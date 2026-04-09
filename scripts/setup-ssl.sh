#!/bin/bash

# SSL Setup Script for SAVX Store
# This script sets up Let's Encrypt SSL certificate

set -e

DOMAIN="yourdomain.com"
EMAIL="admin@yourdomain.com"
WEB_ROOT="/var/www/website"

echo "Setting up SSL for $DOMAIN..."

# Update system packages
sudo apt update

# Install Certbot and Nginx plugin
sudo apt install -y certbot python3-certbot-nginx

# Stop Nginx to allow Certbot to use port 80
sudo systemctl stop nginx

# Obtain SSL certificate
sudo certbot certonly --standalone \
    --email $EMAIL \
    --agree-tos \
    --no-eff-email \
    -d $DOMAIN \
    -d www.$DOMAIN

# Set up automatic renewal
sudo crontab -l | { cat; echo "0 12 * * * /usr/bin/certbot renew --quiet"; } | sudo crontab -

# Create SSL renewal hook
sudo tee /etc/letsencrypt/renewal-hooks/deploy/nginx-reload.sh > /dev/null <<'EOF'
#!/bin/bash
systemctl reload nginx
EOF

sudo chmod +x /etc/letsencrypt/renewal-hooks/deploy/nginx-reload.sh

# Start Nginx
sudo systemctl start nginx

# Enable Nginx auto-start
sudo systemctl enable nginx

echo "SSL setup completed!"
echo "Certificate location: /etc/letsencrypt/live/$DOMAIN/"
echo "Auto-renewal configured via cron"
echo "Test renewal: sudo certbot renew --dry-run"
