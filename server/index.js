import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import session from 'express-session';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import pastesRouter from './routes/pastes.js';
import authRouter from './routes/auth.js';
import foldersRouter from './routes/folders.js';
import imagesRouter from './routes/images.js';
import db from './db/index.js';
import sqlite3SessionStore from 'better-sqlite3-session-store';
const SqliteStore = sqlite3SessionStore(session);

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Important for deployment
app.set('trust proxy', 1);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(session({
    store: new SqliteStore({
        client: db,
        expired: {
            clear: true,
            intervalMs: 900000 // 15 mins
        }
    }),
    secret: process.env.SESSION_SECRET || 'minimal-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000 // 1 week
    }
}));

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/pastes', pastesRouter);
app.use('/api/folders', foldersRouter);
app.use('/api/images', imagesRouter);

// Static Folders
app.use('/shared', express.static(path.join(__dirname, '..', 'shared')));
app.use('/public', express.static(path.join(__dirname, '..', 'public')));
app.use('/uploads', express.static(process.env.RAILWAY_VOLUME_MOUNT_PATH
    ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'uploads')
    : path.join(__dirname, '..', 'public', 'uploads')));

// Redirect /admin to /adminperm for convenience
app.get('/admin', (req, res) => res.redirect('/adminperm'));

// Admin Section (/adminperm)
app.use('/adminperm', (req, res, next) => {
    if (req.path === '/login.html' || req.path.match(/\.(css|js|jpg|png|svg|ico)$/)) {
        return next();
    }
    if (!req.session || !req.session.isAdmin) {
        return res.redirect('/adminperm/login.html');
    }
    next();
}, express.static(path.join(__dirname, '..', 'admin')));

// Access Router
import accessRouter from './routes/access.js';
app.use('/api/access', accessRouter);

// Root Redirect/Entry
// Root Redirect/Entry
app.get('/', (req, res) => {
    const indexPath = path.join(__dirname, '..', 'public', 'index.html');
    let html = '';
    try {
        html = fs.readFileSync(indexPath, 'utf-8');
    } catch (err) {
        console.error('Error reading index.html:', err);
        return res.status(500).send('Error loading frontend.');
    }

    // Default Meta Data for Home
    const title = 'veroe.space';
    const description = 'Share code and text content securely.';
    const siteName = 'veroe.space';
    const themeColor = '#00f5ff';
    const imageUrl = `${req.protocol}://${req.get('host')}/public/preview.png`;
    const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;

    const metaTags = `
    <meta property="og:site_name" content="${siteName}">
    <meta property="og:type" content="website">
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${description}">
    <meta property="og:url" content="${fullUrl}">
    <meta property="og:image" content="${imageUrl}">
    <meta name="theme-color" content="${themeColor}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${title}">
    <meta name="twitter:description" content="${description}">
    <meta name="twitter:image" content="${imageUrl}">
    `;

    // Replace title if needed, or just rely on meta tags. 
    // index.html has <title>QuietBin.space</title> already, but let's be explicit.
    html = html.replace(/<title>.*?<\/title>/, `<title>${title}</title>`);

    // Inject before closing head
    html = html.replace('</head>', `${metaTags}\n</head>`);

    res.send(html);
});

