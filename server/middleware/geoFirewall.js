import db from '../db/index.js';
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
        console.log(`[GEO] Cache -> ${countryCode} (${cachedRow.city || 'Unknown'})`);
    }

    // 3. Hierarchical Security Bypasses
    const isLocal = cleanIp === '127.0.0.1' || cleanIp === '::1';
    const bypassSecret = process.env.FIREWALL_SECRET;
    const hasSecretBypass = bypassSecret && (req.query.bypass === bypassSecret || req.headers['x-firewall-bypass'] === bypassSecret);
    const adminIpSetting = db.prepare("SELECT value FROM firewall_settings WHERE key = 'admin_ip'").get();
    const adminIps = (adminIpSetting?.value || '').split(',').map(v => v.trim()).filter(Boolean);

    // Check for Manual Overrides immediately
    if (req.query.testRestrict === '1' || req.query.testDutch === '1') {
        req.isRestrictedRegion = true;
        console.log(`[GEO] Manual override active for ${cleanIp}`);
    }

    // Primary bypass: Whitelist IPs, Admin Session, or Localhouse
    const isAdminIp = adminIps.includes(cleanIp);
    const isAdminHeader = req.headers['x-admin-auth'] === 'premium-admin';
    const isSessionAdmin = req.session && req.session.isAdmin;
    const userAgent = req.headers['user-agent'] || '';
    const isBot = /Discordbot|Googlebot|Bingbot|Slurp|DuckDuckBot|Baiduspider|YandexBot|Sogou/i.test(userAgent);

    if (isLocal || hasSecretBypass || isAdminIp || isAdminHeader || isSessionAdmin || isBot) {
        return next();
    }

    // 4. Geo-Blocking Logic & Deep Lookup
    try {
        const settings = db.prepare("SELECT * FROM firewall_settings").all();
        const lockdownActive = settings.find(s => s.key === 'lockdown_active')?.value === '1';
        const europeBlockActive = settings.find(s => s.key === 'europe_block')?.value === '1';
        const usaBlockActive = settings.find(s => s.key === 'usa_block')?.value === '1';

        if (lockdownActive && req.path !== '/blocked') {
            logAccess(cleanIp, req, { countryCode: '??' }, 1);
            return res.redirect('/blocked');
        }

        // Deep Lookup Phase (Only if city data is missing or refresh requested)
        const needsLookup = !geoData || !geoData.city || geoData.city === 'Unknown' || geoData.city === '';

        if (needsLookup || req.query.refreshGeo === '1') {
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
                            geoData = {
                                country_code: data.country_code.toUpperCase(),
                                country: data.country_name,
                                region: data.region,
                                city: data.city,
                                lat: data.latitude,
                                lon: data.longitude,
                                isp: data.org
                            };
                        }
                    }
                } catch (e) { }

                // Tier 2: ip-api.com
                if (!geoData) {
                    const fbController = new AbortController();
                    const fbTimeoutId = setTimeout(() => fbController.abort(), 2000);
                    try {
                        const fbResponse = await fetch(`http://ip-api.com/json/${cleanIp}?fields=status,countryCode,country,regionName,city,lat,lon,isp`, { signal: fbController.signal });
                        clearTimeout(fbTimeoutId);
                        if (fbResponse.ok) {
                            const fbData = await fbResponse.json();
                            if (fbData.status === 'success' && fbData.countryCode) {
                                geoData = {
                                    country_code: fbData.countryCode.toUpperCase(),
                                    country: fbData.country,
                                    region: fbData.regionName,
                                    city: fbData.city,
                                    lat: fbData.lat,
                                    lon: fbData.lon,
                                    isp: fbData.isp
                                };
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
                                geoData = {
                                    country_code: t3Data.countryCode.toUpperCase(),
                                    country: t3Data.countryName,
                                    region: t3Data.region,
                                    city: t3Data.cityName,
                                    lat: t3Data.latitude,
                                    lon: t3Data.longitude
                                };
                            }
                        }
                    } catch (e) { }
                }
            } catch (apiError) {
                console.error(`[GEO] All lookup tiers failed for ${cleanIp}`);
            }
        }

        // UNIFIED RESOLUTION: Combine all sources (CF > Lookup > Cache)
        const finalLookupCountry = geoData?.country_code || countryCode;
        const resolvedCountry = finalLookupCountry?.toUpperCase();

        console.log(`[GEO-DEBUG] User: ${cleanIp} | Country: ${resolvedCountry || '??'} | IsAdmin: ${isSessionAdmin}`);

        if (resolvedCountry) {
            // High-Security Lockout: Check if region is restricted (Europe) OR manually blocked
            const isEurope = EUROPEAN_COUNTRIES.includes(resolvedCountry);
            const isUSA = resolvedCountry === 'US';

            const isRestricted = (isEurope && europeBlockActive) || (isUSA && usaBlockActive);
            const isManuallyBlocked = db.prepare('SELECT 1 FROM blocked_countries WHERE countryCode = ?').get(resolvedCountry);

            if ((isRestricted || isManuallyBlocked) && req.path !== '/blocked') {
                // If they ARE owner or admin, they should have been bypassed at line 80.
                // If they reach here, it means the bypass logic failed.

                req.isRestrictedRegion = true;
                logAccess(cleanIp, req, geoData || { country_code: resolvedCountry }, 1);
                console.log(`[GEO] !!! BLOCKING !!! -> IP: ${cleanIp} | Country: ${resolvedCountry}`);
                return res.redirect('/blocked');
            }
        }

        // Log allowed access
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
            (ip, path, method, country, countryCode, region, city, lat, lon, isp, userAgent, proxy, hosting, isBlocked, hostname)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
            req.headers['user-agent'] || '',
            geo.proxy || 0,
            geo.hosting || 0,
            isBlocked ? 1 : 0,
            req.get('host') || 'unknown'
        );
    } catch (e) {
        console.error('Failed to log access:', e.message);
    }
}
