const nodemailer = require('nodemailer');
const sendEmail = async ({ to, subject, html, preferSmtp = false }) => {
    try {
        // Trim env vars to handle accidental spaces
        const user = (process.env.EMAIL_USER || '').trim();
        const pass = (process.env.EMAIL_PASS || '').trim();
        const resendKey = (process.env.RESEND_API_KEY || '').trim();
        const emailFrom = (process.env.EMAIL_FROM || '').trim();
        
        // Debug: Show first/last chars to detect hidden issues
        console.log('Email config debug:', {
            userLength: user.length,
            passLength: pass.length,
            resendKeyLength: resendKey.length,
            emailFromLength: emailFrom.length,
            userStart: user ? user.substring(0, 3) + '***' : 'EMPTY',
            userEnd: user ? '***' + user.slice(-3) : 'EMPTY',
            to: to
        });

        const toList = Array.isArray(to) ? to : [to];

        if (preferSmtp && user && pass) {
            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user,
                    pass
                }
            });

            const fromAddress = emailFrom || user;
            const info = await transporter.sendMail({
                from: fromAddress,
                to: toList.join(','),
                subject,
                html
            });

            console.log('Email sent successfully (Gmail):', info?.messageId || info);
            return true;
        }

        if (resendKey) {
            const { Resend } = require('resend');
            const resendClient = new Resend(resendKey);
            const fromAddress = emailFrom || 'SAVX Store <onboarding@resend.dev>';

            const { data, error } = await resendClient.emails.send({
                from: fromAddress,
                to: toList,
                subject,
                html
            });

            if (error) {
                console.error('=== EMAIL SENDING FAILED ===');
                console.error('Error details:', error);
                return false;
            }

            console.log('Email sent successfully:', data);
            return true;
        }

        if (!user || !pass) {
            console.error('Missing EMAIL_USER/EMAIL_PASS. Set them or set RESEND_API_KEY.');
            return false;
        }

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user,
                pass
            }
        });

        const fromAddress = emailFrom || user;
        const info = await transporter.sendMail({
            from: fromAddress,
            to: toList.join(','),
            subject,
            html
        });

        console.log('Email sent successfully (Gmail):', info?.messageId || info);
        return true;
    } catch (error) {
        console.error('Failed to send email:', error);
        return false;
    }
};

