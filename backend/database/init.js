const mysql = require('mysql2/promise');
const { hashPassword } = require('../utils/passwordUtils');
const fs = require('fs');
const path = require('path');

let pool;

const initDB = async () => {
    try {
        // Try MySQL/Aiven connection
        await initMySQL();
    } catch (err) {
        console.error('❌ Database connection failed:', err.message);
        console.error('🔧 Please check your database configuration in .env or Replit Secrets');
        console.error('📋 Required: DB_HOST, DB_USER, DB_PASSWORD, DB_NAME');
        console.warn('⚠️ Continuing without database - some features will not work');
    }
};

const initMySQL = async () => {
    // Prepare base connection config
    const host = process.env.DB_HOST || '127.0.0.1';
    
    if (host === '127.0.0.1' || host === 'localhost') {
        console.warn('⚠️ WARNING: Using local database (127.0.0.1). Your data will likely disappear when server restarts!');
        console.log('👉 Make sure you have MySQL installed and running locally.');
        console.log('📋 To install MySQL: https://dev.mysql.com/downloads/mysql/');
        console.log('🔧 Or configure a cloud database in your .env file');
    } else {
        console.log(`📡 Connecting to remote cloud database: ${host}`);
    }

    const dbConfig = {
        host: host,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        port: process.env.DB_PORT || 3306,
        acquireTimeout: 60000,
        timeout: 60000,
        reconnect: true
    };

    // If ca.pem exists in project root, assume remote Cloud DB (Aiven/PlanetScale) and apply SSL
    const caPath = path.join(__dirname, '../../ca.pem');
    if (fs.existsSync(caPath)) {
        dbConfig.ssl = {
            ca: fs.readFileSync(caPath)
        };
    }

    // Test basic connection first
    console.log('🔍 Testing MySQL connection...');
    const testConnection = await mysql.createConnection(dbConfig);
    await testConnection.ping();
    await testConnection.end();
    console.log('✅ MySQL connection test successful');

    // First try to connect without database selected to create it if it doesn't exist
    const connection = await mysql.createConnection(dbConfig);

    const dbName = process.env.DB_NAME || 'savx_store';
    console.log(`📂 Selecting database: ${dbName}`);
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\`;`);
    await connection.end();

    // Now initialize the pool properly
    pool = mysql.createPool({
        ...dbConfig,
        database: dbName,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    });

    console.log('✅ Connected to the MySQL database.');
    await createTables();
};


