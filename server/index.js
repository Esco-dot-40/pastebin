import express from 'express';
import cors from 'cors';
import os from 'os';
import dotenv from 'dotenv';
import session from 'express-session';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import pastesRouter from './routes/pastes.js';
import authRouter from './routes/auth.js';
import foldersRouter from './routes/folders.js';
import imagesRouter from './routes/images.js';
import bannerRouter from './routes/banner.js';
import db from './db/index.js';
import sqlite3SessionStore from 'better-sqlite3-session-store';
import { startAutoBackup } from './services/auto-backup.js';
const SqliteStore = sqlite3SessionStore(session);

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

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

// Global Page Access Tracking Middleware
app.use(async (req, res, next) => {
    const isStatic = /\.(css|js|jpg|jpeg|png|gif|svg|ico|webp|woff|woff2|ttf|eot)$/i.test(req.path);
    const isApi = req.path.startsWith('/api/');
    const isAdminPath = req.path.startsWith('/adminperm/');
    const isAdminUser = req.session && req.session.isAdmin;

    // IP Detection
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
        req.headers['x-real-ip'] ||
        req.socket.remoteAddress ||
        '127.0.0.1';
    const cleanIP = ip.includes('::ffff:') ? ip.split(':').pop() : ip;

    // --- SELF-LEARNING FIREWALL (DISABLED DUE TO USER LOCKOUTS) ---
    /*
    if (!isStatic && !isAdminUser && cleanIP !== '127.0.0.1') {
        const blacklist = db.prepare('SELECT proxy, hosting FROM page_accesses WHERE ip = ? AND (proxy = 1 OR hosting = 1) LIMIT 1').get(cleanIP);
        if (blacklist) {
            console.warn(`🛡️ [BLOCK] Neutralized Proxy Node: ${cleanIP}`);
            return res.status(403).send('<h1>403 Forbidden</h1><p>Access Denied: Non-Residential Transit Node Detected.</p>');
        }
    }
    */

    // --- EXCLUSION LOGIC ---
    // 3. Skip if IP is in the ignore list
    const ignoreIPs = (process.env.IGNORE_IPS || '').split(',').map(i => i.trim());
    const isIgnoredIP = ignoreIPs.includes(cleanIP);
    // 4. Skip based on explicit env flag
    const shouldSkip = (isAdminPath || isAdminUser || isIgnoredIP) && process.env.LOG_ADMIN_AND_SELF !== 'true';

    if (!isStatic && !isApi && !shouldSkip && req.method === 'GET') {
        setImmediate(async () => {
            try {
                const userAgent = req.headers['user-agent'] || '';
                const referrer = req.headers['referer'] || req.headers['referrer'] || null;

                let geoData = null;
                // Only fetch geo for external IPs
                const isLocal = cleanIP === '127.0.0.1' || cleanIP.startsWith('192.168.') || cleanIP.startsWith('10.');

                if (!isLocal) {
                    try {
                        const fetch = (await import('node-fetch')).default;
                        const fields = 'status,message,country,countryCode,region,regionName,city,district,zip,lat,lon,timezone,offset,currency,isp,org,as,asname,reverse,mobile,proxy,hosting,query';
                        const response = await fetch(`http://ip-api.com/json/${cleanIP}?fields=${fields}`);
                        const data = await response.json();
                        if (data.status === 'success') geoData = data;
                    } catch (e) { }
                }

                if (geoData) {
                    db.prepare(`
                        INSERT INTO page_accesses (
                            path, method, ip, country, countryCode, region, regionName, city, district, zip, lat, lon, 
                            timezone, currency, isp, org, asName, userAgent, referrer, reverse,
                            proxy, hosting, mobile
                        )
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `).run(
                        req.path, req.method, cleanIP,
                        geoData.country, geoData.countryCode, geoData.region, geoData.regionName, geoData.city, geoData.district, geoData.zip,
                        geoData.lat, geoData.lon, geoData.timezone, geoData.currency,
                        geoData.isp, geoData.org, geoData.as, userAgent, referrer, geoData.reverse || null,
                        geoData.proxy ? 1 : 0, geoData.hosting ? 1 : 0, geoData.mobile ? 1 : 0
                    );
                } else {
                    db.prepare(`INSERT INTO page_accesses (path, method, ip, userAgent, referrer) VALUES (?, ?, ?, ?, ?)`).run(req.path, req.method, cleanIP, userAgent, referrer);
                }
            } catch (err) { }
        });
    }

    next();
});

// Helper for manual events
export const logEvent = async (req, path, method = 'LOG') => {
    try {
        const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.headers['x-real-ip'] || req.socket.remoteAddress || '127.0.0.1';
        const cleanIP = ip.includes('::ffff:') ? ip.split(':').pop() : ip;
        const userAgent = req.headers['user-agent'] || '';
        db.prepare(`INSERT INTO page_accesses (path, method, ip, userAgent) VALUES (?, ?, ?, ?)`).run(path, method, cleanIP, userAgent);
    } catch (e) { }
};

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/pastes', pastesRouter);
app.use('/api/folders', foldersRouter);
app.use('/api/images', imagesRouter);
import analyticsRouter from './routes/analytics.js';
app.use('/api/analytics', analyticsRouter);

