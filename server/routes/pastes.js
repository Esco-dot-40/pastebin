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

    // Normalize IPv6 mapped IPv4 addresses
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

        // Using a more robust backup API if the first fails
        console.log(`🌐 Geo-Lookup: ${ip}`);
        const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,isp,org,as,query`);
        const data = await response.json();

        if (data.status === 'success') {
            return data;
        }
        return null;
    } catch (e) {
        console.error(`Geo Error: ${e.message}`);
        return null;
    }
}

// CREATE
router.post('/', requireAuth, async (req, res) => {
    try {
        const { title, content, language, expiresAt, isPublic, burnAfterRead, folderId, password, embedUrl } = req.body;
        const id = generateId();
        const cleanPassword = password ? password.trim() : null;

        db.prepare(`
            INSERT INTO pastes (id, title, content, language, expiresAt, isPublic, burnAfterRead, folderId, password, embedUrl) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(id, title || 'Untitled', content, language || 'plaintext', expiresAt || null, isPublic !== false ? 1 : 0, burnAfterRead ? 1 : 0, folderId || null, cleanPassword, embedUrl || null);

        res.status(201).json({ id, success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// UPDATE
router.put('/:id', requireAuth, async (req, res) => {
    try {
        const { title, content, language, expiresAt, isPublic, burnAfterRead, folderId, password, embedUrl } = req.body;
        const { id } = req.params;
        const cleanPassword = password ? password.trim() : null;

        db.prepare(`
            UPDATE pastes 
            SET title = ?, content = ?, language = ?, expiresAt = ?, isPublic = ?, burnAfterRead = ?, folderId = ?, password = ?, embedUrl = ?
            WHERE id = ?
        `).run(
            title || 'Untitled',
            content,
            language || 'plaintext',
            expiresAt || null,
            isPublic !== false ? 1 : 0,
            burnAfterRead ? 1 : 0,
            folderId || null,
            cleanPassword,
            embedUrl || null,
            id
        );

        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Helper to validate access key
function validateAccessKey(key) {
    if (!key) return false;
    const row = db.prepare('SELECT id FROM access_keys WHERE key = ? AND status = ?').get(key, 'active');
    return !!row;
}

// PUBLIC LIST
router.get('/public-list', (req, res) => {
    try {
        const accessKey = req.headers['x-access-key'];
        const isAdmin = req.session && req.session.isAdmin;
        const hasAccess = validateAccessKey(accessKey) || isAdmin;

        let query = `
            SELECT p.*, f.name as folderName,
            (SELECT COUNT(*) FROM paste_reactions WHERE pasteId = p.id AND type = 'heart') as hearts,
            (SELECT COUNT(*) FROM paste_reactions WHERE pasteId = p.id AND type = 'star') as stars,
            (SELECT COUNT(*) FROM paste_reactions WHERE pasteId = p.id AND type = 'like') as likes
            FROM pastes p 
            LEFT JOIN folders f ON p.folderId = f.id 
            WHERE p.isPublic = 1
        `;

        if (hasAccess) {
            query = `
                SELECT p.*, f.name as folderName,
                (SELECT COUNT(*) FROM paste_reactions WHERE pasteId = p.id AND type = 'heart') as hearts,
                (SELECT COUNT(*) FROM paste_reactions WHERE pasteId = p.id AND type = 'star') as stars,
                (SELECT COUNT(*) FROM paste_reactions WHERE pasteId = p.id AND type = 'like') as likes
                FROM pastes p 
                LEFT JOIN folders f ON p.folderId = f.id 
                WHERE 1=1
            `;
        }

        const list = db.prepare(query + ` ORDER BY p.createdAt DESC`).all();

        // Sanitize
        const sanitized = list.map(p => ({
            ...p,
            hasPassword: !!p.password,
            password: undefined,
            isPrivate: p.isPublic === 0 // Add flag for UI
        }));

        res.json(sanitized);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// STATS SUMMARY
router.get('/stats/summary', requireAuth, (req, res) => {
    const totalPastes = db.prepare('SELECT COUNT(*) as count FROM pastes').get().count;
    const totalViews = db.prepare('SELECT SUM(views) as total FROM pastes').get().total || 0;
    const totalReactions = db.prepare('SELECT COUNT(*) as count FROM paste_reactions').get().count;
    const langs = db.prepare('SELECT language, COUNT(*) as count FROM pastes GROUP BY language').all();
    const languageBreakdown = {};
    langs.forEach(l => languageBreakdown[l.language] = l.count);
    res.json({ totalPastes, totalViews, totalReactions, languageBreakdown });
});

// GET ONE
router.get('/:id', async (req, res) => {
    try {
        const paste = db.prepare('SELECT * FROM pastes WHERE id = ?').get(req.params.id);
        if (!paste) return res.status(404).json({ error: 'Not found' });

        if (paste.isPublic === 0) {
            const isAdmin = req.session && req.session.isAdmin;
            const accessKey = req.headers['x-access-key'];
            const hasAccess = validateAccessKey(accessKey);

            // Allow access if user is admin, has a key, OR if the paste has a password 
            // (we'll let the password check handle the validation later)
            if (!isAdmin && !hasAccess && !paste.password) {
                return res.status(403).json({ error: 'Private paste access requires a valid access key.' });
            }
        }

        // Password Check Logic
        if (paste.password) {
            const isAdmin = req.session && req.session.isAdmin;
            const providedPass = req.headers['x-paste-password'] || req.query.password;

            // Only bypass if Admin AND explicitly in "Edit Mode" (track=false)
            const isEditMode = req.query.track === 'false';

            console.log(`[DEBUG] Check Password. Paste: ${paste.password}, Provided: ${providedPass}`);

            if (!isAdmin || !isEditMode) {
                if (providedPass !== paste.password) {
                    console.log(`[DEBUG] Password Mismatch! Expected '${paste.password}', Got '${providedPass}'`);
                    return res.status(401).json({ error: 'Password required', passwordRequired: true });
                }
            } else {
                console.log(`[DEBUG] Admin edit bypass granted`);
            }
        } else {
            console.log(`[DEBUG] Paste ${paste.id} has NO password.`);
        }

        db.prepare('UPDATE pastes SET views = views + 1 WHERE id = ?').run(req.params.id);

        // Track View (Ensure all fields are handled)
        const ip = getClientIP(req);
        const userAgent = req.headers['user-agent'] || '';

        fetchGeolocation(ip).then(loc => {
            if (loc) {
                const res2 = db.prepare(`
                    INSERT INTO paste_views (pasteId, ip, country, countryCode, region, regionName, city, zip, lat, lon, isp, org, asName, userAgent)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `).run(
                    req.params.id, ip, loc.country, loc.countryCode, loc.region, loc.regionName,
                    loc.city, loc.zip, loc.lat, loc.lon, loc.isp, loc.org, loc.as, userAgent
                );
                updateHostname('paste_views', res2.lastInsertRowid, ip);
            } else {
                const res2 = db.prepare(`INSERT INTO paste_views (pasteId, ip, userAgent) VALUES (?, ?, ?)`).run(req.params.id, ip, userAgent);
                updateHostname('paste_views', res2.lastInsertRowid, ip);
            }
        }).catch(() => {
            const res2 = db.prepare(`INSERT INTO paste_views (pasteId, ip, userAgent) VALUES (?, ?, ?)`).run(req.params.id, ip, userAgent);
            updateHostname('paste_views', res2.lastInsertRowid, ip);
        });

        // Fetch Reactions
        const reactions = db.prepare('SELECT type, COUNT(*) as count FROM paste_reactions WHERE pasteId = ? GROUP BY type').all(req.params.id);
        const reactionCounts = { heart: 0, star: 0, like: 0 };
        reactions.forEach(r => {
            if (reactionCounts[r.type] !== undefined) reactionCounts[r.type] = r.count;
        });
        paste.reactions = reactionCounts;

        res.json(paste);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// React to Paste
router.post('/:id/react', async (req, res) => {
    try {
        // FORCE LOGIN: Users must be logged in to react
        if (!req.session || !req.session.user) {
            return res.status(401).json({ error: 'Auth Required', authRequired: true });
        }

        const { id } = req.params;
        const { type } = req.body;
        const VALID_TYPES = ['heart', 'star', 'like'];

        if (!VALID_TYPES.includes(type)) return res.status(400).json({ error: 'Invalid reaction type' });

        const ip = getClientIP(req);
        const userAgent = req.headers['user-agent'] || '';
        const user = req.session.user;
        const isAdmin = req.session.isAdmin;

        // Check for existing reaction by this user on this paste of this type
        let existing = db.prepare('SELECT id FROM paste_reactions WHERE pasteId = ? AND userId = ? AND type = ?').get(id, user.id, type);

        if (existing) {
            // Toggle off
            db.prepare('DELETE FROM paste_reactions WHERE id = ?').run(existing.id);
            res.json({ success: true, action: 'removed' });
        } else {
            // One per person rule:
            // For non-admins, ensure they don't have multiple reactions of the SAME type via other methods (id matched)
            // But actually, userId is the primary key for the person here now.

            // Fetch Geo for Analytics
            const loc = await fetchGeolocation(ip);
            const geo = loc || {};

            // Prepare Insert
            const cols = `pasteId, type, ip, country, countryCode, region, regionName, city, zip, lat, lon, isp, org, asName, userAgent, discordId, userId, username, avatarUrl`;
            const vals = `?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?`;

            const result = db.prepare(`INSERT INTO paste_reactions (${cols}) VALUES (${vals})`).run(
                id, type, ip,
                geo.country || null, geo.countryCode || null, geo.region || null, geo.regionName || null,
                geo.city || null, geo.zip || null, geo.lat || null, geo.lon || null, geo.isp || null, geo.org || null, geo.as || null,
                userAgent,
                user.discordId || null, user.id, user.username || user.displayName || 'User', user.avatarUrl
            );

            // Async Reverse DNS
            updateHostname('paste_reactions', result.lastInsertRowid, ip);

            res.json({ success: true, action: 'added' });
        }

    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Helper for Async DNS Update
async function updateHostname(table, id, ip) {
    if (ip === '127.0.0.1' || ip.includes(':')) return;
    try {
        const { promises: dns } = await import('dns');
        const hostnames = await dns.reverse(ip);
        if (hostnames && hostnames.length > 0) {
            db.prepare(`UPDATE ${table} SET hostname = ? WHERE id = ?`).run(hostnames[0], id);
        }
    } catch (e) {
        // limit noise
    }
}

// ADMIN LIST
router.get('/', requireAuth, (req, res) => {
    const list = db.prepare('SELECT * FROM pastes ORDER BY createdAt DESC').all();
    res.json(list);
});

// DELETE
router.delete('/:id', requireAuth, (req, res) => {
    db.prepare('DELETE FROM pastes WHERE id = ?').run(req.params.id);
    res.json({ success: true });
});

// ANALYTICS
router.get('/:id/analytics', requireAuth, (req, res) => {
    const { id } = req.params;
    const paste = db.prepare('SELECT views FROM pastes WHERE id = ?').get(id);
    if (!paste) return res.status(404).json({ error: 'Not found' });

    const views = db.prepare('SELECT * FROM paste_views WHERE pasteId = ? ORDER BY timestamp DESC').all(id);

    const groupCount = (arr, keyFn) => {
        const map = {};
        arr.forEach(item => {
            const k = keyFn(item) || null;
            if (k) {
                if (!map[k]) map[k] = { name: k, count: 0 };
                map[k].count++;
            }
        });
        return Object.values(map).sort((a, b) => b.count - a.count);
    };

    res.json({
        totalViews: paste.views,
        uniqueIPs: new Set(views.map(v => v.ip)).size,
        uniqueCountries: new Set(views.filter(v => v.country).map(v => v.country)).size,
        topLocations: groupCount(views, v => v.city ? `${v.city}, ${v.country}` : null).slice(0, 10),
        topRegions: groupCount(views, v => v.regionName || v.region).slice(0, 10),
        topISPs: groupCount(views, v => v.isp).slice(0, 10),
        topBrowsers: groupCount(views, v => {
            const ua = v.userAgent || '';
            if (ua.includes('Firefox')) return 'Firefox';
            if (ua.includes('Chrome')) return 'Chrome';
            if (ua.includes('Safari')) return 'Safari';
            if (ua.includes('Edg/')) return 'Edge';
            return 'Other';
        }).slice(0, 5),
        recentViews: views.slice(0, 50),
        recentReactions: db.prepare('SELECT * FROM paste_reactions WHERE pasteId = ? ORDER BY createdAt DESC LIMIT 50').all(id),
        reactions: {
            heart: paste.reactions?.heart || 0, // Using DB aggregate if available, or just recalculate
            star: paste.reactions?.star || 0,
            like: paste.reactions?.like || 0
        }
    });
});

// DELETE ANALYTICS (Wipe Logs + Reset Counter)
router.delete('/:id/analytics', requireAuth, (req, res) => {
    try {
        const { id } = req.params;
        db.prepare('DELETE FROM paste_views WHERE pasteId = ?').run(id);
        db.prepare('UPDATE pastes SET views = 0 WHERE id = ?').run(id);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// RESET VIEW COUNTER (Separate from Logs)
router.post('/:id/reset-views', requireAuth, (req, res) => {
    try {
        const { id } = req.params;
        db.prepare('UPDATE pastes SET views = 0 WHERE id = ?').run(id);
        res.json({ success: true, message: 'View counter reset to 0' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// CLEAR ALL ANALYTICS (Wipe All Logs + Reset All Counters)
router.delete('/analytics/all', requireAuth, (req, res) => {
    try {
        db.prepare('DELETE FROM paste_views').run();
        db.prepare('UPDATE pastes SET views = 0').run();
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
