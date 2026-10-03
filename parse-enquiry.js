function parseEnquiry(message) {
    const text = String(message || "")
        .trim()
        .replace(/\s+/g, " ");

    const result = {
        customerName: "",
        vehicleRegistration: "",
        postcode: "",
        serviceRequired: ""
    };


    // --------------------------------------------------
    // UK POSTCODE
    // --------------------------------------------------

    const postcodeRegex =
        /\b(GIR\s?0AA|[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2})\b/i;

    const postcodeMatch = text.match(postcodeRegex);

    if (postcodeMatch) {
        const postcode = postcodeMatch[1]
            .toUpperCase()
            .replace(/\s+/g, "");

        result.postcode =
            postcode.slice(0, -3) + " " + postcode.slice(-3);
    }


    // --------------------------------------------------
    // UK VEHICLE REGISTRATION
    // --------------------------------------------------

    const registrationPatterns = [

        // Current format: AB12 CDE
        /\b[A-Z]{2}\d{2}\s?[A-Z]{3}\b/i,

        // Prefix format: A123 BCD
        /\b[A-Z]\d{1,3}\s?[A-Z]{3}\b/i,

        // Suffix format: ABC 123A
        /\b[A-Z]{3}\s?\d{1,3}[A-Z]\b/i,

        // Dateless/private: V8 OVM, 1 ABC, ABC 1
        /\b[A-Z]{1,3}\s?\d{1,4}\s?[A-Z]{1,3}\b/i,
        /\b\d{1,4}\s?[A-Z]{1,3}\b/i,
        /\b[A-Z]{1,3}\s?\d{1,4}\b/i
    ];

    for (const pattern of registrationPatterns) {
        const match = text.match(pattern);

        if (match) {
            result.vehicleRegistration =
                match[0]
                    .toUpperCase()
                    .replace(/\s+/g, " ")
                    .trim();

            break;
        }
    }


    // --------------------------------------------------
    // SERVICE REQUIRED
    // --------------------------------------------------

    const lowerText = text.toLowerCase();

    if (
        /\b(lost|lose|lost my|lost all)\b.*\b(keys?|key)\b/.test(lowerText) ||
        /\b(all keys? lost|no keys?|no key)\b/.test(lowerText)
    ) {
        result.serviceRequired = "All keys lost";
    }

    else if (
        /\b(keys?|key)\b.*\b(inside|in the car|locked in|locked inside)\b/.test(lowerText) ||
        /\blocked out\b/.test(lowerText)
    ) {
        result.serviceRequired = "Vehicle lockout";
    }

    else if (
        /\b(spare|additional|second|extra)\b.*\b(keys?|key)\b/.test(lowerText) ||
        /\b(keys?|key)\b.*\b(spare|additional|second|extra)\b/.test(lowerText)
    ) {
        result.serviceRequired = "Spare key";
    }

    else if (
        /\b(broken|damaged|snapped)\b.*\b(keys?|key)\b/.test(lowerText) ||
        /\b(keys?|key)\b.*\b(broken|damaged|snapped)\b/.test(lowerText)
    ) {
        result.serviceRequired = "Broken or damaged key";
    }

    else if (
        /\b(remote|fob|buttons?)\b.*\b(not working|stopped working|faulty|broken)\b/.test(lowerText)
    ) {
        result.serviceRequired = "Remote / key fob problem";
    }


    // --------------------------------------------------
    // CUSTOMER NAME
    //
    // Remove the things we already understand from the
    // message, then inspect what remains at the beginning.
    // --------------------------------------------------

    let remainingText = text;

    if (postcodeMatch) {
        remainingText =
            remainingText.replace(postcodeMatch[0], " ");
    }

    if (result.vehicleRegistration) {
        const escapedRegistration =
            result.vehicleRegistration.replace(
                /[.*+?^${}()|[\]\\]/g,
                "\\$&"
            );

        remainingText =
            remainingText.replace(
                new RegExp(escapedRegistration, "i"),
                " "
            );
    }

    // Remove common service descriptions.
    remainingText = remainingText
        .replace(/\b(lost all (?:my )?keys?|all keys? lost)\b/gi, " ")
        .replace(/\b(lost (?:my )?keys?)\b/gi, " ")
        .replace(/\b(no keys?|no key)\b/gi, " ")
        .replace(/\b(need|want|require|looking for)\s+(?:a\s+)?spare\s+key\b/gi, " ")
        .replace(/\b(spare key|additional key|second key|extra key)\b/gi, " ")
        .replace(/\b(keys? locked (?:in|inside)(?: the)? car)\b/gi, " ")
        .replace(/\b(locked out)\b/gi, " ")
        .replace(/\b(broken key|damaged key|snapped key)\b/gi, " ")
        .replace(/\s+/g, " ")
        .trim();

    // Whatever sensible alphabetic text remains is a
    // candidate customer name.
    if (
        remainingText &&
        /^[A-Za-z][A-Za-z' -]{1,49}$/.test(remainingText)
    ) {
        result.customerName = remainingText.trim();
    }


    return result;
}

module.exports = parseEnquiry;