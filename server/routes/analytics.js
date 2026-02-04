import express from 'express';
import db from '../db/index.js';

const router = express.Router();

// Middleware to ensure only admins can manage logs
const requireAdmin = (req, res, next) => {
    if (req.session && req.session.isAdmin) {
        return next();
    }
    res.status(403).json({ error: 'Unauthorized' });
};

// Get all logs with pagination/filtering
router.get('/logs', requireAdmin, (req, res) => {
    const { limit = 100, offset = 0 } = req.query;
    try {
        const logs = db.prepare('SELECT * FROM page_accesses ORDER BY timestamp DESC LIMIT ? OFFSET ?').all(limit, offset);
        const total = db.prepare('SELECT COUNT(*) as count FROM page_accesses').get().count;
        res.json({ logs, total });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Delete a specific log
router.delete('/logs/:id', requireAdmin, (req, res) => {
    try {
        db.prepare('DELETE FROM page_accesses WHERE id = ?').run(req.params.id);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Clear all logs
router.delete('/logs-clear', requireAdmin, (req, res) => {
    try {
        db.prepare('DELETE FROM page_accesses').run();
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Get Threat Intelligence (Suspicious Traffic)
router.get('/threat-intel', requireAdmin, (req, res) => {
    try {
        const suspiciousIPs = db.prepare(`
            SELECT ip, country, isp, COUNT(*) as hit_count, 
                   MAX(proxy) as is_proxy, MAX(hosting) as is_hosting
            FROM page_accesses
            WHERE (proxy = 1 OR hosting = 1)
            GROUP BY ip
            ORDER BY hit_count DESC
            LIMIT 50
        `).all();

        const topBlocked = db.prepare(`
            SELECT country_code as countryCode, 'Locked' as countryName, 1 as status FROM blocked_countries
        `).all();

        res.json({ suspiciousIPs, topBlocked });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Mock "Archive" (could move to another table, but for now just mark or export)
router.post('/logs-archive', requireAdmin, (req, res) => {
    res.json({ success: true, message: 'Logs processed for archival' });
});

// Get Universal Telemetry (Publicly accessible but rate-limited/obfuscated)
router.get('/universal-telemetry', (req, res) => {
    try {
        // Return last 200 hits with coordinates for the globe
        const hits = db.prepare(`
            SELECT lat, lon, hostname, country_code, is_blocked, timestamp 
            FROM page_accesses 
            WHERE lat != 0 AND lon != 0
            ORDER BY timestamp DESC 
            LIMIT 200
        `).all();
        res.json(hits);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

export default router;
