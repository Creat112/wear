#!/bin/bash

# Production Deployment Script for SAVX Store
# This script handles complete production deployment

set -e

# Configuration
DOMAIN="yourdomain.com"
DEPLOY_USER="deploy"
DEPLOY_PATH="/var/www/website"
BACKUP_PATH="/var/backups/savx-store"
NGINX_CONFIG="/etc/nginx/sites-available/savx-store"

echo "Starting production deployment for SAVX Store..."

# Create backup
echo "Creating backup..."
sudo mkdir -p $BACKUP_PATH
sudo tar -czf "$BACKUP_PATH/backup-$(date +%Y%m%d-%H%M%S).tar.gz" -C $DEPLOY_PATH .

# Update application code
echo "Updating application code..."
sudo mkdir -p $DEPLOY_PATH
sudo cp -r . $DEPLOY_PATH/
sudo chown -R $DEPLOY_USER:$DEPLOY_USER $DEPLOY_PATH

# Install dependencies
echo "Installing dependencies..."
cd $DEPLOY_PATH
sudo -u $DEPLOY_USER npm ci --production

# Setup database
echo "Setting up production database..."
if [ "$1" = "--setup-db" ]; then
    mysql -u root -p < scripts/setup-production-db.sql
fi

# Setup SSL
echo "Setting up SSL certificate..."
if [ "$1" = "--setup-ssl" ]; then
    sudo bash scripts/setup-ssl.sh
fi

# Configure Nginx
echo "Configuring Nginx..."
sudo cp nginx.conf /etc/nginx/sites-available/savx-store
sudo ln -sf /etc/nginx/sites-available/savx-store /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Setup environment variables
echo "Configuring environment variables..."
if [ ! -f .env ]; then
    sudo -u $DEPLOY_USER cp .env.example .env
    echo "Please update .env with your production credentials!"
fi

# Setup PM2 for process management
echo "Setting up PM2..."
if ! command -v pm2 &> /dev/null; then
    sudo npm install -g pm2
fi

# Create PM2 ecosystem file
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'savx-store',
    script: 'backend/server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: '/var/log/savx-store/error.log',
    out_file: '/var/log/savx-store/out.log',
    log_file: '/var/log/savx-store/combined.log',
    time: true,
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=1024'
  }]
};
EOF

# Setup log directories
sudo mkdir -p /var/log/savx-store
sudo chown $DEPLOY_USER:$DEPLOY_USER /var/log/savx-store

# Start/restart application
echo "Starting application..."
sudo -u $DEPLOY_USER pm2 restart ecosystem.config.js || sudo -u $DEPLOY_USER pm2 start ecosystem.config.js
sudo -u $DEPLOY_USER pm2 save
sudo -u $DEPLOY_USER pm2 startup

# Setup log rotation
echo "Setting up log rotation..."
sudo tee /etc/logrotate.d/savx-store > /dev/null << EOF
/var/log/savx-store/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 $DEPLOY_USER $DEPLOY_USER
    postrotate
        pm2 reloadLogs
    endscript
}
EOF

# Setup monitoring
echo "Setting up monitoring..."
sudo tee /etc/cron.d/savx-store-monitoring > /dev/null << EOF
# SAVX Store monitoring
*/5 * * * * $DEPLOY_USER cd $DEPLOY_PATH && pm2 list > /dev/null 2>&1 || pm2 restart ecosystem.config.js
0 2 * * * $DEPLOY_USER cd $DEPLOY_PATH && npm run backup-database
0 3 * * 0 $DEPLOY_USER cd $DEPLOY_PATH && npm run cleanup-logs
EOF

# Health check
echo "Performing health check..."
sleep 5
if curl -f -s http://localhost:3000/api/health > /dev/null; then
    echo "Health check passed!"
else
    echo "Health check failed - rolling back..."
    sudo tar -xzf "$BACKUP_PATH/backup-$(date +%Y%m%d-%H%M%S).tar.gz" -C $DEPLOY_PATH
    sudo -u $DEPLOY_USER pm2 restart ecosystem.config.js
    exit 1
fi

echo "Deployment completed successfully!"
echo ""
echo "Application URL: https://$DOMAIN"
echo "Admin URL: https://$DOMAIN/admin.html"
echo "API Health: https://$DOMAIN/api/health"
echo ""
echo "Post-deployment checklist:"
echo "1. Update .env with production credentials"
echo "2. Configure payment gateways (Paymob/Stripe)"
echo "3. Test email functionality"
echo "4. Verify SSL certificate"
echo "5. Test checkout process"
echo "6. Monitor application logs: pm2 logs savx-store"
