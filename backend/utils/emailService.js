/**
 * Email Service Configuration
 * Supports both SendGrid and fallback SMTP
 */

const nodemailer = require('nodemailer');

// Email configuration
const EMAIL_CONFIG = {
    // SendGrid (recommended for production)
    sendgrid: {
        apiKey: process.env.SENDGRID_API_KEY,
        fromEmail: process.env.FROM_EMAIL || 'noreply@savx.com',
        fromName: 'SAVX Store'
    },
    
    // Fallback SMTP (for development/testing)
    smtp: {
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: process.env.SMTP_PORT || 587,
        secure: false, // true for 465, false for other ports
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    }
};

/**
 * Determine which email service to use
 */
function getEmailService() {
    // Prefer SendGrid in production
    if (process.env.NODE_ENV === 'production' && EMAIL_CONFIG.sendgrid.apiKey) {
        return 'sendgrid';
    }
    
    // Fallback to SMTP
    if (EMAIL_CONFIG.smtp.auth.user && EMAIL_CONFIG.smtp.auth.pass) {
        return 'smtp';
    }
    
    // No email service configured
    return null;
}

/**
 * Send email using SendGrid
 */
async function sendSendgridEmail(to, subject, htmlContent, textContent) {
    const sgMail = require('@sendgrid/mail');
    sgMail.setApiKey(EMAIL_CONFIG.sendgrid.apiKey);
    
    const msg = {
        to: to,
        from: {
            email: EMAIL_CONFIG.sendgrid.fromEmail,
            name: EMAIL_CONFIG.sendgrid.fromName
        },
        subject: subject,
        text: textContent || htmlContent.replace(/<[^>]*>/g, ''),
        html: htmlContent
    };
    
    try {
        await sgMail.send(msg);
        console.log(`SendGrid email sent to ${to}`);
        return { success: true, service: 'sendgrid' };
    } catch (error) {
        console.error('SendGrid error:', error);
        throw error;
    }
}

/**
 * Send email using SMTP (Nodemailer)
 */
async function sendSMTPEmail(to, subject, htmlContent, textContent) {
    const transporter = nodemailer.createTransporter(EMAIL_CONFIG.smtp);
    
    const mailOptions = {
        from: `"${EMAIL_CONFIG.sendgrid.fromName}" <${EMAIL_CONFIG.smtp.auth.user}>`,
        to: to,
        subject: subject,
        text: textContent || htmlContent.replace(/<[^>]*>/g, ''),
        html: htmlContent
    };
    
    try {
        await transporter.sendMail(mailOptions);
        console.log(`SMTP email sent to ${to}`);
        return { success: true, service: 'smtp' };
    } catch (error) {
        console.error('SMTP error:', error);
        throw error;
    }
}

/**
 * Send email using available service
 */
async function sendEmail(to, subject, htmlContent, textContent) {
    const service = getEmailService();
    
    if (!service) {
        console.warn('No email service configured. Email logging only.');
        console.log(`EMAIL TO: ${to}`);
        console.log(`SUBJECT: ${subject}`);
        console.log(`CONTENT: ${textContent || htmlContent}`);
        return { success: true, service: 'log', message: 'Email logged only' };
    }
    
    try {
        if (service === 'sendgrid') {
            return await sendSendgridEmail(to, subject, htmlContent, textContent);
        } else if (service === 'smtp') {
            return await sendSMTPEmail(to, subject, htmlContent, textContent);
        }
    } catch (error) {
        console.error(`Email send failed with ${service}:`, error);
        
        // Try fallback service if available
        if (service === 'sendgrid' && EMAIL_CONFIG.smtp.auth.user) {
            console.log('Falling back to SMTP...');
            return await sendSMTPEmail(to, subject, htmlContent, textContent);
        }
        
        throw error;
    }
}

/**
 * Send order confirmation email
 */
async function sendOrderConfirmation(customerEmail, orderData) {
    const subject = `Order Confirmation - ${orderData.orderNumber}`;
    
    const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2c3e50;">Thank you for your order!</h2>
            <p>Dear ${orderData.customerName},</p>
            <p>Your order <strong>${orderData.orderNumber}</strong> has been received and is being processed.</p>
            
            <h3>Order Details</h3>
            <table style="width: 100%; border-collapse: collapse;">
                <tr style="background: #f8f9fa;">
                    <th style="padding: 10px; text-align: left;">Product</th>
                    <th style="padding: 10px; text-align: right;">Quantity</th>
                    <th style="padding: 10px; text-align: right;">Price</th>
                </tr>
                ${orderData.items.map(item => `
                    <tr>
                        <td style="padding: 10px;">${item.productName}</td>
                        <td style="padding: 10px; text-align: right;">${item.quantity}</td>
                        <td style="padding: 10px; text-align: right;">EGP ${item.price}</td>
                    </tr>
                `).join('')}
                <tr style="border-top: 2px solid #2c3e50;">
                    <td colspan="2" style="padding: 10px;"><strong>Total</strong></td>
                    <td style="padding: 10px; text-align: right;"><strong>EGP ${orderData.total}</strong></td>
                </tr>
            </table>
            
            <h3>Shipping Information</h3>
            <p>
                ${orderData.shippingAddress}<br>
                ${orderData.shippingCity}, ${orderData.shippingGov}<br>
                Phone: ${orderData.customerPhone}
            </p>
            
            <p>You can track your order status <a href="https://savx.com/track-order.html">here</a>.</p>
            
            <p>Thank you for shopping at SAVX!</p>
            <hr>
            <p style="font-size: 12px; color: #666;">
                This is an automated message. Please do not reply to this email.
            </p>
        </div>
    `;
    
    return await sendEmail(customerEmail, subject, htmlContent);
}

/**
 * Send password reset email
 */
async function sendPasswordReset(email, resetToken) {
    const subject = 'Password Reset - SAVX Store';
    const resetUrl = `https://savx.com/reset-password.html?token=${resetToken}`;
    
    const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2c3e50;">Password Reset Request</h2>
            <p>You requested to reset your password for your SAVX Store account.</p>
            <p>Click the link below to reset your password:</p>
            <p><a href="${resetUrl}" style="background: #2c3e50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">Reset Password</a></p>
            <p>This link will expire in 1 hour.</p>
            <p>If you didn't request this, please ignore this email.</p>
            <hr>
            <p style="font-size: 12px; color: #666;">
                This is an automated message. Please do not reply to this email.
            </p>
        </div>
    `;
    
    return await sendEmail(email, subject, htmlContent);
}

module.exports = {
    sendEmail,
    sendOrderConfirmation,
    sendPasswordReset,
    getEmailService,
    EMAIL_CONFIG
};
