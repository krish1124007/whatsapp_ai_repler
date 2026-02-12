const axios = require('axios');
require('dotenv').config();

const GROQ_API_KEY = process.env.GROQ_API_KEY;

/**
 * Extract structured travel data from user message using LLM
 * @param {string} text - User's message text
 * @param {object} currentEnquiry - Current enquiry state (optional context for better extraction)
 * @returns {object} - Extracted data object
 */
async function extractDataWithAI(text, currentEnquiry = {}) {
    try {
        const systemPrompt = `
You are a precise data extraction assistant for a travel agency chatbot.
Your task is to extract travel-related information from the user's message and return it in a strict JSON format.

FIELDS TO EXTRACT:
- destination: City or country name
- city: Departure city (from where they are traveling)
- dates: Travel dates (e.g., "10th March", "next week", "2024-03-03")
- daysNights: Duration (e.g., "5 days 4 nights")
- travellers: Number of people (or object with adults/children)
- category: Hotel category (Budget, 3 Star, 4 Star, 5 Star)
- budget: Approximate budget (convert "k", "lakh", "cr" to numbers if possible, e.g., "1 lakh" -> "100000")
- travelType: Mode of travel (Flight, Train, Bus, Car)
- tripType: Family, Honeymoon, Group, Solo, Corporate, Religious
- name: Client's name if mentioned (e.g., "I am Krish", "My name is John")
- email: Email address
- phone: Phone number (if mentioned in text)
- requirements: Special requirements or notes
- passport: Passport details if mentioned

RULES:
1. Return ONLY valid JSON. No markdown, no explanations.
2. If a field is not mentioned, OMIT IT completely. Do NOT return "null", "N/A", or "None" as strings.
3. Be smart about values:
   - "1 lakh" -> "100000"
   - "50k" -> "50000"
   - "Mumbai to Delhi" -> city: "Mumbai", destination: "Delhi"
   - "with wife" -> travellers: "2" (implied) or "Couple"
4. Extract INTENT if possible:
   - If user says "New trip", "Start over", "Plan new", set "intent": "new_trip"
   - If user says "Cancel", set "intent": "cancel"

EXAMPLE INPUT: "I want to go to Goa from Mumbai for 3 days with my wife. Budget is 20k."
EXAMPLE OUTPUT:
{
  "destination": "Goa",
  "city": "Mumbai",
  "daysNights": "3 days",
  "travellers": "2",
  "tripType": "Couple",
  "budget": "20000"
}
`;

        const response = await axios.post(
            "https://api.groq.com/openai/v1/chat/completions",
            {
                model: "llama-3.1-8b-instant", // Fast and capable enough for extraction
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: text }
                ],
                temperature: 0.1, // Low temperature for deterministic output
                response_format: { type: "json_object" }
            },
            {
                headers: {
                    Authorization: `Bearer ${GROQ_API_KEY}`,
                    "Content-Type": "application/json"
                }
            }
        );

        const content = response.data?.choices?.[0]?.message?.content;
        if (!content) return {};

        try {
            return JSON.parse(content);
        } catch (jsonError) {
            console.error("Failed to parse LLM JSON extraction:", jsonError);
            return {};
        }

    } catch (error) {
        console.error("LLM Extraction Error:", error.message);
        return {}; // Fallback to empty object if AI fails
    }
}

module.exports = { extractDataWithAI };
