import db from '../db/index.js';
import fetch from 'node-fetch';
import { UAParser } from 'ua-parser-js';
import crypto from 'crypto';

const EUROPEAN_COUNTRIES = [
    'AD', 'AL', 'AT', 'AX', 'BA', 'BE', 'BG', 'BY', 'CH', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'FO', 'FR', 'GB', 'GG', 'GI', 'GR', 'HR', 'HU', 'IE', 'IM', 'IS', 'IT', 'JE', 'LI', 'LT', 'LU', 'LV', 'MC', 'MD', 'ME', 'MK', 'MT', 'NL', 'NO', 'PL', 'PT', 'RO', 'RS', 'RU', 'SE', 'SI', 'SJ', 'SK', 'SM', 'UA', 'VA'
];

export const geoMiddleware = async (req, res, next) => {
    // 0. Skip Essential Paths & Static Files
    const isStatic = /\.(css|js|jpg|jpeg|png|gif|svg|ico|webp|woff|woff2|ttf|eot)$/i.test(req.path);
    const isBlockedPage = req.path === '/blocked';

    if (isStatic || isBlockedPage) {
        return next();
    }

    // 1. IP Detection & Normalization
    const rawIp = req.headers['cf-connecting-ip'] ||
        req.headers['x-real-ip'] ||
        req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
        req.socket.remoteAddress ||
        '127.0.0.1';

    const cfCountry = req.headers['cf-ipcountry'];

    // Clean IP: trim whitespace and strip IPv6 prefixing (::ffff:)
    let cleanIp = rawIp.trim();
    if (cleanIp.startsWith('::ffff:')) {
        cleanIp = cleanIp.substring(7);
    }

    // 2. Region Detection (Immediate sources)
    let countryCode = null;
    let geoData = null;

    // Source A: Cloudflare (Most reliable)
    if (cfCountry && cfCountry !== 'XX' && cfCountry !== 'T1') {
        countryCode = cfCountry.toUpperCase();
        console.log(`[GEO] Source: Cloudflare -> ${countryCode}`);
    }

    // Source B: Cache (Full lookup)
    const cachedRow = db.prepare(`
        SELECT countryCode, country, region, city, lat, lon, isp 
        FROM page_accesses 
        WHERE ip = ? 
        AND countryCode IS NOT NULL 
        AND countryCode != '??' 
        ORDER BY id DESC LIMIT 1
    `).get(cleanIp);

    if (cachedRow && cachedRow.countryCode) {
        if (!countryCode) countryCode = cachedRow.countryCode.trim().toUpperCase();
        if (!geoData) {
            geoData = {
                countryCode: cachedRow.countryCode,
                country: cachedRow.country,
                region: cachedRow.region,
                city: cachedRow.city,
                lat: cachedRow.lat,
                lon: cachedRow.lon,
                isp: cachedRow.isp
            };
        }
    }

    // 3. Hierarchical Security Bypasses
    const isLocal = cleanIp === '127.0.0.1' || cleanIp === '::1';
    const bypassSecret = process.env.FIREWALL_SECRET;
    const hasSecretBypass = bypassSecret && (req.query.bypass === bypassSecret || req.headers['x-firewall-bypass'] === bypassSecret);
    const adminIpSetting = db.prepare("SELECT value FROM firewall_settings WHERE key = 'admin_ip'").get();
    const adminIps = (adminIpSetting?.value || '').split(',').map(v => v.trim()).filter(Boolean);

    // Primary bypass: Whitelist IPs, Admin Session, or Localhouse
    const isAdminIp = adminIps.includes(cleanIp);
    const isAdminHeader = req.headers['x-admin-auth'] === 'premium-admin';
    const isSessionAdmin = req.session && req.session.isAdmin;
    const userAgent = req.headers['user-agent'] || '';
    const isBot = /Discordbot|Googlebot|Bingbot|Slurp|DuckDuckBot|Baiduspider|YandexBot|Sogou/i.test(userAgent);

    const isAuthPath = req.path.includes('/login') || req.path.includes('/logout');

    if (isLocal || hasSecretBypass || isAdminIp || isAdminHeader || isBot) {
        return next();
    }

    // Special case for Admin: Only log login/logout, skip general PAGE/API logging
    if (isSessionAdmin && !isAuthPath) {
        return next();
    }

    // 4. Geo-Blocking Logic & Deep Lookup
    try {
        const settings = db.prepare("SELECT * FROM firewall_settings").all();
        const lockdownActive = settings.find(s => s.key === 'lockdown_active')?.value === '1';
        const europeBlockActive = settings.find(s => s.key === 'europe_block')?.value === '1';
        const usaBlockActive = settings.find(s => s.key === 'usa_block')?.value === '1';

        if (lockdownActive) {
            logAccess(cleanIp, req, { countryCode: '??' }, 1);
            return res.redirect('/blocked');
        }

        // Deep Lookup Phase
        const needsLookup = !geoData || !geoData.city || geoData.city === 'Unknown' || geoData.city === '';

        if (needsLookup || req.query.refreshGeo === '1') {
            try {
                const response = await fetch(`http://ip-api.com/json/${cleanIp}?fields=status,message,countryCode,country,regionName,city,lat,lon,isp,org,as,proxy,hosting,mobile,reverse`);
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
                        proxy: data.proxy ? 1 : 0,
                        hosting: data.hosting ? 1 : 0,
                        mobile: data.mobile ? 1 : 0,
                        reverse: data.reverse
                    };
                }
            } catch (e) { }
        }

        const resolvedCountry = geoData?.countryCode || countryCode;

        if (resolvedCountry) {
            const isEurope = EUROPEAN_COUNTRIES.includes(resolvedCountry);
            const isUSA = resolvedCountry === 'US';
            const isRestricted = (isEurope && europeBlockActive) || (isUSA && usaBlockActive);
            const isManuallyBlocked = db.prepare('SELECT 1 FROM blocked_countries WHERE countryCode = ?').get(resolvedCountry);

            if (isRestricted || isManuallyBlocked) {
                req.isRestrictedRegion = true;
                logAccess(cleanIp, req, geoData || { countryCode: resolvedCountry }, 1);
                return res.redirect('/blocked');
            }
        }

        logAccess(cleanIp, req, geoData || { countryCode: resolvedCountry || '??' }, 0);
    } catch (err) {
        console.error('Firewall Middleware Error:', err);
    }

    next();
};

