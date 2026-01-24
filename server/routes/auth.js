import express from 'express';
import fetch from 'node-fetch';
import { verifyAdminPassword } from '../middleware/auth.js';
import db from '../db/index.js';

const router = express.Router();

// Get Firebase Client Config for Frontend
router.get('/firebase-config', (req, res) => {
    res.json({
        apiKey: process.env.FIREBASE_API_KEY,
        authDomain: process.env.FIREBASE_AUTH_DOMAIN,
        projectId: process.env.FIREBASE_PROJECT_ID,
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.FIREBASE_APP_ID
    });
});

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
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID || '1455588853254717510';
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET || '133HZ9V2Tlpn_kWaG51JBEggpQ6jHQiu';

// Helper to generate the exact Redirect URI registered in Discord
const getDiscordRedirectURI = (req) => {
    let host = req.get('host') || '';

    // Check for explicit DOMAIN override
    if (process.env.DOMAIN) {
        host = process.env.DOMAIN.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
    }

    // Normalize case and trim
    let normalizedHost = host.toLowerCase().trim();

    // Protocol Determination
    let protocol = 'http';
    // Force HTTPS for live domains
    if (req.secure || req.headers['x-forwarded-proto'] === 'https' ||
        normalizedHost.includes('veroe.space') ||
        normalizedHost.includes('railway.app') ||
        normalizedHost.includes('velarixsolutions.nl') ||
        normalizedHost.includes('veroe.fun')) {
        protocol = 'https';
    }

    // --- MULTI-SITE PATH CONFIGURATION ---
    // veroe.space & velarixsolutions.nl -> LONG PATH (/api/access/auth/...)
    // railway.app, localhost, & others -> SHORT PATH (/api/auth/...)
    let path = '/api/auth/discord/callback';

    // We check the "base" domain (ignoring ports for this specific check)
    const baseHost = normalizedHost.split(':')[0];
    if (baseHost === 'veroe.space' || baseHost === 'www.veroe.space' || baseHost === 'farkle.velarixsolutions.nl' || baseHost === 'velarixsolutions.nl') {
        path = '/api/access/auth/discord/callback';
    }

    const uri = `${protocol}://${normalizedHost}${path}`;
    console.log(`[AUTH] Multi-Site Redirect Sync: ${uri} (Host: ${normalizedHost}, Protocol: ${protocol})`);
    return uri;
};

router.get('/discord', (req, res) => {
    const isLogin = req.query.state === 'login';
    const callbackURL = getDiscordRedirectURI(req);

    console.log(`[AUTH] Initiating Discord. Client: ${DISCORD_CLIENT_ID}, URI: ${callbackURL}`);

    const url = `https://discord.com/api/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(callbackURL)}&response_type=code&scope=identify%20email&state=${isLogin ? 'login' : 'verify'}`;
    res.redirect(url);
});

router.get('/discord/callback', async (req, res) => {
    const { code, state } = req.query;
    if (!code) return res.redirect('/?error=no_code');

    const callbackURL = getDiscordRedirectURI(req);
    console.log(`[AUTH] Processing Callback. URI Match: ${callbackURL}`);

    try {
        const response = await fetch('https://discord.com/api/oauth2/token', {
            method: 'POST',
            body: new URLSearchParams({
                client_id: DISCORD_CLIENT_ID,
                client_secret: DISCORD_CLIENT_SECRET,
                code,
                grant_type: 'authorization_code',
                redirect_uri: callbackURL,
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
            user = { id, email: discordUser.email, discordId: discordUser.id, avatarUrl, username: discordUser.username, displayName: discordUser.global_name || discordUser.username };
        } else {
            db.prepare('UPDATE users SET avatarUrl = ?, username = ?, displayName = ? WHERE id = ?').run(
                avatarUrl, discordUser.username, discordUser.global_name || discordUser.username, user.id
            );
            user.avatarUrl = avatarUrl;
            user.username = discordUser.username;
            user.displayName = discordUser.global_name || discordUser.username;
        }

        req.session.user = user;
        await new Promise(resolve => req.session.save(resolve));

        // Detect existing key for the verified identity
        let existingKey = null;
        try {
            const keyRow = db.prepare('SELECT key FROM access_keys WHERE (discordId = ? OR email = ?) AND status = ?').get(discordUser.id, discordUser.email, 'active');
            if (keyRow) existingKey = keyRow.key;
        } catch (e) {
            console.error('Key lookup error:', e);
        }

        const identityName = discordUser.global_name || discordUser.username;
        const identityHandle = `@${discordUser.username}${(discordUser.discriminator && discordUser.discriminator !== '0') ? '#' + discordUser.discriminator : ''}`;
        const identity = `${identityName} (${identityHandle})`;

        // Support Popup Response with postMessage
        res.send(`
            <html>
            <body style="background: #0f0f12; color: white; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif;">
                <h2 style="color: #00ff88;">✅ Verified as ${discordUser.global_name || discordUser.username}</h2>
                <p>Closing window...</p>
                <script>
                    if (window.opener) {
                        window.opener.postMessage({
                            type: 'DISCORD_VERIFIED',
                            id: \`${identity.replace(/`/g, '\\`')}\`,
                            email: '${discordUser.email || ''}',
                            discordId: '${discordUser.id}',
                            existingKey: '${existingKey || ""}',
                            verified: true
                        }, '*');
                        setTimeout(() => window.close(), 1000);
                    } else {
                        window.location.href = '/public';
                    }
                </script>
            </body>
            </html>
        `);
    } catch (e) {
        console.error('Discord Auth Error:', e);
        res.status(500).send(`
            <html>
            <body style="background: #0f0f12; color: #ff006e; padding: 2rem; font-family: sans-serif;">
                <h1>Auth Failed</h1>
                <p>${e.message}</p>
                <button onclick="window.close()">Close</button>
            </body>
            </html>
        `);
    }
});

router.get('/me', (req, res) => {
    res.json({ user: req.session.user || null });
});

export default router;
