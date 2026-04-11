const express = require('express');
const router = express.Router();
const { getDB } = require('../database/init');
const { sendOrderEmail, sendCustomerOrderEmailWithTracking, sendOrderStatusUpdateEmail } = require('../utils/email');

// Get all orders (Admin)
router.get('/', async (req, res) => {
    const pool = getDB();
    const query = `
        SELECT o.*, i.productId, i.quantity, i.price, i.productName, i.colorId, i.colorName,
               p.image as productImage
        FROM orders o 
        LEFT JOIN order_items i ON o.id = i.orderId
        LEFT JOIN products p ON i.productId = p.id
        ORDER BY o.date DESC
    `;

    try {
        const [rows] = await pool.execute(query);

        // Group items by order
        const ordersMap = new Map();
        rows.forEach(row => {
            if (!ordersMap.has(row.id)) {
                ordersMap.set(row.id, {
                    id: row.id,
                    orderNumber: row.orderNumber,
                    total: Number(row.total),
                    discountCode: row.discount_code,
                    discountAmount: Number(row.discount_amount),
                    status: row.status,
                    date: row.date,
                    paymentMethod: row.payment_method,
                    customer: {
                        fullName: row.customerName,
                        email: row.customerEmail,
                        phone: row.customerPhone
                    },
                    shipping: {
                        address: row.shippingAddress,
                        city: row.shippingCity,
                        governorate: row.shippingGov,
                        notes: row.notes
                    },
                    items: []
                });
            }
            if (row.productId) {
                ordersMap.get(row.id).items.push({
                    productId: row.productId,
                    quantity: Number(row.quantity),
                    price: Number(row.price),
                    name: row.productName,
                    colorId: row.colorId,
                    colorName: row.colorName,
                    productImage: row.productImage
                });
            }
        });

        res.json(Array.from(ordersMap.values()));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create new order with stock validation
router.post('/', async (req, res) => {
    const { customer, shipping, items, total, orderNumber, date, paymentMethod = 'cash', discountCode = null, discountAmount = 0 } = req.body;

    if (!items || items.length === 0) {
        return res.status(400).json({ error: 'No items in order' });
    }

    const pool = getDB();
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        let stockErrors = [];
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const colorId = item.colorId;
            const productId = item.productId;
            const qty = Number(item.quantity) || 0;
            const itemName = item.name || item.productName || `Item ${i + 1}`;

            if (colorId) {
                // Check color variant stock
                const [colorRows] = await connection.execute("SELECT stock FROM product_colors WHERE id = ?", [colorId]);
                const colorRow = colorRows[0];

                if (!colorRow) {
                    stockErrors.push(`Color variant not found for ${itemName}`);
                } else if (colorRow.stock < qty) {
                    stockErrors.push(`Insufficient stock for ${itemName}. Available: ${colorRow.stock}, Requested: ${qty}`);
                }
            } else if (productId) {
                // Check product-level stock (for products without color variants)
                const [productRows] = await connection.execute("SELECT stock FROM products WHERE id = ?", [productId]);
                const productRow = productRows[0];

                if (!productRow) {
                    stockErrors.push(`Product not found: ${itemName}`);
                } else if (productRow.stock < qty) {
                    stockErrors.push(`Insufficient stock for ${itemName}. Available: ${productRow.stock}, Requested: ${qty}`);
                }
            } else {
                stockErrors.push(`${itemName} is missing product and color information`);
            }
        }

        if (stockErrors.length > 0) {
            await connection.rollback();
            return res.status(400).json({ error: 'Stock validation failed', details: stockErrors });
        }

        // Format ISO date to MySQL datetime (YYYY-MM-DD HH:MM:SS)
        const mysqlDate = new Date(date || Date.now()).toISOString().slice(0, 19).replace('T', ' ');

        // Proceed with order creation
        const [result] = await connection.execute(`
            INSERT INTO orders (orderNumber, total, discount_code, discount_amount, status, date, customerName, customerEmail, customerPhone, shippingAddress, shippingCity, shippingGov, notes, payment_method)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            orderNumber, total, discountCode, discountAmount, 'pending', mysqlDate, 
            customer.fullName, customer.email, customer.phone, 
            shipping.address, shipping.city, shipping.governorate, shipping.notes, paymentMethod
        ]);

        const orderId = result.insertId;

        for (const item of items) {
            const productId = Number(item.productId || item.id);
            const qty = Number(item.quantity) || 0;
            const price = Number(item.price || item.colorPrice) || 0;
            const name = item.name || item.productName || 'Unknown Product';
            const colorId = item.colorId;
            const colorName = item.colorName || '';

            await connection.execute(
                `INSERT INTO order_items (orderId, productId, quantity, price, productName, colorId, colorName) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [orderId, productId, qty, price, name, colorId, colorName]
            );

            const [updateRes] = await connection.execute(
                `UPDATE product_colors SET stock = stock - ? WHERE id = ? AND stock >= ?`,
                [qty, colorId, qty]
            );
            if (updateRes.affectedRows === 0) {
                console.warn(`Stock update failed for color ${colorId} - possible race condition`);
            }
        }

        await connection.commit();
        
        console.log('Order and stock updates committed successfully.');
        
        // Asynchronously send emails with better error handling
        (async () => {
            try {
                console.log('Sending admin order email...');
                const adminEmailResult = await sendOrderEmail({ customer, shipping, items, total, orderNumber, date, paymentMethod });
                console.log('Admin email result:', adminEmailResult);
            } catch (emailErr) {
                console.error('Admin email failed:', emailErr);
            }
            
            try {
                console.log('Sending customer order email...');
                const customerEmailResult = await sendCustomerOrderEmailWithTracking({ customer, shipping, items, total, orderNumber, date, paymentMethod });
                console.log('Customer email result:', customerEmailResult);
            } catch (emailErr) {
                console.error('Customer email failed:', emailErr);
            }
        })();

        res.status(201).json({ success: true, orderId });
    } catch (err) {
        await connection.rollback();
        console.error('Order creation error:', err);
        res.status(500).json({ error: err.message });
    } finally {
        connection.release();
    }
});

