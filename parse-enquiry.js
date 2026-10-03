function parseEnquiry(message) {
    const text = String(message || "").trim();

    const result = {
        vehicleRegistration: "",
        postcode: "",
        serviceRequired: ""
    };

    // --------------------------------------------------
    // UK VEHICLE REGISTRATION
    // Example: WU73 YOT
    // --------------------------------------------------

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


    // --------------------------------------------------
    // UK POSTCODE
    // --------------------------------------------------

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


    // --------------------------------------------------
    // SERVICE REQUIRED
    // --------------------------------------------------

    const lowerText = text.toLowerCase();

    // All keys lost
    if (
        /\b(lost|lose|lost my|lost all)\b.*\b(keys?|key)\b/.test(lowerText) ||
        /\b(all keys? lost|no keys?|no key)\b/.test(lowerText)
    ) {
        result.serviceRequired = "All keys lost";
    }

    // Keys locked inside vehicle
    else if (
        /\b(keys?|key)\b.*\b(inside|in the car|locked in|locked inside)\b/.test(lowerText) ||
        /\blocked out\b/.test(lowerText)
    ) {
        result.serviceRequired = "Vehicle lockout";
    }

    // Spare / additional key
    else if (
        /\b(spare|additional|second|extra)\b.*\b(keys?|key)\b/.test(lowerText) ||
        /\b(keys?|key)\b.*\b(spare|additional|second|extra)\b/.test(lowerText)
    ) {
        result.serviceRequired = "Spare key";
    }

    // Broken / damaged key
    else if (
        /\b(broken|damaged|snapped)\b.*\b(keys?|key)\b/.test(lowerText) ||
        /\b(keys?|key)\b.*\b(broken|damaged|snapped)\b/.test(lowerText)
    ) {
        result.serviceRequired = "Broken or damaged key";
    }

    // Remote / buttons not working
    else if (
        /\b(remote|fob|buttons?)\b.*\b(not working|stopped working|faulty|broken)\b/.test(lowerText)
    ) {
        result.serviceRequired = "Remote / key fob problem";
    }

    return result;
}

module.exports = parseEnquiry;