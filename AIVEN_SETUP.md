# 🌐 Aiven Database Setup for SAVX Store

This guide helps you configure your SAVX fashion store to use Aiven cloud database for production.

## 📋 Prerequisites

- Aiven account with MySQL service
- Your Aiven service URI and credentials
- CA certificate from Aiven

## 🚀 Quick Setup

### Method 1: Automated Setup Script

#### Windows:
```bash
scripts\setup-aiven-db.bat
```

#### Mac/Linux:
```bash
bash scripts/setup-aiven-db.sh
```

### Method 2: Manual Setup

1. **Download CA Certificate**
   - Go to your Aiven service page
   - Click "Overview" tab
   - Find "CA Certificate" section
   - Download and save as `ca.pem` in project root

2. **Create .env file**
   ```bash
   # Aiven Database Configuration
   DB_HOST=your-service-name.aivencloud.com
   DB_USER=avnadmin
   DB_PASSWORD=your-password
   DB_NAME=defaultdb
   DB_PORT=25060

   # Payment Configuration
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
   ```

## 🔧 Finding Your Aiven Credentials

### 1. Service URI (DB_HOST)
- Go to your Aiven service
- Look for "Service URI" 
- Format: `your-service-name.aivencloud.com`

### 2. Port (DB_PORT)
- Usually `25060` for MySQL
- Check your Aiven service details

### 3. Username (DB_USER)
- Usually `avnadmin`
- Check "Users" tab in Aiven

### 4. Password (DB_PASSWORD)
- Set in Aiven service settings
- Or found in service connection details

### 5. Database Name (DB_NAME)
- Usually `defaultdb`
- Or create custom database in Aiven

### 6. CA Certificate
- Download from service "Overview" tab
- Save as `ca.pem` in project root

## ✅ Testing Your Connection

1. **Start the application**:
   ```bash
   npm start
   ```

2. **Look for success messages**:
   ```
   🌐 Aiven cloud database detected
   🔐 SSL certificate found, enabling secure connection
   ✅ MySQL connection test successful
   ✅ Connected to the MySQL database.
   ```

3. **Test login**:
   - Visit: `http://localhost:3000`
   - Login: `admin@savx.com` / `admin123`

## 🚀 Production Deployment

### For Production Server:

1. **Copy files to production server**
2. **Run setup script** or configure .env manually
3. **Install dependencies**: `npm install`
4. **Start application**: `npm start`

### For Replit (Alternative):

1. **Add Aiven credentials to Replit Secrets**
2. **Upload ca.pem to Replit**
3. **Pull latest changes**: `git pull origin main`

## 🔒 Security Features

### SSL/TLS Connection:
- ✅ Encrypted connection to Aiven
- ✅ Certificate verification
- ✅ Secure data transmission

### Best Practices:
- 🔄 Regular password updates
- 🔐 Use strong passwords
- 📊 Monitor connection logs
- 🛡️ Enable Aiven's security features

## 🛠️ Troubleshooting

### Common Issues:

#### "ca.pem not found"
- **Solution**: Download CA certificate from Aiven and save as `ca.pem`

#### "Connection refused"
- **Solution**: Check DB_HOST, DB_PORT, and firewall settings

#### "Access denied"
- **Solution**: Verify DB_USER and DB_PASSWORD

#### "SSL handshake failed"
- **Solution**: Ensure ca.pem is valid and up-to-date

#### "Database not found"
- **Solution**: Check DB_NAME or create database in Aiven

### Debug Mode:
Add to .env:
```bash
DEBUG=mysql
```

## 📊 Monitoring

### Check Connection Status:
```bash
# Health check
curl http://localhost:3000/api/health

# Database status
curl http://localhost:3000/api/health | jq '.services.database'
```

### Monitor Logs:
```bash
# Application logs
pm2 logs savx-store

# Database connection logs
tail -f logs/app.log | grep "database"
```

## 🎯 Next Steps

1. **Configure Payment Gateways**:
   - Add Paymob keys for Egyptian payments
   - Add Stripe keys for international payments

2. **Setup Email Service**:
   - Configure SendGrid for order notifications
   - Test email templates

3. **Deploy to Production**:
   - Use production deployment scripts
   - Set up monitoring and backups

4. **Test Full Workflow**:
   - Create test orders
   - Verify payment processing
   - Test email notifications

## 📞 Support

- **Aiven Documentation**: https://docs.aiven.io/
- **SAVX Store Issues**: Check GitHub Issues
- **Database Help**: Aiven support team

---

**Your SAVX store is now ready for production with Aiven database!** 🚀✨
