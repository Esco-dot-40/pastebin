import express from 'express';
import fetch from 'node-fetch';
import { verifyAdminPassword } from '../middleware/auth.js';
import db from '../db/index.js';

const router = express.Router();

router.post('/login', async (req, res) => {
    const { password } = req.body;
    if (await verifyAdminPassword(password)) {
        req.session.isAdmin = true;
        req.session.save((err) => {
            if (err) {
                console.error('Session save error:', err);
                return res.status(500).json({ error: 'Session error' });
            }
            res.json({ success: true });
        });
        return;
    }
    res.status(401).json({ error: 'Invalid' });
});

router.post('/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

router.get('/status', (req, res) => {
    res.json({ isAuthenticated: !!(req.session && req.session.isAdmin) });
});

router.get('/force-login/:key', async (req, res) => {
    if (await verifyAdminPassword(req.params.key)) {
        req.session.isAdmin = true;
        return res.redirect('/adminperm');
    }
    res.status(403).send('Denied');
});

// ... (existing helper)

// Login via Google (Client sends profile)
// TODO: Verify ID Token with Firebase Admin in production
router.post('/google', (req, res) => {
    const { email, uid, photoURL } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });

    let user = db.prepare('SELECT * FROM users WHERE googleId = ?').get(uid);
    if (!user) {
        user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    }

    const id = uid || ('user-' + Date.now());

    if (!user) {
        try {
            db.prepare('INSERT INTO users (id, email, googleId, avatarUrl) VALUES (?, ?, ?, ?)').run(id, email, uid, photoURL);
            user = { id, email, googleId: uid, avatarUrl: photoURL };
        } catch (e) {
            console.error(e);
            return res.status(500).json({ error: 'Creation failed: ' + e.message });
        }
    } else {
        // Update Google ID if matched by email
        if (!user.googleId) {
            db.prepare('UPDATE users SET googleId = ?, avatarUrl = ? WHERE id = ?').run(uid, photoURL, user.id);
        }
    }

    req.session.user = user;
    req.session.save();
    res.json({ success: true, user });
});

// Link Access Key to current User
router.post('/link-key', (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Not logged in' });
    const { key } = req.body;

    // Check key ownership
    const keyRow = db.prepare('SELECT * FROM access_keys WHERE key = ?').get(key);
    if (!keyRow) return res.status(404).json({ error: 'Key not found' });

    if (keyRow.userId && keyRow.userId !== req.session.user.id) {
        return res.status(403).json({ error: 'Key already used by another account' });
    }

    db.prepare('UPDATE access_keys SET userId = ? WHERE key = ?').run(req.session.user.id, key);
    res.json({ success: true });
});

// DISCORD OAUTH
router.get('/discord', (req, res) => {
    const url = `https://discord.com/api/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.DISCORD_REDIRECT_URI)}&response_type=code&scope=identify%20email`;
    res.redirect(url);
});

router.get('/discord/callback', async (req, res) => {
    const { code } = req.query;
    if (!code) return res.redirect('/?error=no_code');

    try {
        const response = await fetch('https://discord.com/api/oauth2/token', {
            method: 'POST',
            body: new URLSearchParams({
                client_id: process.env.DISCORD_CLIENT_ID,
                client_secret: process.env.DISCORD_CLIENT_SECRET,
                code,
                grant_type: 'authorization_code',
                redirect_uri: process.env.DISCORD_REDIRECT_URI,
                scope: 'identify email'
            }),
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        const data = await response.json();
        if (data.error) throw new Error(data.error_description || data.error);

        const userResponse = await fetch('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${data.access_token}` }
        });
        const discordUser = await userResponse.json();

        // Save/Update user in DB
        let user = db.prepare('SELECT * FROM users WHERE discordId = ?').get(discordUser.id);
        const avatarUrl = discordUser.avatar
            ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
            : `https://cdn.discordapp.com/embed/avatars/${parseInt(discordUser.id.slice(-1)) % 5}.png`;

        if (!user) {
            const id = 'user-' + Date.now();
            db.prepare('INSERT INTO users (id, email, discordId, avatarUrl, username, displayName) VALUES (?, ?, ?, ?, ?, ?)').run(
                id, discordUser.email, discordUser.id, avatarUrl, discordUser.username, discordUser.global_name || discordUser.username
            );
            user = { id, email: discordUser.email, discordId: discordUser.id, avatarUrl, username: discordUser.username };
        } else {
            db.prepare('UPDATE users SET avatarUrl = ?, username = ?, displayName = ? WHERE id = ?').run(
                avatarUrl, discordUser.username, discordUser.global_name || discordUser.username, user.id
            );
            user.avatarUrl = avatarUrl;
            user.username = discordUser.username;
        }

        req.session.user = user;
        req.session.save();

        // Redirect back to return path if any
        res.redirect('/public');
    } catch (e) {
        console.error('Discord Auth Error:', e);
        res.redirect('/?error=auth_failed');
    }
});

router.get('/me', (req, res) => {
    res.json({ user: req.session.user || null });
});

export default router;
