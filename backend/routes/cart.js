const express = require('express');
const router = express.Router();
const { getDB } = require('../database/init');

// Get cart API with color and size information
router.get('/', async (req, res) => {
    const { userId } = req.query; 
    const pool = getDB();

    const query = `
        SELECT c.*, p.name, p.price, p.image, p.discount, p.originalPrice,
               pc.colorName, pc.colorCode, pc.price as colorPrice, pc.stock as colorStock, pc.image as colorImage,
               ps.sizeName, ps.sizeCode, ps.price as sizePrice, ps.stock as sizeStock
        FROM cart c 
        JOIN products p ON c.productId = p.id
        LEFT JOIN product_colors pc ON c.colorId = pc.id
        LEFT JOIN product_sizes ps ON c.sizeId = ps.id
        WHERE c.userId = ?
    `;

    if (!userId) {
        return res.json([]);
    }

    try {
        const [rows] = await pool.execute(query, [userId]);
        const normalized = rows.map(r => ({
            ...r,
            price: r.price != null ? Number(r.price) : 0,
            originalPrice: r.originalPrice != null ? Number(r.originalPrice) : null,
            discount: r.discount != null ? Number(r.discount) : 0,
            colorPrice: r.colorPrice != null ? Number(r.colorPrice) : null,
            colorStock: r.colorStock != null ? Number(r.colorStock) : 0,
            sizePrice: r.sizePrice != null ? Number(r.sizePrice) : null,
            sizeStock: r.sizeStock != null ? Number(r.sizeStock) : 0,
        }));
        res.json(normalized);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add to cart with stock validation
router.post('/', async (req, res) => {
    const { productId, quantity, userId, colorId, sizeId } = req.body;
    if (!productId || !userId) {
        return res.status(400).json({ error: 'ProductId and UserId required' });
    }

    const pool = getDB();
    const addedAt = new Date().toISOString().slice(0, 19).replace('T', ' ');

    try {
        if (colorId || sizeId) {
            // Validate variant-specific stock
            let variantStock = null;
            let variantType = '';
            
            if (sizeId) {
                const [sizeRows] = await pool.execute("SELECT stock FROM product_sizes WHERE id = ?", [sizeId]);
                if (sizeRows.length > 0) {
                    variantStock = sizeRows[0].stock;
                    variantType = 'size';
                }
            }
            
            if (colorId) {
                const [colorRows] = await pool.execute("SELECT stock FROM product_colors WHERE id = ?", [colorId]);
                if (colorRows.length > 0) {
                    variantStock = colorRows[0].stock;
                    variantType = 'color';
                }
            }

            if (variantStock === null) {
                return res.status(404).json({ error: `${variantType || 'Variant'} not found` });
            }

            const requestedQty = quantity || 1;

            // Check if item exists with same color and size
            const [cartRows] = await pool.execute(
                "SELECT * FROM cart WHERE userId = ? AND productId = ? AND (colorId = ? OR colorId IS NULL) AND (sizeId = ? OR sizeId IS NULL)", 
                [userId, productId, colorId || null, sizeId || null]
            );
            const row = cartRows[0];

            if (row) {
                const newQty = row.quantity + requestedQty;
                if (newQty > variantStock) {
                    return res.status(400).json({
                        error: `Insufficient stock. Only ${variantStock} available.`,
                        availableStock: variantStock
                    });
                }
                await pool.execute("UPDATE cart SET quantity = ? WHERE id = ?", [newQty, row.id]);
                res.json({ success: true, message: 'Cart updated' });
            } else {
                if (requestedQty > variantStock) {
                    return res.status(400).json({
                        error: `Insufficient stock. Only ${variantStock} available.`,
                        availableStock: variantStock
                    });
                }
                await pool.execute(
                    "INSERT INTO cart (userId, productId, quantity, colorId, sizeId, addedAt) VALUES (?, ?, ?, ?, ?, ?)",
                    [userId, productId, requestedQty, colorId || null, sizeId || null, addedAt]
                );
                res.json({ success: true, message: 'Item added to cart' });
            }
        } else {
            const requestedQty = quantity || 1;
            const [cartRows] = await pool.execute("SELECT * FROM cart WHERE userId = ? AND productId = ? AND colorId IS NULL", [userId, productId]);
            const row = cartRows[0];

            if (row) {
                const newQty = row.quantity + requestedQty;
                await pool.execute("UPDATE cart SET quantity = ? WHERE id = ?", [newQty, row.id]);
                res.json({ success: true, message: 'Cart updated' });
            } else {
                await pool.execute(
                    "INSERT INTO cart (userId, productId, quantity, colorId, addedAt) VALUES (?, ?, ?, NULL, ?)",
                    [userId, productId, requestedQty, addedAt]
                );
                res.json({ success: true, message: 'Item added to cart' });
            }
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update cart item with stock validation
router.put('/:id', async (req, res) => {
    const { quantity } = req.body;
    const { id } = req.params;

    if (quantity < 1) {
        return res.status(400).json({ error: 'Quantity must be positive' });
    }

    const pool = getDB();

    try {
        const [cartRows] = await pool.execute(`
            SELECT c.*, pc.stock 
            FROM cart c 
            LEFT JOIN product_colors pc ON c.colorId = pc.id 
            WHERE c.id = ?
        `, [id]);
        
        const cartItem = cartRows[0];

        if (!cartItem) {
            return res.status(404).json({ error: 'Cart item not found' });
        }

        if (cartItem.stock !== null && quantity > cartItem.stock) {
            return res.status(400).json({
                error: `Insufficient stock. Only ${cartItem.stock} available.`,
                availableStock: cartItem.stock
            });
        }

        await pool.execute("UPDATE cart SET quantity = ? WHERE id = ?", [quantity, id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Remove item
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    const pool = getDB();
    try {
        await pool.execute("DELETE FROM cart WHERE id = ?", [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Clear cart
router.delete('/', async (req, res) => {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'UserId required' });

    const pool = getDB();
    try {
        await pool.execute("DELETE FROM cart WHERE userId = ?", [userId]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
