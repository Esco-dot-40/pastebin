import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { requireAuth } from '../middleware/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = process.env.RAILWAY_VOLUME_MOUNT_PATH
    ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'uploads')
    : path.join(__dirname, '..', '..', 'public', 'uploads');

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 1024 * 1024 * 1024 }, // 1GB limit (for large videos)
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
            cb(null, true);
        } else {
            cb(new Error('Only images and videos are allowed'));
        }
    }
}).single('image');

const router = express.Router();

router.post('/upload', requireAuth, (req, res) => {
    console.log(`[UPLOAD] Received upload request from ${req.ip}`);
    upload(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            console.error(`[UPLOAD] Multer Error: ${err.message}`, err);
            return res.status(400).json({ error: `Upload error: ${err.message}` });
        } else if (err) {
            console.error(`[UPLOAD] Generic Error: ${err.message}`, err);
            return res.status(400).json({ error: err.message });
        }

        try {
            if (!req.file) {
                console.warn('[UPLOAD] No file received in request body');
                return res.status(400).json({ error: 'No file uploaded' });
            }

            console.log(`[UPLOAD] Successfully saved: ${req.file.filename} (${(req.file.size / 1024 / 1024).toFixed(2)} MB)`);
            const url = `/uploads/${req.file.filename}`;
            res.json({ url, success: true });
        } catch (e) {
            console.error('[UPLOAD] Server Error:', e);
            res.status(500).json({ error: e.message });
        }
    });
});

export default router;
