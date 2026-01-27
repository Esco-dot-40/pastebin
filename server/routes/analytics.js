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

// Mock "Archive" (could move to another table, but for now just mark or export)
router.post('/logs-archive', requireAdmin, (req, res) => {
    // In a real app, we'd move these to a cold storage table
    // For now, we'll just return success as a placeholder for the UI
    res.json({ success: true, message: 'Logs processed for archival' });
});

export default router;
