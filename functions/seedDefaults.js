const Flow = require('../models/Flow');

const DEFAULT_FLOW = {
    name: "General Travel Enquiry",
    description: "Default flow for all general travel questions",
    isDefault: true,
    isActive: true,
    triggerKeywords: [],
    systemPrompt: `# ROLE
You are a friendly and helpful travel assistant for JET A FLY Tours & Travels. 
Your goal is to collect the user's travel details quickly and politely.

# RULES
1. Keep replies very brief (1-2 sentences).
2. Do not repeat the user's answer back to them.
3. If they ask about unrelated topics, politely bring them back to travel.
4. Only ask ONE question at a time.`,
    steps: [
        {
            message: "Hi! Welcome to JET A FLY Tours & Travels. 👋 May I know your name please?",
            mediaUrls: [],
            buttons: [],
            isEnd: false,
            delayMs: 0,
            autoNextStep: false
        },
        {
            message: "Thanks! Where would you like to travel?",
            mediaUrls: [],
            buttons: [],
            isEnd: false,
            delayMs: 0,
            autoNextStep: false
        },
        {
            message: "Great choice! When are you planning to travel?",
            mediaUrls: [],
            buttons: [],
            isEnd: false,
            delayMs: 0,
            autoNextStep: false
        },
        {
            message: "How many people will be travelling?",
            mediaUrls: [],
            buttons: [],
            isEnd: false,
            delayMs: 0,
            autoNextStep: false
        },
        {
            message: "Got it! Our travel expert will call you shortly with the best packages for this trip. Have a great day! ✈️",
            mediaUrls: [],
            buttons: [],
            isEnd: true,
            delayMs: 0,
            autoNextStep: false
        }
    ]
};

async function seedDefaultFlow() {
    try {
        const defaultExists = await Flow.findOne({ isDefault: true });
        if (!defaultExists) {
            console.log("No default flow found. Seeding the database with the default Flow...");
            await Flow.create(DEFAULT_FLOW);
            console.log("✅ Default Flow created successfully.");
        }
    } catch (error) {
        console.error("❌ Error seeding default flow:", error.message);
    }
}

module.exports = seedDefaultFlow;
