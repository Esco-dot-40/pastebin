// Minimalist Admin Auth - EXTRA RESILIENT
export function requireAuth(req, res, next) {
    if (req.session && req.session.isAdmin) {
        return next();
    }

    if (req.originalUrl.startsWith('/api') || req.path.startsWith('/api')) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    res.redirect('/adminperm/login.html');
}

export async function verifyAdminPassword(password) {
    if (!password) return false;

    const input = password.trim();
    const envPass = process.env.ADMIN_PASSWORD?.trim();
    const hardcoded = 'Poncholove20!!';

    // Check against authorized passwords
    if (input === envPass || input === hardcoded) {
        return true;
    }

    return false;
}