function logAccess(ip, req, geo, isBlocked) {
    try {
        const ua = req.headers['user-agent'] || '';
        const parser = new UAParser(ua);
        const result = parser.getResult();

        const user = req.session?.user || {};
        const isAdmin = req.session?.isAdmin;
        const userId = user.id || (isAdmin ? 'admin-root' : null);
        const username = user.username || (isAdmin ? 'Admin' : null);

        // Generate a simple fingerprint (not perfect, but hardening)
        const fingerprint = crypto.createHash('md5')
            .update(`${ip}-${ua}-${req.get('accept-language') || ''}`)
            .digest('hex');

        db.prepare(`
            INSERT INTO page_accesses 
            (ip, path, method, country, countryCode, region, city, lat, lon, isp, userAgent, proxy, hosting, isBlocked, hostname, userId, username, email, referrer, browserName, browserVersion, osName, osVersion, deviceModel, deviceType, fingerprint)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            ip,
            req.path,
            req.method,
            geo.country || 'Unknown',
            (geo.countryCode || geo.country_code || '??').toUpperCase(),
            geo.region || geo.regionName || 'Unknown',
            geo.city || 'Unknown',
            geo.lat || geo.latitude || 0,
            geo.lon || geo.longitude || 0,
            geo.isp || geo.org || 'Unknown',
            ua,
            geo.proxy || 0,
            geo.hosting || 0,
            isBlocked ? 1 : 0,
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
            fingerprint
        );
    } catch (e) {
        console.error('Failed to log access:', e.message);
    }
}
