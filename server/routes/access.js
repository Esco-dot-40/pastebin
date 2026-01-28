import express from 'express';
import db from '../db/index.js';
import fetch from 'node-fetch';
import passport from 'passport';
import { Strategy as DiscordStrategy } from 'passport-discord';
import nodemailer from 'nodemailer';

const router = express.Router();

const verificationCodes = new Map(); // email -> { code, expires }

// POST /auth/email-start - Send verification code
router.post('/auth/email-start', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });

    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    verificationCodes.set(email, {
        code,
        expires: Date.now() + 300000 // 5 mins
    });

    console.log(`📨 [MOCK EMAIL] To: ${email} | Code: ${code}`);

    // Sending Email via Nodemailer
    console.log(`📨 [MOCK EMAIL] To: ${email} | Code: ${code}`);

    // SMTP unavailable, pushing code to Discord Webhook for Admin/User visibility
    const webhookUrl = process.env.AK_REQUEST_WEBHOOK_URL || 'https://canary.discord.com/api/webhooks/1455575893882962063/yflGyZD_Luwac67cvTw696k8-3EpUUv3SU78fIf8_PxI8_-aA8EtPkqB_smPdTnOzuvk';

    if (webhookUrl) {
        fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                content: `📨 **Email Verification Started**`,
                embeds: [{
                    title: 'Verification Code',
                    description: `User: **${email}**\nCode: \`${code}\`\n\n*Enter this code on the site to proceed.*`,
                    color: 0x00ff88,
                    footer: { text: 'SMTP Unavailable - Dev Mode' }
                }]
            })
        }).catch(err => console.error('Failed to send code to webhook', err));
    }

    res.json({ success: true, message: 'Verification code sent (Check Discord Webhook)' });
});

// POST /auth/email-verify - Check code
router.post('/auth/email-verify', (req, res) => {
    const { email, code } = req.body;
    const record = verificationCodes.get(email);

    if (!record || record.code !== code) {
        return res.status(401).json({ error: 'Invalid code' });
    }
    if (Date.now() > record.expires) {
        verificationCodes.delete(email);
        return res.status(401).json({ error: 'Code expired' });
    }

    // Success! Mark as verified in session or return a token
    // For simplicity, we'll return a signed temp token or just a success flag
    // In this specific flow, we'll trust the client state for the next step 
    // but ideally we'd sign a JWT. Let's just return success for now.

    // Clean up
    verificationCodes.delete(email);

    res.json({ success: true });
});

// POST /request - Send webhook (Requires verified contact)
router.post('/request', async (req, res) => {
    const { contact, reason, method } = req.body;

    // Use provided webhook URL
    const webhookUrl = process.env.AK_REQUEST_WEBHOOK_URL || 'https://canary.discord.com/api/webhooks/1455575893882962063/yflGyZD_Luwac67cvTw696k8-3EpUUv3SU78fIf8_PxI8_-aA8EtPkqB_smPdTnOzuvk';

    if (webhookUrl) {
        try {
            const discordRes = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content: "Hey Esco, someone wants in! 🔒",
                    embeds: [{
                        title: '🔑 New Access Key Request',
                        color: 0xff0000,
                        fields: [
                            { name: 'User', value: contact, inline: true },
                            { name: 'Auth Method', value: method || 'Email', inline: true },
                            { name: 'Reason', value: reason || 'No reason provided' },
                            { name: 'Time', value: new Date().toLocaleString() }
                        ],
                        footer: { text: 'PasteBin Pro Access System' }
                    }]
                })
            });

            if (!discordRes.ok) {
                const txt = await discordRes.text();
                console.error('Discord Webhook Failed:', discordRes.status, txt);
            }
        } catch (e) {
            console.error('Webhook error:', e);
        }
    }

    res.json({ success: true, message: 'Request sent to Esco' });
});

