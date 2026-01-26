import express from 'express';
import db from '../db/index.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const indexPath = path.join(__dirname, '..', '..', 'public', 'index.html');

// Get current banner text
router.get('/banner', (req, res) => {
    try {
        const html = fs.readFileSync(indexPath, 'utf8');
        const match = html.match(/<div id="announcement-banner"[^>]*>(.*?)<\/div>/s);
        const bannerText = match ? match[1].trim() : '';
        res.json({ text: bannerText });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update banner text
router.post('/banner', (req, res) => {
    const { text } = req.body;

    if (!text || typeof text !== 'string') {
        return res.status(400).json({ error: 'Banner text is required' });
    }

    try {
        let html = fs.readFileSync(indexPath, 'utf8');

        // Replace banner content
        html = html.replace(
            /(<div id="announcement-banner"[^>]*>)(.*?)(<\/div>)/s,
            `$1\n        ${text}\n    $3`
        );

        fs.writeFileSync(indexPath, html, 'utf8');
        res.json({ success: true, text });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
