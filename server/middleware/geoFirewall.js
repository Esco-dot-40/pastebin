import db from '../db/firewall.js';
import fetch from 'node-fetch';

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

    // Source A: Cloudflare (Most reliable)
    if (cfCountry && cfCountry !== 'XX' && cfCountry !== 'T1') {
        countryCode = cfCountry.toUpperCase();
        console.log(`[GEO] Source: Cloudflare -> ${countryCode}`);
    }

    // Source B: Cache (Backup)
    if (!countryCode) {
        const cachedRow = db.prepare(`
            SELECT country_code FROM page_accesses 
            WHERE ip = ? 
            AND country_code IS NOT NULL 
            AND country_code != '??' 
            AND length(country_code) = 2 
            ORDER BY id DESC LIMIT 1
        `).get(cleanIp);

        if (cachedRow && cachedRow.country_code) {
            countryCode = cachedRow.country_code.trim().toUpperCase();
            console.log(`[GEO] Source: Cache -> ${countryCode}`);
        }
    }

    // Check for Manual Overrides immediately
    if (req.query.testRestrict === '1' || req.query.testDutch === '1') {
        req.isRestrictedRegion = true;
        console.log(`[GEO] Manual override active for ${cleanIp}`);
    }

    // 3. Hierarchical Security Bypasses
    const isLocal = cleanIp === '127.0.0.1' || cleanIp === '::1';
    const bypassSecret = process.env.FIREWALL_SECRET;
    const hasSecretBypass = bypassSecret && (req.query.bypass === bypassSecret || req.headers['x-firewall-bypass'] === bypassSecret);
    const adminIpSetting = db.prepare("SELECT value FROM firewall_settings WHERE key = 'admin_ip'").get();
    const isAdminIp = adminIpSetting && adminIpSetting.value === cleanIp;
    const isAdminHeader = req.headers['x-admin-auth'] === 'premium-admin';
    const userAgent = req.headers['user-agent'] || '';
    const isBot = /Discordbot|Googlebot|Bingbot|Slurp|DuckDuckBot|Baiduspider|YandexBot|Sogou/i.test(userAgent);

    if (isLocal || hasSecretBypass || isAdminIp || isAdminHeader || isBot) {
        return next();
    }

    // 4. Geo-Blocking Logic & Deep Lookup
    try {
        const lockdownSetting = db.prepare("SELECT value FROM firewall_settings WHERE key = 'lockdown_active'").get();
        const isLockdown = lockdownSetting && lockdownSetting.value === '1';

        if (isLockdown && req.path !== '/blocked') {
            logAccess(cleanIp, req, { country_code: '??' }, 1);
            return res.redirect('/blocked');
        }

        // Deep Lookup Phase
        if (!geoData || req.query.refreshGeo === '1') {
            try {
                // Tier 1: ipapi.co
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 2000);
                try {
                    const response = await fetch(`https://ipapi.co/${cleanIp}/json/`, { signal: controller.signal });
                    clearTimeout(timeoutId);
                    if (response.ok) {
                        const data = await response.json();
                        if (!data.error && data.country_code && data.country_code.length === 2 && data.country_code !== '??') {
                            geoData = { country_code: data.country_code.toUpperCase(), country: data.country_name, isp: data.org };
                        }
                    }
                } catch (e) { }

                // Tier 2: ip-api.com
                if (!geoData) {
                    const fbController = new AbortController();
                    const fbTimeoutId = setTimeout(() => fbController.abort(), 2000);
                    try {
                        const fbResponse = await fetch(`http://ip-api.com/json/${cleanIp}?fields=status,countryCode,country,isp`, { signal: fbController.signal });
                        clearTimeout(fbTimeoutId);
                        if (fbResponse.ok) {
                            const fbData = await fbResponse.json();
                            if (fbData.status === 'success' && fbData.countryCode) {
                                geoData = { country_code: fbData.countryCode.toUpperCase(), country: fbData.country, isp: fbData.isp };
                            }
                        }
                    } catch (e) { }
                }

                // Tier 3: freeipapi.com
                if (!geoData) {
                    const t3Controller = new AbortController();
                    const t3TimeoutId = setTimeout(() => t3Controller.abort(), 2000);
                    try {
                        const t3Response = await fetch(`https://freeipapi.com/api/json/${cleanIp}`, { signal: t3Controller.signal });
                        clearTimeout(t3TimeoutId);
                        if (t3Response.ok) {
                            const t3Data = await t3Response.json();
                            if (t3Data.countryCode) {
                                geoData = { country_code: t3Data.countryCode.toUpperCase(), country: t3Data.countryName };
                            }
                        }
                    } catch (e) { }
                }
            } catch (apiError) {
                console.error(`[GEO] All lookup tiers failed for ${cleanIp}`);
            }
        }

        // UNIFIED RESOLUTION: Combine all sources (CF > Lookup > Cache)
        const resolvedCountry = (geoData?.country_code || countryCode)?.toUpperCase();

        if (resolvedCountry) {
            // Check Europe List
            if (EUROPEAN_COUNTRIES.includes(resolvedCountry)) {
                req.isRestrictedRegion = true;
                console.log(`[GEO] RESTRICTED REGION DETECTED: ${resolvedCountry} for ${cleanIp}`);
            }

            // Check Manual Block List
            const isBlocked = db.prepare('SELECT 1 FROM blocked_countries WHERE country_code = ?').get(resolvedCountry);
            if (isBlocked && req.path !== '/blocked') {
                logAccess(cleanIp, req, geoData || { country_code: resolvedCountry }, 1);
                return res.redirect('/blocked');
            }
        }

        // Log access with whatever data we have
        logAccess(cleanIp, req, geoData || { country_code: resolvedCountry || '??' }, 0);

    } catch (err) {
        console.error('Firewall Middleware Error:', err);
        // Fail-open
    }

    next();
};

function logAccess(ip, req, geo, isBlocked) {
    try {
        db.prepare(`
            INSERT INTO page_accesses 
            (ip, path, method, country, country_code, region, city, lat, lon, isp, user_agent, proxy, hosting, is_blocked)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            ip,
            req.path,
            req.method,
            geo.country || 'Unknown',
            (geo.country_code || '??').toUpperCase(),
            geo.region || 'Unknown',
            geo.city || 'Unknown',
            geo.lat || 0,
            geo.lon || 0,
            geo.isp || 'Unknown',
            req.headers['user-agent'] || '',
            geo.proxy || 0,
            geo.hosting || 0,
            isBlocked ? 1 : 0
        );
    } catch (e) {
        console.error('Failed to log access:', e.message);
    }
}
