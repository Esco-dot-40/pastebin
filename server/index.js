import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import cors from 'cors';
import os from 'os';
import session from 'express-session';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import pastesRouter from './routes/pastes.js';
import authRouter from './routes/auth.js';
import foldersRouter from './routes/folders.js';
import imagesRouter from './routes/images.js';
import bannerRouter from './routes/banner.js';
import firewallRouter from './routes/firewall.js';
import analyticsRouter from './routes/analytics.js';
import db from './db/index.js';
import sqlite3SessionStore from 'better-sqlite3-session-store';
import { startAutoBackup } from './services/auto-backup.js';
import { geoMiddleware } from './middleware/geoFirewall.js';
const SqliteStore = sqlite3SessionStore(session);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);

// Priority Static Assets
const hubDistPath = path.join(__dirname, '..', '3d-dashboard', 'dist');
app.use(express.static(hubDistPath, { index: false }));
app.use('/public', express.static(path.join(__dirname, '..', 'public')));

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

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

// High-Security Geo-Firewall & Analytics Engine
app.use(geoMiddleware);

// Helper for manual events
export const logEvent = async (req, path, method = 'LOG') => {
    try {
        const ip = req.headers['cf-connecting-ip'] ||
            req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
            req.headers['x-real-ip'] ||
            req.socket.remoteAddress ||
            '127.0.0.1';
        const cleanIP = ip.includes('::ffff:') ? ip.split(':').pop() : ip;
        const userAgent = req.headers['user-agent'] || '';
        db.prepare(`INSERT INTO page_accesses (path, method, ip, userAgent, countryCode) VALUES (?, ?, ?, ?, ?)`).run(path, method, cleanIP, userAgent, '??');
    } catch (e) { }
};

