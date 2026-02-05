import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import fs from 'fs';

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

// Diagnostic Logging with File Existence Check
app.use((req, res, next) => {
    const filePath = path.join(__dirname, 'dist', req.url);
    const exists = fs.existsSync(filePath);
    if (req.url.startsWith('/assets/') || req.url.includes('.')) {
        if (!exists) {
            console.log(`[UPLINK] 404 ASSET: ${req.url}`);
            return res.status(404).send('Asset not found');
        }
    }
    console.log(`[UPLINK] Request: ${req.url} | Exists: ${exists} | Path: ${filePath}`);
    next();
});

// Serve static assets from the 'dist' directory
app.use(express.static(path.join(__dirname, 'dist'), {
    maxAge: '1y',
    etag: true
}));

// Primary Entry Point (Fallback for SPA)
app.get('*', (req, res) => {
    // Only return index.html if it's not a file request
    if (req.url.includes('.') && !req.url.endsWith('.html')) {
        return res.status(404).send('Not found');
    }
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, HOST, () => {
    console.log(`Station Alpha Uplink active: http://${HOST}:${PORT}`);
});
