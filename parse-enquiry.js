function parseEnquiry(message) {
    const text = String(message || "").trim();

    const result = {
        vehicleRegistration: "",
        postcode: ""
    };

    // UK vehicle registration
    // Example: WU73 YOT
    const registrationMatch = text.match(
        /\b([A-Z]{2}\d{2}\s?[A-Z]{3})\b/i
    );

    if (registrationMatch) {
        result.vehicleRegistration =
            registrationMatch[1]
                .toUpperCase()
                .replace(
                    /^([A-Z]{2}\d{2})([A-Z]{3})$/,
                    "$1 $2"
                );
    }

    // UK postcode
    // Covers the common UK postcode formats.
    const postcodeMatch = text.match(
        /\b(GIR\s?0AA|[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2})\b/i
    );

    if (postcodeMatch) {
        const postcode = postcodeMatch[1]
            .toUpperCase()
            .replace(/\s+/g, "");

        result.postcode =
            postcode.slice(0, -3) + " " + postcode.slice(-3);
    }

    return result;
}

module.exports = parseEnquiry;