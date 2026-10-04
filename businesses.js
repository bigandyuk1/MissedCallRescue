const keyControl = require("./business-config");

const businesses = {
    keycontrol: keyControl
};
function getBusinessByTwilioNumber(number) {
    return Object.values(businesses).find(
        business => business.twilioNumber === number
    );
}
module.exports = {
    businesses,
    getBusinessByTwilioNumber
};