app.use('/api/admin', bannerRouter);

// Static Folders
app.use('/shared', express.static(path.join(__dirname, '..', 'shared')));
app.use('/public', express.static(path.join(__dirname, '..', 'public')));
app.use('/uploads', express.static(process.env.RAILWAY_VOLUME_MOUNT_PATH
    ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'uploads')
    : path.join(__dirname, '..', 'public', 'uploads')));

// Redirect /admin to /adminperm for convenience
app.get('/admin', (req, res) => res.redirect('/adminperm'));

// Public Folders (for gallery dropdown)
app.get('/api/public-folders', (req, res) => {
    try {
        const folders = db.prepare('SELECT name FROM folders ORDER BY name ASC').all();
        res.json(folders);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Public Gallery Route (SPA handle)
app.get('/public', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Status Page Route
app.get('/status', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'status.html'));
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

// Access Router
import accessRouter from './routes/access.js';
app.use('/api/access', accessRouter);

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
    const title = 'veroe.space // encrypted transmissions';
    const description = 'Secure, ephemeral node synchronization. Powered by cinematic propagation and aesthetic code.';
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

// Dedicated Status Page
app.get('/status', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'status.html'));
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
    const indexPath = path.join(__dirname, '..', 'public', 'index.html');

    // 1. Read the template
    let html = '';
    try {
        html = fs.readFileSync(indexPath, 'utf-8');
    } catch (err) {
        console.error('Error reading index.html:', err);
        return res.status(500).send('Error loading frontend.');
    }

    // 2. Fetch Paste Metadata
    let paste = null;
    try {
        paste = db.prepare('SELECT title, content, isPublic, password, embedUrl FROM pastes WHERE id = ?').get(pasteId);
    } catch (e) {
        console.error('DB Error fetching paste for embed:', e);
    }

    // 3. Construct Meta Data
    let title = 'veroe.space // node missing';
    let description = 'Transmission not found or purged from the ephemeral repository.';
    const siteName = 'veroe.space';
    const themeColor = '#00f5ff';
    let imageUrl = `${req.protocol}://${req.get('host')}/public/preview.png`;
    let videoUrl = null;
    let videoType = 'text/html';

    if (paste) {
        const isPrivate = paste.isPublic === 0;
        const key = req.query.key;
        const isAdmin = req.session && req.session.isAdmin;

        if (isPrivate && !isAdmin && !key) {
            title = 'veroe.space // sector locked';
            description = 'Authorized signature required for node synchronization.';
        } else {
            title = paste.title || 'Untitled Paste';

            if (paste.embedUrl) {
                let fullEmbedUrl = paste.embedUrl;
                if (!fullEmbedUrl.startsWith('http')) {
                    fullEmbedUrl = `${req.protocol}://${req.get('host')}${fullEmbedUrl.startsWith('/') ? '' : '/'}${fullEmbedUrl}`;
                }
                if (fullEmbedUrl.match(/\.(mp4|webm|mov)$/i)) {
                    videoUrl = fullEmbedUrl;
                    videoType = 'video/mp4';
                    imageUrl = `${req.protocol}://${req.get('host')}/public/preview.png`;
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
    let metaTags = `
    <meta property="og:site_name" content="${siteName}">
    <meta property="og:type" content="website">
    <meta property="og:title" content="${safeTitle}">
    <meta property="og:description" content="${safeDesc}">
    <meta property="og:url" content="${fullUrl}">
    <meta name="theme-color" content="${themeColor}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${safeTitle}">
    <meta name="twitter:description" content="${safeDesc}">`;

    if (imageUrl) {
        metaTags += `
    <meta property="og:image" content="${imageUrl}">
    <meta name="twitter:image" content="${imageUrl}">`;
    }

    if (videoUrl) {
        metaTags += `
    <meta property="og:video" content="${videoUrl}">
    <meta property="og:video:url" content="${videoUrl}">
    <meta property="og:video:secure_url" content="${videoUrl}">
    <meta property="og:video:type" content="${videoType}">
    <meta property="og:video:width" content="1280">
    <meta property="og:video:height" content="720">`;
    }

    html = html.replace(/<title>.*?<\/title>/, `<title>${safeTitle} | ${siteName}</title>`);
    html = html.replace('</head>', `${metaTags}\n</head>`);
    res.send(html);
});


// Custom 404 Error Page (Neon Style)
app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, '..', 'public', '404.html'));
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

    // Start automatic backup service
    try {
        startAutoBackup();
    } catch (error) {
        console.error('⚠️  Auto-backup service failed to start:', error.message);
    }
});

