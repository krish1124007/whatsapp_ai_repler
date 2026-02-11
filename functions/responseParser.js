/**
 * Parse user responses and extract structured data based on conversation stage
 */

/**
 * Parse destination response
 */
function parseDestination(text) {
    const lowerText = text.toLowerCase();

    if (lowerText.includes('international') || lowerText.includes('abroad') || lowerText.includes('foreign')) {
        return { destination: 'International' };
    } else if (lowerText.includes('domestic') || lowerText.includes('india') || lowerText.includes('within')) {
        return { destination: 'Domestic' };
    }

    // Try to extract specific country/location
    return { destination: text.trim() };
}

/**
 * Parse travel dates
 */
function parseTravelDates(text) {
    return { dates: text.trim() };
}

/**
 * Parse days/nights
 */
function parseDaysNights(text) {
    return { daysNights: text.trim() };
}

/**
 * Parse traveller details
 */
function parseTravellers(text) {
    const travellers = {
        adults: 0,
        children: [],
        infants: 0
    };

    const lowerText = text.toLowerCase();

    // Extract adults
    const adultMatch = lowerText.match(/(\d+)\s*(adult|adults|person|persons|people|pax)/);
    if (adultMatch) {
        travellers.adults = parseInt(adultMatch[1]);
    }

    // Extract children with ages
    const childMatches = text.matchAll(/(\d+)\s*(child|children|kid|kids).*?(\d+)\s*(year|years|yr|yrs)/gi);
    for (const match of childMatches) {
        const age = parseInt(match[3]);
        travellers.children.push({ age });
    }

    // If children mentioned but no age, try to extract count
    if (travellers.children.length === 0) {
        const childCountMatch = lowerText.match(/(\d+)\s*(child|children|kid|kids)/);
        if (childCountMatch) {
            const count = parseInt(childCountMatch[1]);
            for (let i = 0; i < count; i++) {
                travellers.children.push({ age: 0 }); // Age not specified
            }
        }
    }

    // Extract infants
    const infantMatch = lowerText.match(/(\d+)\s*(infant|infants|baby|babies)/);
    if (infantMatch) {
        travellers.infants = parseInt(infantMatch[1]);
    }

    return { travellers };
}

/**
 * Parse departure city
 */
function parseDepartureCity(text) {
    return { city: text.trim() };
}

/**
 * Parse hotel category
 */
function parseHotelCategory(text) {
    const lowerText = text.toLowerCase();

    if (lowerText.includes('budget') || lowerText.includes('cheap') || lowerText.includes('economy')) {
        return { category: 'Budget' };
    } else if (lowerText.includes('5') || lowerText.includes('five') || lowerText.includes('luxury')) {
        return { category: '5 Star' };
    } else if (lowerText.includes('4') || lowerText.includes('four')) {
        return { category: '4 Star' };
    } else if (lowerText.includes('3') || lowerText.includes('three')) {
        return { category: '3 Star' };
    }

    return { category: null };
}

/**
 * Parse room requirements
 */
function parseRoomRequirement(text) {
    return { rooms: text.trim() };
}

/**
 * Parse meal plan
 */
function parseMealPlan(text) {
    const lowerText = text.toLowerCase();

    if (lowerText.includes('all inclusive') || lowerText.includes('all-inclusive')) {
        return { mealPlan: 'All Inclusive' };
    } else if (lowerText.includes('full board') || lowerText.includes('ap') || lowerText.includes('american plan')) {
        return { mealPlan: 'Full Board / AP' };
    } else if (lowerText.includes('half board') || lowerText.includes('map') || lowerText.includes('modified american')) {
        return { mealPlan: 'Half Board / MAP' };
    } else if (lowerText.includes('breakfast') || lowerText.includes('cp') || lowerText.includes('continental')) {
        return { mealPlan: 'Breakfast (CP)' };
    } else if (lowerText.includes('room only') || lowerText.includes('no meal')) {
        return { mealPlan: 'Room Only' };
    }

    return { mealPlan: text.trim() };
}

/**
 * Parse services required
 */
