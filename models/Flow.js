const mongoose = require("mongoose");

const flowButtonSchema = new mongoose.Schema({
  label: { type: String, required: true },
  buttonId: { type: String, required: true },
  nextStepIndex: { type: mongoose.Schema.Types.Mixed, required: true }, // number or "END"
}, { _id: false });

const flowMediaSchema = new mongoose.Schema({
  type: { type: String, enum: ["image", "video"], required: true },
  url: { type: String, required: true },
  caption: { type: String, default: "" },
}, { _id: false });

const flowStepSchema = new mongoose.Schema({
  message: { type: String, required: true },
  mediaUrls: { type: [flowMediaSchema], default: [] },
  buttons: { type: [flowButtonSchema], default: [] },
  isEnd: { type: Boolean, default: false },
  delayMs: { type: Number, default: 0 },
  autoNextStep: { type: Boolean, default: false },
  autoNextStepIndex: { type: mongoose.Schema.Types.Mixed, default: "END" },
});

const flowSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, default: "" },
  systemPrompt: { type: String, default: "" }, // Add system prompt for AI enforcement
  triggerKeywords: { type: [String], default: [] },
  isDefault: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  steps: { type: [flowStepSchema], default: [] },
}, { timestamps: true });

module.exports = mongoose.model("Flow", flowSchema);
