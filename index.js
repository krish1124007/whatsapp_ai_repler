require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const connectDB = require("./config/database");
const dashboardRoutes = require("./routes/dashboard");
const { saveContact, saveConversation, estimateTokens } = require("./functions/conversationHelper");
const adminRoutes = require("./routes/admin.js");
const enquiriesRoutes = require("./routes/enquiries.js");
const { getOrCreateEnquiry, updateEnquiryData, createCallbackRequest, getCurrentStage } = require("./functions/travelEnquiryHelper");
const { generateSystemPrompt, generateConversationContext } = require("./functions/systemPromptGenerator");
const { parseUserResponse } = require("./functions/responseParser");

const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors());
app.use(express.json());

// ================== CONFIG ==================
const {
  VERIFY_TOKEN,
  WHATSAPP_TOKEN,
  PHONE_NUMBER_ID,
  GROQ_API_KEY
} = process.env;
// ============================================

// 🔹 HEALTH CHECK
app.get("/", (req, res) => {
  res.send("WhatsApp Groq Bot is running");
});

// 🔹 DASHBOARD API ROUTES
app.use("/api/dashboard", dashboardRoutes);

// 🔹 ADMIN API ROUTES
app.use("/api/admin", adminRoutes);

// 🔹 TRAVEL ENQUIRIES API ROUTES
app.use("/api/enquiries", enquiriesRoutes);

