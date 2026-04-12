const express = require('express');
const router = express.Router();
const { getDB } = require('../database/init');
const { hashPassword, comparePassword } = require('../utils/passwordUtils');
const { formatAppDateTime } = require('../utils/dateUtils');

const { OAuth2Client } = require('google-auth-library');
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '633744806004-b1phb0vkuivleugtdrcmoumkior2sr31.apps.googleusercontent.com';
const client = new OAuth2Client(CLIENT_ID);

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
            const { password: _, ...user } = row;
            res.json(user);
        } else {
            // Create new user (default role: customer)
            const createdAt = formatAppDateTime();
            const [result] = await pool.execute(
                "INSERT INTO users (name, email, password, role, createdAt) VALUES (?, ?, ?, ?, ?)",
                [name, email, 'GOOGLE_AUTH', 'customer', createdAt]
            );
            res.status(201).json({ id: result.insertId, name, email, role: 'customer', createdAt });
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
        const createdAt = formatAppDateTime();
        const role = 'customer';

        // Hash the password
        const hashedPassword = await hashPassword(password);

        try {
            const [result] = await pool.execute(
                "INSERT INTO users (name, email, password, role, createdAt) VALUES (?, ?, ?, ?, ?)",
                [name, email, hashedPassword, role, createdAt]
            );
            res.status(201).json({ id: result.insertId, name, email, role, createdAt });
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
    const { email, password } = req.body;
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

        // Remove password from response
        const { password: _, ...user } = row;
        res.json(user);
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

module.exports = router;
