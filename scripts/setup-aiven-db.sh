#!/bin/bash

# Aiven Database Setup for SAVX Store
# This script helps configure your Aiven database connection

echo "🔧 Setting up Aiven Database for SAVX Store"
echo "=========================================="
echo

# Check if ca.pem exists
if [ ! -f "ca.pem" ]; then
    echo "❌ ca.pem file not found!"
    echo
    echo "To get your Aiven CA certificate:"
    echo "1. Go to your Aiven service page"
    echo "2. Click 'Overview' tab"
    echo "3. Find 'CA Certificate' section"
    echo "4. Download and save as 'ca.pem' in project root"
    echo
    echo "Without ca.pem, SSL connection will fail."
    exit 1
fi

echo "✅ ca.pem certificate found"
echo

# Create .env template for Aiven
echo "📝 Creating .env file for Aiven configuration..."
cat > .env << EOF
# Aiven Database Configuration
DB_HOST=your-aiven-host.aivencloud.com
DB_USER=avnadmin
DB_PASSWORD=your-aiven-password
DB_NAME=defaultdb
DB_PORT=25060

# Payment Configuration (test mode)
STRIPE_PUBLISHABLE_KEY=pk_test_your_key_here
STRIPE_SECRET_KEY=sk_test_your_key_here

# Paymob Configuration (Egypt)
PAYMOB_API_KEY=your_paymob_api_key
PAYMOB_INTEGRATION_ID=your_integration_id
PAYMOB_IFRAME_ID=your_iframe_id

# Email Configuration
SENDGRID_API_KEY=your_sendgrid_key
FROM_EMAIL=noreply@yourdomain.com

# Application Settings
NODE_ENV=production
PORT=3000
EOF

echo
echo "✅ .env template created!"
echo
echo "🔧 Next Steps:"
echo "1. Edit .env file with your Aiven credentials:"
echo "   - DB_HOST: Your Aiven service URI"
echo "   - DB_PASSWORD: Your Aiven password"
echo "   - DB_NAME: Your database name (defaultdb or custom)"
echo
echo "2. Configure payment gateways (optional):"
echo "   - Add your Paymob keys for Egyptian payments"
echo "   - Add Stripe keys for international payments"
echo
echo "3. Setup email service (optional):"
echo "   - Add SendGrid API key for order notifications"
echo
echo "4. Test the connection:"
echo "   - Run: npm start"
echo "   - Look for 'Connected to remote cloud database' message"
echo
echo "📋 Your Aiven Connection Details:"
echo "   - Host: Usually ends with .aivencloud.com"
echo "   - Port: Usually 25060 for MySQL"
echo "   - User: Usually avnadmin"
echo "   - SSL: Enabled (using ca.pem)"
echo
echo "🚀 Once configured, your store will use Aiven for production data!"
