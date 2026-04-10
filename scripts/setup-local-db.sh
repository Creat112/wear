
echo "Setting up local MySQL database for SAVX Store..."
echo

if ! command -v mysql &> /dev/null; then
    echo "❌ MySQL is not installed!"
    echo "Please install MySQL: https://dev.mysql.com/downloads/mysql/"
    echo "On macOS: brew install mysql"
    echo "On Ubuntu: sudo apt install mysql-server"
    exit 1
fi

echo "🚀 Starting MySQL service..."
if [[ "$OSTYPE" == "darwin"* ]]; then
    brew services start mysql
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    sudo systemctl start mysql
    sudo systemctl enable mysql
else
    echo "⚠️  Please start MySQL service manually"
fi

sleep 3

echo "🗄️ Creating database and user..."
mysql -u root -e "
CREATE DATABASE IF NOT EXISTS savx_store CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'savx_user'@'localhost' IDENTIFIED BY 'savx_password_123';
GRANT ALL PRIVILEGES ON savx_store.* TO 'savx_user'@'localhost';
FLUSH PRIVILEGES;
" 2>/dev/null

if [ $? -ne 0 ]; then
    echo "❌ Database setup failed. Please check MySQL installation and root password."
    echo "Try: mysql -u root -p"
    exit 1
fi

echo "📝 Creating .env file for local development..."
cat > .env << EOF
DB_HOST=127.0.0.1
DB_USER=savx_user
DB_PASSWORD=savx_password_123
DB_NAME=savx_store
DB_PORT=3306

STRIPE_PUBLISHABLE_KEY=pk_test_your_key_here
STRIPE_SECRET_KEY=sk_test_your_key_here

EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EOF

echo
echo "✅ Local database setup complete!"
echo
echo "Database: savx_store"
echo "User: savx_user"
echo "Password: savx_password_123"
echo
echo "📄 The .env file has been created with local MySQL settings."
echo "🚀 You can now start the server with: npm start"
echo
echo "💡 To connect to database directly:"
echo "   mysql -u savx_user -p savx_store"
echo "   Password: savx_password_123"
