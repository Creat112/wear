"# SAVX Fashion Store

A modern e-commerce platform for fashion retail with complete payment integration, tax calculations, and shipping management.

## Features

- **Product Management**: Catalog with variants, colors, and inventory tracking
- **Shopping Cart & Checkout**: Full e-commerce workflow with multiple payment options
- **Payment Integration**: Paymob and Stripe support
- **Tax & Shipping**: Automated calculations for Egyptian market
- **Order Management**: Complete order tracking and fulfillment
- **User Authentication**: Secure customer and admin accounts
- **Email Notifications**: Order confirmations and status updates
- **Legal Compliance**: Privacy policy, terms, and return policy
- **Responsive Design**: Mobile-first approach

## Quick Start

### Prerequisites

- Node.js 18+ 
- MySQL 8.0+
- npm or yarn

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/Creat112/fashion-store.git
cd fashion-store
```

2. **Install dependencies**
```bash
npm install
cd backend && npm install
```

3. **Configure environment**
```bash
cp .env.example .env
# Edit .env with your credentials
```

4. **Setup database**
```bash
mysql -u root -p < scripts/setup-production-db.sql
```

5. **Start development server**
```bash
npm start
```

Visit http://localhost:3000 to access the store.

## Environment Configuration

Copy `.env.example` to `.env` and configure:

```bash
# Database
DB_HOST=127.0.0.1
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=savx_store

# Payment Gateways
PAYMOB_API_KEY=your_paymob_key
PAYMOB_INTEGRATION_ID=your_integration_id
PAYMOB_IFRAME_ID=your_iframe_id

STRIPE_PUBLISHABLE_KEY=pk_test_your_key
STRIPE_SECRET_KEY=sk_test_your_key

# Email Service
SENDGRID_API_KEY=your_sendgrid_key
FROM_EMAIL=noreply@yourdomain.com
```

## Production Deployment

### Automated Deployment

Use the provided deployment script:

```bash
# Complete deployment with SSL and database setup
sudo bash scripts/deploy-production.sh --setup-db --setup-ssl

# Application update only
sudo bash scripts/deploy-production.sh
```

### Manual Deployment

1. **Setup SSL Certificate**
```bash
sudo bash scripts/setup-ssl.sh
```

2. **Configure Nginx**
```bash
sudo cp nginx.conf /etc/nginx/sites-available/savx-store
sudo ln -s /etc/nginx/sites-available/savx-store /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

3. **Setup Process Management**
```bash
npm install -g pm2
pm2 start ecosystem.config.js
pm2 startup && pm2 save
```

## API Documentation

### Health Checks
- `GET /api/health` - Complete system health
- `GET /api/health/ready` - Readiness probe
- `GET /api/health/live` - Liveness probe

### Business Rules
- `POST /api/business-rules/calculate-total` - Calculate order total with tax/shipping
- `GET /api/business-rules/governorates` - Get supported shipping regions
- `POST /api/business-rules/calculate-tax` - Calculate tax amount
- `POST /api/business-rules/calculate-shipping` - Calculate shipping cost

### Products
- `GET /api/products` - List all products
- `GET /api/products/:id` - Get product details
- `GET /api/products/:id/colors` - Get product color variants

### Orders
- `POST /api/orders` - Create new order
- `GET /api/orders/:id` - Get order details
- `POST /api/orders/phone-search` - Search by phone number

## Payment Configuration

### Paymob Setup
1. Create account at [Paymob](https://paymob.com)
2. Get API keys from dashboard
3. Configure integration ID and iframe ID
4. Update `.env` with credentials

### Stripe Setup
1. Create account at [Stripe](https://stripe.com)
2. Get API keys from dashboard
3. Update `.env` with credentials

## Email Service

### SendGrid (Recommended)
```bash
# Install SendGrid
npm install @sendgrid/mail

# Setup script
bash scripts/setup-sendgrid.sh
```

### SMTP Fallback
Configure Gmail or other SMTP in `.env`:
```bash
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
```

## Security Features

- Environment variable protection
- SQL injection prevention
- XSS protection headers
- CSRF protection
- Rate limiting
- SSL/TLS enforcement
- Secure password hashing

## Monitoring & Logging

- Application logs: `/var/log/savx-store/`
- PM2 monitoring: `pm2 monit`
- Health checks: `/api/health`
- Error tracking integrated

## Backup & Recovery

Automated backups configured:
- Database backups: Daily at 2 AM
- Log rotation: Weekly
- Application snapshots: Before deployments

## Legal Compliance

- Privacy Policy implemented
- Terms of Service included
- Return Policy configured
- GDPR considerations
- Data protection measures

## Support

- **Documentation**: Check this README and inline code comments
- **Issues**: Report bugs via GitHub Issues
- **Email**: support@savx.com

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Create Pull Request

---

**Built with Node.js, Express, MySQL, and modern web technologies.**" 
