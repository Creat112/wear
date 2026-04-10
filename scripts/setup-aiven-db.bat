@echo off
echo 🔧 Setting up Aiven Database for SAVX Store
echo ==========================================
echo.

REM Check if ca.pem exists
if not exist "ca.pem" (
    echo ❌ ca.pem file not found!
    echo.
    echo To get your Aiven CA certificate:
    echo 1. Go to your Aiven service page
    echo 2. Click 'Overview' tab
    echo 3. Find 'CA Certificate' section
    echo 4. Download and save as 'ca.pem' in project root
    echo.
    echo Without ca.pem, SSL connection will fail.
    pause
    exit /b 1
)

echo ✅ ca.pem certificate found
echo.

REM Create .env template for Aiven
echo 📝 Creating .env file for Aiven configuration...
echo # Aiven Database Configuration > .env
echo DB_HOST=your-aiven-host.aivencloud.com >> .env
echo DB_USER=avnadmin >> .env
echo DB_PASSWORD=your-aiven-password >> .env
echo DB_NAME=defaultdb >> .env
echo DB_PORT=25060 >> .env
echo. >> .env
echo # Payment Configuration (test mode) >> .env
echo STRIPE_PUBLISHABLE_KEY=pk_test_your_key_here >> .env
echo STRIPE_SECRET_KEY=sk_test_your_key_here >> .env
echo. >> .env
echo # Paymob Configuration (Egypt) >> .env
echo PAYMOB_API_KEY=your_paymob_api_key >> .env
echo PAYMOB_INTEGRATION_ID=your_integration_id >> .env
echo PAYMOB_IFRAME_ID=your_iframe_id >> .env
echo. >> .env
echo # Email Configuration >> .env
echo SENDGRID_API_KEY=your_sendgrid_key >> .env
echo FROM_EMAIL=noreply@yourdomain.com >> .env
echo. >> .env
echo # Application Settings >> .env
echo NODE_ENV=production >> .env
echo PORT=3000 >> .env

echo.
echo ✅ .env template created!
echo.
echo 🔧 Next Steps:
echo 1. Edit .env file with your Aiven credentials:
echo    - DB_HOST: Your Aiven service URI
echo    - DB_PASSWORD: Your Aiven password
echo    - DB_NAME: Your database name (defaultdb or custom)
echo.
echo 2. Configure payment gateways (optional):
echo    - Add your Paymob keys for Egyptian payments
echo    - Add Stripe keys for international payments
echo.
echo 3. Setup email service (optional):
echo    - Add SendGrid API key for order notifications
echo.
echo 4. Test the connection:
echo    - Run: npm start
echo    - Look for 'Connected to remote cloud database' message
echo.
echo 📋 Your Aiven Connection Details:
echo    - Host: Usually ends with .aivencloud.com
echo    - Port: Usually 25060 for MySQL
echo    - User: Usually avnadmin
echo    - SSL: Enabled (using ca.pem)
echo.
echo 🚀 Once configured, your store will use Aiven for production data!
echo.
pause