// 🔹 WEBHOOK VERIFY
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Webhook verified");
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// 🔹 WEBHOOK RECEIVE
app.post("/webhook", async (req, res) => {
  // ✅ ALWAYS respond 200 immediately to prevent Meta timeout
  res.sendStatus(200);

  try {
    // 🔹 LOG FULL REQUEST BODY FOR DEBUGGING
    console.log("📥 Webhook POST received");
    console.log("Full Body:", JSON.stringify(req.body, null, 2));

    // 🔹 EXTRACT DATA
    const entry = req.body?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    // 🔹 HANDLE MESSAGE STATUSES (delivered, read, sent, etc.)
    if (value?.statuses) {
      console.log("📊 Status Update:", JSON.stringify(value.statuses, null, 2));
      return; // Don't process status updates
    }

    // 🔹 EXTRACT MESSAGE
    const message = value?.messages?.[0];

    if (!message) {
      console.log("⚠️ No message found in webhook");
      return;
    }

    console.log("📨 Message Type:", message.type);
    console.log("📨 Message Object:", JSON.stringify(message, null, 2));

    // 🔹 ONLY PROCESS TEXT MESSAGES
    if (message.type !== "text") {
      console.log(`⏭️ Skipping non-text message type: ${message.type}`);
      return;
    }

    const from = message.from;
    const userText = message.text?.body;

    if (!userText) {
      console.log("⚠️ No text body found in message");
      return;
    }

    console.log(`👤 User (${from}):`, userText);

    // 🔹 GET OR CREATE TRAVEL ENQUIRY
    const enquiry = await getOrCreateEnquiry(from);
    const currentStage = enquiry.conversationStage;

    console.log(`📍 Current Stage: ${currentStage}`);

    // 🔹 PARSE USER RESPONSE BASED ON CURRENT STAGE
    let parsedData = null;
    if (currentStage !== 'completed') {
      // For greeting stage, check if user provides direct booking details
      if (currentStage === 'greeting') {
        const lowerText = userText.toLowerCase();
        // Check if user is directly requesting a booking
        if (lowerText.includes('book') || lowerText.includes('trip') ||
          lowerText.includes('travel') || lowerText.includes('plan') ||
          lowerText.match(/\bto\b/) || lowerText.match(/from\b/)) {
          // Try to extract comprehensive information
          parsedData = parseUserResponse('travel_dates', userText);
          console.log(`📊 Direct booking detected! Parsed Data:`, parsedData);

          // Also try to determine domestic/international
          const destData = parseUserResponse('destination', userText);
          if (destData.destination) {
            parsedData.destination = destData.destination;
          }
        }
      } else {
        parsedData = parseUserResponse(currentStage, userText);
        console.log(`📊 Parsed Data:`, parsedData);
      }
    }

    // 🔹 UPDATE ENQUIRY DATA BASED ON PARSED RESPONSE (BEFORE AI RESPONSE!)
    let updatedEnquiry = enquiry; // Start with current enquiry
    if (parsedData && currentStage !== 'completed') {
      try {
        // Handle callback request specially
        if (currentStage === 'callback_or_contact' && parsedData.wantsCallback) {
          await createCallbackRequest(from, parsedData.preferredTime);
          console.log(`📞 Callback request created for ${from}`);
        } else {
          // Update enquiry data for current stage
          updatedEnquiry = await updateEnquiryData(from, currentStage, parsedData);
          console.log(`✅ Enquiry data updated for stage: ${currentStage}`);
          console.log(`📊 Updated enquiry data:`, {
            name: updatedEnquiry.clientName,
            destination: updatedEnquiry.destination,
            from: updatedEnquiry.departureCity,
            dates: updatedEnquiry.preferredTravelDates,
            travelers: updatedEnquiry.totalTravellers,
            hotel: updatedEnquiry.hotelCategory
          });
        }
      } catch (updateError) {
        console.error('❌ Error updating enquiry data:', updateError.message);
      }
    }

    // 🔹 GENERATE DYNAMIC SYSTEM PROMPT (using UPDATED enquiry)
    const systemPrompt = generateSystemPrompt(currentStage, {
      destination: updatedEnquiry.destination,
      preferredTravelDates: updatedEnquiry.preferredTravelDates,
      clientName: updatedEnquiry.clientName,
      tripType: updatedEnquiry.tripType
    });

    const conversationContext = generateConversationContext(updatedEnquiry);
    console.log(`📋 Conversation Context:`, conversationContext);

    // 🔹 GET RECENT CONVERSATION HISTORY FOR CONTEXT
    let conversationHistory = [];
    try {
      const recentConversation = await Conversation.findOne({ phoneNumber: from })
        .sort({ createdAt: -1 });

      if (recentConversation && recentConversation.messages.length > 0) {
        // Get last 5 messages for context (excluding current message)
        conversationHistory = recentConversation.messages
          .slice(-5)
          .map(msg => ({
            role: msg.role,
            content: msg.content
          }));
        console.log(`📜 Including ${conversationHistory.length} previous messages for context`);
      }
    } catch (historyError) {
      console.error('⚠️ Error fetching conversation history:', historyError.message);
      // Continue without history
    }

    // 🔹 BUILD MESSAGES ARRAY WITH HISTORY
    const messages = [
      {
        role: "system",
        content: systemPrompt + conversationContext
      },
      ...conversationHistory, // Include previous conversation
      { role: "user", content: userText }
    ];

    // 🔹 GROQ AI CALL WITH DYNAMIC PROMPT AND HISTORY
    const aiResponse = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.1-8b-instant",
        messages: messages,
        temperature: 0.7,
        max_tokens: 500
      },
      {
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    const replyText =
      aiResponse.data.choices[0].message.content || "Sorry, try again.";

    console.log("🤖 AI Reply:", replyText);

    // 🔹 EXTRACT TOKEN USAGE FROM GROQ RESPONSE
    const usage = aiResponse.data.usage || {};
    const inputTokens = usage.prompt_tokens || estimateTokens(userText);
    const outputTokens = usage.completion_tokens || estimateTokens(replyText);

    console.log(`📊 Tokens - Input: ${inputTokens}, Output: ${outputTokens}`);

    // 🔹 SAVE TO DATABASE
    try {
      await saveContact(from);
      await saveConversation(from, userText, replyText, inputTokens, outputTokens);
      console.log("💾 Conversation saved to database");
    } catch (dbError) {
      console.error("❌ Database save error:", dbError.message);
      // Continue even if database save fails
    }

    // 🔹 SEND WHATSAPP MESSAGE
    await axios.post(
      `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to: from,
        text: { body: replyText }
      },
      {
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          "Content-Type": "application/json"
        }
      }
    );

    console.log("✅ Reply sent successfully");

  } catch (error) {
    console.error("❌ ERROR:", error.response?.data || error.message);
    if (error.stack) {
      console.error("Stack:", error.stack);
    }
  }
});
app.get("/privacy-policy", (req, res) => {
  res.send(`
    <html>
      <head>
        <title>Privacy Policy</title>
      </head>
      <body style="font-family: Arial; padding: 20px;">
        <h1>Privacy Policy</h1>

        <p>
          This application uses the WhatsApp Cloud API to receive and respond
          to messages sent by users.
        </p>

        <p>
          We do not store, sell, or share personal data.
          Messages are processed only for automated replies using AI.
        </p>

        <p>
          If you have any questions, contact us at:
          <strong>parmarkrishdevloper@gmail.com</strong>
        </p>
      </body>
    </html>
  `);
});


// 🔹 START SERVER
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`Server running on port ${PORT}`)
);
