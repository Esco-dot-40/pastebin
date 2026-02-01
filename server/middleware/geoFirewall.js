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

    // 2. Region Detection (Immediate cache check)
    let countryCode = null;
    // Strict query: country_code must be exactly 2 characters and not '??'
    const cachedGeo = db.prepare('SELECT country_code FROM page_accesses WHERE ip = ? AND country_code IS NOT NULL AND length(country_code) = 2 AND country_code != "??" ORDER BY id DESC LIMIT 1').get(cleanIp);

    if (cachedGeo) {
        countryCode = cachedGeo.country_code?.toUpperCase();
        console.log(`[GEO] IP: ${cleanIp} -> Country: ${countryCode} (Cached: true)`);
    }

    const EUROPEAN_COUNTRIES = [
        'AD', 'AL', 'AT', 'AX', 'BA', 'BE', 'BG', 'BY', 'CH', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'FO', 'FR', 'GB', 'GG', 'GI', 'GR', 'HR', 'HU', 'IE', 'IM', 'IS', 'IT', 'JE', 'LI', 'LT', 'LU', 'LV', 'MC', 'MD', 'ME', 'MK', 'MT', 'NL', 'NO', 'PL', 'PT', 'RO', 'RS', 'RU', 'SE', 'SI', 'SJ', 'SK', 'SM', 'UA', 'VA'
    ];

    if (req.query.testRestrict === '1' || req.query.testDutch === '1' || EUROPEAN_COUNTRIES.includes(countryCode)) {
        req.isRestrictedRegion = true;
        if (req.query.testRestrict === '1' || req.query.testDutch === '1') {
            console.log(`[GEO] Manual override: Restricted mode active for ${cleanIp}`);
        }
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

        // Use cached data for blocking check if available (skip '??' for blocking decisions)
        let geoData = db.prepare('SELECT * FROM page_accesses WHERE ip = ? AND country_code IS NOT NULL AND length(country_code) = 2 AND country_code != "??" ORDER BY id DESC LIMIT 1').get(cleanIp);

        if (!geoData || req.query.refreshGeo === '1') {
            try {
                if (req.query.refreshGeo === '1') console.log(`[GEO] Refreshing data for ${cleanIp}`);

                // Primary: ipapi.co
                const response = await fetch(`https://ipapi.co/${cleanIp}/json/`, { timeout: 3000 });
                if (response.ok) {
                    const data = await response.json();
                    if (!data.error && data.country_code && data.country_code !== '??') {
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

                // Fallback: ip-api.com (if primary failed or returned unknown)
                if (!geoData || geoData.country_code === '??') {
                    const fbResponse = await fetch(`http://ip-api.com/json/${cleanIp}?fields=status,message,country,countryCode,regionName,city,lat,lon,isp,proxy,hosting`, { timeout: 3000 });
                    if (fbResponse.ok) {
                        const fbData = await fbResponse.json();
                        if (fbData.status === 'success') {
                            geoData = {
                                country: fbData.country,
                                country_code: fbData.countryCode?.toUpperCase(),
                                region: fbData.regionName,
                                city: fbData.city,
                                lat: fbData.lat,
                                lon: fbData.lon,
                                isp: fbData.isp,
                                proxy: fbData.proxy ? 1 : 0,
                                hosting: fbData.hosting ? 1 : 0
                            };
                            console.log(`[GEO] Fallback lookup successful for ${cleanIp} -> ${geoData.country_code}`);
                        }
                    }
                }
            } catch (apiError) {
                console.error(`GeoIP fetching failed for ${cleanIp}:`, apiError.message);
            }
        }

        if (geoData) {
            const currentCountry = geoData.country_code?.toUpperCase();

            // Late-stage detection (for first-time visitors not already in cache)
            const EUROPEAN_COUNTRIES = [
                'AD', 'AL', 'AT', 'AX', 'BA', 'BE', 'BG', 'BY', 'CH', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'FO', 'FR', 'GB', 'GG', 'GI', 'GR', 'HR', 'HU', 'IE', 'IM', 'IS', 'IT', 'JE', 'LI', 'LT', 'LU', 'LV', 'MC', 'MD', 'ME', 'MK', 'MT', 'NL', 'NO', 'PL', 'PT', 'RO', 'RS', 'RU', 'SE', 'SI', 'SJ', 'SK', 'SM', 'UA', 'VA'
            ];

            if (EUROPEAN_COUNTRIES.includes(currentCountry)) {
                req.isRestrictedRegion = true;
            }

            // Check for Country Block
            const isBlocked = db.prepare('SELECT 1 FROM blocked_countries WHERE country_code = ?').get(currentCountry);

            if (isBlocked && req.path !== '/blocked') {
                logAccess(cleanIp, req, geoData, 1);
                console.log(`[GEO] Blocking visitor from ${currentCountry}: ${cleanIp}`);
                return res.redirect('/blocked');
            }

            logAccess(cleanIp, req, geoData, 0);
        } else {
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
