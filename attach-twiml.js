const twilio = require("twilio");

const client = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
);

client.incomingPhoneNumbers("PN4f456e567705dc9e6982fc1f9b4b1fcd")
    .update({
        voiceApplicationSid: "APff964a241f8330f6f2f1b1ea75f4eeae"
    })
    .then(number => {
        console.log("SUCCESS");
        console.log("Number:", number.phoneNumber);
        console.log("Voice App SID:", number.voiceApplicationSid);
    })
    .catch(error => {
        console.error("ERROR:", error.code, error.message);
    });