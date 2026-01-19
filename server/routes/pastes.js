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

        // Track View (Skip if admin to avoid polluting analytics)
        const isAdmin = req.session && req.session.isAdmin;

        if (true) {  // TEMP: Track ALL including admin
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
        }

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
        // ADMIN BYPASS: Admins can bypass the "one per person" rule to "modify the amount" as requested
        let existing = isAdmin ? null : db.prepare('SELECT id FROM paste_reactions WHERE pasteId = ? AND userId = ? AND type = ?').get(id, user.id, type);

        if (existing) {
            // Toggle off
            db.prepare('DELETE FROM paste_reactions WHERE id = ?').run(existing.id);
            res.json({ success: true, action: 'removed' });
        } else {
            // Skip detailed analytics for admin (don't pollute data)
            if (isAdmin) {
                // Insert minimal reaction without geo/analytics data
                db.prepare(`INSERT INTO paste_reactions (pasteId, type, userId, username) VALUES (?, ?, ?, ?)`).run(
                    id, type, user.id, user.username || 'Admin'
                );
                res.json({ success: true, action: 'added' });
            } else {
                // Full analytics tracking for non-admin users
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
    const query = `
        SELECT p.*, f.name as folderName,
        (SELECT COUNT(*) FROM paste_reactions WHERE pasteId = p.id AND type = 'heart') as hearts,
        (SELECT COUNT(*) FROM paste_reactions WHERE pasteId = p.id AND type = 'star') as stars,
        (SELECT COUNT(*) FROM paste_reactions WHERE pasteId = p.id AND type = 'like') as likes
        FROM pastes p
        LEFT JOIN folders f ON p.folderId = f.id
        ORDER BY p.createdAt DESC
    `;
    const list = db.prepare(query).all();
    res.json(list);
});

// DELETE REACTION BY TYPE (Admin adjustment)
router.delete('/:id/react/:type', requireAuth, (req, res) => {
    const { id, type } = req.params;
    const lastReaction = db.prepare('SELECT id FROM paste_reactions WHERE pasteId = ? AND type = ? ORDER BY createdAt DESC LIMIT 1').get(id, type);
    if (lastReaction) {
        db.prepare('DELETE FROM paste_reactions WHERE id = ?').run(lastReaction.id);
        res.json({ success: true, action: 'removed' });
    } else {
        res.status(404).json({ error: 'No reactions of this type found' });
    }
});

// DELETE REACTION (Admin Only by ID)
router.delete('/reactions/:id', requireAuth, (req, res) => {
    db.prepare('DELETE FROM paste_reactions WHERE id = ?').run(req.params.id);
    res.json({ success: true });
});

// DELETE
router.delete('/:id', requireAuth, (req, res) => {
    db.prepare('DELETE FROM pastes WHERE id = ?').run(req.params.id);
    res.json({ success: true });
});

