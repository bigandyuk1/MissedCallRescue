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

    businessId: {
    type: String,
    required: true,
    default: "keycontrol"
},

    customerName: {
        type: String,
        default: ""
    },

    vehicleRegistration: {
        type: String,
        default: ""
    },

    postcode: {
        type: String,
        default: ""
    },

    serviceRequired: {
        type: String,
        default: ""
    },

    notes: {
        type: String,
        default: ""
    },

    status: {
        type: String,
        enum: ["New", "In Progress", "Completed"],
        default: "New"
    },

    receivedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

module.exports = mongoose.model("Enquiry", enquirySchema);