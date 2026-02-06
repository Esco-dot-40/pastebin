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
        // Optimized aggregate stats using SQL
        const totalVisits = db.prepare(`
            SELECT (SELECT COUNT(*) FROM paste_views) + (SELECT COUNT(*) FROM page_accesses) as total
        `).get().total;

        const uniqueVisitors = db.prepare(`
            SELECT COUNT(DISTINCT ip) as count FROM (
                SELECT ip FROM paste_views UNION SELECT ip FROM page_accesses
            )
        `).get().count;

        const fiveMinutesAgo = new Date(Date.now() - (5 * 60 * 1000)).toISOString();
        const activeNow = db.prepare(`
            SELECT COUNT(DISTINCT ip) as count FROM (
                SELECT ip FROM paste_views WHERE timestamp > ?
                UNION
                SELECT ip FROM page_accesses WHERE timestamp > ?
            )
        `).get(fiveMinutesAgo, fiveMinutesAgo).count;

        const uniqueLocations = db.prepare(`
            SELECT COUNT(*) as count FROM (
                SELECT COALESCE(city, 'Unknown'), COALESCE(country, 'Unknown') FROM paste_views GROUP BY city, country
                UNION
                SELECT COALESCE(city, 'Unknown'), COALESCE(country, 'Unknown') FROM page_accesses GROUP BY city, country
            )
        `).get().count;

        // Visitor counts (New vs Returning)
        const visitorStats = db.prepare(`
            SELECT 
                COUNT(CASE WHEN hit_count = 1 THEN 1 END) as newVisitors,
                COUNT(CASE WHEN hit_count > 1 THEN 1 END) as returningVisitors
            FROM (
                SELECT ip, COUNT(*) as hit_count FROM (
                    SELECT ip FROM paste_views UNION ALL SELECT ip FROM page_accesses
                ) GROUP BY ip
            )
        `).get();

        // Platform & Browser distribution (Simplified logic in SQL if possible, but UA parsing is often easier in JS)
        // For efficiency, we'll only fetch the userAgent strings and count them in JS
        const uaRows = db.prepare(`
            SELECT userAgent FROM paste_views WHERE userAgent IS NOT NULL
            UNION ALL
            SELECT userAgent FROM page_accesses WHERE userAgent IS NOT NULL
        `).all();

        const groupCount = (arr, keyFn) => {
            const map = {};
            arr.forEach(item => { const k = keyFn(item) || 'Unknown'; if (!map[k]) map[k] = 0; map[k]++; });
            return Object.entries(map).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
        };

        const platforms = groupCount(uaRows, h => {
            const ua = h.userAgent || '';
            if (ua.includes('Windows')) return 'Windows';
            if (ua.includes('Macintosh')) return 'macOS';
            if (ua.includes('Android')) return 'Android';
            if (ua.includes('iPhone')) return 'iOS';
            return 'Other';
        });

        const browsers = groupCount(uaRows, h => {
            const ua = h.userAgent || '';
            if (ua.includes('Edg/')) return 'Edge';
            if (ua.includes('Chrome')) return 'Chrome';
            if (ua.includes('Firefox')) return 'Firefox';
            return 'Safari';
        });

        const touchCount = uaRows.filter(h => {
            const ua = h.userAgent || '';
            return ua.includes('Mobile') || ua.includes('Android') || ua.includes('iPhone') || ua.includes('iPad');
        }).length;

        // Locations for Heatmap/Cities
        const locations = db.prepare(`
            SELECT 
                COALESCE(city, 'Unknown') as city, 
                COALESCE(country, 'Unknown') as country, 
                COALESCE(countryCode, '??') as countryCode,
                lat, lon, COUNT(*) as count
            FROM (
                SELECT city, country, countryCode, lat, lon FROM paste_views
                UNION ALL
                SELECT city, country, countryCode, lat, lon FROM page_accesses
            )
            GROUP BY city, country, countryCode, lat, lon
            ORDER BY count DESC
        `).all();

        const isps = db.prepare(`
            SELECT isp as name, COUNT(*) as count FROM (
                SELECT isp FROM paste_views WHERE isp IS NOT NULL
                UNION ALL
                SELECT isp FROM page_accesses WHERE isp IS NOT NULL
            ) GROUP BY isp ORDER BY count DESC LIMIT 20
        `).all();

        const referrersRows = db.prepare(`
            SELECT referrer FROM page_accesses WHERE referrer IS NOT NULL
        `).all();

        const referrers = groupCount(referrersRows, h => {
            try { return new URL(h.referrer).hostname; } catch (e) { return 'Direct/Other'; }
        });

        // Recent Activity (Still need some detailed rows)
        const recentActivity = db.prepare(`
            SELECT * FROM (
                SELECT 'paste' as source, '/v/' || pasteId as path, ip, city, country, countryCode, timestamp FROM paste_views
                UNION ALL
                SELECT 'page' as source, path, ip, city, country, countryCode, timestamp FROM page_accesses
            ) ORDER BY timestamp DESC LIMIT 50
        `).all();

        const recentReactions = db.prepare('SELECT * FROM paste_reactions ORDER BY createdAt DESC LIMIT 50').all();

        const pageAccessesByPage = db.prepare(`
            SELECT path as name, COUNT(*) as count FROM page_accesses GROUP BY path ORDER BY count DESC LIMIT 20
        `).all();

        const blockedCountries = db.prepare('SELECT COUNT(*) as count FROM blocked_countries').get().count;
        const totalThreats = db.prepare(`
            SELECT (SELECT COUNT(*) FROM page_accesses WHERE isBlocked = 1) + 
                   (SELECT COUNT(*) FROM paste_views WHERE isBlocked = 1) as count
        `).get().count;

        res.json({
            totalVisits,
            uniqueVisitors,
            activeNow,
            uniqueLocations,
            blockedCountries,
            totalThreats,
            newVisitors: visitorStats.newVisitors,
            returningVisitors: visitorStats.returningVisitors,
            platforms,
            browsers,
            locations,
            isps,
            devices: { touchCount, desktopCount: totalVisits - touchCount },
            referrers,
            recentActivity,
            recentReactions,
            pageAccesses: { total: totalVisits, byPage: pageAccessesByPage }
        });
    } catch (e) {
        console.error('Analytics Error:', e);
        res.status(500).json({ error: e.message });
    }
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
    const hasAccessKey = validateAccessKey(key);
    const isAuthorized = isAdmin || hasAccessKey;

    let query;
    let params = [];

    if (isAuthorized) {
        // Return ALL pastes (Public + Private)
        query = `SELECT p.*, f.name as folderName FROM pastes p LEFT JOIN folders f ON p.folderId = f.id ORDER BY p.createdAt DESC`;
    } else {
        // Return ONLY Public pastes
        query = `SELECT p.*, f.name as folderName FROM pastes p LEFT JOIN folders f ON p.folderId = f.id WHERE p.isPublic = 1 ORDER BY p.createdAt DESC`;
    }

    const list = db.prepare(query).all(params);

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
            password: undefined,
            isPrivate: p.isPublic === 0
        };
    });

    res.json(enrichedList);
});

