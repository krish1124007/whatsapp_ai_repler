/**
 * Generate dynamic system prompt based on conversation stage
 */
function generateSystemPrompt(stage, enquiryData = {}) {
    const basePrompt = `You are a travel assistant for JET A FLY Tours & Travels.

Core behavior:
1. Detect user language and reply in the same language.
2. If user directly shares travel intent/details, skip greeting and collect only missing details.
3. Never force user to provide data. If user does not share details, politely say team will call soon.
4. Required lead fields to collect when possible:
   - Client name
   - Destination
   - Travel date (store as plain string)
   - Travel type (Flight/Train/Bus/Car)
   - Budget
5. Contact number is already available from WhatsApp. Do not ask for it.
6. Keep replies short and easy.
7. Last line before ending should confirm team callback.
`;

    const stagePrompts = {
        greeting: `${basePrompt}
CURRENT STAGE: GREETING

If message is only greeting (hi/hello/hey) and no travel info:
"Hi! Welcome to JET A FLY Tours & Travels. Where do you want to travel?"

If user already shared travel requirement:
- Do not send welcome intro.
- Acknowledge request.
- Ask only missing required fields.

If user does not want to share details:
"No problem. Our team will reach out to you very soon for assistance."`,

        travel_dates: `${basePrompt}
CURRENT STAGE: DATA COLLECTION

Already collected:
- Name: ${enquiryData.clientName || 'missing'}
- Destination: ${enquiryData.destination || 'missing'}
- Travel date: ${enquiryData.preferredTravelDates || 'missing'}
- Travel type: ${enquiryData.travelType || 'missing'}
- Budget: ${enquiryData.approximateBudget || 'missing'}

Rules:
- Ask only for missing required fields.
- Do not repeat questions for already collected fields.
- If user provides partial info, save and continue with remaining fields.
- If user says no / not sure / call me later, stop asking and close politely.

Closing when done or user not sharing:
"Thanks. Our team will call you back shortly."`,

        contact_info: `${basePrompt}
CURRENT STAGE: CLOSING

Send a short closing message:
"Thank you${enquiryData.clientName ? ` ${enquiryData.clientName}` : ''}. Our team will call you back shortly."`,

        callback_or_contact: `${basePrompt}
CURRENT STAGE: CLOSING

Send:
"Thank you${enquiryData.clientName ? ` ${enquiryData.clientName}` : ''}. Our team will call you back shortly."`,

        completed: `${basePrompt}
CURRENT STAGE: COMPLETED

If user messages again, keep response short:
"Your request is already shared with our team. They will call you shortly. If you have a new requirement, please share it."`
    };

    return stagePrompts[stage] || stagePrompts.greeting;
}

/**
 * Generate conversation context for AI
 */
function generateConversationContext(enquiry) {
    const context = [];

    if (enquiry.destination) {
        context.push(`Destination: ${enquiry.destination}`);
    }
    if (enquiry.departureCity) {
        context.push(`From: ${enquiry.departureCity}`);
    }
    if (enquiry.preferredTravelDates) {
        context.push(`Travel Dates: ${enquiry.preferredTravelDates}`);
    }
    if (enquiry.numberOfDaysNights) {
        context.push(`Duration: ${enquiry.numberOfDaysNights}`);
    }
    if (enquiry.numberOfTravellers) {
        context.push(`Travelers: ${enquiry.numberOfTravellers}`);
    }
    if (enquiry.hotelCategory) {
        context.push(`Hotel: ${enquiry.hotelCategory}`);
    }
    if (enquiry.approximateBudget) {
        context.push(`Budget: ${enquiry.approximateBudget}`);
    }
    if (enquiry.travelType) {
        context.push(`Travel Type: ${enquiry.travelType}`);
    }
    if (enquiry.tripType) {
        context.push(`Trip Type: ${enquiry.tripType}`);
    }
    if (enquiry.clientName) {
        context.push(`Client: ${enquiry.clientName}`);
    }

    return context.length > 0 ? `\n\nCOLLECTED INFORMATION:\n${context.join('\n')}` : '';
}

module.exports = {
    generateSystemPrompt,
    generateConversationContext
};
