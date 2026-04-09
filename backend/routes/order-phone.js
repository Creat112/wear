const express = require('express');
const router = express.Router();
const { getDB } = require('../database/init');

// Get orders by phone number
router.get('/phone/:phone', async (req, res) => {
    const { phone } = req.params;
    const pool = getDB();

    if (!phone) {
        return res.status(400).json({ error: 'Phone number is required' });
    }

    const query = `
        SELECT o.*, i.productId, i.quantity, i.price, i.productName, i.colorId, i.colorName
        FROM orders o 
        LEFT JOIN order_items i ON o.id = i.orderId
        WHERE o.customerPhone = ?
        ORDER BY o.date DESC
    `;

    try {
        const [rows] = await pool.execute(query, [phone]);

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
                    customerName: row.customerName,
                    customerEmail: row.customerEmail,
                    customerPhone: row.customerPhone,
                    shippingAddress: row.shippingAddress,
                    shippingCity: row.shippingCity,
                    shippingGov: row.shippingGov,
                    notes: row.notes,
                    trackingNumber: row.trackingNumber,
                    estimatedDelivery: row.estimatedDelivery,
                    shippedDate: row.shippedDate,
                    deliveredDate: row.deliveredDate,
                    items: []
                });
            }
            if (row.productId) {
                ordersMap.get(row.id).items.push({
                    productId: row.productId,
                    quantity: row.quantity,
                    price: Number(row.price),
                    name: row.productName,
                    colorId: row.colorId,
                    colorName: row.colorName
                });
            }
        });

        res.json(Array.from(ordersMap.values()));
    } catch (err) {
        console.error('Error fetching orders by phone:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

module.exports = router;