function parseServices(text) {
    const lowerText = text.toLowerCase();

    const services = {
        flights: lowerText.includes('flight') || lowerText.includes('air') || lowerText.includes('ticket'),
        hotels: lowerText.includes('hotel') || lowerText.includes('accommodation') || lowerText.includes('stay'),
        transfers: lowerText.includes('transfer') || lowerText.includes('transport') || lowerText.includes('cab'),
        sightseeing: lowerText.includes('sightseeing') || lowerText.includes('tour') || lowerText.includes('activity'),
        visa: lowerText.includes('visa') || lowerText.includes('passport'),
        travelInsurance: lowerText.includes('insurance') || lowerText.includes('cover')
    };

    // If user says "all" or "everything"
    if (lowerText.includes('all') || lowerText.includes('everything') || lowerText.includes('complete')) {
        return {
            services: {
                flights: true,
                hotels: true,
                transfers: true,
                sightseeing: true,
                visa: true,
                travelInsurance: true
            }
        };
    }

    return { services };
}

/**
 * Parse budget
 */
function parseBudget(text) {
    return { budget: text.trim() };
}

/**
 * Parse trip type
 */
function parseTripType(text) {
    const lowerText = text.toLowerCase();

    if (lowerText.includes('family')) {
        return { tripType: 'Family' };
    } else if (lowerText.includes('honeymoon') || lowerText.includes('couple')) {
        return { tripType: 'Honeymoon' };
    } else if (lowerText.includes('group')) {
        return { tripType: 'Group' };
    } else if (lowerText.includes('corporate') || lowerText.includes('business')) {
        return { tripType: 'Corporate' };
    } else if (lowerText.includes('religious') || lowerText.includes('pilgrimage')) {
        return { tripType: 'Religious' };
    }

    return { tripType: null };
}

/**
 * Parse special requirements
 */
function parseSpecialRequirements(text) {
    const lowerText = text.toLowerCase();

    if (lowerText.includes('none') || lowerText.includes('no') || lowerText.includes('nothing')) {
        return { requirements: 'None' };
    }

    return { requirements: text.trim() };
}

/**
 * Parse passport details
 */
