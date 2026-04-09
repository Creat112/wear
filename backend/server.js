require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const { initDB } = require('./database/init');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Add request logging middleware
app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});

// Database initialization
initDB();

// API Routes (must come before static files)
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const cartRoutes = require('./routes/cart');
const paymentRoutes = require('./routes/payment');
const discountRoutes = require('./routes/discount');

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

console.log('API routes registered');

// Static files (serve after API routes)
app.use(express.static(path.join(__dirname, '../docs'))); // Serve static files from docs folder
app.use('/products', express.static(path.join(__dirname, '../products'))); // Serve product images

// Fallback for SPA (only for non-API routes)
app.get('*', (req, res) => {
    // Don't intercept API routes
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'API endpoint not found' });
    }
    res.sendFile(path.join(__dirname, '../docs/index.html'));
});

if (!process.env.VERCEL) {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server is running on port ${PORT}`);
    });
}

module.exports = app;
