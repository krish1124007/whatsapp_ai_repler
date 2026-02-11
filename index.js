require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const connectDB = require("./config/database");
const dashboardRoutes = require("./routes/dashboard");
const { saveContact, saveConversation, estimateTokens } = require("./functions/conversationHelper");
const adminRoutes = require("./routes/admin.js");
const enquiriesRoutes = require("./routes/enquiries.js");
const { getOrCreateEnquiry, updateEnquiryData, createCallbackRequest } = require("./functions/travelEnquiryHelper");
const { generateSystemPrompt, generateConversationContext } = require("./functions/systemPromptGenerator");
const { parseUserResponse, isUserDisinterested } = require("./functions/responseParser");

const app = express();

connectDB();

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

app.post("/webhook", async (req, res) => {
  res.sendStatus(200);

  try {
    const entry = req.body?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    if (value?.statuses) {
      console.log("Status update:", JSON.stringify(value.statuses, null, 2));
      return;
    }

    const message = value?.messages?.[0];
    if (!message || message.type !== "text") {
      return;
    }

    const from = message.from;
    const userText = message.text?.body;
    if (!userText) {
      return;
    }

    console.log(`User (${from}):`, userText);

    const enquiry = await getOrCreateEnquiry(from);
    const currentStage = enquiry.conversationStage;
    console.log(`Current stage: ${currentStage}`);

    let conversationHistory = [];
    try {
      const Conversation = require("./models/Conversation");
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

    if (isUserDisinterested(userText, conversationHistory)) {
      const goodbyeMessage = "No problem. Our team will reach out to you very soon. Thank you!";

      try {
        await createCallbackRequest(from, "ASAP");
      } catch (callbackError) {
        console.error("Callback storage error:", callbackError.message);
      }

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

      await axios.post(
        `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`,
        {
          messaging_product: "whatsapp",
          to: from,
          text: { body: goodbyeMessage }
        },
        {
          headers: {
            Authorization: `Bearer ${WHATSAPP_TOKEN}`,
            "Content-Type": "application/json"
          }
        }
      );
      return;
    }

    let parsedData = null;
    if (currentStage !== "completed") {
      parsedData = parseUserResponse(currentStage, userText);
      console.log("Parsed data:", parsedData);
    }

    let updatedEnquiry = enquiry;
    if (parsedData && currentStage !== "completed") {
      try {
        if (currentStage === "callback_or_contact" && parsedData.wantsCallback) {
          await createCallbackRequest(from, parsedData.preferredTime);
        } else {
          updatedEnquiry = await updateEnquiryData(from, currentStage, parsedData);
        }
      } catch (updateError) {
        console.error("Enquiry update error:", updateError.message);
      }
    }

    const stageForPrompt = updatedEnquiry.conversationStage || currentStage;
    const systemPrompt = generateSystemPrompt(stageForPrompt, {
      destination: updatedEnquiry.destination,
      preferredTravelDates: updatedEnquiry.preferredTravelDates,
      clientName: updatedEnquiry.clientName,
      tripType: updatedEnquiry.tripType,
      travelType: updatedEnquiry.travelType,
      approximateBudget: updatedEnquiry.approximateBudget
    });
    const conversationContext = generateConversationContext(updatedEnquiry);

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

    const replyText = aiResponse.data?.choices?.[0]?.message?.content || "Sorry, try again.";
    const usage = aiResponse.data.usage || {};
    const inputTokens = usage.prompt_tokens || estimateTokens(userText);
    const outputTokens = usage.completion_tokens || estimateTokens(replyText);

    try {
      await saveContact(from);
      await saveConversation(from, userText, replyText, inputTokens, outputTokens);
    } catch (dbError) {
      console.error("Database save error:", dbError.message);
    }

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