function parsePassportDetails(text) {
    const lowerText = text.toLowerCase();

    if (!lowerText.includes('passport')) {
        return { passport: null };
    }

    if (lowerText.includes('no') || lowerText.includes('don\'t have') || lowerText.includes('not have')) {
        return {
            passport: {
                hasPassport: false,
                passportNumber: null,
                expiryDate: null
            }
        };
    }

    // Try to extract passport number and expiry
    const passportMatch = text.match(/([A-Z]\d{7})/);
    const expiryMatch = text.match(/(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/);

    return {
        passport: {
            hasPassport: true,
            passportNumber: passportMatch ? passportMatch[1] : text.trim(),
            expiryDate: expiryMatch ? expiryMatch[1] : null
        }
    };
}

/**
 * Parse contact information
 */
function parseContactInfo(text) {
    const contactInfo = {
        name: null,
        phone: null,
        email: null
    };

    // Extract email
    const emailMatch = text.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/);
    if (emailMatch) {
        contactInfo.email = emailMatch[1];
    }

    // Extract phone number
    const phoneMatch = text.match(/(\+?\d{1,3}[-.\s]?\d{10}|\d{10})/);
    if (phoneMatch) {
        contactInfo.phone = phoneMatch[1];
    }

    // Extract name (everything before phone/email or first line)
    let nameText = text;
    if (phoneMatch) {
        nameText = text.substring(0, text.indexOf(phoneMatch[0]));
    } else if (emailMatch) {
        nameText = text.substring(0, text.indexOf(emailMatch[0]));
    }

    // Clean up name
    contactInfo.name = nameText
        .replace(/[,\n]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    return contactInfo;
}

/**
 * Parse callback preference
 */
function parseCallbackPreference(text) {
    const lowerText = text.toLowerCase();

    if (lowerText.includes('option 1') || lowerText.includes('call') || lowerText.includes('talk')) {
        return { wantsCallback: false, preferredTime: null };
    } else if (lowerText.includes('option 2') || lowerText.includes('callback') || lowerText.includes('call back')) {
        // Try to extract time
        const timeMatch = text.match(/(\d{1,2}:\d{2}|morning|afternoon|evening|asap|now|today|tomorrow)/i);
        return {
            wantsCallback: true,
            preferredTime: timeMatch ? timeMatch[0] : 'ASAP'
        };
    }

    return { wantsCallback: true, preferredTime: text.trim() || 'ASAP' };
}

/**
 * Parse comprehensive response with all travel details
 */
function parseComprehensiveResponse(text) {
    const result = {
        dates: null,
        daysNights: null,
        travellers: null,
        city: null,
        destination: null,
        category: null,
        rooms: null,
        mealPlan: null,
        services: null,
        budget: null,
        tripType: null,
        requirements: null,
        passport: null,
        name: null,
        email: null,
        travelType: null
    };

    // Parse source and destination cities (e.g., "Ahmedabad to Delhi", "from Mumbai to Goa")
    const cityPatterns = [
        /(?:from\s+)?([A-Za-z\s]+?)\s+to\s+([A-Za-z\s]+?)(?:\s|,|\.|\n|$)/i,
        /(?:book|trip|travel).*?(?:from\s+)?([A-Za-z\s]+?)\s+to\s+([A-Za-z\s]+?)(?:\s|,|\.|\n|$)/i
    ];

    for (const pattern of cityPatterns) {
        const match = text.match(pattern);
        if (match) {
            result.city = match[1].trim(); // Departure city
            result.destination = match[2].trim(); // Destination
            console.log(`🏙️ Extracted cities: ${result.city} → ${result.destination}`);

            // Check if international based on common international destinations
            const internationalKeywords = ['dubai', 'singapore', 'thailand', 'bali', 'maldives', 'paris',
                'london', 'new york', 'malaysia', 'sri lanka', 'nepal', 'bhutan'];
            const destLower = result.destination.toLowerCase();
            const isInternational = internationalKeywords.some(keyword => destLower.includes(keyword));

            if (isInternational) {
                result.destination = 'International - ' + result.destination;
            } else {
                result.destination = 'Domestic - ' + result.destination;
            }
            break;
        }
    }

    // If no "from-to" pattern, try to extract just destination
    if (!result.destination) {
        const destPatterns = [
            /(?:to|visit|going to|travelling to)\s+([A-Za-z\s]+?)(?:\s|,|\.|\n|$)/i,
            /(?:destination|place)[\s:]+([A-Za-z\s]+?)(?:\s|,|\.|\n|$)/i
        ];
        for (const pattern of destPatterns) {
            const match = text.match(pattern);
            if (match) {
                result.destination = match[1].trim();
                break;
            }
        }
    }

    // Parse travel dates
    const datePatterns = [
        /(?:dates?|travel|from|between)[\s:]*([0-9]{1,2}[-\/][0-9]{1,2}[-\/][0-9]{2,4}.*?to.*?[0-9]{1,2}[-\/][0-9]{1,2}[-\/][0-9]{2,4})/i,
        /([0-9]{1,2}[-\/][0-9]{1,2}[-\/][0-9]{2,4}.*?to.*?[0-9]{1,2}[-\/][0-9]{1,2}[-\/][0-9]{2,4})/i,
        /(?:dates?|travel)[\s:]*(.+?)(?:\n|$)/i
    ];
    for (const pattern of datePatterns) {
        const match = text.match(pattern);
        if (match) {
            result.dates = match[1].trim();
            break;
        }
    }

    // Parse days/nights
    const daysMatch = text.match(/(\d+)\s*days?\s*[\/\-]?\s*(\d+)\s*nights?/i);
    if (daysMatch) {
        result.daysNights = `${daysMatch[1]} days / ${daysMatch[2]} nights`;
    }

    // Parse travellers
    const travellerData = parseTravellers(text);
    if (travellerData.travellers) {
        result.travellers = travellerData.travellers;
    }

    // Parse departure city (if not already extracted from "from-to" pattern)
    if (!result.city) {
        const cityPatterns = [
            /(?:departure|from|leaving from|city)[\s:]*([A-Za-z\s]+?)(?:\n|,|\d|$)/i,
            /(?:departing from)[\s:]*([A-Za-z\s]+?)(?:\n|,|\d|$)/i
        ];
        for (const pattern of cityPatterns) {
            const match = text.match(pattern);
            if (match) {
                result.city = match[1].trim();
                break;
            }
        }
    }

    // Parse hotel category only when explicitly present
    const hotelData = parseHotelCategory(text);
    result.category = hotelData.category;

    // Parse rooms
    const roomMatch = text.match(/(\d+)\s*(room|rooms|double|single)/i);
    if (roomMatch) {
        result.rooms = roomMatch[0].trim();
    }

    // Parse meal plan only when keywords are present
    if (/(all inclusive|all-inclusive|full board|american plan|half board|modified american|breakfast|continental plan|room only|no meal|meal plan)/i.test(text)) {
        const mealData = parseMealPlan(text);
        result.mealPlan = mealData.mealPlan;
    }

    // Parse services
    const servicesData = parseServices(text);
    const hasServiceKeyword = /(flight|air|ticket|hotel|accommodation|stay|transfer|transport|cab|sightseeing|tour|activity|visa|insurance|all|everything|complete)/i.test(text);
    if (hasServiceKeyword && servicesData.services) {
        result.services = servicesData.services;
    }

    // Parse budget
    const budgetPatterns = [
        /(?:budget|price|cost)[\s:]*(?:rs\.?|inr|₹)?\s*(\d+[,\d]*)/i,
        /(?:rs\.?|inr|₹)\s*(\d+[,\d]*)/i,
        /(\d+[,\d]*)\s*(?:rs\.?|inr|rupees)/i
    ];
    for (const pattern of budgetPatterns) {
        const match = text.match(pattern);
        if (match) {
            result.budget = match[1].replace(/,/g, '') + ' INR';
            break;
        }
    }

    // Parse trip type only when recognized
    const tripData = parseTripType(text);
    result.tripType = tripData.tripType;

    // Parse special requirements
    const reqMatch = text.match(/(?:special|requirements?|preferences?)[\s:]*(.+?)(?:\n\n|\d+\.|$)/is);
    if (reqMatch) {
        result.requirements = reqMatch[1].trim();
    }

    // Parse passport details if present
    const passportData = parsePassportDetails(text);
    result.passport = passportData.passport;

    // Parse name with explicit self-introduction patterns
    const nameMatch = text.match(
        /(?:my name is|i am|i'm|name\s*[:\-])\s*([A-Za-z][A-Za-z\s]{1,40})/i
    );
    if (nameMatch) {
        result.name = nameMatch[1].trim();
    }
    const emailMatch = text.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/);
    if (emailMatch) result.email = emailMatch[1];

    // Parse simple travel type preference (mode of travel)
    const lowerText = text.toLowerCase();
    if (lowerText.includes('flight') || lowerText.includes('plane') || lowerText.includes('air')) {
        result.travelType = 'Flight';
    } else if (lowerText.includes('train') || lowerText.includes('rail')) {
        result.travelType = 'Train';
    } else if (lowerText.includes('bus') || lowerText.includes('coach')) {
        result.travelType = 'Bus';
    } else if (lowerText.includes('car') || lowerText.includes('cab') || lowerText.includes('taxi')) {
        result.travelType = 'Car';
    }

    // Capture loose date-like travel text if strict patterns miss
    if (!result.dates) {
        const looseDateMatch = text.match(
            /(?:on|from|between|date|dates|travel date|journey)\s*[:\-]?\s*([A-Za-z0-9,\-\/ ]{4,50})/i
        );
        if (looseDateMatch) {
            result.dates = looseDateMatch[1].trim();
        }
    }

    return result;
}

/**
 * Main parser function
 */
function parseUserResponse(stage, text) {
    switch (stage) {
        case 'greeting':
            return parseComprehensiveResponse(text);
        case 'destination':
            return parseDestination(text);

        case 'travel_dates':
            // Parse basic trip details (destination, dates, days, travellers, hotel, rooms)
            return parseComprehensiveResponse(text);

        case 'hotel_details':
            // Parse meal plan and services
            const mealData = parseMealPlan(text);
            const servicesData = parseServices(text);
            return {
                mealPlan: mealData.mealPlan,
                services: servicesData.services
            };

        case 'budget_triptype':
            // Parse budget, trip type, requirements, passport
            const budgetMatch = text.match(/(?:budget|price|cost)[\s:]*(?:rs\.?|inr|₹)?\s*(\d+[,\d]*)/i) ||
                text.match(/(?:rs\.?|inr|₹)\s*(\d+[,\d]*)/i) ||
                text.match(/(\d+[,\d]*)\s*(?:rs\.?|inr|rupees)/i);
            const tripTypeData = parseTripType(text);
            const passportData = parsePassportDetails(text);

            return {
                budget: budgetMatch ? budgetMatch[1].replace(/,/g, '') + ' INR' : null,
                tripType: tripTypeData.tripType,
                requirements: text.includes('None') || text.includes('none') ? 'None' :
                    (text.match(/(?:requirements?|special|preferences?)[\s:]*(.+?)(?:\n|passport|budget|$)/is)?.[1]?.trim() || null),
                passport: passportData.passport
            };

        case 'days_nights':
            return parseDaysNights(text);

        case 'travellers':
            return parseTravellers(text);

        case 'departure_city':
            return parseDepartureCity(text);

        case 'hotel_category':
            return parseHotelCategory(text);

        case 'room_requirement':
            return parseRoomRequirement(text);

        case 'meal_plan':
            return parseMealPlan(text);

        case 'services':
            return parseServices(text);

        case 'budget':
            return parseBudget(text);

        case 'trip_type':
            return parseTripType(text);

        case 'special_requirements':
            return parseSpecialRequirements(text);

        case 'passport_details':
            return parsePassportDetails(text);

        case 'contact_info':
            return parseContactInfo(text);

        case 'callback_or_contact':
            return parseCallbackPreference(text);

        default:
            return { rawText: text };
    }
}

/**
 * Detect if user wants to end the conversation
 * This should be conservative to avoid false positives
 */
function isUserDisinterested(text, conversationHistory = []) {
    const lowerText = text.toLowerCase().trim();

    // Strong dismissive phrases that clearly indicate wanting to end
    const strongDisinterest = [
        'not interested',
        'don\'t want',
        'do not want',
        'call me back',
        'call back me',
        'leave me alone',
        'stop messaging',
        'stop asking',
        'too many questions',
        'stop bothering'
    ];

    if (strongDisinterest.some(phrase => lowerText.includes(phrase))) {
        return true;
    }

    // Explicit exit words (but not if they're answering a specific question)
    const exitWords = ['bye', 'goodbye', 'stop', 'cancel', 'exit', 'quit'];
    if (exitWords.includes(lowerText)) {
        return true;
    }

    // Multiple consecutive short dismissive responses suggest disinterest
    // Check if the last 2-3 messages from user were all very short and dismissive
    if (conversationHistory.length >= 4) {
        const recentUserMessages = conversationHistory
            .filter(msg => msg.role === 'user')
            .slice(-3)
            .map(msg => msg.content.toLowerCase().trim());

        const shortDismissive = ['no', 'nope', 'nah', 'ok', 'k'];
        const dismissiveCount = recentUserMessages.filter(msg =>
            shortDismissive.includes(msg) || msg.length < 5
        ).length;

        // If 2+ of the last 3 messages are dismissive AND current is also dismissive
        if (dismissiveCount >= 2 && shortDismissive.includes(lowerText)) {
            return true;
        }
    }

    return false;
}

module.exports = {
    parseUserResponse,
    parseDestination,
    parseTravellers,
    parseServices,
    parseContactInfo,
    parseCallbackPreference,
    parseComprehensiveResponse,
    isUserDisinterested
};
