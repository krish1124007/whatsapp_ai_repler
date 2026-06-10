const express = require('express');
const router = express.Router();
const BotConfig = require('../models/BotConfig');
const { authMiddleware } = require('../middleware/auth.cjs');

router.use(authMiddleware);

/* ── Default seeds ─────────────────────────────────────
   These are inserted the FIRST TIME the route is hit if no configs exist.
   Admins can then edit them freely.
───────────────────────────────────────────────────────── */
const DEFAULT_FLOWS = [
    {
        flowKey: 'default',
        flowName: 'Default Flow (All Travel)',
        description: 'Main flow used for all conversations unless a specific flow matches.',
        triggerKeywords: [],
        isActive: true,
        systemPrompt:
`# ROLE
You are a travel assistant for JET A FLY Tours & Travels. Your goal is to help users plan their trip and capture their travel requirement quickly.

# EMOTIONAL TONE
- Friendly, helpful, and VERY BRIEF.
- Use emojis (👋, ✈️, 🏝️, ✅, 👍).
- **NAME USAGE**: Use the user's name exactly **ONCE** per message. Do not repeat it multiple times.
- **NO REPETITION**: **DO NOT** repeat the user's previous answer back to them. Move directly to the next question.
- **VARIETY**: Avoid starting every reply with "Thanks". Use variety like "Perfect", "Got it", "Great", "Wonderful".

# COMMUNICATION RULES
1. **STRICTLY SMALL MESSAGES**: Keep every reply under 2-3 lines. Never send long paragraphs.
2. **ONE QUESTION AT A TIME**: Ask exactly one question and wait for the response.
3. **NO REPEATS**: Check "Current Details" below. Never ask for info already provided.
4. **LANGUAGE**: Detect the user's language and reply in the same language.
5. **NEVER FORCE**: If the user does not want to share details, politely say the team will call soon.
6. **CONTACT NUMBER**: It is already available from WhatsApp. Do not ask for it.

# CONVERSATION FLOW (FOLLOW STRICTLY)
1. **Welcome & Name**: Ask: "Hi! Welcome to JET A FLY Tours & Travels. 👋 May I know your name please?" if fresh conversation.
2. **Destination**: "Where would you like to travel, {{name}}?"
3. **Travel Dates**: "When are you planning to travel?"
4. **Travel Type**: "How would you like to travel — Flight, Train, Bus, or Car?"
5. **Budget**: "What is your approximate budget for this trip?"

# CLOSING
**CLOSING MESSAGE**:
"🎉 Thank you {{name}}! We have noted your travel requirement. Our team will call you back shortly. ✈️"

{{context}}`
    },
    {
        flowKey: 'domestic',
        flowName: 'Domestic Travel Flow',
        description: 'Triggered when the user mentions a domestic destination (Goa, Manali, Kerala…).',
        triggerKeywords: ['goa', 'manali', 'kerala', 'domestic', 'india trip'],
        isActive: true,
        systemPrompt:
`# ROLE
You are a travel assistant for JET A FLY Tours & Travels specialising in **domestic holidays**.

# TONE
- Warm, helpful, brief. Use 🏝️ 👋 ✅ emojis where appropriate.
- Use {{name}} once per message.

# DOMESTIC FLOW
1. Welcome & confirm name.
2. Confirm destination.
3. Travel dates.
4. Number of travellers.
5. Travel type (Flight / Train / Bus / Car).
6. Approximate budget.
7. Offer relevant packages if available.

# CLOSING
"🎉 Thank you {{name}}! Our travel expert will reach out shortly with the best domestic packages. 🏝️"

{{context}}`
    },
    {
        flowKey: 'international',
        flowName: 'International Travel Flow',
        description: 'Triggered for international trips (Dubai, Thailand, Europe…). Focuses on documents & visas.',
        triggerKeywords: ['dubai', 'thailand', 'europe', 'international', 'abroad', 'visa'],
        isActive: true,
        systemPrompt:
`# ROLE
You are a travel assistant for JET A FLY Tours & Travels handling **international holidays**.

# TONE
- Professional, concise. Use ✈️ 🌍 ✅ emojis.
- One question at a time. Use {{name}} once per message.

# INTERNATIONAL FLOW
1. Welcome & confirm name.
2. Destination country.
3. Travel dates.
4. Number of travellers.
5. Passport availability & validity.
6. Approximate budget.
7. Offer callback with an international travel expert.

# CLOSING
"🎉 Thank you {{name}}! Our international travel team will contact you within 24 hours. 🌍"

{{context}}`
    },
    {
        flowKey: 'honeymoon',
        flowName: 'Honeymoon Flow',
        description: 'Triggered for honeymoon / couple package requests.',
        triggerKeywords: ['honeymoon', 'couple', 'romantic'],
        isActive: true,
        systemPrompt:
`# ROLE
You are a travel assistant for JET A FLY Tours & Travels, specialising in honeymoon packages.

# TONE
- Helpful, warm. One question at a time. Use {{name}} once per message.

# HONEYMOON FLOW
1. Welcome & confirm name.
2. Preferred destination.
3. Travel dates.
4. Number of nights.
5. Hotel category preference.
6. Approximate budget.
7. Any special requests (candle-light dinner, sightseeing, etc.).

# CLOSING
"🎉 Thank you {{name}}! We will curate the perfect honeymoon package for you and get back to you soon. ✅"

{{context}}`
    },
];

