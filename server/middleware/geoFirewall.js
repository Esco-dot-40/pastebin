import db from '../db/index.js';
import fetch from 'node-fetch';
import { UAParser } from 'ua-parser-js';
import crypto from 'crypto';

const EUROPEAN_COUNTRIES = [
    'AD', 'AL', 'AT', 'AX', 'BA', 'BE', 'BG', 'BY', 'CH', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'FO', 'FR', 'GB', 'GG', 'GI', 'GR', 'HR', 'HU', 'IE', 'IM', 'IS', 'IT', 'JE', 'LI', 'LT', 'LU', 'LV', 'MC', 'MD', 'ME', 'MK', 'MT', 'NL', 'NO', 'PL', 'PT', 'RO', 'RS', 'RU', 'SE', 'SI', 'SJ', 'SK', 'SM', 'UA', 'VA'
];

export const geoMiddleware = async (req, res, next) => {
    // 1. IP Detection & Normalization
    const rawIp = req.headers['cf-connecting-ip'] ||
        req.headers['x-real-ip'] ||
        req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
        req.socket.remoteAddress ||
        '127.0.0.1';

    let cleanIp = rawIp.trim();
    if (cleanIp.startsWith('::ffff:')) {
        cleanIp = cleanIp.substring(7);
    }

    // 2. Identify Admin ("Mine") - ABSOLUTE EXCLUSION & AUTO-REGISTRATION
    const adminIpSetting = db.prepare("SELECT value FROM firewall_settings WHERE key = 'admin_ip'").get();
    let adminIps = (adminIpSetting?.value || '').split(',').map(v => v.trim()).filter(Boolean);
    const isLocal = cleanIp === '127.0.0.1' || cleanIp === '::1';

    const bypassSecret = process.env.FIREWALL_SECRET;
    const hasSecretBypass = bypassSecret && (req.query.bypass === bypassSecret || req.headers['x-firewall-bypass'] === bypassSecret);
    const isAdminHeader = req.headers['x-admin-auth'] === 'premium-admin';
    const isSessionAdmin = req.session && req.session.isAdmin;

    // Auto-Register Admin IP if they are logged in but IP is not listed
    if (isSessionAdmin && !adminIps.includes(cleanIp) && !isLocal) {
        adminIps.push(cleanIp);
        db.prepare("INSERT OR REPLACE INTO firewall_settings (key, value) VALUES (?, ?)").run('admin_ip', adminIps.join(','));
        console.log(`[FIREWALL] Auto-registered new Admin IP: ${cleanIp}`);
    }

    // 3. Region Detection & Cache Strategy
    let countryCode = req.headers['cf-ipcountry']?.toUpperCase();
    if (countryCode === 'XX' || countryCode === 'T1') countryCode = null;

    // FOR LOCAL TESTING: Force a country code if it's localhost
    if (isLocal && !countryCode) countryCode = 'US';

    // IF THIS IS THE ADMIN OR AUTHORIZED BYPASS, WE STILL LOG BUT SKIP BLOCKING
    if (adminIps.includes(cleanIp) || isLocal || hasSecretBypass || isAdminHeader || isSessionAdmin) {
        // Log skip-block access
        const geoDummy = isLocal ? { 
            countryCode: 'US', 
            country: 'Localhost', 
            city: 'Internal', 
            isp: 'Virtual Node',
            lat: 37.751, 
            lon: -97.822 
        } : null;
        logAccess(cleanIp, req, geoDummy || { countryCode: countryCode || '??' }, 0, 'Admin/Bypass');
        return next();
    }

    // 3. Path & Context Analysis
    const path = req.path || '/';
    const isStatic = /\.(css|js|jpg|jpeg|png|gif|svg|ico|webp|woff|woff2|ttf|eot)$/i.test(path);
    const isBlockedPage = path === '/blocked';

    // Bots usually get a pass for SEO/Embeds unless lockdown is active
    const userAgent = req.headers['user-agent'] || '';
    const isBot = /Discordbot|Twitterbot|facebookexternalhit|LinkedInBot|Slackbot|TelegramBot|WhatsApp|Googlebot|Bingbot|Slurp|DuckDuckBot|Baiduspider|YandexBot|Sogou/i.test(userAgent);

    let geoData = null;
    let blockReason = null;

    // Quick Cache Lookup
    const cachedRow = db.prepare(`
        SELECT * FROM page_accesses 
        WHERE ip = ? 
        AND countryCode IS NOT NULL 
        AND countryCode != '??' 
        ORDER BY id DESC LIMIT 1
    `).get(cleanIp);

    if (cachedRow) {
        countryCode = countryCode || cachedRow.countryCode;
        geoData = cachedRow;
    }

    // 5. Deep Lookup Logic (Strict enforcement for NL)
    if (!countryCode && !isBlockedPage) {
        try {
            const response = await fetch(`http://ip-api.com/json/${cleanIp}?fields=status,message,countryCode,country,regionName,city,zip,lat,lon,isp,org,as,query,proxy,hosting,mobile,reverse`);
            const data = await response.json();
            if (data.status === 'success') {
                geoData = {
                    countryCode: data.countryCode,
                    country: data.country,
                    region: data.regionName,
                    city: data.city,
                    lat: data.lat,
                    lon: data.lon,
                    isp: data.isp,
                    org: data.org,
                    as: data.as,
                    proxy: data.proxy ? 1 : 0,
                    hosting: data.hosting ? 1 : 0,
                    mobile: data.mobile ? 1 : 0,
                    reverse: data.reverse,
                    zip: data.zip
                };
                countryCode = data.countryCode;
            }
        } catch (e) {
            console.error('[GEO] Lookup Error:', e.message);
        }
    }

    // 6. Security & Blocking Logic
    let isBlocked = 0;
    const settings = db.prepare("SELECT * FROM firewall_settings").all();
    const lockdownActive = settings.find(s => s.key === 'lockdown_active')?.value === '1';
    const europeBlockActive = settings.find(s => s.key === 'europe_block')?.value === '1';
    const usaBlockActive = settings.find(s => s.key === 'usa_block')?.value === '1';

    if (lockdownActive) {
        isBlocked = 1;
        blockReason = 'Global Lockdown';
    }

    if (countryCode && !isBlocked) {
        const isEurope = EUROPEAN_COUNTRIES.includes(countryCode);
        const isUSA = countryCode === 'US';
        const isRestricted = (isEurope && europeBlockActive) || (isUSA && usaBlockActive);
        const manualBlock = db.prepare('SELECT 1 FROM blocked_countries WHERE countryCode = ?').get(countryCode);

        if (isRestricted) {
            isBlocked = 1;
            blockReason = `Regional Block (${countryCode})`;
        } else if (manualBlock) {
            isBlocked = 1;
            blockReason = `Manual Country Block (${countryCode})`;
        }
    }

    // 7. Exhaustive Analytic Logging (EVERY SINGLE ASPECT)
    logAccess(cleanIp, req, geoData || { countryCode: countryCode || '??' }, isBlocked, blockReason);

    // 8. Enforce Block
    if (isBlocked && !isBot && !isBlockedPage) {
        if (isStatic) {
            // Drop static requests for blocked users to save bandwidth/noise
            return res.status(403).end();
        }
        return res.redirect('/blocked');
    }

    next();
};

