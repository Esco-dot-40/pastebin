/**
 * Simple Sanitizer to prevent XSS in basic metadata
 */
export const sanitizeRequest = (req, res, next) => {
    const sanitize = (val) => {
        if (typeof val === 'string') {
            // Remove scripts and scary tags, but keep basics like & < > for code if needed
            // Actually for metadata (title, folder names), we want to be strict.
            return val.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, "")
                .replace(/<[^>]*>?/gm, "")
                .trim();
        }
        if (Array.isArray(val)) return val.map(sanitize);
        if (typeof val === 'object' && val !== null) {
            const newObj = {};
            for (const key in val) {
                newObj[key] = sanitize(val[key]);
            }
            return newObj;
        }
        return val;
    };

    // We only sanitize metadata, not the actual 'content' of pastes which might contain code.
    if (req.body) {
        if (req.body.title) req.body.title = sanitize(req.body.title);
        if (req.body.name) req.body.name = sanitize(req.body.name);
        if (req.body.language) req.body.language = sanitize(req.body.language);
    }

    next();
};
