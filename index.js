
require("dotenv").config();

const express = require("express");
const twilio = require("twilio");
const mongoose = require("mongoose");
const path = require("path");

const Enquiry = require("./enquiry");
const parseEnquiry = require("./parse-enquiry");
const businessConfig = require("./business-config");
const { getBusinessByTwilioNumber } = require("./businesses");
const { configureAuthentication, requireLogin, requireSameOrigin } = require("./auth");

const app = express();
const PORT = 3100;

// DATABASE
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log("[DATABASE] Connected to MongoDB"))
    .catch(error => console.error("[DATABASE ERROR]", error.message));

// MIDDLEWARE
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

configureAuthentication(app);

// DASHBOARD ACCESS
app.get("/index.html", (req, res) => {
    if (!req.session?.user) {
        return res.redirect("/login.html");
    }

    res.redirect("/");
});

app.get("/", (req, res) => {
    if (!req.session?.user) {
        return res.redirect("/login.html");
    }

    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Require login for every enquiry API route.
app.use("/api", requireLogin, requireSameOrigin);

// Public assets, but never serve the dashboard anonymously.
app.use(express.static(path.join(__dirname, "public"), {
    index: false
}));

// TWILIO
const client = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
);

// TWILIO WEBHOOK SIGNATURE VERIFICATION
// Twilio signs the public HTTPS URL, not localhost.

const PUBLIC_WEBHOOK_BASE = "https://api.missedcallrescue.uk";

if (!process.env.TWILIO_AUTH_TOKEN) {
    throw new Error("TWILIO_AUTH_TOKEN is required");
}

function verifyTwilioWebhook(route) {
    return twilio.webhook({
        validate: true,
        url: `${PUBLIC_WEBHOOK_BASE}${route}`
    });
}

// HUMAN TRANSFER TEST
app.post("/test-human-transfer", verifyTwilioWebhook("/test-human-transfer"), (req, res) => {
    const response = new twilio.twiml.VoiceResponse();

    response.say(
        { voice: "Polly.Amy", language: "en-GB" },
        "Please hold while I connect you to a member of our team."
    );

    const dial = response.dial({
        timeout: 20,
        answerOnBridge: true,
        action: "/human-transfer-result",
        method: "POST"
    });

    dial.number(process.env.HUMAN_TRANSFER_NUMBER);

    res.type("text/xml");
    res.send(response.toString());
});

app.post("/human-transfer-result", verifyTwilioWebhook("/human-transfer-result"), (req, res) => {
    const response = new twilio.twiml.VoiceResponse();

    if (req.body.DialCallStatus !== "completed") {
        response.say(
            { voice: "Polly.Amy", language: "en-GB" },
            "Sorry, nobody is available right now. We'll arrange for someone to call you back."
        );
    }

    response.hangup();
    res.type("text/xml");
    res.send(response.toString());
});

// INCOMING CALL
app.post("/incoming-call", verifyTwilioWebhook("/incoming-call"), async (req, res) => {
    const caller = req.body.From || "Unknown caller";
    const calledNumber = req.body.To;

    const business = getBusinessByTwilioNumber(calledNumber);
    const activeBusiness = business || businessConfig;

    console.log(
        `[MISSED CALL] ${activeBusiness.businessId} - ${caller}`
    );

    const response = new twilio.twiml.VoiceResponse();

    response.say(
        { voice: "Polly.Amy", language: "en-GB" },
        activeBusiness.voiceMessage
    );

    response.pause({ length: 1 });
    response.hangup();

    res.type("text/xml");
    res.send(response.toString());

    if (caller === "Unknown caller") {
        console.log("[SMS] No caller number available - SMS not sent.");
        return;
    }

    try {
        const message = await client.messages.create({
            body:
                `${activeBusiness.businessName}: ` +
                `${activeBusiness.rescueMessage}`,
            from: activeBusiness.twilioNumber,
            to: caller
        });

        console.log(`[SMS SENT] ${message.sid} -> ${caller}`);
    } catch (error) {
        console.error(
            `[SMS FAILED] ${error.code || ""} ${error.message}`
        );
    }
});

// INCOMING SMS
app.post("/incoming-sms", verifyTwilioWebhook("/incoming-sms"), async (req, res) => {
    const from = req.body.From || "Unknown";
    const body = req.body.Body || "";
    const receivedNumber = req.body.To;

    const business = getBusinessByTwilioNumber(receivedNumber);
    const activeBusiness = business || businessConfig;
    const parsed = parseEnquiry(body);

    const enquiry = {
        caller: from,
        message: body,
        businessId: activeBusiness.businessId,
        customerName: parsed.customerName,
        vehicleRegistration: parsed.vehicleRegistration,
        postcode: parsed.postcode,
        serviceRequired: parsed.serviceRequired,
        receivedAt: new Date()
    };

    console.log("[ENQUIRY]", enquiry);
    console.log(`[SMS RECEIVED] From: ${from}`);
    console.log(`[SMS BODY] ${body}`);

    try {
        const savedEnquiry = await Enquiry.create(enquiry);
        console.log(`[ENQUIRY SAVED] ${savedEnquiry._id}`);
    } catch (error) {
        console.error("[ENQUIRY SAVE FAILED]", error.message);
    }

    const response = new twilio.twiml.MessagingResponse();
    res.type("text/xml");
    res.send(response.toString());
});

// TENANT OWNERSHIP
// Never accept a business ID from the browser.
function enquiryFilter(req) {
    const businessId = req.session.user.businessId;

    if (businessId === "keycontrol") {
        return {
            $or: [
                { businessId: "keycontrol" },
                { businessId: { $exists: false } }
            ]
        };
    }

    return { businessId };
}

function enquiryById(req) {
    return {
        $and: [
            { _id: req.params.id },
            enquiryFilter(req)
        ]
    };
}

// GET ENQUIRIES
app.get("/api/enquiries", async (req, res) => {
    try {
        const enquiries = await Enquiry.find(enquiryFilter(req))
            .sort({ receivedAt: -1 });

        res.json(enquiries);
    } catch (error) {
        console.error("[ENQUIRIES ERROR]", error.message);
        res.status(500).json({
            error: "Unable to retrieve enquiries"
        });
    }
});

// UPDATE ENQUIRY STATUS
app.patch("/api/enquiries/:id/status", async (req, res) => {
    try {
        const allowedStatuses = [
            "New",
            "In Progress",
            "Completed"
        ];

        const { status } = req.body;

        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({
                error: "Invalid enquiry status"
            });
        }

        const enquiry = await Enquiry.findOneAndUpdate(
            enquiryById(req),
            { status },
            {
                returnDocument: "after",
                runValidators: true
            }
        );

        if (!enquiry) {
            return res.status(404).json({
                error: "Enquiry not found"
            });
        }

        res.json(enquiry);
    } catch (error) {
        console.error("[STATUS UPDATE ERROR]", error.message);
        res.status(500).json({
            error: "Unable to update enquiry status"
        });
    }
});

