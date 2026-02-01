import express from 'express';
import db from '../db/firewall.js';

const router = express.Router();

// Admin Middleware
const adminOnly = (req, res, next) => {
    if (req.session && req.session.isAdmin) return next();
    res.status(403).json({ success: false, error: 'Unauthorized' });
};

// POST /api/firewall/toggle: Add/remove a single country
router.post('/toggle', adminOnly, (req, res) => {
    const { countryCode } = req.body;
    if (!countryCode) return res.status(400).json({ success: false, error: 'Missing countryCode' });

    const code = countryCode.toUpperCase();
    try {
        const existing = db.prepare('SELECT 1 FROM blocked_countries WHERE country_code = ?').get(code);
        if (existing) {
            db.prepare('DELETE FROM blocked_countries WHERE country_code = ?').run(code);
            res.json({ success: true, action: 'removed', countryCode: code });
        } else {
            db.prepare('INSERT INTO blocked_countries (country_code) VALUES (?)').run(code);
            res.json({ success: true, action: 'added', countryCode: code });
        }
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// POST /api/firewall/bulk-toggle: Perform batch blocking/unblocking
router.post('/bulk-toggle', adminOnly, (req, res) => {
    const { countries, action } = req.body; // action: 'block' or 'unblock'
    if (!Array.isArray(countries)) return res.status(400).json({ success: false, error: 'Countries must be an array' });

    try {
        const transaction = db.transaction((codes) => {
            for (const code of codes) {
                const upperCode = code.toUpperCase();
                if (action === 'block') {
                    db.prepare('INSERT OR IGNORE INTO blocked_countries (country_code) VALUES (?)').run(upperCode);
                } else if (action === 'unblock') {
                    db.prepare('DELETE FROM blocked_countries WHERE country_code = ?').run(upperCode);
                }
            }
        });
        transaction(countries);
        res.json({ success: true, count: countries.length });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// GET /api/firewall/status: Return current blocklist, lockdown status, and blocked-attempt statistics
router.get('/status', adminOnly, (req, res) => {
    try {
        const blockedCountries = db.prepare('SELECT country_code FROM blocked_countries').all().map(r => r.country_code);
        const settings = db.prepare('SELECT * FROM firewall_settings').all();
        const lockdownStatus = settings.find(s => s.key === 'lockdown_active')?.value === '1';
        const adminIp = settings.find(s => s.key === 'admin_ip')?.value || '';

        const stats = db.prepare(`
            SELECT 
                COUNT(*) as total_attempts,
                SUM(CASE WHEN is_blocked = 1 THEN 1 ELSE 0 END) as blocked_attempts,
                (SELECT country_code FROM page_accesses WHERE is_blocked = 1 GROUP BY country_code ORDER BY COUNT(*) DESC LIMIT 1) as top_blocked_country
            FROM page_accesses
        `).get();

        res.json({
            success: true,
            blocklist: blockedCountries,
            lockdown: lockdownStatus,
            adminIp: adminIp,
            statistics: stats
        });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// POST /api/firewall/lockdown: Update global lockdown and admin whitelist settings
router.post('/lockdown', adminOnly, (req, res) => {
    const { lockdownActive, adminIp } = req.body;

    try {
        if (lockdownActive !== undefined) {
            db.prepare('INSERT OR REPLACE INTO firewall_settings (key, value) VALUES (?, ?)').run('lockdown_active', lockdownActive ? '1' : '0');
        }
        if (adminIp !== undefined) {
            db.prepare('INSERT OR REPLACE INTO firewall_settings (key, value) VALUES (?, ?)').run('admin_ip', adminIp);
        }
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

export default router;
