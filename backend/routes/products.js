const express = require('express');
const router = express.Router();
const { getDB } = require('../database/init');
const { authenticateJWT, requireAdmin } = require('../middleware/auth');

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
        images: c.images ? JSON.parse(c.images) : (c.image ? [c.image] : [])
    };
}

function normalizeSize(s) {
    return {
        ...s,
        price: s.price != null ? Number(s.price) : 0,
        stock: s.stock != null ? Number(s.stock) : 0,
    };
}

// Get products with color and size variants.
// Legacy callers still receive an array. Paginated callers receive
// { items, pagination } so the catalog can avoid loading the entire image-heavy
// product table on every page visit.
router.get('/', async (req, res) => {
    const { category, includeDisabled, page, limit, search, color, sort, inStock } = req.query;
    const pool = getDB();

    const isPaginated = page !== undefined || limit !== undefined;
    const currentPage = Math.max(parseInt(page, 10) || 1, 1);
    const pageSize = Math.min(Math.max(parseInt(limit, 10) || 12, 1), 24);
    const offset = (currentPage - 1) * pageSize;

    const conditions = ["1=1"];
    let params = [];

    if (includeDisabled !== 'true') {
        conditions.push("disabled = 0");
    }

    if (category) {
        conditions.push("LOWER(category) = LOWER(?)");
        params.push(category);
    }

    if (search && search.trim()) {
        const searchTerm = `%${search.trim()}%`;
        conditions.push("(name LIKE ? OR category LIKE ? OR description LIKE ?)");
        params.push(searchTerm, searchTerm, searchTerm);
    }

    if (color && color.trim()) {
        conditions.push(`
            EXISTS (
                SELECT 1 FROM product_colors filter_colors
                WHERE filter_colors.productId = products.id
                  AND LOWER(filter_colors.colorName) LIKE LOWER(?)
            )
        `);
        params.push(`%${color.trim()}%`);
    }

    if (inStock === 'true') {
        conditions.push(`(
            stock > 0
            OR EXISTS (SELECT 1 FROM product_colors stock_colors WHERE stock_colors.productId = products.id AND stock_colors.stock > 0)
            OR EXISTS (SELECT 1 FROM product_sizes stock_sizes WHERE stock_sizes.productId = products.id AND stock_sizes.stock > 0)
        )`);
    }

    const whereClause = conditions.join(' AND ');
    const sortMap = {
        'price-asc': 'price ASC, id DESC',
        'price-desc': 'price DESC, id DESC',
        'name-asc': 'name ASC, id DESC',
        'name-desc': 'name DESC, id DESC',
        'newest': 'id DESC'
    };
    const orderBy = sortMap[sort] || sortMap.newest;

    try {
        let productsQuery = `SELECT * FROM products WHERE ${whereClause} ORDER BY ${orderBy}`;
        if (isPaginated) {
            productsQuery += ` LIMIT ${pageSize} OFFSET ${offset}`;
        }

        const [products] = await pool.execute(productsQuery, params);

        if (products.length === 0) {
            if (isPaginated) {
                return res.json({
                    items: [],
                    pagination: {
                        page: currentPage,
                        limit: pageSize,
                        total: 0,
                        totalPages: 0,
                        hasNextPage: false,
                        hasPreviousPage: currentPage > 1
                    }
                });
            }
            return res.json([]);
        }

        const productIds = products.map(p => p.id);
        const placeholders = productIds.map(() => '?').join(',');
        
        const [colors] = await pool.execute(
            `${isPaginated
                ? `SELECT id, productId, colorName, colorCode, price, stock, image FROM product_colors WHERE productId IN (${placeholders})`
                : `SELECT * FROM product_colors WHERE productId IN (${placeholders})`}`,
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

        if (!isPaginated) {
            return res.json(productsWithVariants);
        }

        const [countRows] = await pool.execute(
            `SELECT COUNT(*) AS total FROM products WHERE ${whereClause}`,
            params
        );
        const total = Number(countRows[0]?.total || 0);
        res.json({
            items: productsWithVariants,
            pagination: {
                page: currentPage,
                limit: pageSize,
                total,
                totalPages: Math.ceil(total / pageSize),
                hasNextPage: offset + productsWithVariants.length < total,
                hasPreviousPage: currentPage > 1
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Lightweight metadata for catalog filters. This avoids downloading every
// product image just to populate two select menus.
router.get('/meta', async (req, res) => {
    const pool = getDB();
    try {
        const [[categories], [colors]] = await Promise.all([
            pool.execute(`
                SELECT DISTINCT category
                FROM products
                WHERE disabled = 0 AND category IS NOT NULL AND TRIM(category) <> ''
                ORDER BY category ASC
            `),
            pool.execute(`
                SELECT DISTINCT pc.colorName
                FROM product_colors pc
                INNER JOIN products p ON p.id = pc.productId
                WHERE p.disabled = 0 AND pc.colorName IS NOT NULL AND TRIM(pc.colorName) <> ''
                ORDER BY pc.colorName ASC
            `)
        ]);

        res.json({
            categories: categories.map(row => row.category),
            colors: colors.map(row => row.colorName)
        });
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
router.post('/', authenticateJWT, requireAdmin, async (req, res) => {
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
                const imagesJson = color.images && color.images.length > 0 ? JSON.stringify(color.images) : null;
                const firstImage = color.images && color.images.length > 0 ? color.images[0] : (color.image || image);
                await connection.execute(
                    "INSERT INTO product_colors (productId, colorName, colorCode, price, stock, image, images) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    [productId, color.colorName, color.colorCode, color.price || finalPrice, color.stock || 0, firstImage, imagesJson]
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
router.put('/:id', authenticateJWT, requireAdmin, async (req, res) => {
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
                    const imagesJson = color.images && color.images.length > 0 ? JSON.stringify(color.images) : null;
                    const firstImage = color.images && color.images.length > 0 ? color.images[0] : (color.image || image);
                    await connection.execute(
                        "INSERT INTO product_colors (productId, colorName, colorCode, price, stock, image, images) VALUES (?, ?, ?, ?, ?, ?, ?)",
                        [id, color.colorName, color.colorCode, color.price || price, color.stock || 0, firstImage, imagesJson]
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
        console.error('PUT /products error:', err.message);
        res.status(500).json({ error: err.message });
    } finally {
        connection.release();
    }
});

// Delete Product
router.delete('/:id', authenticateJWT, requireAdmin, async (req, res) => {
    const pool = getDB();
    try {
        await pool.execute("DELETE FROM products WHERE id = ?", [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
