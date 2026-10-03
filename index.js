require("dotenv").config();

const express = require("express");
const twilio = require("twilio");
const mongoose = require("mongoose");
const Enquiry = require("./enquiry");
const parseEnquiry = require("./parse-enquiry");

mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log("[DATABASE] Connected to MongoDB"))
    .catch(error => console.error("[DATABASE ERROR]", error.message));

const app = express();
const PORT = 3100;

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static("public"));

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioNumber = process.env.TWILIO_PHONE_NUMBER;

const client = twilio(accountSid, authToken);


// --------------------------------------------------
// INCOMING CALL
// --------------------------------------------------

app.post("/incoming-call", async (req, res) => {
    const caller = req.body.From || "Unknown caller";

    console.log(`[MISSED CALL] Incoming call from: ${caller}`);

    const response = new twilio.twiml.VoiceResponse();

    response.say(
        { voice: "Polly.Amy", language: "en-GB" },
        "Thanks for calling. We can't answer your call right now. We'll send you a text message shortly."
    );

    response.hangup();

    res.type("text/xml");
    res.send(response.toString());

    if (caller === "Unknown caller") {
        console.log("[SMS] No caller number available - SMS not sent.");
        return;
    }

    try {
        const message = await client.messages.create({
            body: "KEY CONTROL AUTO LOCKSMITHS: Thanks for calling. We're unable to answer right now. Please reply with your vehicle registration, postcode and what you need help with, and we'll get back to you shortly.",
            from: twilioNumber,
            to: caller
        });

        console.log(`[SMS SENT] ${message.sid} -> ${caller}`);

    } catch (error) {
        console.error(`[SMS FAILED] ${error.code || ""} ${error.message}`);
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


// --------------------------------------------------
// ENQUIRY API
// --------------------------------------------------

app.get("/api/enquiries", async (req, res) => {
    try {
        const enquiries = await Enquiry.find()
            .sort({ receivedAt: -1 });

        res.json(enquiries);

    } catch (error) {
        console.error("[ENQUIRIES ERROR]", error.message);

        res.status(500).json({
            error: "Unable to retrieve enquiries"
        });
    }
});


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

        const enquiry = await Enquiry.findByIdAndUpdate(
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

        const enquiry = await Enquiry.findByIdAndUpdate(
            req.params.id,
            {
                customerName,
                vehicleRegistration,
                postcode,
                serviceRequired,
                notes
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
// START SERVER
// --------------------------------------------------

app.listen(PORT, () => {
    console.log(
        `MissedCall Rescue listening on port ${PORT}`
    );
});