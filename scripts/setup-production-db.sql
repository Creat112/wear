-- Production Database Setup for SAVX Store
-- Run this script to create secure production database

-- Create database if it doesn't exist
CREATE DATABASE IF NOT EXISTS savx_store_prod CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create dedicated database user with limited privileges
CREATE USER IF NOT EXISTS 'savx_user'@'%' IDENTIFIED BY 'CHANGE_THIS_STRONG_PASSWORD_123!';

-- Grant necessary permissions to the user
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX ON savx_store_prod.* TO 'savx_user'@'%';

-- Grant permissions on existing tables
GRANT ALL PRIVILEGES ON savx_store_prod.* TO 'savx_user'@'%';

-- Flush privileges to apply changes
FLUSH PRIVILEGES;

-- Switch to the production database
USE savx_store_prod;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_disabled ON products(disabled);
CREATE INDEX IF NOT EXISTS idx_cart_userid ON cart(userId);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(date);
CREATE INDEX IF NOT EXISTS idx_order_items_orderid ON order_items(orderId);
CREATE INDEX IF NOT EXISTS idx_product_colors_productid ON product_colors(productId);
CREATE INDEX IF NOT EXISTS idx_discount_codes_code ON discount_codes(code);
CREATE INDEX IF NOT EXISTS idx_discount_codes_active ON discount_codes(active);

-- Create view for order statistics
CREATE OR REPLACE VIEW order_stats AS
SELECT 
    DATE(date) as order_date,
    COUNT(*) as total_orders,
    SUM(total) as total_revenue,
    AVG(total) as avg_order_value,
    status
FROM orders 
GROUP BY DATE(date), status;

-- Create view for product performance
CREATE OR REPLACE VIEW product_performance AS
SELECT 
    p.id,
    p.name,
    p.category,
    p.price,
    p.stock,
    COUNT(oi.id) as times_sold,
    COALESCE(SUM(oi.quantity), 0) as total_quantity_sold,
    COALESCE(SUM(oi.price * oi.quantity), 0) as total_revenue
FROM products p
LEFT JOIN order_items oi ON p.id = oi.productId
GROUP BY p.id, p.name, p.category, p.price, p.stock;

-- Show database information
SELECT 
    database() as current_database,
    user() as current_user,
    version() as mysql_version;

-- Show table information
SELECT 
    table_name,
    table_rows,
    data_length,
    index_length,
    (data_length + index_length) as total_size
FROM information_schema.tables 
WHERE table_schema = 'savx_store_prod'
ORDER BY total_size DESC;
