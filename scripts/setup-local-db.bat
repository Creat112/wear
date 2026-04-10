@echo off
echo Setting up local MySQL database for SAVX Store...
echo.

echo 1. Checking if MySQL is installed...
mysql --version >nul 2>&1
if %errorlevel% neq 0 (
    echo MySQL is not installed!
    echo Please download and install MySQL from: https://dev.mysql.com/downloads/mysql/
    echo Choose "MySQL Community Server" during installation
    echo.
    pause
    exit /b 1
)

echo 2. Starting MySQL service...
net start mysql80 >nul 2>&1
if %errorlevel% neq 0 (
    echo MySQL service not found. Trying 'mysql' service name...
    net start mysql >nul 2>&1
    if %errorlevel% neq 0 (
        echo Failed to start MySQL service. Please start it manually.
        echo Check Windows Services for MySQL service.
        pause
        exit /b 1
    )
)

echo 3. Creating database and user...
mysql -u root -e "
CREATE DATABASE IF NOT EXISTS savx_store CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'savx_user'@'localhost' IDENTIFIED BY 'savx_password_123';
GRANT ALL PRIVILEGES ON savx_store.* TO 'savx_user'@'localhost';
FLUSH PRIVILEGES;
"

if %errorlevel% neq 0 (
    echo Database setup failed. Please check MySQL installation.
    pause
    exit /b 1
)

echo 4. Creating .env file for local development...
echo # Local Development Database Configuration > .env
echo DB_HOST=127.0.0.1 >> .env
echo DB_USER=savx_user >> .env
echo DB_PASSWORD=savx_password_123 >> .env
echo DB_NAME=savx_store >> .env
echo DB_PORT=3306 >> .env
echo. >> .env
echo # Payment Configuration (test mode) >> .env
echo STRIPE_PUBLISHABLE_KEY=pk_test_your_key_here >> .env
echo STRIPE_SECRET_KEY=sk_test_your_key_here >> .env
echo. >> .env
echo # Email Configuration >> .env
echo EMAIL_USER=your-email@gmail.com >> .env
echo EMAIL_PASS=your-app-password >> .env

echo.
echo ✅ Local database setup complete!
echo.
echo Database: savx_store
echo User: savx_user
echo Password: savx_password_123
echo.
echo The .env file has been created with local MySQL settings.
echo You can now start the server with: npm start
echo.
pause
