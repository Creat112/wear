# 🚀 Deploy SAVX Store to Replit

This guide will help you deploy your SAVX fashion store to Replit with full functionality.

## 📋 Prerequisites

- A Replit account (free tier works)
- Your GitHub repository with the SAVX store code

## 🛠️ Step-by-Step Deployment

### 1. Create a New Replit

1. Go to [replit.com](https://replit.com)
2. Click **"Create Repl"**
3. Choose **"Import from GitHub"**
4. Enter your repository URL: `https://github.com/Creat112/fashion-store.git`
5. Give it a name (e.g., "savx-store")
6. Click **"Import Repl"**

### 2. Configure the Replit

The `.replit` file is already included in your repository, but verify these settings:

```toml
[entrypoint]
main = "backend/server.js"

[packager]
language = "nodejs"

[deployment]
run = ["npm", "start"]
build = ["npm", "install"]
```

### 3. Set Environment Variables

1. Click the **"Secrets"** tab (lock icon) in the left sidebar
2. Add these environment variables:

#### Required for Basic Functionality:
```bash
NODE_ENV=production
PORT=3000
```

#### For Payment Gateways (Optional):
```bash
# Paymob
PAYMOB_API_KEY=your_paymob_api_key
PAYMOB_INTEGRATION_ID=your_integration_id
PAYMOB_IFRAME_ID=your_iframe_id

# Stripe
STRIPE_PUBLISHABLE_KEY=pk_test_your_key
STRIPE_SECRET_KEY=sk_test_your_key
```

#### For Email Service (Optional):
```bash
# SendGrid (Recommended)
SENDGRID_API_KEY=your_sendgrid_key
FROM_EMAIL=noreply@yourdomain.com

# Or Gmail (for testing)
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
```

### 4. Install Dependencies

The Replit will automatically install dependencies from `package.json`. If you need to manually install:

```bash
npm install
```

### 5. Start the Application

Click the **"Run"** button at the top, or the application will start automatically.

### 6. Access Your Store

Your store will be available at:
- **Main URL**: `https://your-repl-name.your-username.repl.co`
- **Admin Login**: Use the login page with `admin@savx.com` / `admin123`

## 🔧 What Works on Replit

### ✅ Fully Functional Features:
- **Database**: Automatic Replit database with persistence
- **User Authentication**: Login, registration, admin access
- **Product Catalog**: Browse products with colors and variants
- **Shopping Cart**: Add/remove items, quantity management
- **Checkout Process**: Complete order workflow
- **Order Management**: Track and manage orders
- **Tax & Shipping**: Automated calculations
- **Legal Compliance**: Privacy policy, terms, returns
- **Admin Panel**: Complete backend management

### 🌐 Replit-Specific Features:
- **Automatic HTTPS**: SSL certificate included
- **Persistent Storage**: Data survives repl restarts
- **Zero Configuration**: Database setup is automatic
- **Free Hosting**: No server costs

## 🎯 Admin Credentials

- **Email**: `admin@savx.com`
- **Password**: `admin123`

## 📱 Mobile Responsiveness

Your store is fully responsive and works on:
- Desktop computers
- Tablets
- Mobile phones

## 🔍 Testing Your Deployment

1. **Basic Test**: Visit the main URL and browse products
2. **Login Test**: Use admin credentials to access admin panel
3. **Cart Test**: Add products to cart and proceed to checkout
4. **Order Test**: Create a test order (use test payment mode)

## 🚀 Production Considerations

### For Real Store Usage:
1. **Configure Payment Gateways**: Add your Paymob/Stripe keys
2. **Set Up Email**: Configure SendGrid for order notifications
3. **Custom Domain**: Upgrade to Replit paid plan for custom domain
4. **Monitor Usage**: Check Replit's usage limits and billing

### Security Notes:
- Change admin password in production
- Use HTTPS (automatic on Replit)
- Configure proper CORS settings
- Set up proper email authentication

## 🐛 Troubleshooting

### Common Issues:

#### "Database connection failed"
- **Solution**: The Replit database automatically initializes. Wait a few seconds and refresh.

#### "Login not working"
- **Solution**: Use the exact credentials: `admin@savx.com` / `admin123`

#### "Products not showing"
- **Solution**: Check the console for errors, the database should auto-seed products

#### "Payment gateway errors"
- **Solution**: Add your payment gateway API keys to Secrets

#### "Email not sending"
- **Solution**: Configure SendGrid or Gmail credentials in Secrets

### Getting Help:
1. Check the Replit console for error messages
2. Verify all environment variables are set correctly
3. Make sure the repository is fully imported
4. Check that all dependencies installed successfully

## 📈 Scaling Your Store

### Replit Limitations:
- **Free Tier**: Limited resources, suitable for small stores
- **Paid Plans**: More resources, custom domains, better performance

### For High Traffic:
Consider migrating to a dedicated server or cloud platform with the production scripts provided.

## 🎉 Success!

Your SAVX fashion store is now live on Replit! You can:
- Share the URL with customers
- Process orders (with payment gateway setup)
- Manage products through the admin panel
- Track orders and customer data

**Your store is ready for business!** 🛍️✨