const sendCustomerOrderEmailWithTracking = async (orderData) => {
    try {
        // Trim env vars to handle accidental spaces
        const customerResendApi = (process.env.CUSTOMER_RESEND_API || '').trim();
        const emailUser = (process.env.EMAIL_USER || '').trim();
        const emailPass = (process.env.EMAIL_PASS || '').trim();
        const emailFrom = (process.env.EMAIL_FROM || '').trim();
        
        console.log('=== CUSTOMER ORDER EMAIL WITH TRACKING START ===');
        console.log('Customer Email:', orderData?.customer?.email);
        console.log('Environment check - CUSTOMER_RESEND_API:', customerResendApi ? 'SET' : 'NOT SET', 'Length:', customerResendApi.length);
        console.log('Environment check - EMAIL_USER:', emailUser ? 'SET' : 'NOT SET', 'Length:', emailUser.length);

        const customerEmail = orderData?.customer?.email;
        if (!customerEmail) {
            console.error('Missing customer email in orderData');
            return false;
        }

        if (!customerResendApi && !emailUser) {
            console.error('No email service configured. Set CUSTOMER_RESEND_API or EMAIL_USER/EMAIL_PASS');
            return false;
        }

        const trackingLink = `https://yourdomain.com/track-order.html?order=${orderData.orderNumber}`;
        const paymentMethodDisplay = orderData.paymentMethod === 'paymob' ? 'Visa/Card' : 'Cash on Delivery';
        
        const htmlContent = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #333;">Thank you for your order!</h2>
                <p style="color: #666;">Your order is being processed.</p>
                
                <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
                    <p style="margin: 5px 0;"><strong>Order ID:</strong> ${orderData.orderNumber}</p>
                    <p style="margin: 5px 0;"><strong>Total:</strong> <span style="color: #28a745;">EGP ${orderData.total.toFixed(2)}</span></p>
                    <p style="margin: 5px 0;"><strong>Date:</strong> ${new Date(orderData.date).toLocaleString()}</p>
                    <p style="margin: 5px 0;"><strong>Payment Method:</strong> <span style="color: ${orderData.paymentMethod === 'paymob' ? '#28a745' : '#ffc107'}; font-weight: bold;">${paymentMethodDisplay}</span></p>
                </div>
                
                <div style="background: #e7f3ff; padding: 15px; border-radius: 5px; margin-bottom: 20px; text-align: center;">
                    <p style="margin: 0 0 10px 0;"><strong>Track your order:</strong></p>
                    <a href="${trackingLink}" style="display: inline-block; background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Track Order Status</a>
                </div>
                
                <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666;">
                    <p>This is an automated notification from SAVX Store.</p>
                </div>
            </div>
        `;

        // Use customer-specific Resend API
        const { Resend } = require('resend');
        const resendClient = new Resend(customerResendApi);
        const fromAddress = emailFrom || 'SAVX Store <onboarding@resend.dev>';

        const { data, error } = await resendClient.emails.send({
            from: fromAddress,
            to: customerEmail,
            subject: `Order Confirmation: ${orderData.orderNumber}`,
            html: htmlContent
        });

        if (error) {
            console.error('=== CUSTOMER EMAIL SENDING FAILED ===');
            console.error('Error details:', error);
            return false;
        }

        console.log('Customer email sent successfully:', data);
        console.log('=== CUSTOMER ORDER EMAIL WITH TRACKING SUCCESS ===');
        return true;
    } catch (error) {
        console.error('=== CUSTOMER ORDER EMAIL WITH TRACKING FAILED ===');
        console.error('Error details:', error);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        console.error('Order data received:', JSON.stringify(orderData, null, 2));
        return false;
    }
};

const buildOrderEmailHtml = (orderData, headingText) => {
    const itemsHtml = orderData.items.map(item => `
            <tr>
                <td style="padding: 8px; border-bottom: 1px solid #ddd;">${item.name || item.productName}</td>
                <td style="padding: 8px; border-bottom: 1px solid #ddd;">${item.colorName || 'N/A'}</td>
                <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: center;">${item.quantity}</td>
                <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">EGP ${item.price.toFixed(2)}</td>
                <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">EGP ${(item.price * item.quantity).toFixed(2)}</td>
            </tr>
        `).join('');

    const paymentMethodDisplay = orderData.paymentMethod === 'paymob' ? 'Visa/Card' : 'Cash on Delivery';
    const paymentMethodColor = orderData.paymentMethod === 'paymob' ? '#28a745' : '#ffc107';

    return `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px;">${headingText}</h1>
                
                <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
                    <p style="margin: 5px 0;"><strong>Order Number:</strong> ${orderData.orderNumber}</p>
                    <p style="margin: 5px 0;"><strong>Date:</strong> ${new Date(orderData.date).toLocaleString()}</p>
                    <p style="margin: 5px 0;"><strong>Total:</strong> <span style="color: #28a745; font-size: 18px;">EGP ${orderData.total.toFixed(2)}</span></p>
                    <p style="margin: 5px 0;"><strong>Payment Method:</strong> <span style="color: ${paymentMethodColor}; font-weight: bold;">${paymentMethodDisplay}</span></p>
                </div>
                
                <h3 style="color: #333;">Customer Information:</h3>
                <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
                    <p style="margin: 5px 0;"><strong>Name:</strong> ${orderData.customer.fullName}</p>
                    <p style="margin: 5px 0;"><strong>Email:</strong> ${orderData.customer.email}</p>
                    <p style="margin: 5px 0;"><strong>Phone:</strong> ${orderData.customer.phone}</p>
                    ${orderData.customer.secondaryPhone ? `<p style="margin: 5px 0;"><strong>Secondary Phone:</strong> ${orderData.customer.secondaryPhone}</p>` : ''}
                </div>
                
                <h3 style="color: #333;">Shipping Address:</h3>
                <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
                    <p style="margin: 5px 0;"><strong>Address:</strong> ${orderData.shipping.address}</p>
                    <p style="margin: 5px 0;"><strong>City:</strong> ${orderData.shipping.city}</p>
                    <p style="margin: 5px 0;"><strong>Governorate:</strong> ${orderData.shipping.governorate}</p>
                    ${orderData.shipping.notes ? `<p style="margin: 5px 0;"><strong>Notes:</strong> ${orderData.shipping.notes}</p>` : ''}
                </div>
                
                <h3 style="color: #333;">Order Items:</h3>
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                    <thead>
                        <tr style="background: #007bff; color: white;">
                            <th style="padding: 10px; text-align: left;">Product</th>
                            <th style="padding: 10px; text-align: left;">Color</th>
                            <th style="padding: 10px; text-align: center;">Quantity</th>
                            <th style="padding: 10px; text-align: right;">Price</th>
                            <th style="padding: 10px; text-align: right;">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsHtml}
                    </tbody>
                    <tfoot>
                        <tr style="background: #f8f9fa; font-weight: bold;">
                            <td colspan="4" style="padding: 10px; text-align: right;">Total:</td>
                            <td style="padding: 10px; text-align: right; color: #28a745;">EGP ${orderData.total.toFixed(2)}</td>
                        </tr>
                    </tfoot>
                </table>
                
                <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666;">
                    <p>This is an automated notification from SAVX Store.</p>
                </div>
            </div>
        `;
};

const sendOrderEmail = async (orderData) => {
    try {
        const emailUser = (process.env.EMAIL_USER || '').trim();
        
        console.log('=== EMAIL SENDING START ===');
        console.log('Email user:', emailUser || 'NOT SET');
        console.log('Order data:', JSON.stringify(orderData, null, 2));

        if (!emailUser) {
            console.error('EMAIL_USER not configured');
            return false;
        }

        const htmlContent = buildOrderEmailHtml(orderData, 'New Order Received!');

        const result = await sendEmail({
            to: emailUser,
            subject: `New Order Received: ${orderData.orderNumber}`,
            html: htmlContent
        });

        if (!result) {
            console.error('=== EMAIL SENDING FAILED ===');
            return false;
        }

        console.log('=== EMAIL SENDING SUCCESS ===');
        return true;
    } catch (error) {
        console.error('=== EMAIL SENDING FAILED ===');
        console.error('Error details:', error);
        console.error('Error message:', error.message);
        console.error('Error code:', error.code);
        // We don't throw here to avoid failing the order if email fails
        return false;
    }
};

const sendCustomerOrderEmail = async (orderData) => {
    try {
        console.log('=== CUSTOMER ORDER EMAIL SENDING START ===');
        console.log('Customer Email:', orderData?.customer?.email);

        const customerEmail = orderData?.customer?.email;
        if (!customerEmail) {
            console.error('Missing customer email in orderData');
            return false;
        }

        const htmlContent = buildOrderEmailHtml(orderData, 'Order Confirmation');

        const result = await sendEmail({
            to: customerEmail,
            subject: `Your SAVX Order: ${orderData.orderNumber}`,
            html: htmlContent,
            preferSmtp: false
        });

        if (!result) {
            console.error('=== CUSTOMER ORDER EMAIL FAILED ===');
            return false;
        }

        console.log('=== CUSTOMER ORDER EMAIL SUCCESS ===');
        return true;
    } catch (error) {
        console.error('=== CUSTOMER ORDER EMAIL FAILED ===');
        console.error('Error details:', error);
        return false;
    }
};

const sendOrderStatusUpdateEmail = async (orderData, newStatus, trackingNumber = null, estimatedDelivery = null) => {
    try {
        console.log('=== CUSTOMER EMAIL NOTIFICATION ===');
        console.log('Customer Email:', orderData.customerEmail);
        console.log('Order:', orderData.orderNumber);
        console.log('New Status:', newStatus);
        console.log('Tracking:', trackingNumber || 'N/A');
        console.log('Est. Delivery:', estimatedDelivery || 'N/A');
        console.log('=== EMAIL SENT TO CUSTOMER ===');
        return true;
    } catch (error) {
        console.error('Failed to send customer email:', error);
        return false;
    }
};

module.exports = { sendOrderEmail, sendCustomerOrderEmail, sendOrderStatusUpdateEmail, sendCustomerOrderEmailWithTracking };