// Utility to serve HTML with injected meta tags
const serveHtmlWithMeta = (req, res, title, description, customMeta = '', templateType = 'public') => {
    let indexPath;
    if (templateType === 'hub') {
        indexPath = path.join(hubDistPath, 'index.html');
    } else {
        indexPath = path.join(__dirname, '..', 'public', 'index.html');
    }

    let html = '';
    try {
        html = fs.readFileSync(indexPath, 'utf-8');
    } catch (err) {
        console.error(`Error reading index.html (${templateType}):`, err);
        return res.status(500).send('Error loading frontend.');
    }

    const siteName = 'veroe.space';
    const themeColor = '#00f5ff';
    const host = req.get('host');
    const proto = (req.protocol === 'https' || req.headers['x-forwarded-proto'] === 'https') ? 'https' : 'http';

    const defaultImageUrl = `${proto}://${host}/public/preview.png`;
    const fullUrl = `${proto}://${host}${req.originalUrl}`;

    const escape = (str) => String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const safeTitle = escape(title);
    const safeDesc = escape(description);
    const safeUrl = escape(fullUrl);

    const hasCustomImage = customMeta.includes('og:image') || customMeta.includes('twitter:image');
    const imageMeta = hasCustomImage ? '' : `
    <meta property="og:image" content="${escape(defaultImageUrl)}">
    <meta name="twitter:image" content="${escape(defaultImageUrl)}">`;

    const isVideo = customMeta.includes('og:video');
    const twitterCard = isVideo ? 'player' : 'summary_large_image';

    let legalScript = '';
    if (req.isRestrictedRegion) {
        try {
            const scriptPath = path.join(__dirname, '..', 'public', 'legal-notice.js');
            legalScript = fs.readFileSync(scriptPath, 'utf-8');
        } catch (e) {
            console.error('Failed to read legal-notice.js for inlining:', e.message);
        }
    }

    const metaBlock = `
    <!-- Primary Meta Tags -->
    <title>${safeTitle} | ${siteName}</title>
    <meta name="title" content="${safeTitle} | ${siteName}">
    <meta name="description" content="${safeDesc}">

    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="${isVideo ? 'video.other' : 'website'}">
    <meta property="og:url" content="${safeUrl}">
    <meta property="og:title" content="${safeTitle}">
    <meta property="og:description" content="${safeDesc}">
    <meta property="og:site_name" content="${siteName}">
    ${imageMeta}

    <!-- Twitter -->
    <meta name="twitter:card" content="${twitterCard}">
    <meta name="twitter:url" content="${safeUrl}">
    <meta name="twitter:title" content="${safeTitle}">
    <meta name="twitter:description" content="${safeDesc}">
    
    <!-- Theme & Colors -->
    <meta name="theme-color" content="${themeColor}">
    ${customMeta}`;

    // Clean up existing titles to prevent double titles
    html = html.replace(/<title>.*?<\/title>/gi, '');

    // Inject Head Meta at the very top of head for best crawler support
    html = html.replace(/<head.*?>/i, (match) => `${match}\n${metaBlock}`);

    // Inject Body Guard (The Notice)
    if (req.isRestrictedRegion && legalScript) {
        const guardScript = `<script>window.FORCE_LEGAL_NOTICE = true;</script><script>${legalScript}</script>`;
        html = html.replace(/<body.*?>/, (match) => `${match}\n${guardScript}`);
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(html);
};

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/pastes', pastesRouter);
app.use('/api/folders', foldersRouter);
app.use('/api/images', imagesRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/firewall', firewallRouter);

app.use('/api/admin', bannerRouter);

// Redirect /admin to /adminperm for convenience
app.get('/admin', (req, res) => res.redirect('/adminperm'));

// Shared Static Assets
app.use('/shared', express.static(path.join(__dirname, '..', 'shared')));
app.use('/uploads', express.static(process.env.RAILWAY_VOLUME_MOUNT_PATH
    ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'uploads')
    : path.join(__dirname, '..', 'public', 'uploads')));

// Admin Auth Status
app.get('/api/auth/status', (req, res) => {
    res.json({ isAuthenticated: !!(req.session && req.session.isAdmin) });
});

app.get('/favicon.ico', (req, res) => {
    // Serve the logo as favicon or a 204 No Content to stop the 404
    res.status(204).end();
});

// Public Folders (for gallery dropdown)
app.get('/api/public-folders', (req, res) => {
    try {
        const folders = db.prepare('SELECT name FROM folders ORDER BY name ASC').all();
        res.json(folders);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Status Page Route
app.get('/status', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'status.html'));
});

app.get('/blocked', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'blocked.html'));
});

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

app.get('/api/uptime', (req, res) => {
    const services = [
        { name: 'Database Kernel', status: 'online', latency: '12ms', uptime: '99.98%' },
        { name: 'API Propagation Node', status: 'online', latency: '45ms', uptime: '100%' },
        { name: 'Encrypted Storage Layer', status: 'online', latency: '28ms', uptime: '99.95%' },
        { name: 'Discord Uplink', status: 'online', latency: '150ms', uptime: '98.4%' },
        { name: 'Global CDN Layer', status: 'online', latency: '5ms', uptime: '100%' }
    ];
    res.json({
        systemStatus: 'Fully Operational',
        lastChecked: new Date(),
        services
    });
});

// Access Router (Imported at top or used here)
import accessRouter from './routes/access.js';
app.use('/api/access', accessRouter);

// Root Redirect/Entry (Splash Screen)
app.get('/', (req, res) => {
    // Serve the Universal Hub (3D Loader) with dynamic meta tags
    serveHtmlWithMeta(
        req, res,
        'STATION ALPHA',
        'Direct uplink to the ephemeral node repository. Aesthetic code and cinematic propagation.',
        '',
        'hub'
    );
});

// Main Site Entry
app.get('/home', (req, res) => {
    serveHtmlWithMeta(
        req, res,
        'Home',
        'Secure node synchronization and ephemeral data storage.'
    );
});

// SPA Fallback for Hub
app.get('/hub/*', (req, res) => {
    res.sendFile(path.join(hubDistPath, 'index.html'));
});

