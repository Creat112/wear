const mysql = require('mysql2/promise');
const sqlite3 = require('sqlite3').verbose();
const { hashPassword } = require('../utils/passwordUtils');
const fs = require('fs');
const path = require('path');

let pool;
let dbEngine = 'none';

const initDB = async () => {
    const hasRemoteConfig = process.env.DB_HOST && process.env.DB_USER && process.env.DB_PASSWORD && process.env.DB_NAME;

    if (hasRemoteConfig) {
        try {
            await initMySQL();
            return;
        } catch (err) {
            console.warn(`Remote database unavailable: ${err.message}`);
            console.warn('Using local SQLite database for this Replit workspace.');
        }
    } else {
        console.warn('Remote database credentials are incomplete. Using local SQLite database for this Replit workspace.');
    }

    await initSQLite();
};

const initMySQL = async () => {
    const host = process.env.DB_HOST || '127.0.0.1';

    if (host === '127.0.0.1' || host === 'localhost') {
        console.warn('Using local MySQL database.');
    } else {
        console.log(`Connecting to remote cloud database: ${host}`);
    }

    const dbConfig = {
        host,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        port: process.env.DB_PORT || 3306
    };

    const possibleCaPaths = [
        path.join(__dirname, '../../ca.pem'),
        ...fs.readdirSync(path.join(__dirname, '../../'))
            .filter(f => f.endsWith('.pem'))
            .map(f => path.join(__dirname, '../../', f))
    ];
    const caPath = possibleCaPaths.find(p => fs.existsSync(p));
    if (caPath) {
        console.log(`Using SSL certificate: ${path.basename(caPath)}`);
        dbConfig.ssl = {
            ca: fs.readFileSync(caPath)
        };
    }

    console.log('Testing MySQL connection...');
    const testConnection = await mysql.createConnection(dbConfig);
    await testConnection.ping();
    await testConnection.end();
    console.log('MySQL connection test successful');

    const connection = await mysql.createConnection(dbConfig);
    const dbName = process.env.DB_NAME || 'savx_store';
    console.log(`Selecting database: ${dbName}`);
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\`;`);
    await connection.end();

    pool = mysql.createPool({
        ...dbConfig,
        database: dbName,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    });

    dbEngine = 'mysql';
    console.log('Connected to the MySQL database.');
    await createTables();
};

class SQLitePool {
    constructor(filePath) {
        this.db = new sqlite3.Database(filePath);
    }

    execute(sql, params = []) {
        const normalized = sql.trim().toLowerCase();
        if (normalized.startsWith('select') || normalized.startsWith('with') || normalized.startsWith('pragma')) {
            return this.all(sql, params).then(rows => [rows]);
        }
        return this.run(sql, params).then(result => [result]);
    }

    all(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) return reject(normalizeSQLiteError(err));
                resolve(rows || []);
            });
        });
    }

    run(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function(err) {
                if (err) return reject(normalizeSQLiteError(err));
                resolve({ insertId: this.lastID, affectedRows: this.changes, changes: this.changes });
            });
        });
    }

    async getConnection() {
        return new SQLiteConnection(this);
    }
}

class SQLiteConnection {
    constructor(poolInstance) {
        this.pool = poolInstance;
    }

    execute(sql, params = []) {
        return this.pool.execute(sql, params);
    }

    beginTransaction() {
        return this.pool.run('BEGIN TRANSACTION');
    }

    commit() {
        return this.pool.run('COMMIT');
    }

    rollback() {
        return this.pool.run('ROLLBACK');
    }

    release() {}
}

const normalizeSQLiteError = (err) => {
    if (err && err.code === 'SQLITE_CONSTRAINT') {
        err.code = 'ER_DUP_ENTRY';
    }
    return err;
};

const initSQLite = async () => {
    const dataDir = path.join(__dirname, '../../.data');
    fs.mkdirSync(dataDir, { recursive: true });
    const dbPath = process.env.SQLITE_PATH || path.join(dataDir, 'savx-store.sqlite');
    pool = new SQLitePool(dbPath);
    dbEngine = 'sqlite';
    console.log(`Connected to local SQLite database: ${dbPath}`);
    await createSQLiteTables();
};