function logAccess(ip, req, geo, isBlocked, blockReason) {
    // Note: Admin exclusion is already handled in geoMiddleware
    console.log(`📡 [ANALYSIS] ${req.method} ${req.path} | ${ip} [${geo.countryCode || '??'}] | ${isBlocked ? 'BLOCKED: ' + blockReason : 'ALLOWED'}`);

    try {
        const user = req.session?.user || {};
        const ua = req.headers['user-agent'] || '';
        const parser = new UAParser(ua);
        const result = parser.getResult();

        const userId = user.id || null;
        const username = user.username || null;

        let meta = {};
        if (req.headers['x-veroe-meta']) {
            try { meta = JSON.parse(req.headers['x-veroe-meta']); } catch (e) { }
        }
        const fingerprint = req.headers['x-veroe-fingerprint'] || crypto.createHash('md5').update(`${ip}-${ua}`).digest('hex');

        // EXHAUSTIVE DATA CAPTURE
        const rawHeaders = JSON.stringify(req.headers);
        const queryParams = JSON.stringify(req.query);
        const cookieData = JSON.stringify(req.cookies || {});

        let requestBody = null;
        if (req.body && Object.keys(req.body).length > 0) {
            try {
                requestBody = JSON.stringify(req.body);
                if (requestBody.length > 5000) requestBody = requestBody.substring(0, 5000) + '... [TRUNCATED]';
            } catch (e) { requestBody = '[PARSE_ERROR]'; }
        }

        db.prepare(`
            INSERT INTO page_accesses 
            (ip, path, method, country, countryCode, region, city, zip, lat, lon, isp, userAgent, proxy, hosting, isBlocked, blockReason, hostname, userId, username, email, referrer, browserName, browserVersion, osName, osVersion, deviceModel, deviceType, fingerprint, cpuCores, deviceMemory, screenResolution, gpuRenderer, osBuild, asn, installedFonts, installedPlugins, rawHeaders, requestBody, queryParams, cookieData)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            ip,
            req.path,
            req.method,
            geo.country || 'Unknown',
            (geo.countryCode || '??').toUpperCase(),
            geo.region || geo.regionName || 'Unknown',
            geo.city || 'Unknown',
            geo.zip || null,
            geo.lat || geo.latitude || 0,
            geo.lon || geo.longitude || 0,
            geo.isp || geo.org || 'Unknown',
            ua,
            geo.proxy || 0,
            geo.hosting || 0,
            isBlocked ? 1 : 0,
            blockReason,
            req.get('host') || 'unknown',
            userId,
            username,
            user.email || null,
            req.get('referrer') || '',
            result.browser.name || 'Unknown',
            result.browser.version || 'Unknown',
            result.os.name || 'Unknown',
            result.os.version || 'Unknown',
            result.device.model || 'Unknown',
            result.device.type || 'desktop',
            fingerprint,
            meta.cpuCores || null,
            meta.deviceMemory || null,
            meta.screenResolution || null,
            meta.gpuRenderer || null,
            meta.osBuild || null,
            geo.as || null,
            meta.installedFonts || null,
            meta.installedPlugins || null,
            rawHeaders,
            requestBody,
            queryParams,
            cookieData
        );
    } catch (e) {
        console.error('[ANALYSIS] Logging Failed:', e.message);
    }
}
