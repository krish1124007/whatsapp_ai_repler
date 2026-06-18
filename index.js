require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const connectDB = require("./config/database");
const Conversation = require("./models/Conversation");
const dashboardRoutes = require("./routes/dashboard");
const { saveContact, saveConversation, estimateTokens } = require("./functions/conversationHelper");
const adminRoutes = require("./routes/admin.js");
const enquiriesRoutes = require("./routes/enquiries.js");
const {
  getOrCreateEnquiry,
  upsertEnquiryFromMessage,
  createCallbackRequest,
  updateEnquiryData,
  getEnquirySummary, // Import summary helper
  resetEnquiry
} = require("./functions/travelEnquiryHelper");
const { generateSystemPrompt, generateConversationContext } = require("./functions/systemPromptGenerator");
const { isUserDisinterested } = require("./functions/responseParser");
const { checkAndStartFlow, handleActiveFlow } = require("./functions/flowHelper");

const packageRoutes = require("./routes/packages.js");
const qaRoutes = require("./routes/qa.js");
const Package = require("./models/Package");
const QuestionAnswer = require("./models/QuestionAnswer");

// Generic automation features (ported from zatpat UI)
const handoverRoutes = require("./routes/handover.js");
const analyticsRoutes = require("./routes/analytics.js");
const templatesRoutes = require("./routes/templates.js");
const broadcastRoutes = require("./routes/broadcast.js");
const botConfigRoutes = require("./routes/botConfig.js");
const flowsRoutes = require("./routes/flows.js");
const mediaRoutes = require("./routes/media.js");
const Handover = require("./models/Handover");
const seedDefaultFlow = require("./functions/seedDefaults");

const app = express();

connectDB().then(() => {
  seedDefaultFlow();
});

app.use(cors());
app.use(express.json());

const {
  VERIFY_TOKEN,
  WHATSAPP_TOKEN,
  PHONE_NUMBER_ID,
  GROQ_API_KEY
} = process.env;

app.get("/", (req, res) => {
  res.send("WhatsApp Groq Bot is running");
});

