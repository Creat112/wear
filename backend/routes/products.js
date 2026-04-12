const express = require('express');
const router = express.Router();
const { getDB } = require('../database/init');

// MySQL returns DECIMAL columns as strings — cast them to JS numbers
function normalizeProduct(p) {
    return {
        ...p,
        price: p.price != null ? Number(p.price) : 0,
        originalPrice: p.originalPrice != null ? Number(p.originalPrice) : null,
        discount: p.discount != null ? Number(p.discount) : 0,
        stock: p.stock != null ? Number(p.stock) : 0,
    };
}

function normalizeColor(c) {
    return {
        ...c,
        price: c.price != null ? Number(c.price) : 0,
        stock: c.stock != null ? Number(c.stock) : 0,
    };
}

function normalizeSize(s) {
    return {
        ...s,
        price: s.price != null ? Number(s.price) : 0,
        stock: s.stock != null ? Number(s.stock) : 0,
    };
}

// Get all products with color and size variants
router.get('/', async (req, res) => {
    const { category, includeDisabled } = req.query;
    const pool = getDB();

    let query = "SELECT * FROM products WHERE 1=1";
    let params = [];

    if (includeDisabled !== 'true') {
        query += " AND disabled = 0";
    }

    if (category) {
        query += " AND category = ?";
        params.push(category);
    }

    try {
        const [products] = await pool.execute(query, params);

        if (products.length === 0) {
            return res.json([]);
        }

        const productIds = products.map(p => p.id);
        const placeholders = productIds.map(() => '?').join(',');
        
        const [colors] = await pool.execute(
            `SELECT * FROM product_colors WHERE productId IN (${placeholders})`,
            productIds
        );

        const [sizes] = await pool.execute(
            `SELECT * FROM product_sizes WHERE productId IN (${placeholders})`,
            productIds
        );

        const colorsByProduct = {};
        colors.forEach(color => {
            if (!colorsByProduct[color.productId]) {
                colorsByProduct[color.productId] = [];
            }
            colorsByProduct[color.productId].push(normalizeColor(color));
        });

        const sizesByProduct = {};
        sizes.forEach(size => {
            if (!sizesByProduct[size.productId]) {
                sizesByProduct[size.productId] = [];
            }
            sizesByProduct[size.productId].push(normalizeSize(size));
        });

        const productsWithVariants = products.map(product => {
            return {
                ...normalizeProduct(product),
                colors: colorsByProduct[product.id] || [],
                sizes: sizesByProduct[product.id] || []
            };
        });

        res.json(productsWithVariants);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get stock for a specific color variant (MUST come before /:id/stock)
router.get('/colors/:colorId/stock', async (req, res) => {
    const pool = getDB();
    try {
        const [rows] = await pool.execute("SELECT stock, colorName, productId FROM product_colors WHERE id = ?", [req.params.colorId]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Color variant not found' });
        }
        res.json({ 
            stock: rows[0].stock,
            colorName: rows[0].colorName,
            productId: rows[0].productId
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get stock for a specific product
router.get('/:id/stock', async (req, res) => {
    const pool = getDB();
    try {
        const [rows] = await pool.execute("SELECT stock FROM products WHERE id = ?", [req.params.id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }
        res.json({ stock: rows[0].stock });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get single product with color and size variants
router.get('/:id', async (req, res) => {
    const pool = getDB();
    try {
        const [products] = await pool.execute("SELECT * FROM products WHERE id = ?", [req.params.id]);
        const product = products[0];

        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        const [colors] = await pool.execute("SELECT * FROM product_colors WHERE productId = ?", [req.params.id]);
        const [sizes] = await pool.execute("SELECT * FROM product_sizes WHERE productId = ?", [req.params.id]);
        
        res.json({
            ...normalizeProduct(product),
            colors: (colors || []).map(normalizeColor),
            sizes: (sizes || []).map(normalizeSize)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create Product with color and size variants
router.post('/', async (req, res) => {
    const { name, price, description, category, image, stock, discount, originalPrice, colors, sizes } = req.body;
    const pool = getDB();

    let finalOriginalPrice = originalPrice;
    let finalPrice = price;

    if (discount && discount > 0) {
        if (!originalPrice) {
            finalOriginalPrice = price;
            finalPrice = price * (1 - discount / 100);
        } else {
            finalOriginalPrice = originalPrice;
            finalPrice = price;
        }
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const [result] = await connection.execute(
            "INSERT INTO products (name, price, description, category, image, stock, discount, originalPrice) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            [name, finalPrice, description, category, image, stock || 0, discount || 0, finalOriginalPrice]
        );

        const productId = result.insertId;

        if (colors && Array.isArray(colors) && colors.length > 0) {
            for (const color of colors) {
                await connection.execute(
                    "INSERT INTO product_colors (productId, colorName, colorCode, price, stock, image) VALUES (?, ?, ?, ?, ?, ?)",
                    [productId, color.colorName, color.colorCode, color.price || finalPrice, color.stock || 0, color.image || image]
                );
            }
        }

        if (sizes && Array.isArray(sizes) && sizes.length > 0) {
            for (const size of sizes) {
                await connection.execute(
                    "INSERT INTO product_sizes (productId, sizeName, sizeCode, price, stock) VALUES (?, ?, ?, ?, ?)",
                    [productId, size.sizeName, size.sizeCode, size.price || finalPrice, size.stock || 0]
                );
            }
        }

        await connection.commit();
        res.status(201).json({ id: productId });
    } catch (err) {
        await connection.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        connection.release();
    }
});

// Update Product with color and size variants
router.put('/:id', async (req, res) => {
    const { name, price, description, category, image, stock, disabled, discount, originalPrice, colors, sizes } = req.body;
    const { id } = req.params;
    
    console.log('PUT /products/:id - Received sizes:', sizes);
    
    const pool = getDB();

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        let updates = [];
        let params = [];
        
        if (name) { updates.push("name = ?"); params.push(name); }
        if (price !== undefined) { updates.push("price = ?"); params.push(price); }
        if (description) { updates.push("description = ?"); params.push(description); }
        if (category) { updates.push("category = ?"); params.push(category); }
        if (image && image.trim() !== '') { updates.push("image = ?"); params.push(image); }
        if (stock !== undefined) { updates.push("stock = ?"); params.push(stock); }
        if (disabled !== undefined) { updates.push("disabled = ?"); params.push(disabled ? 1 : 0); }
        if (discount !== undefined) { updates.push("discount = ?"); params.push(discount); }
        if (originalPrice !== undefined) { updates.push("originalPrice = ?"); params.push(originalPrice); }

        if (updates.length > 0) {
            params.push(id);
            await connection.execute(`UPDATE products SET ${updates.join(', ')} WHERE id = ?`, params);
        }

        if (colors && Array.isArray(colors)) {
            await connection.execute("DELETE FROM product_colors WHERE productId = ?", [id]);

            if (colors.length > 0) {
                for (const color of colors) {
                    await connection.execute(
                        "INSERT INTO product_colors (productId, colorName, colorCode, price, stock, image) VALUES (?, ?, ?, ?, ?, ?)",
                        [id, color.colorName, color.colorCode, color.price || price, color.stock || 0, color.image || image]
                    );
                }
            }
        }

        if (sizes && Array.isArray(sizes)) {
            console.log('Deleting existing sizes for product:', id);
            await connection.execute("DELETE FROM product_sizes WHERE productId = ?", [id]);

            if (sizes.length > 0) {
                console.log('Inserting', sizes.length, 'sizes');
                for (const size of sizes) {
                    console.log('Inserting size:', size);
                    await connection.execute(
                        "INSERT INTO product_sizes (productId, sizeName, sizeCode, price, stock) VALUES (?, ?, ?, ?, ?)",
                        [id, size.sizeName, size.sizeCode, size.price || price, size.stock || 0]
                    );
                }
            }
        } else {
            console.log('No sizes received or sizes is not an array');
        }

        await connection.commit();
        console.log('Product update committed successfully');
        res.json({ success: true });
    } catch (err) {
        await connection.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        connection.release();
    }
});

// Delete Product
router.delete('/:id', async (req, res) => {
    const pool = getDB();
    try {
        await pool.execute("DELETE FROM products WHERE id = ?", [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
