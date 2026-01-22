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
        const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,isp,org,as,query`, {
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        const data = await response.json();
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
// ANALYTICS ROUTES (Must be before /:id)
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

        res.json({
            totalVisits, uniqueVisitors, activeNow, uniqueLocations,
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
            recentViews: pasteViews.slice(-50).reverse(),
            pageAccesses: {
                total: pageAccesses.length,
                recent: pageAccesses.slice(-50).reverse()
            }
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ==========================================
// CORE CRUD
// ==========================================

router.get('/public-list', (req, res) => {
    try {
        const isAdmin = req.session && req.session.isAdmin;
        const hasAccess = validateAccessKey(req.headers['x-access-key']) || isAdmin;
        let query = `SELECT p.*, f.name as folderName FROM pastes p LEFT JOIN folders f ON p.folderId = f.id WHERE ${hasAccess ? '1=1' : 'p.isPublic = 1'} ORDER BY p.createdAt DESC`;
        const list = db.prepare(query).all();
        res.json(list.map(p => ({ ...p, hasPassword: !!p.password, password: undefined })));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', requireAuth, async (req, res) => {
    try {
        const { title, content, language, expiresAt, isPublic, burnAfterRead, folderId, password, embedUrl } = req.body;
        const id = generateId();
        db.prepare('INSERT INTO pastes (id, title, content, language, expiresAt, isPublic, burnAfterRead, folderId, password, embedUrl) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(id, title || 'Untitled', content, language || 'plaintext', expiresAt || null, isPublic !== false ? 1 : 0, burnAfterRead ? 1 : 0, folderId || null, password || null, embedUrl || null);
        res.status(201).json({ id, success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/stats/summary', requireAuth, (req, res) => {
    const totalPastes = db.prepare('SELECT COUNT(*) as count FROM pastes').get().count;
    const totalViews = db.prepare('SELECT SUM(views) as total FROM pastes').get().total || 0;
    res.json({ totalPastes, totalViews });
});

router.get('/:id', async (req, res) => {
    try {
        const paste = db.prepare('SELECT * FROM pastes WHERE id = ?').get(req.params.id);
        if (!paste) return res.status(404).json({ error: 'Not found' });

        if (paste.password && (req.headers['x-paste-password'] || req.query.password) !== paste.password && !(req.session && req.session.isAdmin && req.query.track === 'false')) {
            return res.status(401).json({ error: 'Password required', passwordRequired: true });
        }

        db.prepare('UPDATE pastes SET views = views + 1 WHERE id = ?').run(req.params.id);
        const isAdmin = req.session && req.session.isAdmin;
        if (!isAdmin || process.env.LOG_ADMINS === 'true') {
            const ip = getClientIP(req);
            fetchGeolocation(ip).then(loc => {
                const q = loc ? `INSERT INTO paste_views (pasteId, ip, country, countryCode, region, regionName, city, zip, lat, lon, isp, org, asName, userAgent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` : `INSERT INTO paste_views (pasteId, ip, userAgent) VALUES (?, ?, ?)`;
                const params = loc ? [req.params.id, ip, loc.country, loc.countryCode, loc.region, loc.regionName, loc.city, loc.zip, loc.lat, loc.lon, loc.isp, loc.org, loc.as, req.headers['user-agent']] : [req.params.id, ip, req.headers['user-agent']];
                const res2 = db.prepare(q).run(...params);
                updateHostname('paste_views', res2.lastInsertRowid, ip);
            }).catch(() => { });
        }
        res.json(paste);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id/analytics', requireAuth, (req, res) => {
    try {
        const paste = db.prepare('SELECT views FROM pastes WHERE id = ?').get(req.params.id);
        if (!paste) return res.status(404).json({ error: 'Not found' });
        const views = db.prepare('SELECT * FROM paste_views WHERE pasteId = ? ORDER BY timestamp DESC').all(req.params.id);
        const groupCount = (arr, keyFn) => {
            const map = {};
            arr.forEach(item => { const k = keyFn(item); if (k) { if (!map[k]) map[k] = { name: k, count: 0 }; map[k].count++; } });
            return Object.values(map).sort((a, b) => b.count - a.count);
        };
        res.json({
            totalViews: paste.views,
            uniqueIPs: new Set(views.map(v => v.ip)).size,
            topLocations: groupCount(views, v => v.city ? `${v.city}, ${v.country}` : null).slice(0, 10),
            topISPs: groupCount(views, v => v.isp).slice(0, 10),
            recentViews: views.slice(0, 50)
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', requireAuth, (req, res) => {
    db.prepare('DELETE FROM pastes WHERE id = ?').run(req.params.id);
    res.json({ success: true });
});

export default router;