// Public Viewer - SPA Redirects
app.get('/public', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Short URL for viewing pastes: /v/ID
app.get('/v/:id', (req, res) => {
    const pasteId = req.params.id;
    const indexPath = path.join(__dirname, '..', 'public', 'index.html');

    // 1. Read the template
    let html = '';
    try {
        html = fs.readFileSync(indexPath, 'utf-8');
    } catch (err) {
        console.error('Error reading index.html:', err);
        return res.status(500).send('Error loading frontend.');
    }

    // 2. Fetch Paste Metadata (Synchronously for simplicity/speed in this context or use async)
    // Since we are in an async handler, better to be safe. But `better-sqlite3` is synchronous! 
    // `db` in `index.js` comes from `./db/index.js`. Check if it's better-sqlite3.
    // server/index.js line 12: `import sqlite3SessionStore from 'better-sqlite3-session-store';`
    // It's likely better-sqlite3.

    let paste = null;
    try {
        paste = db.prepare('SELECT title, content, isPublic, password, embedUrl FROM pastes WHERE id = ?').get(pasteId);
    } catch (e) {
        console.error('DB Error fetching paste for embed:', e);
    }

    // 3. Construct Meta Data
    // Default values if paste not found (SPA will handle 404 UI)
    let title = 'veroe.space';
    let description = 'Share code and text content securely.';
    const siteName = 'veroe.space';
    const themeColor = '#00f5ff'; // Cyan/Neon Blue from your theme
    let imageUrl = `${req.protocol}://${req.get('host')}/public/preview.png`;
    let videoUrl = null;
    let videoType = 'text/html';

    if (paste) {
        title = paste.title || 'Untitled Paste';

        // Handle image vs video in embedUrl
        if (paste.embedUrl) {
            let fullEmbedUrl = paste.embedUrl;
            if (!fullEmbedUrl.startsWith('http')) {
                fullEmbedUrl = `${req.protocol}://${req.get('host')}${fullEmbedUrl.startsWith('/') ? '' : '/'}${fullEmbedUrl}`;
            }

            // Simple extension detection
            if (fullEmbedUrl.match(/\.(mp4|webm|mov)$/i)) {
                videoUrl = fullEmbedUrl;
                videoType = 'video/mp4';
                // For direct video, also provide a thumbnail if we can
                imageUrl = `${req.protocol}://${req.get('host')}/public/preview.png`;
            } else {
                imageUrl = fullEmbedUrl;
            }
        }

        if (paste.password) {
            description = '🔒 This paste is password protected.';
        } else if (paste.isPublic === 0) {
            description = '🔒 Private Paste.';
        } else {
            // Check for iframe in content
            const iframeMatch = paste.content?.match(/<iframe.*?src=["'](.*?)["']/i);
            if (iframeMatch && iframeMatch[1]) {
                videoUrl = iframeMatch[1];
                videoType = 'text/html';
            }

            // Truncate content for description AND STRIP HTML/Code
            let rawContent = paste.content || '';

            // Decode common HTML entities (case insensitive)
            rawContent = rawContent
                .replace(/&lt;/gi, '<')
                .replace(/&gt;/gi, '>')
                .replace(/&quot;/gi, '"')
                .replace(/&#39;/gi, "'")
                .replace(/&nbsp;/gi, ' ')
                .replace(/&amp;/gi, '&');

            const strippedContent = rawContent
                .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove scripts
                .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')   // Remove styles
                .replace(/<\/?[^>]+(>|$)/g, ' ')                                    // Strip tags
                .replace(/[=-]{3,}/g, '')                                          // Remove separators
                .replace(/\s+/g, ' ')                                              // Collapse spaces
                .trim();

            const maxDesc = 200;
            if (strippedContent.length > 3) {
                description = strippedContent.length > maxDesc
                    ? strippedContent.substring(0, maxDesc) + '...'
                    : strippedContent;
            } else {
                description = 'Interactive content hosted on veroe.space';
            }
        }
    }



    // 4. Escape HTML Helpers
    const escape = (str) => String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    const safeTitle = escape(title);
    const safeDesc = escape(description);
    const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;

    // 5. Inject Meta Tags
    // We replace the existing <title> and append meta tags to <head>

    let metaTags = `
    <meta property="og:site_name" content="${siteName}">
    <meta property="og:type" content="website">
    <meta property="og:title" content="${safeTitle}">
    <meta property="og:description" content="${safeDesc}">
    <meta property="og:url" content="${fullUrl}">
    <meta name="theme-color" content="${themeColor}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${safeTitle}">
    <meta name="twitter:description" content="${safeDesc}">
    `;

    if (imageUrl) {
        metaTags += `
    <meta property="og:image" content="${imageUrl}">
    <meta name="twitter:image" content="${imageUrl}">
        `;
    }

    if (videoUrl) {
        metaTags += `
    <meta property="og:video" content="${videoUrl}">
    <meta property="og:video:url" content="${videoUrl}">
    <meta property="og:video:secure_url" content="${videoUrl}">
    <meta property="og:video:type" content="${videoType}">
    <meta property="og:video:width" content="1280">
    <meta property="og:video:height" content="720">
        `;
    }

    // Replace title
    html = html.replace(/<title>.*?<\/title>/, `<title>${safeTitle} | ${siteName}</title>`);

    // Inject before closing head
    html = html.replace('</head>', `${metaTags}\n</head>`);

    res.send(html);
});


// Error handling
app.use((err, req, res, next) => {
    console.error(err);
    if (req.path.startsWith('/api') || req.xhr || req.headers.accept?.includes('json')) {
        res.status(500).json({ error: err.message || 'Internal Server Error' });
    } else {
        res.status(500).send('Internal Server Error');
    }
});

app.listen(PORT, () => {
    console.log(`🚀 veroe.space Ready on Port ${PORT}!`);
});
