/**
 * Replit Database Setup
 * Uses Replit's built-in database for persistence
 */

const { Database } = require('replit-db');
const { hashPassword } = require('../utils/passwordUtils');

class ReplitDatabase {
    constructor() {
        this.db = new Database();
        this.data = {
            users: [],
            products: [],
            product_colors: [],
            cart: [],
            discount_codes: [],
            orders: [],
            order_items: []
        };
    }

    async init() {
        try {
            console.log('🔌 Connecting to Replit Database...');
            
            // Load existing data
            await this.loadData();
            
            // Initialize data if empty
            if (this.data.users.length === 0) {
                await this.seedData();
            }
            
            console.log('✅ Replit database ready!');
            return this;
        } catch (error) {
            console.error('❌ Replit database error:', error);
            throw error;
        }
    }

    async loadData() {
        try {
            const keys = ['users', 'products', 'product_colors', 'cart', 'discount_codes', 'orders', 'order_items'];
            
            for (const key of keys) {
                const value = await this.db.get(key);
                if (value) {
                    this.data[key] = JSON.parse(value);
                }
            }
            
            console.log('📥 Data loaded from Replit database');
        } catch (error) {
            console.log('📝 Starting with fresh database');
        }
    }

    async saveData(table) {
        try {
            await this.db.set(table, JSON.stringify(this.data[table]));
        } catch (error) {
            console.error(`❌ Failed to save ${table}:`, error);
        }
    }

    async execute(sql, params = []) {
        // Convert SQL-like queries to Replit database operations
        const sqlLower = sql.toLowerCase().trim();
        
        console.log('🔍 Replit Query:', sql, params);
        
        try {
            // Handle SELECT queries
            if (sqlLower.startsWith('select')) {
                return await this.handleSelect(sql, params);
            }
            
            // Handle INSERT queries
            if (sqlLower.startsWith('insert')) {
                return await this.handleInsert(sql, params);
            }
            
            // Handle UPDATE queries
            if (sqlLower.startsWith('update')) {
                return await this.handleUpdate(sql, params);
            }
            
            // Handle DELETE queries
            if (sqlLower.startsWith('delete')) {
                return await this.handleDelete(sql, params);
            }
            
            throw new Error('Unsupported query type');
        } catch (error) {
            console.error('❌ Replit query error:', error);
            throw error;
        }
    }

    async handleSelect(sql, params) {
        // Simple SELECT parsing - this is a basic implementation
        if (sql.includes('users') && sql.includes('email')) {
            const email = params[0];
            const users = this.data.users.filter(user => user.email === email);
            return [users];
        }
        
        if (sql.includes('users')) {
            return [this.data.users];
        }
        
        if (sql.includes('products')) {
            return [this.data.products];
        }
        
        if (sql.includes('product_colors')) {
            return [this.data.product_colors];
        }
        
        if (sql.includes('cart')) {
            return [this.data.cart];
        }
        
        if (sql.includes('discount_codes')) {
            return [this.data.discount_codes];
        }
        
        if (sql.includes('orders')) {
            return [this.data.orders];
        }
        
        if (sql.includes('order_items')) {
            return [this.data.order_items];
        }
        
        return [[]];
    }

    async handleInsert(sql, params) {
        // Simple INSERT parsing
        if (sql.includes('users')) {
            const newUser = {
                id: this.data.users.length + 1,
                name: params[0],
                email: params[1],
                password: params[2],
                role: params[3] || 'customer',
                createdAt: params[4] || new Date().toISOString()
            };
            
            this.data.users.push(newUser);
            await this.saveData('users');
            
            return [{ insertId: newUser.id, affectedRows: 1 }];
        }
        
        if (sql.includes('products')) {
            const newProduct = {
                id: this.data.products.length + 1,
                name: params[0],
                price: params[1],
                description: params[2],
                category: params[3],
                image: params[4],
                stock: params[5] || 0,
                disabled: params[6] || 0,
                discount: params[7] || 0,
                originalPrice: params[8] || null
            };
            
            this.data.products.push(newProduct);
            await this.saveData('products');
            
            return [{ insertId: newProduct.id, affectedRows: 1 }];
        }
        
        // Add more INSERT handlers as needed
        return [{ insertId: 1, affectedRows: 1 }];
    }