const createTables = async () => {
    try {
        // Users Table
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255),
                email VARCHAR(255) UNIQUE,
                password VARCHAR(255),
                role VARCHAR(50) DEFAULT 'customer',
                createdAt DATETIME
            )
        `);

        // Products Table
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS products (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255),
                price DECIMAL(10, 2),
                description TEXT,
                category VARCHAR(255),
                image TEXT,
                stock INT DEFAULT 0,
                disabled TINYINT(1) DEFAULT 0,
                discount DECIMAL(5, 2) DEFAULT 0,
                originalPrice DECIMAL(10, 2)
            )
        `);

        // Product Colors Table
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS product_colors (
                id INT AUTO_INCREMENT PRIMARY KEY,
                productId INT,
                colorName VARCHAR(100),
                colorCode VARCHAR(20),
                price DECIMAL(10, 2),
                stock INT DEFAULT 0,
                image TEXT,
                FOREIGN KEY(productId) REFERENCES products(id) ON DELETE CASCADE
            )
        `);

        // Cart Table
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS cart (
                id INT AUTO_INCREMENT PRIMARY KEY,
                productId INT,
                quantity INT,
                userId INT,
                colorId INT NULL,
                addedAt DATETIME,
                FOREIGN KEY(productId) REFERENCES products(id) ON DELETE CASCADE,
                FOREIGN KEY(colorId) REFERENCES product_colors(id) ON DELETE SET NULL
            )
        `);

        // Discount Codes Table
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS discount_codes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                code VARCHAR(50) UNIQUE,
                discount_type ENUM('percentage', 'fixed') DEFAULT 'percentage',
                discount_value DECIMAL(10,2) DEFAULT 0,
                percentage DECIMAL(5,2) DEFAULT 0,
                fixed_amount DECIMAL(10,2) DEFAULT 0,
                active TINYINT(1) DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Migration: Add new columns if they don't exist (for existing tables)
        try {
            await pool.execute(`ALTER TABLE discount_codes ADD COLUMN IF NOT EXISTS discount_type ENUM('percentage', 'fixed') DEFAULT 'percentage'`);
            await pool.execute(`ALTER TABLE discount_codes ADD COLUMN IF NOT EXISTS discount_value DECIMAL(10,2) DEFAULT 0`);
            await pool.execute(`ALTER TABLE discount_codes ADD COLUMN IF NOT EXISTS fixed_amount DECIMAL(10,2) DEFAULT 0`);
            console.log('✅ Discount codes table migrated successfully');
        } catch (migrationErr) {
            // Columns might already exist, ignore error
            console.log('ℹ️  Discount codes migration check completed');
        }

        // Orders Table
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS orders (
                id INT AUTO_INCREMENT PRIMARY KEY,
                orderNumber VARCHAR(255) UNIQUE NOT NULL,
                total DECIMAL(10, 2) NOT NULL,
                discount_code VARCHAR(50) NULL,
                discount_amount DECIMAL(10, 2) DEFAULT 0,
                status VARCHAR(50) DEFAULT 'pending',
                date DATETIME NOT NULL,
                customerName VARCHAR(255),
                customerEmail VARCHAR(255),
                customerPhone VARCHAR(50),
                shippingAddress TEXT,
                shippingCity VARCHAR(100),
                shippingGov VARCHAR(100),
                notes TEXT,
                payment_method VARCHAR(50) DEFAULT 'cash',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                shippedDate DATETIME NULL,
                estimatedDelivery DATETIME NULL,
                deliveredDate DATETIME NULL
            )
        `);

        // Order Items Table
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS order_items (
                id INT AUTO_INCREMENT PRIMARY KEY,
                orderId INT,
                productId INT,
                quantity INT,
                price DECIMAL(10, 2),
                productName VARCHAR(255),
                colorId INT NULL,
                colorName VARCHAR(100),
                FOREIGN KEY(orderId) REFERENCES orders(id) ON DELETE CASCADE
            )
        `);

        // Payment Sessions Table
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS payment_sessions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                order_id INT,
                paymob_order_id INT,
                payment_token TEXT,
                amount DECIMAL(10, 2),
                status VARCHAR(50) DEFAULT 'pending',
                transaction_id VARCHAR(255),
                created_at DATETIME,
                processed_at DATETIME,
                FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE
            )
        `);

        await seedAdmin();
        await seedProducts();
        await seedProductColors();

    } catch (err) {
        console.error("Error creating tables:", err.message);
    }
};

const seedAdmin = async () => {
    try {
        const [rows] = await pool.execute("SELECT count(*) as count FROM users WHERE role = 'admin'");
        if (rows[0].count === 0) {
            console.log("Seeding admin user...");
            const hashedPassword = await hashPassword('admin123');
            const createdAt = new Date().toISOString().slice(0, 19).replace('T', ' ');
            
            await pool.execute(
                "INSERT INTO users (name, email, password, role, createdAt) VALUES (?, ?, ?, ?, ?)",
                ['Admin User', 'admin@SAVX.com', hashedPassword, 'admin', createdAt]
            );
            console.log("Admin user seeded successfully with hashed password");
        }
    } catch (err) {
        console.error(err.message);
    }
};

const seedProducts = async () => {
    try {
        const [rows] = await pool.execute("SELECT count(*) as count FROM products");
        if (rows[0].count === 0) {
            console.log("Seeding products...");
            const products = [
                { name: 'Winter Compression', price: 390, originalPrice: 450, description: 'Comfortable winter compression wear', category: 'compression', image: 'products/Winter Compression/Black Compression.jpeg', stock: 50, discount: 13.33 },
                { name: 'Sweat Pants', price: 580, originalPrice: 690, description: 'Comfortable sweat pants for daily wear', category: 'pants', image: 'products/sweetpants/Sweet Pants Black.jpeg', stock: 30, discount: 15.94 },
                { name: 'Zipper Jacket', price: 690, originalPrice: 1010, description: 'Stylish zipper jacket with modern design', category: 'jackets', image: 'products/Ziper Jacket/Ziper Jacket Black.jpeg', stock: 25, discount: 31.68 },
                { name: 'Savax Winter Set', price: 1300, originalPrice: 1750, description: 'Complete set with top and bottom', category: 'sets', image: 'products/Set/Sets Savax Black.jpeg', stock: 20, discount: 25.71 }
            ];

            for (const p of products) {
                await pool.execute(
                    "INSERT INTO products (name, price, description, category, image, stock, discount, originalPrice) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                    [p.name, p.price, p.description, p.category, p.image, p.stock, p.discount, p.originalPrice]
                );
            }
        }
    } catch (err) {
        console.error(err.message);
    }
};

const seedProductColors = async () => {
    try {
        const [rows] = await pool.execute("SELECT count(*) as count FROM product_colors");
        if (rows[0].count === 0) {
            console.log("Seeding product colors...");
            const colors = [
                { productId: 1, colorName: 'Black', colorCode: '#000000', price: 390, stock: 25, image: 'products/Winter Compression/Black Compression.jpeg' },
                { productId: 1, colorName: 'White', colorCode: '#FFFFFF', price: 390, stock: 25, image: 'products/Winter Compression/White Compression.jpeg' },
                { productId: 2, colorName: 'Black', colorCode: '#000000', price: 580, stock: 10, image: 'products/sweetpants/Sweet Pants Black.jpeg' },
                { productId: 2, colorName: 'Brown', colorCode: '#8B4513', price: 580, stock: 10, image: 'products/sweetpants/Sweet Pants Brown.jpeg' },
                { productId: 2, colorName: 'Grey', colorCode: '#808080', price: 580, stock: 10, image: 'products/sweetpants/Sweet Pants Grey.jpeg' },
                { productId: 2, colorName: 'Olive Green', colorCode: '#808000', price: 580, stock: 10, image: 'products/sweetpants/Sweet Pants Olive Green.jpeg' },
                { productId: 2, colorName: 'Pink', colorCode: '#FFC0CB', price: 580, stock: 10, image: 'products/sweetpants/Sweet Pants Pink.jpeg' },
                { productId: 2, colorName: 'White', colorCode: '#FFFFFF', price: 580, stock: 10, image: 'products/sweetpants/Sweet Pants white.jpeg' },
                { productId: 3, colorName: 'Black', colorCode: '#000000', price: 690, stock: 8, image: 'products/Ziper Jacket/Ziper Jacket Black.jpeg' },
                { productId: 3, colorName: 'Olive Green', colorCode: '#808000', price: 690, stock: 8, image: 'products/Ziper Jacket/Ziper Jacket Olive Greenjpeg.jpeg' },
                { productId: 3, colorName: 'Pink', colorCode: '#FFC0CB', price: 690, stock: 8, image: 'products/Ziper Jacket/Ziper Jacket Pink.jpeg' },
                { productId: 3, colorName: 'White', colorCode: '#FFFFFF', price: 690, stock: 8, image: 'products/Ziper Jacket/Ziper Jacket White.jpeg' },
                { productId: 3, colorName: 'Brown', colorCode: '#8B4513', price: 690, stock: 8, image: 'products/Ziper Jacket/Ziper Jacket brownjpeg.jpeg' },
                { productId: 3, colorName: 'Grey', colorCode: '#808080', price: 690, stock: 8, image: 'products/Ziper Jacket/Ziper Jacket greyjpeg.jpeg' },
                { productId: 4, colorName: 'Black', colorCode: '#000000', price: 1300, stock: 5, image: 'products/Set/Sets Savax Black.jpeg' },
                { productId: 4, colorName: 'Brown', colorCode: '#8B4513', price: 1300, stock: 5, image: 'products/Set/Sets Savax Brown.jpeg' },
                { productId: 4, colorName: 'Grey', colorCode: '#808080', price: 1300, stock: 5, image: 'products/Set/Sets Savax Grey.jpeg' },
                { productId: 4, colorName: 'Olive Green', colorCode: '#808000', price: 1300, stock: 5, image: 'products/Set/Sets Savax Olive Green.jpeg' },
                { productId: 4, colorName: 'Pink', colorCode: '#FFC0CB', price: 1300, stock: 5, image: 'products/Set/Sets Savax Pink.jpeg' },
                { productId: 4, colorName: 'White', colorCode: '#FFFFFF', price: 1300, stock: 5, image: 'products/Set/Sets Savax White.jpeg' }
            ];

            for (const c of colors) {
                await pool.execute(
                    "INSERT INTO product_colors (productId, colorName, colorCode, price, stock, image) VALUES (?, ?, ?, ?, ?, ?)",
                    [c.productId, c.colorName, c.colorCode, c.price, c.stock, c.image]
                );
            }
        }
    } catch (err) {
        console.error(err.message);
    }
};

const getDB = () => pool;

module.exports = { initDB, getDB };
