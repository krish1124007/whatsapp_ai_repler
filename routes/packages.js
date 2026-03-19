const express = require('express');
const router = express.Router();
const Package = require('../models/Package');
const { authMiddleware } = require('../middleware/auth.cjs');

// Apply authentication middleware to all package routes
router.use(authMiddleware);

// Get all packages
router.get('/', async (req, res) => {
    try {
        const packages = await Package.find().sort({ createdAt: -1 });
        res.json({ success: true, data: packages });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create a new package
router.post('/', async (req, res) => {
    try {
        const newPackage = new Package(req.body);
        await newPackage.save();
        res.status(201).json({ success: true, data: newPackage });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
});

// Update a package
router.put('/:id', async (req, res) => {
    try {
        const updatedPackage = await Package.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updatedPackage) return res.status(404).json({ success: false, error: 'Package not found' });
        res.json({ success: true, data: updatedPackage });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
});

// Delete a package
router.delete('/:id', async (req, res) => {
    try {
        const deletedPackage = await Package.findByIdAndDelete(req.params.id);
        if (!deletedPackage) return res.status(404).json({ success: false, error: 'Package not found' });
        res.json({ success: true, message: 'Package deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
