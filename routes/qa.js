const express = require('express');
const router = express.Router();
const QuestionAnswer = require('../models/QuestionAnswer');
const { authMiddleware } = require('../middleware/auth.cjs');

// Apply authentication middleware to all QA routes
router.use(authMiddleware);

// Get all QA pairs
router.get('/', async (req, res) => {
    try {
        const qas = await QuestionAnswer.find().sort({ createdAt: -1 });
        res.json({ success: true, data: qas });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create a new QA pair
router.post('/', async (req, res) => {
    try {
        const newQA = new QuestionAnswer(req.body);
        await newQA.save();
        res.status(201).json({ success: true, data: newQA });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
});

// Update a QA pair
router.put('/:id', async (req, res) => {
    try {
        const updatedQA = await QuestionAnswer.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updatedQA) return res.status(404).json({ success: false, error: 'QA not found' });
        res.json({ success: true, data: updatedQA });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
});

// Delete a QA pair
router.delete('/:id', async (req, res) => {
    try {
        const deletedQA = await QuestionAnswer.findByIdAndDelete(req.params.id);
        if (!deletedQA) return res.status(404).json({ success: false, error: 'QA not found' });
        res.json({ success: true, message: 'QA pair deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
