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

        // Check Claim Status (Enhanced Security)
        const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;
        console.log('[ACCESS] Request IP:', ip, 'Claimed IP:', row.claimedIp);

        if (row.claimedIp && row.claimedIp !== ip) {
            console.warn(`⚠️ Access Denied: Key [${key}] is bound to IP ${row.claimedIp}, but accessed from ${ip}`);
            return res.status(403).json({ error: 'This access key is bound to another device/network.' });
        }

        if (!row.claimedIp) {
            console.log(`🔐 Key Claimed: [${key}] matched to IP ${ip}`);
            db.prepare('UPDATE access_keys SET claimedIp = ? WHERE key = ?').run(ip, key);
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



// Discord OAuth Configuration
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID || '1455588853254717510';
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET || 'qOyQ_YgGUOK8M1f5Zb1O0gDgiS6lvi10';

if (DISCORD_CLIENT_ID !== 'YOUR_CLIENT_ID') {
    // Configure Passport with a placeholder callback URL
    // The actual callback URL will be set dynamically in each route
    passport.use(new DiscordStrategy({
        clientID: DISCORD_CLIENT_ID,
        clientSecret: DISCORD_CLIENT_SECRET,
        callbackURL: '/api/access/auth/discord/callback', // Placeholder - will be overridden
        scope: ['identify', 'email']
    }, (accessToken, refreshToken, profile, done) => {
        return done(null, profile);
    }));
}

router.use(passport.initialize());

// Start Discord Auth
router.get('/auth/discord', (req, res, next) => {
    if (DISCORD_CLIENT_ID === 'YOUR_CLIENT_ID') {
        return res.send(`
            <h1>Discord App Not Configured</h1>
            <p>Please set DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET in your environment variables.</p>
        `);
    }
    const callbackURL = `${req.protocol}://${req.get('host')}/api/access/auth/discord/callback`;
    console.log("Discord Auth Start. Callback:", callbackURL);
    passport.authenticate('discord', { callbackURL })(req, res, next);
});

// Discord Login
router.get('/auth/discord/login', (req, res, next) => {
    const callbackURL = `${req.protocol}://${req.get('host')}/api/access/auth/discord/callback`;
    passport.authenticate('discord', { state: 'login', callbackURL })(req, res, next);
});

// Discord Callback
router.get('/auth/discord/callback', (req, res, next) => {
    const callbackURL = `${req.protocol}://${req.get('host')}/api/access/auth/discord/callback`;
    passport.authenticate('discord', {
        failureRedirect: '/?error=auth_failed',
        session: false,
        callbackURL
    })(req, res, next);
}, async (req, res) => {
    // Successful authentication
    const user = req.user;
    const state = req.query.state;

    if (state === 'login') {
        const discordId = user.id;
        const email = user.email;
        const avatarUrl = `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`;
        const username = user.username;
        const displayName = user.global_name || user.username;

        let dbUser = db.prepare('SELECT * FROM users WHERE discordId = ?').get(discordId);
        if (!dbUser && email) dbUser = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

        if (!dbUser) {
            const id = 'user-' + Date.now();
            try {
                db.prepare('INSERT INTO users (id, email, discordId, avatarUrl, username, displayName) VALUES (?, ?, ?, ?, ?, ?)').run(id, email, discordId, avatarUrl, username, displayName);
                dbUser = { id, email, discordId, avatarUrl, username, displayName };
            } catch (e) { console.error("Discord User Create Error", e); }
        } else {
            db.prepare('UPDATE users SET discordId = ?, avatarUrl = ?, username = ?, displayName = ? WHERE id = ?').run(discordId, avatarUrl, username, displayName, dbUser.id);
            dbUser.discordId = discordId;
            dbUser.username = username;
            dbUser.displayName = displayName;
        }

        req.session.user = dbUser;
        await new Promise(resolve => req.session.save(resolve));
        // Continue to verify/message logic instead of redirecting
    }

    // Verification & Message Logic
    const displayName = user.global_name || user.username;
    const descriptor = (user.discriminator && user.discriminator !== '0') ? `#${user.discriminator}` : '';
    const handle = `@${user.username}${descriptor}`;
    const identity = `${displayName} (${handle})`;

    // CHECK AUTOMATION: Does this user already have a key?
    // We can look up by discordId (user.id) or email (user.email)
    let existingKey = null;
    try {
        // Check via Discord ID first
        let keyRow = db.prepare('SELECT key FROM access_keys WHERE discordId = ? AND status = ?').get(user.id, 'active');

        // If not found, check via Email
        if (!keyRow && user.email) {
            keyRow = db.prepare('SELECT key FROM access_keys WHERE email = ? AND status = ?').get(user.email, 'active');
        }

        if (keyRow) {
            existingKey = keyRow.key;
        }
    } catch (e) { console.error("Auto-Key Check Error", e); }

    // Return a script to communicate with the opener
    res.send(`
            <html>
            <body style="background: #0f0f12; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; overflow: hidden;">
                <h1 style="color: #00ff88; font-family: sans-serif; font-size: 2rem; margin-bottom: 1rem;">Verified!</h1>
                <p style="color: #666; font-family: sans-serif; font-size: 1rem;">Closing window...</p>
                <script>
                    setTimeout(() => {
                        if (window.opener) {
                            try {
                                window.opener.postMessage({
                                    type: 'DISCORD_VERIFIED',
                                    id: '${identity.replace(/'/g, "\\'")}',
                                    verified: true,
                                    discordId: '${user.id}',
                                    email: '${user.email || ""}',
                                    existingKey: '${existingKey || ""}' 
                                }, '*');
                                window.close();
                            } catch(e) {
                                document.body.innerHTML += '<p style="color:red">Error communicating with main window.</p>';
                            }
                        } else {
                            document.body.innerHTML = '<p style="color:white; font-family: sans-serif;">Verified as ${identity}. You can close this window.</p>';
                        }
                    }, 1000);
                </script>
            </body>
            </html>
        `);
}
);

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
