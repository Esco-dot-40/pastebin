import express from 'express';
import db from '../db/index.js';

const router = express.Router();

// Admin Middleware (assuming it's available or implemented)
const adminOnly = (req, res, next) => {
    if (req.session && req.session.isAdmin) return next();
    res.status(403).json({ success: false, error: 'Unauthorized' });
};

// GET all blocked countries
router.get('/list', async (req, res) => {
    try {
        const rows = db.prepare('SELECT * FROM blocked_countries').all();
        res.json({ success: true, countries: rows });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// TOGGLE country block
router.post('/toggle', adminOnly, async (req, res) => {
    const { countryCode, countryName, status } = req.body;
    if (!countryCode) return res.status(400).json({ success: false, error: 'Missing countryCode' });

    try {
        const existing = db.prepare('SELECT * FROM blocked_countries WHERE countryCode = ?').get(countryCode);
        if (existing) {
            db.prepare('UPDATE blocked_countries SET status = ? WHERE countryCode = ?').run(status ? 1 : 0, countryCode);
        } else {
            db.prepare('INSERT INTO blocked_countries (countryCode, countryName, status) VALUES (?, ?, ?)')
                .run(countryCode, countryName || 'Unknown', status ? 1 : 0);
        }
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// GET active blocks (Publicly available for middleware use)
router.get('/active', async (req, res) => {
    try {
        const rows = db.prepare('SELECT countryCode FROM blocked_countries WHERE status = 1').all();
        res.json({ success: true, codes: rows.map(r => r.countryCode) });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

export default router;