// Track order by order number
router.get('/track/:orderNumber', async (req, res) => {
    const { orderNumber } = req.params;
    const pool = getDB();
    
    try {
        const [rows] = await pool.execute(`
            SELECT o.*, i.productId, i.quantity, i.price, i.productName, i.colorId, i.colorName,
                   p.image as productImage
            FROM orders o 
            LEFT JOIN order_items i ON o.id = i.orderId
            LEFT JOIN products p ON i.productId = p.id
            WHERE o.orderNumber = ?
        `, [orderNumber]);
        
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }

        const row = rows[0]; // first row just for order meta
        const items = rows.filter(r => r.productId != null).map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            price: Number(item.price),
            name: item.productName,
            colorId: item.colorId,
            colorName: item.colorName,
            image: item.productImage
        }));

        const order = {
            id: row.id,
            orderNumber: row.orderNumber,
            total: Number(row.total),
            discountCode: row.discount_code,
            discountAmount: Number(row.discount_amount),
            status: row.status,
            date: row.date,
            trackingNumber: row.trackingNumber, // Ensure trackingNumber column is present in MySQL schema if used here, or we can ignore
            estimatedDelivery: row.estimatedDelivery,
            shippedDate: row.shippedDate,
            deliveredDate: row.deliveredDate,
            customer: {
                fullName: row.customerName,
                email: row.customerEmail,
                phone: row.customerPhone
            },
            shipping: {
                address: row.shippingAddress,
                city: row.shippingCity,
                governorate: row.shippingGov,
                notes: row.notes
            },
            items: items
        };

        res.json(order);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update order status with tracking information
router.put('/:id', async (req, res) => {
    const { status, trackingNumber, estimatedDelivery } = req.body;
    const { id } = req.params;
    const pool = getDB();
    
    try {
        const [orders] = await pool.execute("SELECT * FROM orders WHERE id = ? OR orderNumber = ?", [id, id]);
        const order = orders[0];

        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }
        
        let updateFields = ['status = ?'];
        let updateValues = [status];
        
        if (trackingNumber !== undefined) {
            updateFields.push('trackingNumber = ?');
            updateValues.push(trackingNumber);
        }
        
        if (estimatedDelivery !== undefined) {
            updateFields.push('estimatedDelivery = ?');
            updateValues.push(estimatedDelivery);
        }
        
        if (status === 'shipped') {
            updateFields.push('shippedDate = ?');
            updateValues.push(new Date().toISOString().slice(0, 19).replace('T', ' '));
        } else if (status === 'delivered') {
            updateFields.push('deliveredDate = ?');
            updateValues.push(new Date().toISOString().slice(0, 19).replace('T', ' '));
        }
        
        updateValues.push(id, id);
        const query = `UPDATE orders SET ${updateFields.join(', ')} WHERE id = ? OR orderNumber = ?`;
        
        const [result] = await pool.execute(query, updateValues);
        
        sendOrderStatusUpdateEmail(
            { orderNumber: order.orderNumber, customerEmail: order.customerEmail, date: order.date, total: order.total }, 
            status, trackingNumber, estimatedDelivery
        ).catch(console.error);
        
        res.json({ success: true, changes: result.affectedRows, message: `Order status updated to ${status}` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete order
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    const pool = getDB();

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const [rows] = await connection.execute("SELECT id FROM orders WHERE id = ? OR orderNumber = ?", [id, id]);
        const row = rows[0];

        if (!row) {
            await connection.rollback();
            return res.status(404).json({ error: 'Order not found' });
        }

        await connection.execute('DELETE FROM order_items WHERE orderId = ?', [row.id]);
        await connection.execute('DELETE FROM orders WHERE id = ?', [row.id]);

        await connection.commit();
        res.json({ success: true });
    } catch (err) {
        await connection.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        connection.release();
    }
});

module.exports = router;