const createSQLiteTables = async () => {
    await pool.execute(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            email TEXT UNIQUE,
            password TEXT,
            role TEXT DEFAULT 'customer',
            createdAt TEXT
        )
    `);

    await pool.execute(`
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

    await pool.execute(`
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

    await pool.execute(`
        CREATE TABLE IF NOT EXISTS product_sizes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            productId INTEGER,
            sizeName TEXT,
            sizeCode TEXT,
            price REAL,
            stock INTEGER DEFAULT 0,
            FOREIGN KEY(productId) REFERENCES products(id) ON DELETE CASCADE
        )
    `);

    await pool.execute(`
        CREATE TABLE IF NOT EXISTS cart (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            productId INTEGER,
            quantity INTEGER,
            userId INTEGER,
            colorId INTEGER NULL,
            sizeId INTEGER NULL,
            addedAt TEXT,
            FOREIGN KEY(productId) REFERENCES products(id) ON DELETE CASCADE,
            FOREIGN KEY(colorId) REFERENCES product_colors(id) ON DELETE SET NULL,
            FOREIGN KEY(sizeId) REFERENCES product_sizes(id) ON DELETE SET NULL
        )
    `);

    await pool.execute(`
        CREATE TABLE IF NOT EXISTS discount_codes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT UNIQUE,
            discount_type TEXT DEFAULT 'percentage',
            discount_value REAL DEFAULT 0,
            percentage REAL DEFAULT 0,
            fixed_amount REAL DEFAULT 0,
            active INTEGER DEFAULT 1,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await pool.execute(`
        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            orderNumber TEXT UNIQUE NOT NULL,
            total REAL NOT NULL,
            discount_code TEXT NULL,
            discount_amount REAL DEFAULT 0,
            status TEXT DEFAULT 'pending',
            date TEXT NOT NULL,
            customerName TEXT,
            customerEmail TEXT,
            customerPhone TEXT,
            shippingAddress TEXT,
            shippingCity TEXT,
            shippingGov TEXT,
            notes TEXT,
            payment_method TEXT DEFAULT 'cash',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            trackingNumber TEXT NULL,
            shippedDate TEXT NULL,
            estimatedDelivery TEXT NULL,
            deliveredDate TEXT NULL
        )
    `);

    await pool.execute(`
        CREATE TABLE IF NOT EXISTS order_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            orderId INTEGER,
            productId INTEGER,
            quantity INTEGER,
            price REAL,
            productName TEXT,
            colorId INTEGER NULL,
            colorName TEXT,
            sizeId INTEGER NULL,
            sizeName TEXT,
            FOREIGN KEY(orderId) REFERENCES orders(id) ON DELETE CASCADE
        )
    `);

    await pool.execute(`
        CREATE TABLE IF NOT EXISTS payment_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER,
            paymob_order_id INTEGER,
            payment_token TEXT,
            amount REAL,
            status TEXT DEFAULT 'pending',
            transaction_id TEXT,
            created_at TEXT,
            processed_at TEXT,
            FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE
        )
    `);

    await seedAdmin();
    await seedProducts();
    await seedProductColors();
};

const createTables = async () => {
    try {
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

        await pool.execute(`
            CREATE TABLE IF NOT EXISTS product_sizes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                productId INT,
                sizeName VARCHAR(100),
                sizeCode VARCHAR(50),
                price DECIMAL(10, 2),
                stock INT DEFAULT 0,
                FOREIGN KEY(productId) REFERENCES products(id) ON DELETE CASCADE
            )
        `);

        await pool.execute(`
            CREATE TABLE IF NOT EXISTS cart (
                id INT AUTO_INCREMENT PRIMARY KEY,
                productId INT,
                quantity INT,
                userId INT,
                colorId INT NULL,
                sizeId INT NULL,
                addedAt DATETIME,
                FOREIGN KEY(productId) REFERENCES products(id) ON DELETE CASCADE,
                FOREIGN KEY(colorId) REFERENCES product_colors(id) ON DELETE SET NULL,
                FOREIGN KEY(sizeId) REFERENCES product_sizes(id) ON DELETE SET NULL
            )
        `);

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

        const migrations = [
            { column: 'discount_type', sql: `ALTER TABLE discount_codes ADD COLUMN discount_type ENUM('percentage', 'fixed') DEFAULT 'percentage'` },
            { column: 'discount_value', sql: `ALTER TABLE discount_codes ADD COLUMN discount_value DECIMAL(10,2) DEFAULT 0` },
            { column: 'fixed_amount', sql: `ALTER TABLE discount_codes ADD COLUMN fixed_amount DECIMAL(10,2) DEFAULT 0` }
        ];

        for (const migration of migrations) {
            try {
                await pool.execute(migration.sql);
                console.log(`Added column: ${migration.column}`);
            } catch (migrationErr) {
                if (migrationErr.code !== 'ER_DUP_FIELDNAME' && !migrationErr.message.includes('Duplicate column')) {
                    console.log(`Migration note for ${migration.column}:`, migrationErr.message);
                }
            }
        }

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
                trackingNumber VARCHAR(255) NULL,
                shippedDate DATETIME NULL,
                estimatedDelivery DATETIME NULL,
                deliveredDate DATETIME NULL
            )
        `);

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
                sizeId INT NULL,
                sizeName VARCHAR(100),
                FOREIGN KEY(orderId) REFERENCES orders(id) ON DELETE CASCADE
            )
        `);

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
        console.error('Error creating tables:', err.message);
    }
};