app.use("/api/dashboard", dashboardRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/enquiries", enquiriesRoutes);
app.use("/api/packages", packageRoutes);
app.use("/api/qa", qaRoutes);
app.use("/api/handover", handoverRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/templates", templatesRoutes);
app.use("/api/broadcast", broadcastRoutes);
app.use("/api/bot-config", botConfigRoutes);
app.use("/api/flows", flowsRoutes);
app.use("/api/media", mediaRoutes);
app.use("/uploads", express.static(require("path").join(__dirname, "uploads")));

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

async function sendWhatsAppMessage(to, body, token, phoneId) {
  await axios.post(
    `https://graph.facebook.com/v19.0/${phoneId}/messages`,
    {
      messaging_product: "whatsapp",
      to,
      text: { body }
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    }
  );
}

app.post("/webhook", async (req, res) => {
  res.sendStatus(200);

  try {
    const entry = req.body?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    if (value?.statuses) {
      return;
    }

    const message = value?.messages?.[0];
    if (!message || (message.type !== "text" && message.type !== "interactive")) {
      return;
    }

    const from = message.from;
    let userText = "";
    if (message.type === "text") {
        userText = message.text?.body;
    } else if (message.type === "interactive") {
        if (message.interactive.type === "button_reply") {
            userText = message.interactive.button_reply.title;
        } else if (message.interactive.type === "list_reply") {
            userText = message.interactive.list_reply.title;
        }
    }
    if (!userText) {
      return;
    }

    // ── Human Handover check ──────────────────────────
    // If an agent has taken over this chat, the bot must NOT auto-reply.
    // We still record the incoming message so it shows in the chat history.
    try {
      const handoverRecord = await Handover.findOne({ phoneNumber: from });
      if (handoverRecord && handoverRecord.controller === "human") {
        console.log(`🤝 [HANDOVER] ${from} is under human control — bot skipping`);
        try {
          await saveContact(from);
          const inTokens = estimateTokens(userText);
          await Conversation.create({
            phoneNumber: from,
            messages: [
              { role: "user", content: userText, timestamp: new Date(), inputTokens: inTokens }
            ],
            totalInputTokens: inTokens,
            startedAt: new Date(),
            lastMessageAt: new Date()
          });
        } catch (dbErr) {
          console.error("DB save error (handover):", dbErr.message);
        }
        return;
      }
    } catch (handoverErr) {
      console.error("Handover lookup error:", handoverErr.message);
    }

    // 0. Auto-Reset if last message was 15+ days ago
    try {
      const lastConv = await Conversation.findOne({ phoneNumber: from }).sort({ createdAt: -1 });
      if (lastConv) {
        const fifteenDaysAgo = new Date();
        fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);

        if (lastConv.createdAt < fifteenDaysAgo) {
          console.log(`Auto-resetting conversation for ${from} due to 15+ days inactivity.`);
          await Conversation.deleteMany({ phoneNumber: from });
          await resetEnquiry(from);
        }
      }
    } catch (resetError) {
      console.error("Auto-reset error:", resetError.message);
    }

    let enquiry = await getOrCreateEnquiry(from);

    let conversationHistory = [];
    try {
      const recentConversation = await Conversation.findOne({ phoneNumber: from }).sort({ createdAt: -1 });
      if (recentConversation?.messages?.length) {
        conversationHistory = recentConversation.messages.slice(-5).map((msg) => ({
          role: msg.role,
          content: msg.content
        }));
      }
    } catch (historyError) {
      console.error("Conversation history error:", historyError.message);
    }

    const upsertResult = await upsertEnquiryFromMessage(from, userText);
    enquiry = upsertResult.enquiry;

    // --- NEW DYNAMIC FLOW BUILDER LOGIC ---
    let conversationDoc = await Conversation.findOne({ phoneNumber: from }).sort({ createdAt: -1 });
    if (conversationDoc && conversationDoc.activeFlowId) {
      const handled = await handleActiveFlow(from, userText, conversationDoc);
      if (handled) return;
    } else {
      const flowStarted = await checkAndStartFlow(from, userText, conversationDoc);
      if (flowStarted) return;
    }
    // --------------------------------------

    // 1. Handle explicit reset (User said "New Trip")
    // 1. Handle explicit reset (User said "New Trip") OR Smart Reset (Detected New Destination)
    if (upsertResult.isReset) {
      let resetMsg = "Okay, I've started a new trip plan for you. Where would you like to go?";

      // If it was a SMART reset (we already captured new data like "Trip to Goa"), customize the message
      // "do not ask for past details start fresh"
      if (upsertResult.isSmartReset && enquiry.destination) {
        resetMsg = `Great! I've noted you're planning a trip to ${enquiry.destination}. When are you planning to travel?`;
      }

      await sendWhatsAppMessage(from, resetMsg, WHATSAPP_TOKEN, PHONE_NUMBER_ID);
      // Save conversation state for this message
      try {
        await saveContact(from);
        await saveConversation(from, userText, resetMsg, estimateTokens(userText), estimateTokens(resetMsg));
      } catch (dbError) { console.error(dbError); }
      return;
    }

    // 2. Handle Greeting with Existing Completed Enquiry
    const isGreeting = /^(hi|hello|hey|greetings|namaste|hola)/i.test(userText.trim());

    // STRICT CHECK: Only show "Welcome Back" if we actually have useful data (Destination/Origin)
    // "if all things are null... do not ask user... start over automatic"
    const hasUsefulData = enquiry.destination || enquiry.departureCity;

    if (isGreeting && enquiry.status === 'in_progress' && enquiry.callbackRequested && hasUsefulData) {
      const summary = getEnquirySummary(enquiry);
      const welcomeBackMsg = `Welcome back! We have your previous request for: ${summary}.\n\nDo you want to continue with this or plan a *new trip*?`;

      await sendWhatsAppMessage(from, welcomeBackMsg, WHATSAPP_TOKEN, PHONE_NUMBER_ID);
      try {
        await saveContact(from);
        await saveConversation(from, userText, welcomeBackMsg, estimateTokens(userText), estimateTokens(welcomeBackMsg));
      } catch (dbError) { console.error(dbError); }
      return;
    }

    if (isUserDisinterested(userText, conversationHistory)) {
      const goodbyeMessage = "No problem. Our team will reach out to you very soon. Thank you!";
      await createCallbackRequest(from, "ASAP");

      try {
        await saveContact(from);
        await saveConversation(
          from,
          userText,
          goodbyeMessage,
          estimateTokens(userText),
          estimateTokens(goodbyeMessage)
        );
      } catch (dbError) {
        console.error("Database save error:", dbError.message);
      }

      await sendWhatsAppMessage(from, goodbyeMessage, WHATSAPP_TOKEN, PHONE_NUMBER_ID);
      return;
    }

    if (upsertResult.hasAllPrimaryFields) {
      await updateEnquiryData(from, "contact_info", {});
      // Fix "Thank you null" -> Use valid name or generic fallback
      const namePart = enquiry.clientName && enquiry.clientName !== 'null' ? ` ${enquiry.clientName}` : "";
      const finalMessage = `Thank you${namePart}. Our team will call you back shortly.`;

      try {
        await saveContact(from);
        await saveConversation(
          from,
          userText,
          finalMessage,
          estimateTokens(userText),
          estimateTokens(finalMessage)
        );
      } catch (dbError) {
        console.error("Database save error:", dbError.message);
      }

      await sendWhatsAppMessage(from, finalMessage, WHATSAPP_TOKEN, PHONE_NUMBER_ID);
      return;
    }

    const stageForPrompt = enquiry.conversationStage || "travel_dates";

    // FETCH PACKAGES & QA
    let relevantPackages = [];
    if (enquiry.destination) {
      console.log(`🔍 Searching packages for destination: "${enquiry.destination}"`);
      // More flexible search: split by space/comma and search any word
      const destParts = enquiry.destination.split(/[\s,]+/).filter(p => p.length > 2);
      const searchTerms = destParts.length > 0 ? destParts : [enquiry.destination];
      
      relevantPackages = await Package.find({
        $or: [
          { destination: { $regex: enquiry.destination, $options: "i" } },
          { name: { $regex: enquiry.destination, $options: "i" } },
          ...searchTerms.map(term => ({ destination: { $regex: term, $options: "i" } }))
        ]
      }).limit(3);
      
      console.log(`✅ Found ${relevantPackages.length} relevant packages.`);
    }

    const allQAs = await QuestionAnswer.find().limit(10);

    const systemPrompt = generateSystemPrompt(stageForPrompt, {
      destination: enquiry.destination,
      preferredTravelDates: enquiry.preferredTravelDates,
      clientName: enquiry.clientName,
      tripType: enquiry.tripType,
      travelType: enquiry.travelType,
      approximateBudget: enquiry.approximateBudget
    }, relevantPackages, allQAs);

    const conversationContext = generateConversationContext(enquiry);

    const messages = [
      { role: "system", content: systemPrompt + conversationContext },
      ...conversationHistory,
      { role: "user", content: userText }
    ];

    const aiResponse = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.1-8b-instant",
        messages,
        temperature: 0.5,
        max_tokens: 300
      },
      {
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    const replyText = aiResponse.data?.choices?.[0]?.message?.content || "Thanks. Our team will call you shortly.";
    const usage = aiResponse.data.usage || {};
    const inputTokens = usage.prompt_tokens || estimateTokens(userText);
    const outputTokens = usage.completion_tokens || estimateTokens(replyText);

    try {
      await saveContact(from);
      await saveConversation(from, userText, replyText, inputTokens, outputTokens);
    } catch (dbError) {
      console.error("Database save error:", dbError.message);
    }

    await sendWhatsAppMessage(from, replyText, WHATSAPP_TOKEN, PHONE_NUMBER_ID);
  } catch (error) {
    console.error("ERROR:", error.response?.data || error.message);
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
