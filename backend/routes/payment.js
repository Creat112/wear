const express = require('express');
const router = express.Router();
const { 
    authenticatePaymob, 
    createPaymobOrder, 
    generatePaymentKey, 
    getPaymentUrl,
    verifyWebhookSignature,
    processWebhook 
} = require('../utils/paymobUtils');
const { getDB } = require('../database/init');
const { sendOrderEmail, sendCustomerOrderEmailWithTracking } = require('../utils/email');

// Paymob Payment Routes

router.post('/paymob/create', async (req, res) => {
    try {
        const { 
            amount, 
            orderId, 
            customerData, 
            shippingData,
            items = [] 
        } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({ error: 'Invalid amount' });
        }

        if (!orderId) {
            return res.status(400).json({ error: 'Order ID is required' });
        }

        const amountInCents = Math.round(amount * 100);
        const authToken = await authenticatePaymob();

        const orderData = {
            merchantOrderId: orderId.toString(),
            items: items.map(item => ({
                name: item.name,
                amount_cents: Math.round(item.price * 100),
                description: item.description || '',
                quantity: item.quantity || 1,
            })),
            shippingData: shippingData || {},
        };

        const paymobOrder = await createPaymobOrder(authToken, amountInCents, orderData);

        const paymentData = {
            firstName: customerData?.firstName || shippingData?.first_name,
            lastName: customerData?.lastName || shippingData?.last_name,
            email: customerData?.email || shippingData?.email,
            phoneNumber: customerData?.phoneNumber || shippingData?.phone_number,
            street: shippingData?.street,
            building: shippingData?.building,
            city: shippingData?.city,
            state: shippingData?.state,
            country: shippingData?.country || 'EG',
            postalCode: shippingData?.postal_code,
            apartment: shippingData?.apartment,
            floor: shippingData?.floor,
        };

        const paymentToken = await generatePaymentKey(
            authToken, 
            paymobOrder.id, 
            amountInCents, 
            paymentData
        );

        const paymentUrl = getPaymentUrl(paymentToken);

        const pool = getDB();
        await pool.execute(`
            INSERT INTO payment_sessions 
            (order_id, paymob_order_id, payment_token, amount, status, created_at) 
            VALUES (?, ?, ?, ?, ?, ?)
        `, [
            orderId,
            paymobOrder.id,
            paymentToken,
            amount,
            'pending',
            new Date().toISOString().slice(0, 19).replace('T', ' ')
        ]);

        res.json({
            success: true,
            paymentUrl,
            paymentToken,
            paymobOrderId: paymobOrder.id,
            amount,
            currency: 'EGP',
        });

    } catch (error) {
        console.error('Paymob payment creation error:', error);
        res.status(500).json({ 
            error: 'Payment processing failed',
            message: error.message 
        });
    }
});

router.post('/paymob/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    try {
        const webhookData = JSON.parse(req.body);
        const { hmac, obj, type } = webhookData;

        if (!verifyWebhookSignature(obj, hmac)) {
            return res.status(400).json({ error: 'Invalid signature' });
        }

        const processedData = processWebhook(webhookData);
        const pool = getDB();
        
        if (type === 'TRANSACTION') {
            await pool.execute(`
                UPDATE payment_sessions 
                SET status = ?, transaction_id = ?, processed_at = ?
                WHERE paymob_order_id = ?
            `, [
                processedData.status,
                processedData.transactionId,
                new Date().toISOString().slice(0, 19).replace('T', ' '),
                processedData.orderId
            ]);

            if (processedData.status === 'success') {
                await pool.execute(`
                    UPDATE orders 
                    SET status = 'paid', payment_method = 'paymob', updated_at = ?
                    WHERE id = ?
                `, [
                    new Date().toISOString().slice(0, 19).replace('T', ' '),
                    processedData.merchantOrderId
                ]);

                try {
                    const [rows] = await pool.execute("SELECT * FROM orders WHERE id = ?", [processedData.merchantOrderId]);
                    const orderRow = rows[0];
                    if (orderRow) {
                        await sendOrderEmail({
                            orderNumber: orderRow.orderNumber,
                            customer: { fullName: orderRow.customerName, email: orderRow.customerEmail, phone: orderRow.customerPhone },
                            shipping: { address: orderRow.shippingAddress, city: orderRow.shippingCity, governorate: orderRow.shippingGov, notes: orderRow.notes },
                            total: orderRow.total,
                            date: orderRow.date,
                            items: [] 
                        });

                        await sendCustomerOrderEmailWithTracking({
                            orderNumber: orderRow.orderNumber,
                            customer: { email: orderRow.customerEmail },
                            total: orderRow.total,
                            date: orderRow.date
                        });
                    }
                } catch (emailError) {}
            } else {
                await pool.execute(`
                    UPDATE orders 
                    SET status = 'payment_failed', updated_at = ?
                    WHERE id = ?
                `, [
                    new Date().toISOString().slice(0, 19).replace('T', ' '),
                    processedData.merchantOrderId
                ]);
            }
        }

        res.status(200).json({ received: true });

    } catch (error) {
        console.error('Paymob webhook processing error:', error);
        res.status(500).json({ error: 'Webhook processing failed' });
    }
});

router.get('/paymob/status/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;
        const pool = getDB();

        const [rows] = await pool.execute(`
            SELECT ps.*, o.status as order_status 
            FROM payment_sessions ps
            LEFT JOIN orders o ON ps.order_id = o.id
            WHERE ps.order_id = ?
        `, [orderId]);
        const row = rows[0];

        if (!row) {
            return res.status(404).json({ error: 'Payment session not found' });
        }

        res.json({
            orderId: row.order_id,
            status: row.status,
            transactionId: row.transaction_id,
            orderStatus: row.order_status,
            createdAt: row.created_at,
            processedAt: row.processed_at,
        });

    } catch (error) {
        console.error('Payment status check error:', error);
        res.status(500).json({ error: 'Failed to check payment status' });
    }
});

module.exports = router;
