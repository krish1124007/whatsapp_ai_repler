require("dotenv").config();
const express = require("express");
const axios = require("axios");

const app = express();
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

    // 🔹 GROQ AI CALL
    const aiResponse = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.1-8b-instant",
        messages: [
          { role: "system", content: "You are a helpful WhatsApp assistant." },
          { role: "user", content: userText }
        ]
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
