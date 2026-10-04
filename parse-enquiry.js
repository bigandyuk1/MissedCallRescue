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
    //
    // Detect postcode first. Once found, remove it from
    // the text used for vehicle registration detection.
    //
    // This prevents a postcode such as BS37 8UP from
    // also being interpreted as a private registration.
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

    let textForRegistration = text;

    if (postcodeMatch) {
        textForRegistration =
            textForRegistration.replace(postcodeMatch[0], " ");
    }

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
        
    ];

    let registrationMatch = null;

    for (const pattern of registrationPatterns) {
        const match = textForRegistration.match(pattern);

        if (match) {
            registrationMatch = match;

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
        /\b(keys?|key)\b.*\b(spare|additional|second|extra)\b/.test(lowerText) ||
        /\bnew style key\b/.test(lowerText)
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
    // --------------------------------------------------

    let remainingText = text;

    if (postcodeMatch) {
        remainingText =
            remainingText.replace(postcodeMatch[0], " ");
    }

    if (registrationMatch) {
        remainingText =
            remainingText.replace(registrationMatch[0], " ");
    }

    // Remove common service descriptions.
    remainingText = remainingText
        .replace(/\b(lost all (?:my )?keys?|all keys? lost)\b/gi, " ")
        .replace(/\b(lost (?:my )?keys?)\b/gi, " ")
        .replace(/\b(no keys?|no key)\b/gi, " ")
        .replace(/\b(need|want|require|looking for)\s+(?:a\s+)?spare\s+key\b/gi, " ")
        .replace(/\b(spare key|additional key|second key|extra key)\b/gi, " ")
        .replace(/\b(want|need|require|looking for)\s+(?:a\s+)?new style key\b/gi, " ")
        .replace(/\bnew style key\b/gi, " ")
        .replace(/\b(keys? locked (?:in|inside)(?: the)? car)\b/gi, " ")
        .replace(/\blocked out\b/gi, " ")
        .replace(/\b(broken key|damaged key|snapped key)\b/gi, " ")
        .replace(/\s+/g, " ")
        .trim();


    // --------------------------------------------------
    // NAME EXTRACTION
    //
    // A customer's name often appears before the vehicle
    // description, e.g.
    //
    // Rocccus Toyota RAV4 2023 BS37 8UP Want new style key
    // --------------------------------------------------

    const vehicleWords =
        /\b(Toyota|Ford|Vauxhall|Volkswagen|VW|Audi|BMW|Mercedes|Nissan|Renault|Peugeot|Citroen|Fiat|Kia|Hyundai|Honda|Suzuki|Mazda|Volvo|Skoda|Seat|Jeep|Land Rover|Range Rover)\b/i;

    const vehicleWordMatch = remainingText.match(vehicleWords);

    if (vehicleWordMatch && vehicleWordMatch.index > 0) {
        const possibleName =
            remainingText
                .slice(0, vehicleWordMatch.index)
                .trim();

        if (
            possibleName &&
            /^[A-Za-z][A-Za-z' -]{1,49}$/.test(possibleName)
        ) {
            result.customerName = possibleName;
        }
    }

    else if (
        remainingText &&
        /^[A-Za-z][A-Za-z' -]{1,49}$/.test(remainingText)
    ) {
        result.customerName = remainingText.trim();
    }


    return result;
}

module.exports = parseEnquiry;