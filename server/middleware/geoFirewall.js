import db from '../db/firewall.js';
import fetch from 'node-fetch';

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

    // Clean IP: trim whitespace and strip IPv6 prefixing (::ffff:)
    let cleanIp = rawIp.trim();
    if (cleanIp.startsWith('::ffff:')) {
        cleanIp = cleanIp.substring(7);
    }

    // 2. Hierarchical Security Bypasses

    // Localhost
    const isLocal = cleanIp === '127.0.0.1' || cleanIp === '::1';

    // Secret Key
    const bypassSecret = process.env.FIREWALL_SECRET;
    const hasSecretBypass = bypassSecret && (req.query.bypass === bypassSecret || req.headers['x-firewall-bypass'] === bypassSecret);

    // Admin IP
    const adminIpSetting = db.prepare("SELECT value FROM firewall_settings WHERE key = 'admin_ip'").get();
    const isAdminIp = adminIpSetting && adminIpSetting.value === cleanIp;

    // Admin Header
    const isAdminHeader = req.headers['x-admin-auth'] === 'premium-admin';

    // Bot Whitelist
    const userAgent = req.headers['user-agent'] || '';
    const isBot = /Discordbot|Googlebot|Bingbot|Slurp|DuckDuckBot|Baiduspider|YandexBot|Sogou/i.test(userAgent);

    if (req.query.testDutch === '1') {
        req.isDutch = true;
    }

    if (isLocal || hasSecretBypass || isAdminIp || isAdminHeader || isBot) {
        return next();
    }

    // 3. Geo-Blocking Logic
    try {
        const lockdownSetting = db.prepare("SELECT value FROM firewall_settings WHERE key = 'lockdown_active'").get();
        const isLockdown = lockdownSetting && lockdownSetting.value === '1';

        // Redirect all non-bypassed traffic if lockdown is active
        if (isLockdown && req.path !== '/blocked') {
            logAccess(cleanIp, req, { country_code: '??' }, 1);
            return res.redirect('/blocked');
        }

        // Hybrid Lookup
        let geoData = db.prepare('SELECT * FROM page_accesses WHERE ip = ? AND country_code IS NOT NULL ORDER BY id DESC LIMIT 1').get(cleanIp);

        if (!geoData) {
            try {
                const response = await fetch(`https://ipapi.co/${cleanIp}/json/`, { timeout: 5000 });
                if (response.ok) {
                    const data = await response.json();
                    if (!data.error) {
                        geoData = {
                            country: data.country_name,
                            country_code: data.country_code?.toUpperCase(),
                            region: data.region,
                            city: data.city,
                            lat: data.latitude,
                            lon: data.longitude,
                            isp: data.org,
                            proxy: data.proxy ? 1 : 0,
                            hosting: data.hosting ? 1 : 0
                        };
                    }
                }
            } catch (apiError) {
                console.error(`GeoIP API failed for ${cleanIp}:`, apiError.message);
                // Fail-open: proceed to log and next()
            }
        }

        if (geoData) {
            const countryCode = geoData.country_code?.toUpperCase();
            console.log(`[GEO] IP: ${cleanIp} -> Country: ${countryCode} (Cached: ${!!db.prepare('SELECT 1 FROM page_accesses WHERE ip = ? AND country_code IS NOT NULL').get(cleanIp)})`);

            // Check for Country Block
            const isBlocked = db.prepare('SELECT 1 FROM blocked_countries WHERE country_code = ?').get(countryCode);

            // Region Injection setup
            if (countryCode === 'NL') {
                req.isDutch = true;
                console.log(`[GEO] Dutch visitor detected: ${cleanIp}`);
            }

            if (isBlocked && req.path !== '/blocked') {
                logAccess(cleanIp, req, geoData, 1);
                console.log(`[GEO] Blocking visitor from ${countryCode}: ${cleanIp}`);
                return res.redirect('/blocked');
            }

            logAccess(cleanIp, req, geoData, 0);
        } else {
            console.log(`[GEO] No geo data found for IP: ${cleanIp}`);
            // If no geoData could be fetched, log as unknown but allow (fail-open)
            logAccess(cleanIp, req, { country_code: '??' }, 0);
        }

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
