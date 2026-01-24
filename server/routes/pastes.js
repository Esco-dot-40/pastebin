import express from 'express';
import db from '../db/index.js';
import fetch from 'node-fetch';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

function generateId() {
    return Math.random().toString(36).substring(2, 10);
}

function getClientIP(req) {
    let ip = req.headers['x-forwarded-for']?.split(',')[0] ||
        req.headers['x-real-ip'] ||
        req.socket.remoteAddress ||
        '127.0.0.1';
    if (ip.includes('::ffff:')) {
        ip = ip.split(':').pop();
    }
    return ip.trim();
}

async function fetchGeolocation(ip) {
    try {
        if (!ip || ip === '::1' || ip === '127.0.0.1' || ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) {
            return null;
        }
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        // Added: proxy, hosting, mobile, reverse, asname
        const fields = 'status,message,country,countryCode,region,regionName,city,zip,lat,lon,isp,org,as,asname,reverse,mobile,proxy,hosting,query';
        const response = await fetch(`http://ip-api.com/json/${ip}?fields=${fields}`, {
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        const data = await response.json();

        // Block Proxies/VPNs if detected (Optional: can be made configurable)
        if (data.status === 'success' && (data.proxy === true || data.hosting === true)) {
            data.isBlocked = true;
        }

        return data.status === 'success' ? data : null;
    } catch (e) {
        return null;
    }
}

async function updateHostname(table, id, ip) {
    if (ip === '127.0.0.1' || ip.includes(':')) return;
    try {
        const { promises: dns } = await import('dns');
        const hostnames = await dns.reverse(ip);
        if (hostnames && hostnames.length > 0) {
            db.prepare(`UPDATE ${table} SET hostname = ? WHERE id = ?`).run(hostnames[0], id);
        }
    } catch (e) { }
}

const validateAccessKey = (key) => {
    if (!key) return false;
    const row = db.prepare('SELECT id FROM access_keys WHERE key = ? AND status = ?').get(key, 'active');
    return !!row;
};

// ==========================================
// ANALYTICS / ADMIN UTILS (Must be first)
// ==========================================

router.get('/analytics/top-cities', requireAuth, (req, res) => {
    try {
        const query = `
            SELECT city, country, SUM(hit_count) as count FROM (
                SELECT city, country, COUNT(*) as hit_count FROM paste_views WHERE city IS NOT NULL AND city != '' GROUP BY city, country
                UNION ALL
                SELECT city, country, COUNT(*) as hit_count FROM page_accesses WHERE city IS NOT NULL AND city != '' GROUP BY city, country
            ) combined GROUP BY city, country ORDER BY count DESC LIMIT 50
        `;
        res.json(db.prepare(query).all());
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/analytics/all', requireAuth, (req, res) => {
    try {
        db.prepare('DELETE FROM paste_views').run();
        db.prepare('DELETE FROM page_accesses').run();
        db.prepare('UPDATE pastes SET views = 0').run();
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/analytics/city/:cityName', requireAuth, (req, res) => {
    try {
        const { cityName } = req.params;
        const v = db.prepare('DELETE FROM paste_views WHERE city = ?').run(cityName);
        const r = db.prepare('DELETE FROM paste_reactions WHERE city = ?').run(cityName);
        const p = db.prepare('DELETE FROM page_accesses WHERE city = ?').run(cityName);
        res.json({ success: true, deleted: { views: v.changes, reactions: r.changes, pageAccesses: p.changes } });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/analytics/isp/:ispName', requireAuth, (req, res) => {
    try {
        const { ispName } = req.params;
        const v = db.prepare('DELETE FROM paste_views WHERE isp = ?').run(ispName);
        const r = db.prepare('DELETE FROM paste_reactions WHERE isp = ?').run(ispName);
        const p = db.prepare('DELETE FROM page_accesses WHERE isp = ?').run(ispName);
        res.json({ success: true, deleted: { views: v.changes, reactions: r.changes, pageAccesses: p.changes } });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/analytics', requireAuth, (req, res) => {
    try {
        const pasteViews = db.prepare('SELECT * FROM paste_views').all();
        const pageAccesses = db.prepare('SELECT * FROM page_accesses').all();
        const allHits = [...pasteViews.map(v => ({ ...v, source: 'paste' })), ...pageAccesses.map(v => ({ ...v, source: 'page' }))].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        const allReactions = db.prepare('SELECT * FROM paste_reactions ORDER BY createdAt DESC').all();

        const totalVisits = allHits.length;
        const uniqueVisitors = new Set(allHits.map(h => h.ip)).size;
        const thirtySecondsAgo = Date.now() - (30 * 1000);
        const activeNow = new Set(allHits.filter(h => new Date(h.timestamp).getTime() > thirtySecondsAgo).map(h => h.ip)).size;
        const uniqueLocations = new Set(allHits.filter(h => h.city || h.country).map(h => `${h.city},${h.country}`)).size;

        const groupCount = (arr, keyFn) => {
            const map = {};
            arr.forEach(item => { const k = keyFn(item) || 'Unknown'; if (!map[k]) map[k] = 0; map[k]++; });
            return Object.entries(map).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
        };

        const ipCounts = {}; allHits.forEach(h => { ipCounts[h.ip] = (ipCounts[h.ip] || 0) + 1; });
        const newVisitors = Object.values(ipCounts).filter(c => c === 1).length;
        const returningVisitors = Object.values(ipCounts).filter(c => c > 1).length;

        // Devices
        const touchDevices = allHits.filter(h => {
            const ua = h.userAgent || '';
            return ua.includes('Mobile') || ua.includes('Android') || ua.includes('iPhone') || ua.includes('iPad');
        }).length;

        res.json({
            totalVisits, uniqueVisitors, activeNow, uniqueLocations, newVisitors, returningVisitors,
            platforms: groupCount(allHits, h => {
                const ua = h.userAgent || '';
                if (ua.includes('Windows')) return 'Windows';
                if (ua.includes('Macintosh')) return 'macOS';
                if (ua.includes('Android')) return 'Android';
                if (ua.includes('iPhone')) return 'iOS';
                return 'Other';
            }),
            browsers: groupCount(allHits, h => {
                const ua = h.userAgent || '';
                if (ua.includes('Edg/')) return 'Edge';
                if (ua.includes('Chrome')) return 'Chrome';
                if (ua.includes('Firefox')) return 'Firefox';
                return 'Safari';
            }),
            locations: Object.values(allHits.reduce((acc, h) => {
                if (h.lat && h.lon) {
                    const k = `${h.city},${h.country}`;
                    if (!acc[k]) acc[k] = { city: h.city, country: h.country, lat: h.lat, lon: h.lon, count: 0 };
                    acc[k].count++;
                }
                return acc;
            }, {})),
            isps: groupCount(allHits, h => h.isp),
            devices: { touchCount: touchDevices, desktopCount: allHits.length - touchDevices },
            referrers: groupCount(allHits, h => { if (!h.referrer) return 'Direct'; try { return new URL(h.referrer).hostname; } catch (e) { return 'Other'; } }),
            recentViews: pasteViews.slice(-50).reverse(),
            recentReactions: allReactions.slice(0, 50),
            pageAccesses: { total: pageAccesses.length, byPage: groupCount(pageAccesses, p => p.path).slice(0, 20), recent: pageAccesses.slice(-50).reverse() }
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/stats/summary', requireAuth, (req, res) => {
    try {
        const totalPastes = db.prepare('SELECT COUNT(*) as count FROM pastes').get().count;
        const totalViews = db.prepare('SELECT SUM(views) as total FROM pastes').get().total || 0;
        const totalReactions = db.prepare('SELECT COUNT(*) as count FROM paste_reactions').get().count;
        res.json({ totalPastes, totalViews, totalReactions });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ==========================================
// CORE CRUD
// ==========================================

router.get('/', requireAuth, (req, res) => {
    try {
        const list = db.prepare('SELECT p.*, f.name as folderName FROM pastes p LEFT JOIN folders f ON p.folderId = f.id ORDER BY p.createdAt DESC').all();

        // Enrich with reaction counts
        const enrichedList = list.map(p => {
            const reactions = db.prepare('SELECT type, COUNT(*) as count FROM paste_reactions WHERE pasteId = ? GROUP BY type').all(p.id);
            const reactionCounts = { heart: 0, star: 0, like: 0 };
            reactions.forEach(r => {
                if (reactionCounts[r.type] !== undefined) reactionCounts[r.type] = r.count;
            });
            return { ...p, reactions: reactionCounts };
        });

        res.json(enrichedList);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/public-list', (req, res) => {
    const isAdmin = req.session && req.session.isAdmin;
    const key = req.headers['x-access-key'] || req.query.key;
    const hasAccess = validateAccessKey(key) || isAdmin;

    // Respect privacy: Only show private pastes if user hasAccess or is Admin
    const query = hasAccess
        ? `SELECT p.*, f.name as folderName FROM pastes p LEFT JOIN folders f ON p.folderId = f.id ORDER BY p.createdAt DESC`
        : `SELECT p.*, f.name as folderName FROM pastes p LEFT JOIN folders f ON p.folderId = f.id WHERE p.isPublic = 1 ORDER BY p.createdAt DESC`;

    const list = db.prepare(query).all();

    // Aggregate reactions for each paste
    const enrichedList = list.map(p => {
        const reactions = db.prepare('SELECT type, COUNT(*) as count FROM paste_reactions WHERE pasteId = ? GROUP BY type').all(p.id);
        const reactionCounts = { heart: 0, star: 0, like: 0 };
        reactions.forEach(r => {
            if (reactionCounts[r.type] !== undefined) reactionCounts[r.type] = r.count;
        });

        return {
            ...p,
            reactions: reactionCounts,
            hasPassword: !!p.password,
            password: undefined
        };
    });

    res.json(enrichedList);
});

router.post('/', requireAuth, async (req, res) => {
    const { title, content, language, expiresAt, isPublic, burnAfterRead, folderId, password, embedUrl } = req.body;
    const id = generateId();
    db.prepare('INSERT INTO pastes (id, title, content, language, expiresAt, isPublic, burnAfterRead, folderId, password, embedUrl) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(id, title || 'Untitled', content, language || 'plaintext', expiresAt || null, isPublic !== false ? 1 : 0, burnAfterRead ? 1 : 0, folderId || null, password || null, embedUrl || null);
    res.status(201).json({ id, success: true });
});

router.put('/:id', requireAuth, async (req, res) => {
    const { title, content, language, expiresAt, isPublic, burnAfterRead, folderId, password, embedUrl } = req.body;
    db.prepare('UPDATE pastes SET title=?, content=?, language=?, expiresAt=?, isPublic=?, burnAfterRead=?, folderId=?, password=?, embedUrl=? WHERE id=?').run(title, content, language, expiresAt, isPublic ? 1 : 0, burnAfterRead ? 1 : 0, folderId, password, embedUrl, req.params.id);
    res.json({ success: true });
});

router.delete('/:id', requireAuth, (req, res) => {
    db.prepare('DELETE FROM pastes WHERE id = ?').run(req.params.id);
    res.json({ success: true });
});

// ==========================================
// PASTE ACTIONS
// ==========================================

router.get('/:id', async (req, res) => {
    const paste = db.prepare('SELECT * FROM pastes WHERE id = ?').get(req.params.id);
    if (!paste) return res.status(404).json({ error: 'Not found' });

    const isAdmin = req.session && req.session.isAdmin;
    const hasAccessKey = validateAccessKey(req.headers['x-access-key']);
    const isAuthorized = isAdmin || hasAccessKey;

    // Check Privacy Access
    if (paste.isPublic === 0 && !isAuthorized) {
        return res.status(403).json({ error: 'This paste is private. Authorized access only.' });
    }

    if (paste.password && (req.headers['x-paste-password'] || req.query.password) !== paste.password && !(isAdmin && req.query.track === 'false')) {
        return res.status(401).json({ error: 'Password required', passwordRequired: true });
    }

    db.prepare('UPDATE pastes SET views = views + 1 WHERE id = ?').run(req.params.id);
    const ip = getClientIP(req);
    const ua = req.headers['user-agent'];
    const loc = await fetchGeolocation(ip);

    // BLOCK PROXIES/VPNs for authorized nodes if requested
    if (loc && loc.isBlocked && !isAuthorized) {
        return res.status(403).json({ error: 'Access Denied: Proxy/VPN identified. Please connect directly to this sector.' });
    }

    if (!(req.session && req.session.isAdmin) || process.env.LOG_ADMINS === 'true') {
        const res2 = loc ? db.prepare(`INSERT INTO paste_views (pasteId, ip, country, countryCode, region, regionName, city, zip, lat, lon, isp, org, asName, userAgent, proxy, hosting, mobile, reverse, district, timezone, currency) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(req.params.id, ip, loc.country, loc.countryCode, loc.region, loc.regionName, loc.city, loc.zip, loc.lat, loc.lon, loc.isp, loc.org, loc.as, ua, loc.proxy ? 1 : 0, loc.hosting ? 1 : 0, loc.mobile ? 1 : 0, loc.reverse, loc.district, loc.timezone, loc.currency)
            : db.prepare(`INSERT INTO paste_views (pasteId, ip, userAgent) VALUES (?, ?, ?)`).run(req.params.id, ip, ua);
        updateHostname('paste_views', res2.lastInsertRowid, ip);
    }
    // Aggregate reactions
    const reactionRows = db.prepare('SELECT type, COUNT(*) as count FROM paste_reactions WHERE pasteId = ? GROUP BY type').all(req.params.id);
    const reactionCounts = { heart: 0, star: 0, like: 0 };
    reactionRows.forEach(r => { if (reactionCounts[r.type] !== undefined) reactionCounts[r.type] = r.count; });

    res.json({ ...paste, reactions: reactionCounts });
});

router.post('/:id/react', async (req, res) => {
    if (!req.session?.user) return res.status(401).json({ error: 'Auth Required' });
    const { type } = req.body; const ip = getClientIP(req); const user = req.session.user;
    const loc = await fetchGeolocation(ip); const geo = loc || {};
    const result = db.prepare(`INSERT INTO paste_reactions (pasteId, type, ip, city, country, isp, userAgent, userId, username, avatarUrl) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(req.params.id, type, ip, geo.city, geo.country, geo.isp, req.headers['user-agent'], user.id, user.username, user.avatarUrl);
    updateHostname('paste_reactions', result.lastInsertRowid, ip);
    res.json({ success: true });
});

router.get('/:id/analytics', requireAuth, (req, res) => {
    const paste = db.prepare('SELECT views FROM pastes WHERE id = ?').get(req.params.id);
    if (!paste) return res.status(404).json({ error: 'Not found' });
    const views = db.prepare('SELECT * FROM paste_views WHERE pasteId = ? ORDER BY timestamp DESC').all(req.params.id);
    const reactions = db.prepare('SELECT * FROM paste_reactions WHERE pasteId = ? ORDER BY createdAt DESC').all(req.params.id);

    const groupCount = (arr, keyFn) => {
        const map = {};
        arr.forEach(item => {
            const k = keyFn(item);
            if (k) {
                if (!map[k]) map[k] = { name: k, count: 0 };
                map[k].count++;
            }
        });
        return Object.values(map).sort((a, b) => b.count - a.count);
    };

    const parseUA = (ua) => {
        if (!ua) return { os: 'Unknown', browser: 'Unknown' };
        let os = 'Other';
        if (ua.includes('Windows')) os = 'Windows';
        else if (ua.includes('Macintosh')) os = 'macOS';
        else if (ua.includes('Android')) os = 'Android';
        else if (ua.includes('iPhone')) os = 'iOS';

        let browser = 'Safari';
        if (ua.includes('Edg/')) browser = 'Edge';
        else if (ua.includes('Chrome')) browser = 'Chrome';
        else if (ua.includes('Firefox')) browser = 'Firefox';

        return { os, browser };
    };

    res.json({
        totalViews: paste.views,
        uniqueIPs: new Set(views.map(v => v.ip)).size,
        topLocations: groupCount(views, v => v.city ? `${v.city}, ${v.country}` : null).slice(0, 10),
        topISPs: groupCount(views, v => v.isp).slice(0, 10),
        platforms: groupCount(views.map(v => parseUA(v.userAgent)), u => u.os),
        browsers: groupCount(views.map(v => parseUA(v.userAgent)), u => u.browser),
        recentViews: views.slice(0, 100).map(v => ({ ...v, ...parseUA(v.userAgent) })),
        reactions: reactions.map(r => ({
            type: r.type,
            username: r.username || 'Anonymous',
            timestamp: r.createdAt,
            city: r.city,
            country: r.country
        }))
    });
});

router.delete('/:id/analytics', requireAuth, (req, res) => {
    db.prepare('DELETE FROM paste_views WHERE pasteId = ?').run(req.params.id);
    db.prepare('UPDATE pastes SET views = 0 WHERE id = ?').run(req.params.id);
    res.json({ success: true });
});

router.post('/:id/reset-views', requireAuth, (req, res) => {
    db.prepare('UPDATE pastes SET views = 0 WHERE id = ?').run(req.params.id);
    res.json({ success: true });
});

router.put('/:id/views', requireAuth, (req, res) => {
    db.prepare('UPDATE pastes SET views = ? WHERE id = ?').run(req.body.views, req.params.id);
    res.json({ success: true });
});

router.put('/:id/metrics', requireAuth, (req, res) => {
    const { id } = req.params;
    const { views, reactions } = req.body;

    db.prepare('UPDATE pastes SET views = ? WHERE id = ?').run(views, id);

    if (reactions) {
        for (const [type, count] of Object.entries(reactions)) {
            // Wipe existing and re-insert synthetic ones
            db.prepare('DELETE FROM paste_reactions WHERE pasteId = ? AND type = ?').run(id, type);
            const stmt = db.prepare(`INSERT INTO paste_reactions (pasteId, type, ip, userId, username) VALUES (?, ?, ?, ?, ?)`);
            for (let i = 0; i < count; i++) {
                stmt.run(id, type, '0.0.0.0', 'admin-synthetic', 'Admin Override');
            }
        }
    }
    res.json({ success: true });
});

router.put('/:id/reactions/:type', requireAuth, (req, res) => {
    const { id, type } = req.params; const { count } = req.body;
    db.prepare('DELETE FROM paste_reactions WHERE pasteId = ? AND type = ?').run(id, type);
    const stmt = db.prepare(`INSERT INTO paste_reactions (pasteId, type, ip, userId, username) VALUES (?, ?, ?, ?, ?)`);
    for (let i = 0; i < count; i++) stmt.run(id, type, '0.0.0.0', 'admin-synthetic', 'Admin');
    res.json({ success: true });
});

router.delete('/:id/react/:type', requireAuth, (req, res) => {
    const last = db.prepare('SELECT id FROM paste_reactions WHERE pasteId = ? AND type = ? ORDER BY createdAt DESC LIMIT 1').get(req.params.id, req.params.type);
    if (last) db.prepare('DELETE FROM paste_reactions WHERE id = ?').run(last.id);
    res.json({ success: true });
});

router.delete('/reactions/:id', requireAuth, (req, res) => {
    db.prepare('DELETE FROM paste_reactions WHERE id = ?').run(req.params.id);
    res.json({ success: true });
});

export default router;
