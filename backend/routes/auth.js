const express = require('express');
const router = express.Router();
const { getDB } = require('../database/init');
const { hashPassword, comparePassword } = require('../utils/passwordUtils');
const {
    createAccessToken,
    getRefreshTokenFromRequest,
    setRefreshCookie,
    clearRefreshCookie,
    hashRefreshToken,
    createRefreshToken,
    authenticateJWT
} = require('../middleware/auth');

const { OAuth2Client } = require('google-auth-library');
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '633744806004-b1phb0vkuivleugtdrcmoumkior2sr31.apps.googleusercontent.com';
const client = new OAuth2Client(CLIENT_ID);

const publicUser = (user) => {
    const { password: _, ...safeUser } = user;
    return safeUser;
};

const issueSession = async (req, res, user, status = 200, { remember = true } = {}) => {
    const pool = getDB();
    const refreshToken = await createRefreshToken(pool, user.id);
    setRefreshCookie(req, res, refreshToken, { persistent: remember });
    res.status(status).json({
        user: publicUser(user),
        accessToken: createAccessToken(user)
    });
};

router.get('/me', authenticateJWT, async (req, res) => {
    try {
        const pool = getDB();
        const [rows] = await pool.execute(
            'SELECT id, name, email, role, createdAt FROM users WHERE id = ?',
            [req.user.id]
        );
        if (!rows[0]) {
            return res.status(401).json({ error: 'User account not found' });
        }
        res.json({ user: rows[0] });
    } catch (error) {
        console.error('Get current user error:', error);
        res.status(500).json({ error: 'Unable to load account' });
    }
});

// Google Sign-In
router.post('/google', async (req, res) => {
    const { token } = req.body;
    try {
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: CLIENT_ID,
        });
        const payload = ticket.getPayload();
        const { email, name, sub: googleId } = payload;

        const pool = getDB();
        const [rows] = await pool.execute("SELECT * FROM users WHERE email = ?", [email]);
        const row = rows[0];

        if (row) {
            // User exists, log them in
            await issueSession(req, res, row);
        } else {
            // Create new user (default role: customer)
            const createdAt = new Date().toISOString().slice(0, 19).replace('T', ' ');
            const [result] = await pool.execute(
                "INSERT INTO users (name, email, password, role, createdAt) VALUES (?, ?, ?, ?, ?)",
                [name, email, 'GOOGLE_AUTH', 'customer', createdAt]
            );
            await issueSession(req, res, {
                id: result.insertId,
                name,
                email,
                password: 'GOOGLE_AUTH',
                role: 'customer',
                createdAt
            }, 201);
        }
    } catch (error) {
        console.error('Google Auth Error:', error);
        res.status(401).json({ error: 'Invalid Google Token' });
    }
});

// Signup
router.post('/signup', async (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    // Validate password strength
    if (password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }

    try {
        const pool = getDB();
        const createdAt = new Date().toISOString().slice(0, 19).replace('T', ' ');
        const role = 'customer';

        // Hash the password
        const hashedPassword = await hashPassword(password);

        try {
            const [result] = await pool.execute(
                "INSERT INTO users (name, email, password, role, createdAt) VALUES (?, ?, ?, ?, ?)",
                [name, email, hashedPassword, role, createdAt]
            );
            await issueSession(req, res, {
                id: result.insertId,
                name,
                email,
                password: hashedPassword,
                role,
                createdAt
            }, 201);
        } catch (err) {
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({ error: 'Email already exists' });
            }
            throw err;
        }
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ error: 'Server error during signup' });
    }
});

// Login
router.post('/login', async (req, res) => {
    const { email, password, rememberMe = false } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password required' });
    }

    try {
        const pool = getDB();
        if (!pool) {
            return res.status(503).json({ 
                error: 'Database not available',
                message: 'Server is starting up. Please try again in a moment.' 
            });
        }

        const [rows] = await pool.execute("SELECT * FROM users WHERE email = ?", [email]);
        const row = rows[0];

        if (!row) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Handle Google auth users (they have 'GOOGLE_AUTH' as password)
        if (row.password === 'GOOGLE_AUTH') {
            return res.status(401).json({ error: 'Please use Google Sign-In for this account' });
        }

        // Compare the provided password with the hashed password
        const isMatch = await comparePassword(password, row.password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        await issueSession(req, res, row, 200, { remember: Boolean(rememberMe) });
    } catch (error) {
        console.error('Login error:', error);
        
        // Provide more specific error messages
        if (error.code === 'ECONNREFUSED') {
            return res.status(503).json({ 
                error: 'Database unavailable',
                message: 'Database connection failed. Please try again later.' 
            });
        }
        
        res.status(500).json({ 
            error: 'Server error during login',
            message: 'An unexpected error occurred. Please try again.' 
        });
    }
});

// Rotate a refresh token and issue a new short-lived access token.
router.post('/refresh', async (req, res) => {
    const refreshToken = getRefreshTokenFromRequest(req);
    if (!refreshToken) {
        clearRefreshCookie(req, res);
        return res.status(401).json({ error: 'Refresh token required' });
    }

    const pool = getDB();
    const tokenHash = hashRefreshToken(refreshToken);
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

    try {
        const [rows] = await pool.execute(`
            SELECT rt.id, rt.userId, rt.tokenHash, rt.expiresAt, rt.revokedAt,
                   u.id as user_id, u.name, u.email, u.password, u.role, u.createdAt
            FROM refresh_tokens rt
            INNER JOIN users u ON u.id = rt.userId
            WHERE rt.tokenHash = ? AND rt.revokedAt IS NULL AND rt.expiresAt > ?
        `, [tokenHash, now]);
        const tokenRow = rows[0];

        if (!tokenRow) {
            clearRefreshCookie(req, res);
            return res.status(401).json({ error: 'Invalid or expired refresh token' });
        }

        await pool.execute(
            'UPDATE refresh_tokens SET revokedAt = ?, lastUsedAt = ? WHERE id = ? AND revokedAt IS NULL',
            [now, now, tokenRow.id]
        );

        const user = {
            id: tokenRow.user_id,
            name: tokenRow.name,
            email: tokenRow.email,
            password: tokenRow.password,
            role: tokenRow.role,
            createdAt: tokenRow.createdAt
        };
        await issueSession(req, res, user);
    } catch (error) {
        console.error('Refresh token error:', error);
        clearRefreshCookie(req, res);
        res.status(500).json({ error: 'Unable to refresh authentication' });
    }
});

// Revoke the current refresh token and clear the browser cookie.
router.post('/logout', async (req, res) => {
    const refreshToken = getRefreshTokenFromRequest(req);
    if (refreshToken) {
        try {
            const pool = getDB();
            await pool.execute(
                'UPDATE refresh_tokens SET revokedAt = ? WHERE tokenHash = ? AND revokedAt IS NULL',
                [new Date().toISOString().slice(0, 19).replace('T', ' '), hashRefreshToken(refreshToken)]
            );
        } catch (error) {
            console.error('Logout token revocation error:', error);
        }
    }
    clearRefreshCookie(req, res);
    res.json({ success: true });
});

module.exports = router;
