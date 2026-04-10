/**
 * SQLite Database Setup for Local Development
 * This provides a database solution without requiring MySQL installation
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { hashPassword } = require('../utils/passwordUtils');

class SQLiteDatabase {
    constructor() {
        this.db = null;
        this.dbPath = path.join(__dirname, '../../data/savx_store.db');
    }

    async init() {
        try {
            // Create data directory if it doesn't exist
            const fs = require('fs');
            const dataDir = path.dirname(this.dbPath);
            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, { recursive: true });
            }

            // Connect to SQLite database
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    console.error('Error opening SQLite database:', err.message);
                } else {
                    console.log('✅ Connected to SQLite database.');
                }
            });

            // Enable foreign keys
            await this.run('PRAGMA foreign_keys = ON');
            
            // Create tables
            await this.createTables();
            await this.seedData();
            
            console.log('🎉 SQLite database setup complete!');
            return this.db;
        } catch (error) {
            console.error('SQLite initialization error:', error);
            throw error;
        }
    }

    run(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id: this.lastID, changes: this.changes });
                }
            });
        });
    }

    get(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    all(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async createTables() {
        console.log('📝 Creating SQLite tables...');

        // Users Table
        await this.run(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT,
                email TEXT UNIQUE,
                password TEXT,
                role TEXT DEFAULT 'customer',
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Products Table
        await this.run(`
            CREATE TABLE IF NOT EXISTS products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT,
                price REAL,
                description TEXT,
                category TEXT,
                image TEXT,
                stock INTEGER DEFAULT 0,
                disabled INTEGER DEFAULT 0,
                discount REAL DEFAULT 0,
                originalPrice REAL
            )
        `);

        // Product Colors Table
        await this.run(`
            CREATE TABLE IF NOT EXISTS product_colors (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                productId INTEGER,
                colorName TEXT,
                colorCode TEXT,
                price REAL,
                stock INTEGER DEFAULT 0,
                image TEXT,
                FOREIGN KEY(productId) REFERENCES products(id) ON DELETE CASCADE
            )
        `);

        // Cart Table
        await this.run(`
            CREATE TABLE IF NOT EXISTS cart (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                productId INTEGER,
                quantity INTEGER,
                userId INTEGER,
                colorId INTEGER,
                addedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(productId) REFERENCES products(id) ON DELETE CASCADE,
                FOREIGN KEY(colorId) REFERENCES product_colors(id) ON DELETE SET NULL
            )
        `);

        // Discount Codes Table
        await this.run(`
            CREATE TABLE IF NOT EXISTS discount_codes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                code TEXT UNIQUE,
                percentage REAL DEFAULT 0,
                active INTEGER DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Orders Table
        await this.run(`
            CREATE TABLE IF NOT EXISTS orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                orderNumber TEXT UNIQUE NOT NULL,
                total REAL NOT NULL,
                discount_code TEXT,
                discount_amount REAL DEFAULT 0,
                status TEXT DEFAULT 'pending',
                date DATETIME NOT NULL,
                customerName TEXT,
                customerEmail TEXT,
                customerPhone TEXT,
                shippingAddress TEXT,
                shippingCity TEXT,
                shippingGov TEXT,
                notes TEXT,
                payment_method TEXT DEFAULT 'cash',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                shippedDate DATETIME,
                estimatedDelivery DATETIME,
                deliveredDate DATETIME
            )
        `);

        // Order Items Table
        await this.run(`
            CREATE TABLE IF NOT EXISTS order_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                orderId INTEGER,
                productId INTEGER,
                quantity INTEGER,
                price REAL,
                productName TEXT,
                colorId INTEGER,
                colorName TEXT,
                FOREIGN KEY(orderId) REFERENCES orders(id) ON DELETE CASCADE
            )
        `);

        console.log('✅ Tables created successfully');
    }

    async seedData() {
        console.log('🌱 Seeding initial data...');

        // Check if admin user exists
        const adminExists = await this.get('SELECT COUNT(*) as count FROM users WHERE role = ?', ['admin']);
        
        if (adminExists.count === 0) {
            console.log('👤 Creating admin user...');
            const hashedPassword = await hashPassword('admin123');
            
            await this.run(
                'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
                ['Admin User', 'admin@savx.com', hashedPassword, 'admin']
            );
            console.log('✅ Admin user created (admin@savx.com / admin123)');
        }

        // Check if products exist
        const productsExist = await this.get('SELECT COUNT(*) as count FROM products');
        
        if (productsExist.count === 0) {
            console.log('🛍️ Creating sample products...');
            const products = [
                { name: 'Winter Compression', price: 390, originalPrice: 450, description: 'Comfortable winter compression wear', category: 'compression', image: 'products/Winter Compression/Black Compression.jpeg', stock: 50, discount: 13.33 },
                { name: 'Sweat Pants', price: 580, originalPrice: 690, description: 'Comfortable sweat pants for daily wear', category: 'pants', image: 'products/sweetpants/Sweet Pants Black.jpeg', stock: 30, discount: 15.94 },
                { name: 'Zipper Jacket', price: 690, originalPrice: 1010, description: 'Stylish zipper jacket with modern design', category: 'jackets', image: 'products/Ziper Jacket/Ziper Jacket Black.jpeg', stock: 25, discount: 31.68 },
                { name: 'Savax Winter Set', price: 1300, originalPrice: 1750, description: 'Complete set with top and bottom', category: 'sets', image: 'products/Set/Sets Savax Black.jpeg', stock: 20, discount: 25.71 }
            ];

            for (const product of products) {
                const result = await this.run(
                    'INSERT INTO products (name, price, description, category, image, stock, discount, originalPrice) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                    [product.name, product.price, product.description, product.category, product.image, product.stock, product.discount, product.originalPrice]
                );

                // Add colors for each product
                await this.seedProductColors(result.id, product.name);
            }
        }

        console.log('✅ Database seeding complete');
    }

    async seedProductColors(productId, productName) {
        const colors = {
            'Winter Compression': [
                { colorName: 'Black', colorCode: '#000000', price: 390, stock: 25, image: 'products/Winter Compression/Black Compression.jpeg' },
                { colorName: 'White', colorCode: '#FFFFFF', price: 390, stock: 25, image: 'products/Winter Compression/White Compression.jpeg' }
            ],
            'Sweat Pants': [
                { colorName: 'Black', colorCode: '#000000', price: 580, stock: 10, image: 'products/sweetpants/Sweet Pants Black.jpeg' },
                { colorName: 'Brown', colorCode: '#8B4513', price: 580, stock: 10, image: 'products/sweetpants/Sweet Pants Brown.jpeg' },
                { colorName: 'Grey', colorCode: '#808080', price: 580, stock: 10, image: 'products/sweetpants/Sweet Pants Grey.jpeg' }
            ],
            'Zipper Jacket': [
                { colorName: 'Black', colorCode: '#000000', price: 690, stock: 8, image: 'products/Ziper Jacket/Ziper Jacket Black.jpeg' },
                { colorName: 'Olive Green', colorCode: '#808000', price: 690, stock: 8, image: 'products/Ziper Jacket/Ziper Jacket Olive Greenjpeg.jpeg' },
                { colorName: 'Pink', colorCode: '#FFC0CB', price: 690, stock: 8, image: 'products/Ziper Jacket/Ziper Jacket Pink.jpeg' }
            ],
            'Savax Winter Set': [
                { colorName: 'Black', colorCode: '#000000', price: 1300, stock: 5, image: 'products/Set/Sets Savax Black.jpeg' },
                { colorName: 'Brown', colorCode: '#8B4513', price: 1300, stock: 5, image: 'products/Set/Sets Savax Brown.jpeg' },
                { colorName: 'Grey', colorCode: '#808080', price: 1300, stock: 5, image: 'products/Set/Sets Savax Grey.jpeg' }
            ]
        };

        const productColors = colors[productName] || [];
        for (const color of productColors) {
            await this.run(
                'INSERT INTO product_colors (productId, colorName, colorCode, price, stock, image) VALUES (?, ?, ?, ?, ?, ?)',
                [productId, color.colorName, color.colorCode, color.price, color.stock, color.image]
            );
        }
    }

    getDatabase() {
        return this.db;
    }
}

// Export for use in main application
module.exports = SQLiteDatabase;
