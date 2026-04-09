const express = require('express');
const router = express.Router();
const { getDB } = require('../database/init');

// Get all discount codes (Admin)
router.get('/', async (req, res) => {
    const pool = getDB();
    try {
        const [rows] = await pool.execute("SELECT * FROM discount_codes ORDER BY created_at DESC");
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Validate a discount code (Checkout)
router.post('/validate', async (req, res) => {
    const { code } = req.body;
    if (!code) {
        return res.status(400).json({ error: 'Code is required' });
    }

    const pool = getDB();
    try {
        const [rows] = await pool.execute("SELECT * FROM discount_codes WHERE code = ? AND active = 1", [code]);
        const discountRow = rows[0];

        if (!discountRow) {
            return res.status(404).json({ error: 'Invalid or inactive discount code' });
        }

        res.json({
            success: true,
            code: discountRow.code,
            percentage: discountRow.percentage
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create a new discount code
router.post('/', async (req, res) => {
    let { code, percentage } = req.body;
    if (!code || percentage === undefined || percentage <= 0 || percentage > 100) {
        return res.status(400).json({ error: 'Valid code and percentage (0-100) required' });
    }

    code = code.trim().toUpperCase();

    const pool = getDB();
    try {
        await pool.execute(
            "INSERT INTO discount_codes (code, percentage, active, created_at) VALUES (?, ?, 1, ?)",
            [code, percentage, new Date().toISOString().slice(0, 19).replace('T', ' ')]
        );
        res.status(201).json({ success: true });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'This discount code already exists' });
        }
        res.status(500).json({ error: err.message });
    }
});

// Toggle code status
router.put('/:id/toggle', async (req, res) => {
    const { id } = req.params;
    const pool = getDB();

    try {
        const [rows] = await pool.execute("SELECT active FROM discount_codes WHERE id = ?", [id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Code not found' });
        
        const newStatus = rows[0].active ? 0 : 1;
        await pool.execute("UPDATE discount_codes SET active = ? WHERE id = ?", [newStatus, id]);
        
        res.json({ success: true, active: newStatus });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete code
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    const pool = getDB();

    try {
        await pool.execute("DELETE FROM discount_codes WHERE id = ?", [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
