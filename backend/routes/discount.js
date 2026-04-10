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

        const response = {
            success: true,
            code: discountRow.code,
            discount_type: discountRow.discount_type
        };

        if (discountRow.discount_type === 'percentage') {
            response.percentage = discountRow.percentage;
            response.displayText = `${discountRow.percentage}% off`;
        } else if (discountRow.discount_type === 'fixed') {
            response.fixed_amount = discountRow.fixed_amount;
            response.displayText = `EGP ${discountRow.fixed_amount} off`;
        }

        res.json(response);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create a new discount code
router.post('/', async (req, res) => {
    let { code, discount_type, percentage, fixed_amount } = req.body;
    
    code = code.trim().toUpperCase();
    discount_type = discount_type || 'percentage';

    // Validation
    if (!code) {
        return res.status(400).json({ error: 'Code is required' });
    }

    if (discount_type === 'percentage') {
        if (percentage === undefined || percentage <= 0 || percentage > 100) {
            return res.status(400).json({ error: 'Valid percentage (0-100) required' });
        }
        fixed_amount = 0;
    } else if (discount_type === 'fixed') {
        if (fixed_amount === undefined || fixed_amount <= 0) {
            return res.status(400).json({ error: 'Valid fixed amount required' });
        }
        percentage = 0;
    } else {
        return res.status(400).json({ error: 'Discount type must be "percentage" or "fixed"' });
    }

    const pool = getDB();
    try {
        await pool.execute(
            "INSERT INTO discount_codes (code, discount_type, percentage, fixed_amount, active, created_at) VALUES (?, ?, ?, ?, 1, ?)",
            [code, discount_type, percentage, fixed_amount, new Date().toISOString().slice(0, 19).replace('T', ' ')]
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