// Public Gallery Route (SPA handle)
app.get('/public', (req, res) => {
    serveHtmlWithMeta(
        req, res,
        'public archives',
        'Browse the public node repository. Aesthetic code and cinematic propagation.'
    );
});

// Dedicated Status Page
app.get('/status', (req, res) => {
    const statusPath = path.join(__dirname, '..', 'public', 'status.html');
    res.sendFile(statusPath);
});

// Heartbeat Analytics API
app.get('/api/heartbeat-data', (req, res) => {
    // Real system metrics
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const memUsage = (((totalMem - freeMem) / totalMem) * 100).toFixed(1);

    const baseLatency = 15;
    const finalLatency = Math.floor(baseLatency + Math.random() * 10);
    const uptime = (99.987 + (Math.random() * 0.01)).toFixed(3);

    // Mock component data with history for the new UI
    const components = [
        {
            name: 'Main Website',
            type: 'HTTPS',
            status: 'Operational',
            uptime: '99.98%',
            latency: '124ms',
            icon: 'globe',
            history: Array.from({ length: 40 }, () => Math.random() > 0.98 ? 'down' : 'up')
        },
        {
            name: 'Analytics API',
            type: 'REST API',
            status: 'Operational',
            uptime: '100%',
            latency: '85ms',
            icon: 'bolt',
            history: Array.from({ length: 40 }, (_, i) => i === 15 ? 'down' : 'up')
        },
        {
            name: 'PostgreSQL Database',
            type: 'TCP',
            status: 'Operational',
            uptime: '99.95%',
            latency: '12ms',
            icon: 'database',
            history: Array.from({ length: 40 }, (_, i) => i === 8 ? 'down' : 'up')
        },
        {
            name: 'Image Content Delivery',
            type: 'CDN',
            status: 'Operational',
            uptime: '100%',
            latency: '45ms',
            icon: 'shield',
            history: Array.from({ length: 40 }, (_, i) => i === 10 ? 'down' : 'up')
        }
    ];

    res.json({
        load: memUsage,
        latency: finalLatency,
        uptime: uptime,
        components,
        lastChecked: new Date().toLocaleTimeString()
    });
});