// UPDATE ENQUIRY DETAILS
app.patch("/api/enquiries/:id", async (req, res) => {
    try {
        const {
            customerName,
            vehicleRegistration,
            postcode,
            serviceRequired,
            notes
        } = req.body;

        const existingEnquiry = await Enquiry.findOne(
            enquiryById(req)
        );

        if (!existingEnquiry) {
            return res.status(404).json({
                error: "Enquiry not found"
            });
        }

        existingEnquiry.customerName = customerName;
        existingEnquiry.vehicleRegistration = vehicleRegistration;
        existingEnquiry.postcode = postcode;
        existingEnquiry.serviceRequired = serviceRequired;
        existingEnquiry.notes = notes;

        if (existingEnquiry.status === "New") {
            existingEnquiry.status = "In Progress";
        }

        await existingEnquiry.save();
        res.json(existingEnquiry);
    } catch (error) {
        console.error("[ENQUIRY UPDATE ERROR]", error.message);
        res.status(500).json({
            error: "Unable to update enquiry"
        });
    }
});

// RE-PARSE ENQUIRY
app.post("/api/enquiries/:id/reparse", async (req, res) => {
    try {
        const enquiry = await Enquiry.findOne(enquiryById(req));

        if (!enquiry) {
            return res.status(404).json({
                error: "Enquiry not found"
            });
        }

        const parsed = parseEnquiry(enquiry.message);

        enquiry.customerName = parsed.customerName;
        enquiry.vehicleRegistration = parsed.vehicleRegistration;
        enquiry.postcode = parsed.postcode;
        enquiry.serviceRequired = parsed.serviceRequired;

        // Preserve original SMS, notes, status,
        // caller, received time and business ownership.
        await enquiry.save();

        console.log(`[ENQUIRY RE-PARSED] ${enquiry._id}`);
        res.json(enquiry);
    } catch (error) {
        console.error("[ENQUIRY RE-PARSE ERROR]", error.message);
        res.status(500).json({
            error: "Unable to re-parse enquiry"
        });
    }
});

// ARCHIVE ENQUIRY
app.patch("/api/enquiries/:id/archive", async (req, res) => {
    try {
        const enquiry = await Enquiry.findOneAndUpdate(
            enquiryById(req),
            {
                archived: true,
                archivedAt: new Date()
            },
            {
                returnDocument: "after",
                runValidators: true
            }
        );

        if (!enquiry) {
            return res.status(404).json({
                error: "Enquiry not found"
            });
        }

        res.json(enquiry);
    } catch (error) {
        console.error("[ARCHIVE ERROR]", error.message);
        res.status(500).json({
            error: "Unable to archive enquiry"
        });
    }
});

// RESTORE ARCHIVED ENQUIRY
app.patch("/api/enquiries/:id/restore", async (req, res) => {
    try {
        const enquiry = await Enquiry.findOneAndUpdate(
            enquiryById(req),
            {
                archived: false,
                archivedAt: null
            },
            {
                returnDocument: "after",
                runValidators: true
            }
        );

        if (!enquiry) {
            return res.status(404).json({
                error: "Enquiry not found"
            });
        }

        res.json(enquiry);
    } catch (error) {
        console.error("[RESTORE ERROR]", error.message);

        res.status(500).json({
            error: "Unable to restore enquiry"
        });
    }
});

// PERMANENTLY DELETE ARCHIVED ENQUIRY
app.delete("/api/enquiries/:id", async (req, res) => {
    try {
        if (req.session.user.role !== "admin") {
            return res.status(403).json({
                error: "Administrator access required"
            });
        }

        const enquiry = await Enquiry.findOneAndDelete({
            $and: [
                enquiryById(req),
                { archived: true }
            ]
        });

        if (!enquiry) {
            return res.status(404).json({
                error: "Archived enquiry not found"
            });
        }

        console.log(`[ENQUIRY DELETED] ${enquiry._id}`);

        res.json({ success: true });
    } catch (error) {
        console.error("[DELETE ERROR]", error.message);

        res.status(500).json({
            error: "Unable to delete enquiry"
        });
    }
});


// START SERVER
app.listen(PORT, () => {
    console.log(`MissedCall Rescue listening on port ${PORT}`);
});
