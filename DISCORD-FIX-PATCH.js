// Wrap Discord callback in try-catch
router.get('/auth/discord/callback', (req, res, next) => {
    const callbackURL = `${req.protocol}://${req.get('host')}/api/access/auth/discord/callback`;
    passport.authenticate('discord', {
        failureRedirect: '/?error=auth_failed',
        session: false,
        callbackURL
    })(req, res, next);
}, async (req, res) => {
    try {
        console.log('[DISCORD] Callback processing...');
        const user = req.user;
        if (!user) {
            throw new Error('No user from passport');
        }
        console.log(`[DISCORD] User: ${user.username}`);

        const state = req.query.state;
        if (state === 'login') {
            const { id: discordId, email, username, avatar, global_name } = user;
            const avatarUrl = `https://cdn.discordapp.com/avatars/${discordId}/${avatar}.png`;
            const displayName = global_name || username;

            let dbUser = db.prepare('SELECT * FROM users WHERE discordId = ?').get(discordId);
            if (!dbUser && email) dbUser = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

            if (!dbUser) {
                const id = 'user-' + Date.now();
                db.prepare('INSERT INTO users (id, email, discordId, avatarUrl, username, displayName) VALUES (?, ?, ?, ?, ?, ?)').run(id, email, discordId, avatarUrl, username, displayName);
                dbUser = { id, email, discordId, avatarUrl, username, displayName };
            } else {
                db.prepare('UPDATE users SET discordId = ?, avatarUrl = ?, username = ?, displayName = ? WHERE id = ?').run(discordId, avatarUrl, username, displayName, dbUser.id);
                dbUser = { ...dbUser, discordId, avatarUrl, username, displayName };
            }

            req.session.user = dbUser;
            await new Promise(resolve => req.session.save(resolve));
        }

        const displayName = user.global_name || user.username;
        const descriptor = (user.discriminator && user.discriminator !== '0') ? `#${user.discriminator}` : '';
        const handle = `@${user.username}${descriptor}`;
        const identity = `${displayName} (${handle})`;

        let existingKey = null;
        try {
            let keyRow = db.prepare('SELECT key FROM access_keys WHERE discordId = ? AND status = ?').get(user.id, 'active');
            if (!keyRow && user.email) keyRow = db.prepare('SELECT key FROM access_keys WHERE email = ? AND status = ?').get(user.email, 'active');
            if (keyRow) existingKey = keyRow.key;
        } catch (e) { console.error('Key check:', e); }

        res.send(`<html><body style="background:#0f0f12;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh"><h1 style="color:#00ff88;font-family:sans-serif">Verified!</h1><p style="color:#666;font-family:sans-serif">Closing...</p><script>setTimeout(()=>{if(window.opener){window.opener.postMessage({type:'DISCORD_VERIFIED',id:'${identity.replace(/'/g, "\\'")}',verified:true,discordId:'${user.id}',email:'${user.email || ""}',existingKey:'${existingKey || ""}'},'*');window.close()}else{document.body.innerHTML='<p style="color:white">Verified. Close this window</p>'}},1000)</script></body></html>`);
    } catch (error) {
        console.error('[DISCORD] ERROR:', error);
        res.status(500).send(`<html><body style="background:#0f0f12;color:white;padding:2rem"><h1 style="color:#ff006e">Auth Error</h1><p>${error.message}</p><button onclick="window.close()" style="padding:10px 20px;background:#7b42ff;border:none;color:white;border-radius:6px;cursor:pointer">Close</button></body></html>`);
    }
});
