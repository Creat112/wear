require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const { initDB } = require('./database/init');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});

const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const cartRoutes = require('./routes/cart');
const paymentRoutes = require('./routes/payment');
const discountRoutes = require('./routes/discount');
const businessRulesRoutes = require('./routes/business-rules');
const healthRoutes = require('./routes/health');

console.log('Registering API routes...');

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', require('./routes/orders'));
console.log('Phone search route loading...');
app.use('/api/orders', require('./routes/order-phone'));
console.log('Phone search route loaded');
app.use('/api/payment', paymentRoutes);
app.use('/api/discounts', discountRoutes);
app.use('/api/business-rules', businessRulesRoutes);
app.use('/api/health', healthRoutes);

console.log('API routes registered');

app.use(express.static(path.join(__dirname, '../docs')));
app.use('/products', express.static(path.join(__dirname, '../products')));

app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'API endpoint not found' });
    }
    res.sendFile(path.join(__dirname, '../docs/index.html'));
});

const startServer = async () => {
    await initDB();

    if (!process.env.VERCEL) {
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`Server is running on port ${PORT}`);
        });
    }
};

startServer().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
});

module.exports = app;
