require("dotenv").config();

const express = require("express");
const twilio = require("twilio");
const mongoose = require("mongoose");
const Enquiry = require("./enquiry");

mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log("[DATABASE] Connected to MongoDB"))
    .catch(error => console.error("[DATABASE ERROR]", error.message));

const app = express();
app.use(express.static("public"));
const PORT = 3100;

app.use(express.urlencoded({ extended: false }));

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioNumber = process.env.TWILIO_PHONE_NUMBER;

const client = twilio(accountSid, authToken);

app.post("/incoming-call", async (req, res) => {
    const caller = req.body.From || "Unknown caller";

    console.log(`[MISSED CALL] Incoming call from: ${caller}`);

    // Respond to the telephone call immediately.
    const response = new twilio.twiml.VoiceResponse();

    response.say(
        { voice: "Polly.Amy", language: "en-GB" },
        "Thanks for calling. We can't answer your call right now. We'll send you a text message shortly."
    );

    response.hangup();

    res.type("text/xml");
    res.send(response.toString());

    // Now attempt the rescue SMS.
    if (caller === "Unknown caller") {
        console.log("[SMS] No caller number available - SMS not sent.");
        return;
    }

    try {
        const message = await client.messages.create({
            body:"KEY CONTROL AUTO LOCKSMITHS: Thanks for calling. We're unable to answer right now. Please reply with your vehicle registration, postcode and what you need help with, and we'll get back to you shortly.",
            from: twilioNumber,
            to: caller
        });

        console.log(`[SMS SENT] ${message.sid} -> ${caller}`);
    } catch (error) {
        console.error(`[SMS FAILED] ${error.code || ""} ${error.message}`);
    }
});

app.post("/incoming-sms", (req, res) => {
    const from = req.body.From || "Unknown";
    const body = req.body.Body || "";
	const enquiry = {
    	caller: from,
    	message: body,
    	receivedAt: new Date().toISOString()
};

    console.log("[ENQUIRY]", enquiry);
    
    Enquiry.create(enquiry)
    .then(savedEnquiry => {
        console.log(`[ENQUIRY SAVED] ${savedEnquiry._id}`);
    })
    .catch(error => {
        console.error("[ENQUIRY SAVE FAILED]", error.message);
    });

    console.log(`[SMS RECEIVED] From: ${from}`);
    console.log(`[SMS BODY] ${body}`);

    const response = new twilio.twiml.MessagingResponse();

    res.type("text/xml");
    res.send(response.toString());
});

app.get("/", (req, res) => {
    res.send("MissedCall Rescue is running.");
});

app.get("/api/enquiries", async (req, res) => {
    try {
        const enquiries = await Enquiry.find().sort({ receivedAt: -1 });
        res.json(enquiries);
    } catch (error) {
        console.error("[ENQUIRIES ERROR]", error.message);
        res.status(500).json({ error: "Unable to retrieve enquiries" });
    }
});

app.listen(PORT, () => {
    console.log(`MissedCall Rescue listening on port ${PORT}`);
});