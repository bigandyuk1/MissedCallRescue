require("dotenv").config();

const express = require("express");
const twilio = require("twilio");
const mongoose = require("mongoose");

const Enquiry = require("./enquiry");
const parseEnquiry = require("./parse-enquiry");
const businessConfig = require("./business-config");
const { getBusinessByTwilioNumber } = require("./businesses");


const app = express();
const PORT = 3100;


// --------------------------------------------------
// DATABASE
// --------------------------------------------------

mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log("[DATABASE] Connected to MongoDB"))
    .catch(error =>
        console.error("[DATABASE ERROR]", error.message)
    );


// --------------------------------------------------
// MIDDLEWARE
// --------------------------------------------------

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static("public"));


// --------------------------------------------------
// TWILIO
// --------------------------------------------------

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioNumber = businessConfig.twilioNumber;

const client = twilio(accountSid, authToken);


// --------------------------------------------------
// INCOMING CALL
// --------------------------------------------------

app.post("/incoming-call", async (req, res) => {
    const caller = req.body.From || "Unknown caller";
    const calledNumber = req.body.To;
    const business = getBusinessByTwilioNumber(calledNumber);
    const activeBusiness = business || businessConfig;

    console.log(`[MISSED CALL] Incoming call from: ${caller}`);

    const response = new twilio.twiml.VoiceResponse();

    response.say(
        {
            voice: "Polly.Amy",
            language: "en-GB"
        },
        activeBusiness.voiceMessage
    );

    response.hangup();

    res.type("text/xml");
    res.send(response.toString());

    if (caller === "Unknown caller") {
        console.log(
            "[SMS] No caller number available - SMS not sent."
        );
        return;
    }

    try {
        const message = await client.messages.create({
            body: `${activeBusiness.businessName}: ${activeBusiness.rescueMessage}`,
            from: twilioNumber,
            to: caller
        });

        console.log(
            `[SMS SENT] ${message.sid} -> ${caller}`
        );

    } catch (error) {
        console.error(
            `[SMS FAILED] ${error.code || ""} ${error.message}`
        );
    }
});


// --------------------------------------------------
// INCOMING SMS
// --------------------------------------------------

app.post("/incoming-sms", async (req, res) => {
    const from = req.body.From || "Unknown";
    const body = req.body.Body || "";

    const parsed = parseEnquiry(body);

    const enquiry = {
        caller: from,
        message: body,
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
        const savedEnquiry =
            await Enquiry.create(enquiry);

        console.log(
            `[ENQUIRY SAVED] ${savedEnquiry._id}`
        );

    } catch (error) {
        console.error(
            "[ENQUIRY SAVE FAILED]",
            error.message
        );
    }

    const response =
        new twilio.twiml.MessagingResponse();

    res.type("text/xml");
    res.send(response.toString());
});


// --------------------------------------------------
// GET ENQUIRIES
// --------------------------------------------------

app.get("/api/enquiries", async (req, res) => {
    try {
        const enquiries = await Enquiry.find()
            .sort({ receivedAt: -1 });

        res.json(enquiries);

    } catch (error) {
        console.error(
            "[ENQUIRIES ERROR]",
            error.message
        );

        res.status(500).json({
            error: "Unable to retrieve enquiries"
        });
    }
});


// --------------------------------------------------
// UPDATE ENQUIRY STATUS
// --------------------------------------------------

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

        const enquiry =
            await Enquiry.findByIdAndUpdate(
                req.params.id,
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
        console.error(
            "[STATUS UPDATE ERROR]",
            error.message
        );

        res.status(500).json({
            error: "Unable to update enquiry status"
        });
    }
});


// --------------------------------------------------
// UPDATE ENQUIRY DETAILS
// --------------------------------------------------

app.patch("/api/enquiries/:id", async (req, res) => {
    try {
        const {
            customerName,
            vehicleRegistration,
            postcode,
            serviceRequired,
            notes
        } = req.body;

        const existingEnquiry =
            await Enquiry.findById(req.params.id);

        if (!existingEnquiry) {
            return res.status(404).json({
                error: "Enquiry not found"
            });
        }

        existingEnquiry.customerName =
            customerName;

        existingEnquiry.vehicleRegistration =
            vehicleRegistration;

        existingEnquiry.postcode =
            postcode;

        existingEnquiry.serviceRequired =
            serviceRequired;

        existingEnquiry.notes =
            notes;

        // Once somebody works on a new enquiry,
        // automatically move it into In Progress.
        //
        // Completed enquiries are never reopened
        // simply because their details were edited.

        if (existingEnquiry.status === "New") {
            existingEnquiry.status = "In Progress";
        }

        await existingEnquiry.save();

        res.json(existingEnquiry);

    } catch (error) {
        console.error(
            "[ENQUIRY UPDATE ERROR]",
            error.message
        );

        res.status(500).json({
            error: "Unable to update enquiry"
        });
    }
});


// --------------------------------------------------
// RE-PARSE ENQUIRY
// --------------------------------------------------

app.post("/api/enquiries/:id/reparse", async (req, res) => {
    try {
        const enquiry =
            await Enquiry.findById(req.params.id);

        if (!enquiry) {
            return res.status(404).json({
                error: "Enquiry not found"
            });
        }

        const parsed =
            parseEnquiry(enquiry.message);

        enquiry.customerName =
            parsed.customerName;

        enquiry.vehicleRegistration =
            parsed.vehicleRegistration;

        enquiry.postcode =
            parsed.postcode;

        enquiry.serviceRequired =
            parsed.serviceRequired;

        // Deliberately preserve:
        // - original SMS
        // - notes
        // - status
        // - caller
        // - received time

        await enquiry.save();

        console.log(
            `[ENQUIRY RE-PARSED] ${enquiry._id}`
        );

        res.json(enquiry);

    } catch (error) {
        console.error(
            "[ENQUIRY RE-PARSE ERROR]",
            error.message
        );

        res.status(500).json({
            error: "Unable to re-parse enquiry"
        });
    }
});


// --------------------------------------------------
// START SERVER
// --------------------------------------------------

app.listen(PORT, () => {
    console.log(
        `MissedCall Rescue listening on port ${PORT}`
    );
});