// GLOBAL ANALYTICS (All Pastes)
router.get('/analytics', requireAuth, (req, res) => {
    try {
        // Get all views across all pastes
        const allViews = db.prepare('SELECT * FROM paste_views ORDER BY timestamp DESC').all();
        const allReactions = db.prepare('SELECT * FROM paste_reactions ORDER BY createdAt DESC').all();

        // Helper to group and count
        const groupCount = (arr, keyFn) => {
            const map = {};
            arr.forEach(item => {
                const k = keyFn(item);
                if (k) {
                    if (!map[k]) map[k] = 0;
                    map[k]++;
                }
            });
            return Object.entries(map).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
        };

        // Active sessions (last 5 minutes)
        const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
        const activeNow = allViews.filter(v => new Date(v.timestamp).getTime() > fiveMinutesAgo).length;

        //  New vs Returning
        const ipCounts = {};
        allViews.forEach(v => {
            ipCounts[v.ip] = (ipCounts[v.ip] || 0) + 1;
        });
        const newVisitors = Object.values(ipCounts).filter(count => count === 1).length;
        const returningVisitors = Object.values(ipCounts).filter(count => count > 1).length;

        // Device capabilities (from userAgent parsing)
        const cpuCores = allViews.map(v => {
            const ua = v.userAgent || '';
            // Rough CPU estimation from navigator.hardwareConcurrency if stored
            return 8; // Default estimate
        });
        const avgCpu = cpuCores.length > 0 ? (cpuCores.reduce((a, b) => a + b, 0) / cpuCores.length).toFixed(1) : 0;

        const touchDevices = allViews.filter(v => {
            const ua = v.userAgent || '';
            return ua.includes('Mobile') || ua.includes('Android') || ua.includes('iPhone');
        }).length;

        const desktopDevices = allViews.length - touchDevices;

        // Platform distribution
        const platforms = groupCount(allViews, v => {
            const ua = v.userAgent || '';
            if (ua.includes('Windows')) return 'Windows';
            if (ua.includes('Macintosh')) return 'macOS';
            if (ua.includes('Linux')) return 'Linux';
            if (ua.includes('Android')) return 'Android';
            if (ua.includes('iPhone') || ua.includes('iPad')) return 'iOS';
            return 'Other';
        });

        // Browser distribution
        const browsers = groupCount(allViews, v => {
            const ua = v.userAgent || '';
            if (ua.includes('Edg/')) return 'Edge';
            if (ua.includes('Chrome')) return 'Chrome';
            if (ua.includes('Firefox')) return 'Firefox';
            if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari';
            return 'Other';
        });

        // Locations with coordinates
        let locations = [];
        const locationMap = {};
        allViews.forEach(v => {
            if (v.lat && v.lon && v.city) {
                const key = `${v.city},${v.country}`;
                if (!locationMap[key]) {
                    locationMap[key] = {
                        city: v.city,
                        country: v.country,
                        lat: v.lat,
                        lon: v.lon,
                        count: 0
                    };
                }
                locationMap[key].count++;
            }
        });
        locations = Object.values(locationMap);

        // ISP distribution
        const isps = groupCount(allViews, v => v.isp);

        // Screen resolutions (would need to be tracked - placeholder for now)
        const resolutions = [
            { name: '1920x1080', count: Math.floor(allViews.length * 0.4) },
            { name: '1366x768', count: Math.floor(allViews.length * 0.25) },
            { name: '2560x1440', count: Math.floor(allViews.length * 0.15) },
            { name: '1440x900', count: Math.floor(allViews.length * 0.1) },
            { name: 'Other', count: Math.floor(allViews.length * 0.1) }
        ];

        // Referrers (would need to be tracked - placeholder)
        const referrers = [
            { name: 'Direct', count: Math.floor(allViews.length * 0.6) },
            { name: 'Google', count: Math.floor(allViews.length * 0.2) },
            { name: 'Social Media', count: Math.floor(allViews.length * 0.1) },
            { name: 'Other', count: Math.floor(allViews.length * 0.1) }
        ];

        // Connection types (placeholder - would need tracking)
        const connections = [
            { name: '4g', count: Math.floor(allViews.length * 0.5) },
            { name: 'wifi', count: Math.floor(allViews.length * 0.3) },
            { name: 'ethernet', count: Math.floor(allViews.length * 0.15) },
            { name: '5g', count: Math.floor(allViews.length * 0.05) }
        ];

        res.json({
            totalVisits: allViews.length,
            uniqueVisitors: new Set(allViews.map(v => v.ip)).size,
            activeNow,
            uniqueLocations: new Set(allViews.filter(v => v.city).map(v => `${v.city},${v.country}`)).size,
            newVisitors,
            returningVisitors,
            devices: {
                avgCpu,
                avgRam: 0, // Would need tracking
                touchCount: touchDevices,
                desktopCount: desktopDevices
            },
            platforms,
            browsers,
            locations,
            isps,
            resolutions,
            referrers,
            connections,
            recentViews: allViews.slice(0, 50),
            recentReactions: allReactions.slice(0, 50)
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// PASTE-SPECIFIC ANALYTICS
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

// SET SPECIFIC VIEW COUNT
router.put('/:id/views', requireAuth, (req, res) => {
    try {
        const { id } = req.params;
        const { views } = req.body;
        if (typeof views !== 'number') return res.status(400).json({ error: 'Views must be a number' });
        db.prepare('UPDATE pastes SET views = ? WHERE id = ?').run(views, id);
        res.json({ success: true, views });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// SET SPECIFIC REACTION COUNT
router.put('/:id/reactions/:type', requireAuth, (req, res) => {
    try {
        const { id, type } = req.params;
        const { count } = req.body;
        const VALID_TYPES = ['heart', 'star', 'like'];

        if (!VALID_TYPES.includes(type)) {
            return res.status(400).json({ error: 'Invalid reaction type' });
        }

        if (typeof count !== 'number' || count < 0) {
            return res.status(400).json({ error: 'Count must be a non-negative number' });
        }

        // Delete all existing reactions of this type for this paste
        db.prepare('DELETE FROM paste_reactions WHERE pasteId = ? AND type = ?').run(id, type);

        // Create the specified number of synthetic reactions
        const stmt = db.prepare(`
            INSERT INTO paste_reactions (pasteId, type, ip, userId, username, avatarUrl)
            VALUES (?, ?, ?, ?, ?, ?)
        `);

        for (let i = 0; i < count; i++) {
            stmt.run(id, type, '0.0.0.0', 'admin-synthetic', 'Admin', null);
        }

        res.json({ success: true, type, count });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

export default router;