// Short URL for viewing pastes: /v/ID
app.get('/v/:id', (req, res) => {
    const pasteId = req.params.id;

    // 1. Fetch Paste Metadata
    let paste = null;
    try {
        paste = db.prepare('SELECT title, content, isPublic, password, embedUrl, discordThumbnail FROM pastes WHERE id = ? COLLATE NOCASE').get(pasteId);
    } catch (e) {
        console.error('DB Error fetching paste for embed:', e);
    }

    // 2. Default Meta Data
    let title = 'node missing';
    let description = 'Transmission not found or purged from the ephemeral repository.';
    let imageUrl = '';
    let videoUrl = null;
    let videoType = 'text/html';

    if (paste) {
        const isPrivate = paste.isPublic === 0;
        const key = req.query.key;
        const isAdmin = req.session && req.session.isAdmin;

        if (isPrivate && !isAdmin && !key) {
            title = 'sector locked';
            description = 'Authorized signature required for node synchronization.';
        } else {
            title = paste.title || 'Untitled Paste';

            if (paste.embedUrl) {
                let fullEmbedUrl = paste.embedUrl;
                if (!fullEmbedUrl.startsWith('http')) {
                    const protocol = (req.protocol === 'https' || req.headers['x-forwarded-proto'] === 'https') ? 'https' : 'http';
                    const host = req.get('host');
                    fullEmbedUrl = `${protocol}://${host}${fullEmbedUrl.startsWith('/') ? '' : '/'}${fullEmbedUrl}`;
                }
                if (fullEmbedUrl.match(/\.(mp4|webm|mov)$/i)) {
                    videoUrl = fullEmbedUrl;
                    videoType = 'video/mp4';
                } else if (fullEmbedUrl.match(/\.gif$/i)) {
                    // GIFs need special treatment for Discord
                    videoUrl = fullEmbedUrl;
                    videoType = 'video.other';
                    imageUrl = fullEmbedUrl; // Also set as image for fallback
                } else {
                    imageUrl = fullEmbedUrl;
                }
            }

            if (paste.password) {
                description = '🔒 This paste is password protected.';
            } else {
                const iframeMatch = paste.content?.match(/<iframe.*?src=["'](.*?)["']/i);
                if (iframeMatch && iframeMatch[1]) {
                    videoUrl = iframeMatch[1];
                    videoType = 'text/html';
                }

                let rawContent = paste.content || '';
                rawContent = rawContent
                    .replace(/&lt;/gi, '<')
                    .replace(/&gt;/gi, '>')
                    .replace(/&quot;/gi, '"')
                    .replace(/&#39;/gi, "'")
                    .replace(/&nbsp;/gi, ' ')
                    .replace(/&amp;/gi, '&');

                const strippedContent = rawContent
                    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
                    .replace(/<\/?[^>]+(>|$)/g, ' ')
                    .replace(/[=-]{3,}/g, '')
                    .replace(/\s+/g, ' ')
                    .trim();

                const maxDesc = 200;
                description = strippedContent.length > 3
                    ? (strippedContent.length > maxDesc ? strippedContent.substring(0, maxDesc) + '...' : strippedContent)
                    : 'Interactive content hosted on veroe.space';
            }
        }
    }

    let customMeta = '';

    // Priority 1: If discordThumbnail is set, use it for the og:image (Discord static thumbnail)
    if (paste.discordThumbnail) {
        let fullThumbnailUrl = paste.discordThumbnail;
        if (!fullThumbnailUrl.startsWith('http')) {
            const protocol = (req.protocol === 'https' || req.headers['x-forwarded-proto'] === 'https') ? 'https' : 'http';
            const host = req.get('host');
            fullThumbnailUrl = `${protocol}://${host}${fullThumbnailUrl.startsWith('/') ? '' : '/'}${fullThumbnailUrl}`;
        }
        const safeThumbnail = fullThumbnailUrl.replace(/"/g, '&quot;');
        customMeta += `
    <meta property="og:image" content="${safeThumbnail}">
    <meta name="twitter:image" content="${safeThumbnail}">`;
    } else if (imageUrl) {
        // Priority 2: Use embedUrl as image if no discordThumbnail
        const safeImg = imageUrl.replace(/"/g, '&quot;');
        customMeta += `
    <meta property="og:image" content="${safeImg}">
    <meta name="twitter:image" content="${safeImg}">`;
    }

    if (videoUrl) {
        const safeVid = videoUrl.replace(/"/g, '&quot;');
        const safeVidType = videoType.replace(/"/g, '&quot;');

        // For Discord/Twitter player support
        customMeta += `
    <meta property="og:video" content="${safeVid}">
    <meta property="og:video:url" content="${safeVid}">
    <meta property="og:video:secure_url" content="${safeVid}">
    <meta property="og:video:type" content="${safeVidType}">
    <meta property="og:video:width" content="1280">
    <meta property="og:video:height" content="720">
    <meta name="twitter:player" content="${safeVid}">
    <meta name="twitter:player:width" content="1280">
    <meta name="twitter:player:height" content="720">`;
    }

    serveHtmlWithMeta(req, res, title, description, customMeta);
});


// Custom 404 Error Page (Neon Style)
app.use((req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/public') || req.path.startsWith('/shared') || req.path.startsWith('/uploads')) {
        return res.status(404).sendFile(path.join(__dirname, '..', 'public', '404.html'));
    }
    // SPA Fallback for other routes
    serveHtmlWithMeta(req, res, 'encrypted transmissions', 'Secure node synchronization.');
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

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 veroe.space Ready on Port ${PORT}!`);

    // Start automatic backup service
    try {
        startAutoBackup();
    } catch (error) {
        console.error('⚠️  Auto-backup service failed to start:', error.message);
    }
});

