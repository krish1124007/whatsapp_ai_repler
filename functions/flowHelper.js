const axios = require("axios");
const Flow = require("../models/Flow");
const Conversation = require("../models/Conversation");
const { saveContact, saveConversation, estimateTokens } = require("./conversationHelper");

async function checkAndStartFlow(from, userText, conversation) {
    const activeFlows = await Flow.find({ isActive: true });
    
    let matchedFlow = null;
    const lowerText = userText.toLowerCase();

    for (const flow of activeFlows) {
        if (flow.triggerKeywords && flow.triggerKeywords.length > 0) {
            const matches = flow.triggerKeywords.some(kw => lowerText.includes(kw.toLowerCase()));
            if (matches) {
                matchedFlow = flow;
                break;
            }
        }
    }

    if (!matchedFlow) {
        matchedFlow = activeFlows.find(f => f.isDefault);
    }

    if (!matchedFlow || !matchedFlow.steps || matchedFlow.steps.length === 0) {
        return false; // No flow to start
    }

    // Start the flow
    if (conversation) {
        conversation.activeFlowId = matchedFlow._id;
        conversation.currentStepIndex = 0;
        await conversation.save();
    } else {
        conversation = await Conversation.create({
            phoneNumber: from,
            activeFlowId: matchedFlow._id,
            currentStepIndex: 0,
            messages: [{ role: "user", content: userText }]
        });
    }

    const firstStep = matchedFlow.steps[0];
    await sendFlowStepMessage(from, firstStep, matchedFlow, conversation, userText);
    return true;
}

async function handleActiveFlow(from, userText, conversation) {
    if (!conversation || !conversation.activeFlowId) return false;

    const flow = await Flow.findById(conversation.activeFlowId);
    if (!flow || !flow.isActive || !flow.steps || flow.steps.length === 0) {
        // Flow deleted or inactive, clear it
        conversation.activeFlowId = null;
        await conversation.save();
        return false;
    }

    const currentStepIndex = conversation.currentStepIndex || 0;
    if (currentStepIndex >= flow.steps.length) {
        conversation.activeFlowId = null;
        await conversation.save();
        return false;
    }

    const currentStep = flow.steps[currentStepIndex];

    // Use AI to determine if user answered the question or diverted
    const aiResponse = await evaluateUserResponseWithAI(userText, currentStep.message, flow.systemPrompt);
    
    if (aiResponse.status === 'answered') {
        // Advance to next step
        let nextIndex = currentStepIndex + 1;
        
        // Handle buttons if they have specific routing
        // For simplicity, we just advance or end based on step properties
        if (currentStep.isEnd) {
            nextIndex = 'END';
        }

        if (nextIndex === 'END' || nextIndex >= flow.steps.length) {
            conversation.activeFlowId = null;
            await conversation.save();
            const endMsg = aiResponse.message || "Thank you! We have recorded your response.";
            await sendRawMessage(from, endMsg, userText);
            return true;
        }

        conversation.currentStepIndex = nextIndex;
        await conversation.save();
        const nextStep = flow.steps[nextIndex];
        await sendFlowStepMessage(from, nextStep, flow, conversation, userText, aiResponse.message);
        return true;
    } else {
        // Diverted (related or unrelated)
        // Send AI's generated message which should answer (if related) and repeat the question
        await sendRawMessage(from, aiResponse.message, userText);
        return true;
    }
}

async function evaluateUserResponseWithAI(userText, currentQuestion, systemPrompt) {
    const prompt = `
You are evaluating a user's response in a WhatsApp conversation flow.
Flow System Prompt / Context:
${systemPrompt}

Current Question asked to user:
"${currentQuestion}"

User's Response:
"${userText}"

Instructions:
1. Determine if the user's response answers the "Current Question" appropriately. If yes, respond with JSON { "status": "answered", "message": "Optional brief acknowledgment" }.
2. If the user asked something else related to the business/travel, respond with JSON { "status": "diverted_related", "message": "<Answer their question briefly> Let's complete your details first. <Repeat Current Question>" }.
3. If the user asked something completely unrelated, respond with JSON { "status": "diverted_unrelated", "message": "I can only help with travel related queries. Please answer: <Repeat Current Question>" }.

Respond ONLY in valid JSON format matching the structure above.
`;

    try {
        const response = await axios.post(
            "https://api.groq.com/openai/v1/chat/completions",
            {
                model: "llama-3.1-8b-instant",
                messages: [{ role: "user", content: prompt }],
                temperature: 0.1,
                response_format: { type: "json_object" }
            },
            {
                headers: {
                    Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
                    "Content-Type": "application/json"
                }
            }
        );

        const content = response.data?.choices?.[0]?.message?.content;
        return JSON.parse(content);
    } catch (err) {
        console.error("AI Evaluation Error:", err.message);
        // Fallback to assume answered so we don't get stuck
        return { status: "answered", message: "Got it." };
    }
}

async function sendFlowStepMessage(to, step, flow, conversation, userText, prefixMessage = "") {
    let body = prefixMessage ? `${prefixMessage}\n\n${step.message}` : step.message;
    
    // Construct WhatsApp message payload
    let payload = {
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body }
    };

    // If step has media, we could change payload type to image/video (simplified for text here, but can be expanded)
    // If step has buttons, use interactive message format
    if (step.buttons && step.buttons.length > 0) {
        payload = {
            messaging_product: "whatsapp",
            to,
            type: "interactive",
            interactive: {
                type: "button",
                body: { text: body },
                action: {
                    buttons: step.buttons.map(b => ({
                        type: "reply",
                        reply: { id: b.buttonId, title: b.label }
                    }))
                }
            }
        };
    }

    await axios.post(
        `https://graph.facebook.com/v19.0/${process.env.PHONE_NUMBER_ID}/messages`,
        payload,
        {
            headers: {
                Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
                "Content-Type": "application/json"
            }
        }
    );

    await saveContact(to);
    await saveConversation(to, userText, body, estimateTokens(userText), estimateTokens(body));
    
    // Handle autoNextStep
    if (step.autoNextStep) {
        let nextIndex = step.autoNextStepIndex === 'END' ? 'END' : step.autoNextStepIndex;
        if (nextIndex === 'END' || nextIndex >= flow.steps.length) {
            conversation.activeFlowId = null;
            await conversation.save();
        } else {
            conversation.currentStepIndex = nextIndex;
            await conversation.save();
            const nextStep = flow.steps[nextIndex];
            setTimeout(() => {
                sendFlowStepMessage(to, nextStep, flow, conversation, "[Auto-continue]");
            }, step.delayMs || 1000);
        }
    }
}

async function sendRawMessage(to, body, userText) {
    await axios.post(
        `https://graph.facebook.com/v19.0/${process.env.PHONE_NUMBER_ID}/messages`,
        {
            messaging_product: "whatsapp",
            to,
            text: { body }
        },
        {
            headers: {
                Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
                "Content-Type": "application/json"
            }
        }
    );
    await saveContact(to);
    await saveConversation(to, userText, body, estimateTokens(userText), estimateTokens(body));
}

module.exports = {
    checkAndStartFlow,
    handleActiveFlow
};
