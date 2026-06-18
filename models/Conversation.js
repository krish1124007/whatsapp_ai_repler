const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    role: {
        type: String,
        enum: ['user', 'assistant', 'system', 'agent'],
        required: true
    },
    content: {
        type: String,
        required: true
    },
    timestamp: {
        type: Date,
        default: Date.now
    },
    inputTokens: {
        type: Number,
        default: 0
    },
    outputTokens: {
        type: Number,
        default: 0
    }
});

const conversationSchema = new mongoose.Schema({
    phoneNumber: {
        type: String,
        required: true,
        index: true
    },
    messages: [messageSchema],
    totalInputTokens: {
        type: Number,
        default: 0
    },
    totalOutputTokens: {
        type: Number,
        default: 0
    },
    startedAt: {
        type: Date,
        default: Date.now
    },
    lastMessageAt: {
        type: Date,
        default: Date.now
    },
    activeFlowId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Flow',
        default: null
    },
    currentStepIndex: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

// Index for faster queries
conversationSchema.index({ phoneNumber: 1, createdAt: -1 });

// TTL Index for automatic deletion after 15 days (15 * 24 * 60 * 60 = 1,296,000 seconds)
conversationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 1296000 });

module.exports = mongoose.model('Conversation', conversationSchema);
