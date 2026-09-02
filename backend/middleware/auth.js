const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const ACCESS_TOKEN_EXPIRES_IN = '15m';
const REFRESH_TOKEN_DAYS = 30;
const REFRESH_COOKIE_NAME = 'savx_refresh_token';

function getJwtSecret() {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32) {
        throw new Error('JWT_SECRET must be configured with at least 32 characters');
    }
    return secret;
}

function createAccessToken(user) {
    return jwt.sign(
        {
            sub: String(user.id),
            role: user.role
        },
        getJwtSecret(),
        {
            algorithm: 'HS256',
            expiresIn: ACCESS_TOKEN_EXPIRES_IN
        }
    );
}

function verifyAccessToken(token) {
    const payload = jwt.verify(token, getJwtSecret(), {
        algorithms: ['HS256']
    });

    if (!payload || !payload.sub || !/^\d+$/.test(String(payload.sub))) {
        throw new Error('Invalid token subject');
    }

    return {
        id: Number(payload.sub),
        role: payload.role
    };
}

function authenticateJWT(req, res, next) {
    const authorization = req.get('authorization') || '';
    const [scheme, token] = authorization.split(' ');

    if (scheme !== 'Bearer' || !token) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        req.user = verifyAccessToken(token);
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid or expired access token' });
    }
}

function requireAdmin(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
}

function parseCookies(req) {
    const header = req.get('cookie') || '';
    return header.split(';').reduce((cookies, part) => {
        const separator = part.indexOf('=');
        if (separator === -1) return cookies;
        const key = part.slice(0, separator).trim();
        const value = part.slice(separator + 1).trim();
        if (key) cookies[key] = decodeURIComponent(value);
        return cookies;
    }, {});
}

function getRefreshTokenFromRequest(req) {
    return parseCookies(req)[REFRESH_COOKIE_NAME] || null;
}

function setRefreshCookie(req, res, token, { persistent = true } = {}) {
    const secure = req.secure || process.env.NODE_ENV === 'production';
    const attributes = [
        `${REFRESH_COOKIE_NAME}=${encodeURIComponent(token)}`,
        'HttpOnly',
        'SameSite=Lax',
        'Path=/api/auth'
    ];
    if (persistent) attributes.push(`Max-Age=${REFRESH_TOKEN_DAYS * 24 * 60 * 60}`);
    if (secure) attributes.push('Secure');
    res.setHeader('Set-Cookie', attributes.join('; '));
}

function clearRefreshCookie(req, res) {
    const secure = req.secure || process.env.NODE_ENV === 'production';
    const attributes = [
        `${REFRESH_COOKIE_NAME}=`,
        'HttpOnly',
        'SameSite=Lax',
        'Path=/api/auth',
        'Max-Age=0'
    ];
    if (secure) attributes.push('Secure');
    res.setHeader('Set-Cookie', attributes.join('; '));
}

function hashRefreshToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

async function createRefreshToken(pool, userId) {
    const token = crypto.randomBytes(48).toString('base64url');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);
    const toDatabaseDate = date => date.toISOString().slice(0, 19).replace('T', ' ');

    await pool.execute(
        `INSERT INTO refresh_tokens
            (userId, tokenHash, expiresAt, createdAt)
         VALUES (?, ?, ?, ?)`,
        [userId, hashRefreshToken(token), toDatabaseDate(expiresAt), toDatabaseDate(now)]
    );

    return token;
}

module.exports = {
    ACCESS_TOKEN_EXPIRES_IN,
    REFRESH_TOKEN_DAYS,
    REFRESH_COOKIE_NAME,
    authenticateJWT,
    requireAdmin,
    createAccessToken,
    getRefreshTokenFromRequest,
    setRefreshCookie,
    clearRefreshCookie,
    hashRefreshToken,
    createRefreshToken
};