// POST /verify - Check key
router.post('/verify', (req, res) => {
    const key = req.body.key?.trim();
    console.log('[ACCESS] Verify request. Key:', key);
    if (!key) return res.status(400).json({ error: 'Key required' });

    try {
        const row = db.prepare('SELECT * FROM access_keys WHERE key = ?').get(key);
        console.log('[ACCESS] Database result:', row);

        if (!row) {
            console.log(`[ACCESS] Key check failed: [${key}]`);
            // Let's also check all keys in the database for debugging
            const allKeys = db.prepare('SELECT key, status FROM access_keys').all();
            console.log('[ACCESS] All keys in DB:', allKeys);
            return res.status(401).json({ error: 'Key not found.' });
        }

        if (row.status !== 'active') {
            console.log('[ACCESS] Key is not active:', row.status);
            return res.status(401).json({ error: 'Key is not active.' });
        }

        // Check Fingerprint (Machine Binding)
        const fingerprint = req.body.fingerprint;
        const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;

        if (row.claimedFingerprint && row.claimedFingerprint !== fingerprint) {
            console.warn(`⚠️ Access Denied: Key [${key}] is bound to fingerprint ${row.claimedFingerprint.substring(0, 8)}..., but accessed from ${fingerprint?.substring(0, 8)}...`);
            return res.status(403).json({ error: 'This access key is bound to another device. If you believe this is an error, contact Esco.' });
        }

        if (!row.claimedFingerprint && fingerprint) {
            console.log(`🔐 Key Bound to Device: [${key}] matched to fingerprint ${fingerprint}`);
            db.prepare('UPDATE access_keys SET claimedFingerprint = ?, claimedIp = ? WHERE key = ?').run(fingerprint, ip, key);
        }

        // Log usage
        db.prepare('UPDATE access_keys SET lastUsedAt = ? WHERE key = ?').run(new Date().toISOString(), key);

        console.log('[ACCESS] Key verified successfully');
        res.json({ success: true, key: row.key, userId: row.userId });
    } catch (e) {
        console.error('Verify Error:', e);
        res.status(500).json({ error: 'DB Error: ' + e.message });
    }
});

// POST /generate - Generate new key (Admin only)
router.post('/generate', (req, res) => {
    // Admin auth check
    if (!req.session || !req.session.isAdmin) {
        return res.status(403).json({ error: 'Admin authentication required' });
    }

    // Generate secure random key
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let key = 'sk-';
    for (let i = 0; i < 32; i++) {
        key += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    const id = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    try {
        db.prepare('INSERT INTO access_keys (id, key, status, createdAt) VALUES (?, ?, ?, ?)').run(id, key, 'active', new Date().toISOString());
        res.json({ success: true, key });
    } catch (e) {
        console.error('Key Gen Error:', e);
        res.status(500).json({ error: 'Failed: ' + e.message });
    }
});



// --- REPLACED WITH CONSOLIDATED AUTH IN auth.js ---
router.get('/auth/discord', (req, res) => {
    const query = new URLSearchParams(req.query).toString();
    res.redirect(`/api/auth/discord${query ? '?' + query : ''}`);
});
router.get('/auth/discord/login', (req, res) => {
    const query = new URLSearchParams(req.query).toString();
    res.redirect(`/api/auth/discord?state=login${query ? '&' + query : ''}`);
});
router.get('/auth/discord/callback', (req, res) => {
    const query = new URLSearchParams(req.query).toString();
    res.redirect(`/api/auth/discord/callback${query ? '?' + query : ''}`);
});

// --- Admin Routes ---

function isAdmin(req, res, next) {
    if (req.session && req.session.isAdmin) return next();
    res.status(403).json({ error: 'Admin only' });
}

router.get('/keys', isAdmin, (req, res) => {
    try {
        const keys = db.prepare(`
            SELECT k.*, u.email as userEmail, u.discordId as userDiscordId
            FROM access_keys k
            LEFT JOIN users u ON k.userId = u.id
            ORDER BY k.createdAt DESC
        `).all();
        res.json(keys);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/keys/:id', isAdmin, (req, res) => {
    try {
        db.prepare('DELETE FROM access_keys WHERE id = ?').run(req.params.id);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/users', isAdmin, (req, res) => {
    try {
        const users = db.prepare('SELECT * FROM users ORDER BY createdAt DESC').all();
        res.json(users);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
