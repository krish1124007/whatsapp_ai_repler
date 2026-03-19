const mongoose = require("mongoose");

const questionAnswerSchema = new mongoose.Schema({
    question: {
        type: String,
        required: true
    },
    answer: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const QuestionAnswer = mongoose.model("QuestionAnswer", questionAnswerSchema);

module.exports = QuestionAnswer;