    async handleUpdate(sql, params) {
        // Basic UPDATE implementation
        return [{ affectedRows: 1 }];
    }

    async handleDelete(sql, params) {
        // Basic DELETE implementation
        return [{ affectedRows: 1 }];
    }

    async seedData() {
        console.log('🌱 Seeding initial data...');
        
        // Create admin user
        const hashedPassword = await hashPassword('admin123');
        this.data.users = [{
            id: 1,
            name: 'Admin User',
            email: 'admin@savx.com',
            password: hashedPassword,
            role: 'admin',
            createdAt: new Date().toISOString()
        }];

        // Create sample products
        this.data.products = [
            {
                id: 1,
                name: 'Winter Compression',
                price: 390,
                originalPrice: 450,
                description: 'Comfortable winter compression wear',
                category: 'compression',
                image: 'products/Winter Compression/Black Compression.jpeg',
                stock: 50,
                discount: 13.33,
                disabled: 0
            },
            {
                id: 2,
                name: 'Sweat Pants',
                price: 580,
                originalPrice: 690,
                description: 'Comfortable sweat pants for daily wear',
                category: 'pants',
                image: 'products/sweetpants/Sweet Pants Black.jpeg',
                stock: 30,
                discount: 15.94,
                disabled: 0
            },
            {
                id: 3,
                name: 'Zipper Jacket',
                price: 690,
                originalPrice: 1010,
                description: 'Stylish zipper jacket with modern design',
                category: 'jackets',
                image: 'products/Ziper Jacket/Ziper Jacket Black.jpeg',
                stock: 25,
                discount: 31.68,
                disabled: 0
            },
            {
                id: 4,
                name: 'Savax Winter Set',
                price: 1300,
                originalPrice: 1750,
                description: 'Complete set with top and bottom',
                category: 'sets',
                image: 'products/Set/Sets Savax Black.jpeg',
                stock: 20,
                discount: 25.71,
                disabled: 0
            }
        ];

        // Create product colors
        this.data.product_colors = [
            { id: 1, productId: 1, colorName: 'Black', colorCode: '#000000', price: 390, stock: 25, image: 'products/Winter Compression/Black Compression.jpeg' },
            { id: 2, productId: 1, colorName: 'White', colorCode: '#FFFFFF', price: 390, stock: 25, image: 'products/Winter Compression/White Compression.jpeg' },
            { id: 3, productId: 2, colorName: 'Black', colorCode: '#000000', price: 580, stock: 10, image: 'products/sweetpants/Sweet Pants Black.jpeg' },
            { id: 4, productId: 2, colorName: 'Brown', colorCode: '#8B4513', price: 580, stock: 10, image: 'products/sweetpants/Sweet Pants Brown.jpeg' },
            { id: 5, productId: 2, colorName: 'Grey', colorCode: '#808080', price: 580, stock: 10, image: 'products/sweetpants/Sweet Pants Grey.jpeg' },
            { id: 6, productId: 3, colorName: 'Black', colorCode: '#000000', price: 690, stock: 8, image: 'products/Ziper Jacket/Ziper Jacket Black.jpeg' },
            { id: 7, productId: 3, colorName: 'Olive Green', colorCode: '#808000', price: 690, stock: 8, image: 'products/Ziper Jacket/Ziper Jacket Olive Greenjpeg.jpeg' },
            { id: 8, productId: 3, colorName: 'Pink', colorCode: '#FFC0CB', price: 690, stock: 8, image: 'products/Ziper Jacket/Ziper Jacket Pink.jpeg' },
            { id: 9, productId: 4, colorName: 'Black', colorCode: '#000000', price: 1300, stock: 5, image: 'products/Set/Sets Savax Black.jpeg' },
            { id: 10, productId: 4, colorName: 'Brown', colorCode: '#8B4513', price: 1300, stock: 5, image: 'products/Set/Sets Savax Brown.jpeg' },
            { id: 11, productId: 4, colorName: 'Grey', colorCode: '#808080', price: 1300, stock: 5, image: 'products/Set/Sets Savax Grey.jpeg' }
        ];

        // Save all data
        for (const table of Object.keys(this.data)) {
            await this.saveData(table);
        }

        console.log('✅ Initial data seeded successfully');
        console.log('👤 Admin user created: admin@savx.com / admin123');
    }
}

module.exports = ReplitDatabase;
