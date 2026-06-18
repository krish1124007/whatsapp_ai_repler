const express = require('express');
const router = express.Router();
const Flow = require('../models/Flow');

// GET all flows
router.get('/', async (req, res) => {
    try {
        const flows = await Flow.find().sort({ createdAt: -1 });
        res.status(200).json({ success: true, data: flows });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// GET single flow
router.get('/:id', async (req, res) => {
    try {
        const flow = await Flow.findById(req.params.id);
        if (!flow) return res.status(404).json({ success: false, message: "Flow not found" });
        res.status(200).json({ success: true, data: flow });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// POST create flow
router.post('/', async (req, res) => {
    try {
        if (req.body.isDefault) {
            await Flow.updateMany({ isDefault: true }, { $set: { isDefault: false } });
        }
        const flow = await Flow.create(req.body);
        res.status(201).json({ success: true, data: flow });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// PUT update flow
router.put('/:id', async (req, res) => {
    try {
        if (req.body.isDefault) {
            await Flow.updateMany(
                { _id: { $ne: req.params.id }, isDefault: true },
                { $set: { isDefault: false } }
            );
        }
        const flow = await Flow.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!flow) return res.status(404).json({ success: false, message: "Flow not found" });
        res.status(200).json({ success: true, data: flow });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// DELETE flow
router.delete('/:id', async (req, res) => {
    try {
        const flow = await Flow.findByIdAndDelete(req.params.id);
        if (!flow) return res.status(404).json({ success: false, message: "Flow not found" });
        res.status(200).json({ success: true, message: "Flow deleted" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// PATCH toggle isActive
router.patch('/:id/toggle', async (req, res) => {
    try {
        const flow = await Flow.findById(req.params.id);
        if (!flow) return res.status(404).json({ success: false, message: "Flow not found" });
        flow.isActive = !flow.isActive;
        await flow.save();
        res.status(200).json({ success: true, data: flow });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
