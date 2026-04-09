#!/bin/bash

# SendGrid Setup Script for SAVX Store
# This script installs and configures SendGrid for email services

set -e

echo "Setting up SendGrid email service..."

# Check if SendGrid API key is provided
if [ -z "$SENDGRID_API_KEY" ]; then
    echo "Error: SENDGRID_API_KEY environment variable is required"
    echo "Get your API key from: https://app.sendgrid.com/settings/api_keys"
    exit 1
fi

# Install SendGrid Node.js library
npm install @sendgrid/mail

# Update .env file with SendGrid configuration
if [ ! -f .env ]; then
    echo "Creating .env file from template..."
    cp .env.example .env
fi

# Add SendGrid configuration to .env
if ! grep -q "SENDGRID_API_KEY" .env; then
    echo "" >> .env
    echo "# SendGrid Configuration" >> .env
    echo "SENDGRID_API_KEY=$SENDGRID_API_KEY" >> .env
    echo "FROM_EMAIL=noreply@yourdomain.com" >> .env
fi

# Test SendGrid configuration
node -e "
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey('$SENDGRID_API_KEY');

const testEmail = {
    to: 'test@example.com',
    from: 'noreply@yourdomain.com',
    subject: 'SAVX Store - SendGrid Test',
    text: 'This is a test email from SAVX Store email service.',
    html: '<strong>This is a test email from SAVX Store email service.</strong>'
};

sgMail.send(testEmail)
    .then(() => console.log('SendGrid test email sent successfully!'))
    .catch(error => {
        console.error('SendGrid test failed:', error.response?.body || error.message);
        process.exit(1);
    });
"

echo "SendGrid setup completed!"
echo "Configuration added to .env file"
echo "Test email sent successfully"
echo ""
echo "Next steps:"
echo "1. Update FROM_EMAIL in .env with your domain"
echo "2. Verify your sender identity in SendGrid dashboard"
echo "3. Update email templates in backend/utils/emailService.js"