router.post('/', requireAuth, async (req, res) => {
    const { title, content, language, expiresAt, isPublic, burnAfterRead, folderId, password, embedUrl, discordThumbnail } = req.body;

    // Validation
    if (!content) return res.status(400).json({ error: 'Content is strictly required for synchronization.' });
    if (content.length > 20000000) return res.status(400).json({ error: 'Transmission overflow: Content exceeds 20MB limit.' });
    if (title && title.length > 100) return res.status(400).json({ error: 'Title overhead: Maximum 100 characters allowed.' });

    const id = generateId();
    const userId = req.session?.user?.id || (req.session?.isAdmin ? 'admin' : null);
    db.prepare('INSERT INTO pastes (id, title, content, language, expiresAt, isPublic, burnAfterRead, folderId, password, embedUrl, discordThumbnail, userId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(id, title || 'Untitled', content, language || 'plaintext', expiresAt || null, isPublic !== false ? 1 : 0, burnAfterRead ? 1 : 0, folderId || null, password || null, embedUrl || null, discordThumbnail || null, userId);
    res.status(201).json({ id, success: true });
});

router.put('/:id', requireAuth, async (req, res) => {
    const { title, content, language, expiresAt, isPublic, burnAfterRead, folderId, password, embedUrl, discordThumbnail } = req.body;

    // Validation
    if (content && content.length > 20000000) return res.status(400).json({ error: 'Transmission overflow: Content exceeds 20MB limit.' });
    if (title && title.length > 100) return res.status(400).json({ error: 'Title overhead: Maximum 100 characters allowed.' });

    db.prepare('UPDATE pastes SET title=?, content=?, language=?, expiresAt=?, isPublic=?, burnAfterRead=?, folderId=?, password=?, embedUrl=?, discordThumbnail=? WHERE id=?').run(title, content, language, expiresAt, isPublic ? 1 : 0, burnAfterRead ? 1 : 0, folderId, password, embedUrl, discordThumbnail, req.params.id);
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
    const paste = db.prepare('SELECT * FROM pastes WHERE id = ? COLLATE NOCASE').get(req.params.id);
    if (!paste) return res.status(404).json({ error: 'Not found' });

    // If paste is burned, return metadata but NO content
    if (paste.burned) {
        return res.json({
            ...paste,
            content: '[ BURNED: THIS CONTENT HAS BEEN DELETED ]',
            isBurned: true
        });
    }

    const isAdmin = req.session && req.session.isAdmin;
    const key = req.headers['x-access-key'] || req.query.key;
    const hasAccessKey = validateAccessKey(key);
    const isAuthorized = isAdmin || hasAccessKey;
    const isOwner = req.session && req.session.user && paste.userId === req.session.user.id;

    // Check Privacy Access
    if (paste.isPublic === 0 && !isAuthorized && !isOwner) {
        return res.status(403).json({
            error: 'Access Denied: Authorized signature required.',
            isPrivate: true,
            needsKey: true
        });
    }

    if (paste.password && (req.headers['x-paste-password'] || req.query.password) !== paste.password && !(isAdmin && req.query.track === 'false')) {
        return res.status(401).json({ error: 'Password required', passwordRequired: true });
    }

    const track = req.query.track !== 'false';

    if (track) {
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
    }
    // Aggregate reactions
    const reactionRows = db.prepare('SELECT type, COUNT(*) as count FROM paste_reactions WHERE pasteId = ? GROUP BY type').all(req.params.id);
    const reactionCounts = { heart: 0, star: 0, like: 0 };
    reactionRows.forEach(r => { if (reactionCounts[r.type] !== undefined) reactionCounts[r.type] = r.count; });

    // Burn After Read Logic
    if (track && paste.burnAfterRead) {
        setImmediate(() => {
            try {
                db.prepare('UPDATE pastes SET burned = 1, content = NULL WHERE id = ?').run(req.params.id);
                console.log(`🔥 Paste ${req.params.id} burned after read.`);
            } catch (e) {
                console.error('Failed to burn paste:', e);
            }
        });
    }

    res.json({ ...paste, reactions: reactionCounts });
});

// Purge Expired or Burned Pastes every hour
import cron from 'node-cron';
cron.schedule('0 * * * *', () => {
    try {
        const now = new Date().toISOString();
        // Delete pastes that are:
        // 1. Expired
        // 2. Burned (mark for physical deletion after 1 hour if preferred, or immediate)
        // Here let's just delete expired ones. Burned ones keep the record so frontend shows "Burned".
        const result = db.prepare('DELETE FROM pastes WHERE (expiresAt IS NOT NULL AND expiresAt < ?)').run(now);
        if (result.changes > 0) {
            console.log(`🧹 [PASTE PURGE] Cleaned up ${result.changes} expired paste(s)`);
        }
    } catch (e) {
        console.error('❌ Paste Purge error:', e.message);
    }
});

router.post('/:id/react', async (req, res) => {
    if (!req.session?.user) return res.status(401).json({ error: 'Auth Required', authRequired: true });

    const { type } = req.body;
    const pasteId = req.params.id;
    const user = req.session.user;
    const ip = getClientIP(req);

    try {
        // Check for existing reaction by this user on this paste with this type
        const existing = db.prepare('SELECT id FROM paste_reactions WHERE pasteId = ? AND userId = ? AND type = ?').get(pasteId, user.id, type);

        if (existing) {
            // Toggle OFF: Remove existing reaction
            db.prepare('DELETE FROM paste_reactions WHERE id = ?').run(existing.id);
            return res.json({ success: true, action: 'removed' });
        } else {
            // Toggle ON: Add new reaction
            const loc = await fetchGeolocation(ip);
            const geo = loc || {};

            const result = db.prepare(`
                INSERT INTO paste_reactions (
                    pasteId, type, ip, city, country, isp, userAgent, userId, username, avatarUrl
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                pasteId, type, ip, geo.city, geo.country, geo.isp,
                req.headers['user-agent'], user.id, user.username, user.avatarUrl
            );

            updateHostname('paste_reactions', result.lastInsertRowid, ip);
            return res.json({ success: true, action: 'added' });
        }
    } catch (e) {
        console.error('Reaction Error:', e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.get('/:id/analytics', requireAuth, (req, res) => {
    const paste = db.prepare('SELECT views FROM pastes WHERE id = ? COLLATE NOCASE').get(req.params.id);
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

    // Reaction Summary
    const reactionCounts = { heart: 0, star: 0, like: 0 };
    reactions.forEach(r => { if (reactionCounts[r.type] !== undefined) reactionCounts[r.type]++; });

    res.json({
        totalViews: paste.views,
        uniqueIPs: new Set(views.map(v => v.ip)).size,
        topLocations: groupCount(views, v => v.city ? `${v.city}, ${v.country}` : null).slice(0, 10),
        topISPs: groupCount(views, v => v.isp).slice(0, 10),
        platforms: groupCount(views.map(v => parseUA(v.userAgent)), u => u.os),
        browsers: groupCount(views.map(v => parseUA(v.userAgent)), u => u.browser),
        recentViews: views.slice(0, 100).map(v => ({ ...v, ...parseUA(v.userAgent) })),
        reactions: reactionCounts, // Summary for the cards
        detailedReactions: reactions.map(r => ({ // Rename or keep as log
            id: r.id,
            type: r.type,
            username: r.username || 'Anonymous',
            avatarUrl: r.avatarUrl,
            discordId: r.discordId,
            ip: r.ip,
            createdAt: r.createdAt,
            city: r.city,
            country: r.country,
            countryCode: r.countryCode,
            isp: r.isp
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
