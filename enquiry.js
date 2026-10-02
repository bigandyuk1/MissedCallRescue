const mongoose = require("mongoose");

const enquirySchema = new mongoose.Schema({
    caller: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    },
    receivedAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model("Enquiry", enquirySchema);