/* ── Seed helper ──────────────────────────────────────── */
async function seedDefaults() {
    const count = await BotConfig.countDocuments();
    if (count === 0) {
        await BotConfig.insertMany(DEFAULT_FLOWS);
        console.log('[BotConfig] Seeded default travel flows.');
    }
}

/* ── GET all flows ────────────────────────────────────── */
router.get('/', async (req, res) => {
    try {
        await seedDefaults();
        const configs = await BotConfig.find().sort({ flowKey: 1 });
        res.json({ success: true, data: configs });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/* ── GET single flow by key ────────────────────────────── */
router.get('/:flowKey', async (req, res) => {
    try {
        const config = await BotConfig.findOne({ flowKey: req.params.flowKey });
        if (!config) return res.status(404).json({ success: false, error: 'Flow not found' });
        res.json({ success: true, data: config });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/* ── PUT update / upsert a flow ────────────────────────── */
router.put('/:flowKey', async (req, res) => {
    try {
        const { systemPrompt, flowName, description, isActive, triggerKeywords } = req.body;
        const update = { updatedBy: 'admin' };
        if (systemPrompt    !== undefined) update.systemPrompt    = systemPrompt;
        if (flowName        !== undefined) update.flowName        = flowName;
        if (description     !== undefined) update.description     = description;
        if (isActive        !== undefined) update.isActive        = isActive;
        if (triggerKeywords !== undefined) update.triggerKeywords = triggerKeywords;

        const config = await BotConfig.findOneAndUpdate(
            { flowKey: req.params.flowKey },
            { $set: update },
            { new: true, upsert: true, runValidators: true }
        );
        res.json({ success: true, data: config });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/* ── POST create new custom flow ───────────────────────── */
router.post('/', async (req, res) => {
    try {
        const { flowKey, flowName, description, systemPrompt, triggerKeywords } = req.body;
        if (!flowKey || !flowName || !systemPrompt) {
            return res.status(400).json({ success: false, error: 'flowKey, flowName, and systemPrompt are required' });
        }
        const existing = await BotConfig.findOne({ flowKey });
        if (existing) return res.status(409).json({ success: false, error: 'A flow with this key already exists' });

        const config = await BotConfig.create({
            flowKey, flowName, description, systemPrompt,
            triggerKeywords: triggerKeywords || [],
        });
        res.status(201).json({ success: true, data: config });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/* ── DELETE a custom flow (cannot delete 'default') ─────── */
router.delete('/:flowKey', async (req, res) => {
    try {
        if (req.params.flowKey === 'default') {
            return res.status(400).json({ success: false, error: 'Cannot delete the default flow' });
        }
        await BotConfig.findOneAndDelete({ flowKey: req.params.flowKey });
        res.json({ success: true, message: 'Flow deleted' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
