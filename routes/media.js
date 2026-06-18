const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// Provide a way to serve these files
// E.g., via express.static('uploads') in index.js

router.get('/', (req, res) => {
    try {
        const files = fs.readdirSync(uploadDir);
        const mediaList = files.map(file => {
            const ext = path.extname(file).toLowerCase();
            const type = ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext) ? 'image' : 'video';
            const serverUrl = req.protocol + '://' + req.get('host');
            return {
                filename: file,
                type: type,
                url: `${serverUrl}/uploads/${file}`
            };
        });
        // Sort by newest first
        mediaList.sort((a, b) => {
            return fs.statSync(path.join(uploadDir, b.filename)).mtime.getTime() - 
                   fs.statSync(path.join(uploadDir, a.filename)).mtime.getTime();
        });
        res.status(200).json({ success: true, data: mediaList });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.post('/upload', upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }
        
        const ext = path.extname(req.file.filename).toLowerCase();
        const type = ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext) ? 'image' : 'video';
        const serverUrl = req.protocol + '://' + req.get('host');
        
        res.status(201).json({
            success: true,
            data: {
                filename: req.file.filename,
                type: type,
                url: `${serverUrl}/uploads/${req.file.filename}`
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.delete('/:filename', (req, res) => {
    try {
        const filepath = path.join(uploadDir, req.params.filename);
        if (fs.existsSync(filepath)) {
            fs.unlinkSync(filepath);
            res.status(200).json({ success: true, message: 'File deleted' });
        } else {
            res.status(404).json({ success: false, message: 'File not found' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