const seedAdmin = async () => {
    try {
        const adminEmail = (process.env.ADMIN_EMAIL || 'admin@SAVX.com').trim();
        const adminPassword = (process.env.ADMIN_PASSWORD || 'admin123').trim();
        const adminName = (process.env.ADMIN_NAME || 'Admin User').trim();
        const hashedPassword = await hashPassword(adminPassword);

        const [configuredUsers] = await pool.execute("SELECT id FROM users WHERE email = ?", [adminEmail]);
        const configuredUser = configuredUsers[0];

        if (configuredUser) {
            await pool.execute(
                "UPDATE users SET name = ?, password = ?, role = 'admin' WHERE id = ?",
                [adminName, hashedPassword, configuredUser.id]
            );
            console.log(`Admin user synced from environment: ${adminEmail}`);
            return;
        }

        const [admins] = await pool.execute("SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1");
        const existingAdmin = admins[0];

        if (existingAdmin) {
            await pool.execute(
                "UPDATE users SET name = ?, email = ?, password = ?, role = 'admin' WHERE id = ?",
                [adminName, adminEmail, hashedPassword, existingAdmin.id]
            );
            console.log(`Existing admin user updated from environment: ${adminEmail}`);
            return;
        }

        const createdAt = new Date().toISOString().slice(0, 19).replace('T', ' ');
        await pool.execute(
            'INSERT INTO users (name, email, password, role, createdAt) VALUES (?, ?, ?, ?, ?)',
            [adminName, adminEmail, hashedPassword, 'admin', createdAt]
        );
        console.log(`Admin user seeded successfully: ${adminEmail}`);
    } catch (err) {
        console.error('Error seeding admin:', err.message);
    }
};

const seedProducts = async () => {
    try {
        const [rows] = await pool.execute('SELECT count(*) as count FROM products');
        if (rows[0].count === 0) {
            console.log('Seeding products...');
            const products = [
                { name: 'Winter Compression', price: 390, originalPrice: 450, description: 'Comfortable winter compression wear', category: 'compression', image: 'products/Winter Compression/Black Compression.jpeg', stock: 50, discount: 13.33 },
                { name: 'Sweat Pants', price: 580, originalPrice: 690, description: 'Comfortable sweat pants for daily wear', category: 'pants', image: 'products/sweetpants/Sweet Pants Black.jpeg', stock: 30, discount: 15.94 },
                { name: 'Zipper Jacket', price: 690, originalPrice: 1010, description: 'Stylish zipper jacket with modern design', category: 'jackets', image: 'products/Ziper Jacket/Ziper Jacket Black.jpeg', stock: 25, discount: 31.68 },
                { name: 'Savax Winter Set', price: 1300, originalPrice: 1750, description: 'Complete set with top and bottom', category: 'sets', image: 'products/Set/Sets Savax Black.jpeg', stock: 20, discount: 25.71 }
            ];

            for (const p of products) {
                await pool.execute(
                    'INSERT INTO products (name, price, description, category, image, stock, discount, originalPrice) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                    [p.name, p.price, p.description, p.category, p.image, p.stock, p.discount, p.originalPrice]
                );
            }
        }
    } catch (err) {
        console.error('Error seeding products:', err.message);
    }
};

const seedProductColors = async () => {
    try {
        const [rows] = await pool.execute('SELECT count(*) as count FROM product_colors');
        if (rows[0].count === 0) {
            console.log('Seeding product colors...');
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
                    'INSERT INTO product_colors (productId, colorName, colorCode, price, stock, image) VALUES (?, ?, ?, ?, ?, ?)',
                    [c.productId, c.colorName, c.colorCode, c.price, c.stock, c.image]
                );
            }
        }
    } catch (err) {
        console.error('Error seeding product colors:', err.message);
    }
};

const getDB = () => pool;
const getDBEngine = () => dbEngine;

module.exports = { initDB, getDB, getDBEngine };
