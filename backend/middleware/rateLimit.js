const windows = new Map();

function createRateLimiter({
    windowMs,
    max,
    keyGenerator,
    skip = () => false,
    message = 'Too many requests. Please slow down and try again.'
}) {
    return (req, res, next) => {
        if (skip(req)) return next();

        const now = Date.now();
        const key = keyGenerator(req);
        let window = windows.get(key);

        if (!window || window.resetAt <= now) {
            window = { count: 0, resetAt: now + windowMs };
            windows.set(key, window);
        }

        window.count += 1;
        const remaining = Math.max(0, max - window.count);
        const retryAfterSeconds = Math.max(1, Math.ceil((window.resetAt - now) / 1000));

        res.setHeader('RateLimit-Limit', String(max));
        res.setHeader('RateLimit-Remaining', String(remaining));
        res.setHeader('RateLimit-Reset', String(Math.ceil(window.resetAt / 1000)));

        if (window.count > max) {
            res.setHeader('Retry-After', String(retryAfterSeconds));
            return res.status(429).json({ error: message, retryAfter: retryAfterSeconds });
        }

        // Bound memory if a large number of clients send requests.
        if (windows.size > 5000) {
            for (const [clientKey, clientWindow] of windows) {
                if (clientWindow.resetAt <= now) windows.delete(clientKey);
            }
        }

        next();
    };
}

const limitProductSearch = createRateLimiter({
    windowMs: 60 * 1000,
    max: 60,
    keyGenerator: req => `search:${req.ip}`,
    skip: req => !String(req.query.search || '').trim(),
    message: 'Too many product searches. Please wait a moment and try again.'
});

const limitOrderSubmissions = createRateLimiter({
    windowMs: 60 * 1000,
    max: 10,
    keyGenerator: req => `orders:${req.user.id}`,
    message: 'Too many order attempts. Please wait a moment and try again.'
});

module.exports = {
    createRateLimiter,
    limitProductSearch,
    limitOrderSubmissions
};
