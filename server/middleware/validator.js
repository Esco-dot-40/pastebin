export const validatePaste = (req, res, next) => {
    const { title, content, language, isPublic, burnAfterRead } = req.body;

    if (req.method === 'POST' && !content) {
        return res.status(400).json({ error: 'Content is strictly required for synchronization.' });
    }

    if (content && content.length > 20000000) {
        return res.status(400).json({ error: 'Transmission overflow: Content exceeds 20MB limit.' });
    }

    if (title && title.length > 100) {
        return res.status(400).json({ error: 'Title overhead: Maximum 100 characters allowed.' });
    }

    // Sanitize basic strings to prevent XSS in admin dashboard
    if (req.body.title) {
        req.body.title = req.body.title.replace(/<[^>]*>?/gm, '').trim();
    }

    // Strict typing
    if (req.body.isPublic !== undefined) req.body.isPublic = !!req.body.isPublic;
    if (req.body.burnAfterRead !== undefined) req.body.burnAfterRead = !!req.body.burnAfterRead;

    next();
};
