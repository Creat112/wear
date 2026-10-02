// Track Order JavaScript
import { api } from './api.js';

class OrderTracker {
    constructor() {
        this.form = document.getElementById('track-order-form');
        this.orderResult = document.getElementById('order-result');
        this.loading = document.getElementById('loading');
        this.errorMessage = document.getElementById('error-message');
        
        this.init();
    }

    init() {
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));
        this.initializeSearchToggle();
    }

    async handleSubmit(e) {
        e.preventDefault();
        
        const formData = new FormData(this.form);
        const orderId = formData.get('orderId').trim().toUpperCase();
        
        if (!orderId) {
            this.showError('Please enter an order ID');
            return;
        }
        
        this.showLoading();
        
        // Simulate API call delay
        setTimeout(() => {
            this.trackOrder(orderId);
        }, 0);
    }

    async trackOrder(orderId) {
        let timeoutId;
        try {
            // Call real API endpoint
            const controller = new AbortController();
            timeoutId = setTimeout(() => controller.abort(), 10000);
            const response = await fetch(`/api/orders/track/${orderId}`, { signal: controller.signal });
            
            // Check if response is HTML (error page) instead of JSON
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const text = await response.text();
                console.error('Server returned HTML instead of JSON:', text.substring(0, 200));
                this.showError('Server configuration error. Please contact support.');
                return;
            }
            
            if (!response.ok) {
                if (response.status === 404) {
                    this.showError(`Order with ID "${orderId}" not found. Please check your order ID and try again.`);
                } else {
                    const errorData = await response.json().catch(() => ({}));
                    this.showError(errorData.error || `Server error: ${response.status}`);
                }
                return;
            }
            
            const order = await response.json();
            this.displayOrder(order);
            
        } catch (error) {
            console.error('Order tracking error:', error);
            if (error?.name === 'AbortError') {
                this.showError('Request timed out. Please try again.');
            } else if (error.message.includes('Failed to fetch')) {
                this.showError('Unable to connect to the server. Please check your internet connection.');
            } else {
                this.showError('An unexpected error occurred. Please try again later.');
            }
        } finally {
            if (timeoutId) clearTimeout(timeoutId);
            this.hideLoading();
        }
    }

    displayOrder(order) {
        this.hideError();
        
        // Generate timeline based on order status and dates
        const timeline = this.generateTimeline(order);
        const shippingFee = Number(order.shipping?.fee || 90);
        const itemsSubtotal = Array.isArray(order.items)
            ? order.items.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity || 1)), 0)
            : Math.max(0, Number(order.total || 0) - shippingFee);
        
        const orderHTML = `
            <div class="order-header">
                <div class="order-id">Order #${order.orderNumber}</div>
                <div class="order-date">Placed on ${new Date(order.date).toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                })}</div>
            </div>
            
            <div class="order-status">
                <h3>Order Status</h3>
                <span class="status-badge status-${order.status}">${order.status}</span>
                <div class="payment-method">
                    <strong>Payment Method:</strong> 
                    <span class="payment-badge payment-${order.paymentMethod || 'cash'}">
                        ${order.paymentMethod === 'paymob' ? 'Visa/Card' : 'Cash on Delivery'}
                    </span>
                </div>
                ${order.trackingNumber ? `<p>Tracking Number: ${order.trackingNumber}</p>` : ''}
                ${order.estimatedDelivery ? `<p>Estimated Delivery: ${new Date(order.estimatedDelivery).toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                })}</p>` : ''}
            </div>
            
            <div class="order-timeline">
                <h3>Order Timeline</h3>
                ${timeline.map(item => `
                    <div class="timeline-item ${item.completed ? 'completed' : ''}">
                        <div class="timeline-icon">
                            <i class="${item.icon}"></i>
                        </div>
                        <div class="timeline-content">
                            <div class="timeline-title">${item.title}</div>
                            <div class="timeline-date">${item.date}</div>
                        </div>
                    </div>
                `).join('')}
            </div>
            
            <div class="order-items">
                <h3>Order Items</h3>
                ${order.items.map(item => `
                    <div class="order-item">
                        <img src="${item.image ? (item.image.startsWith('http') || item.image.startsWith('/') ? item.image : '/' + item.image) : 'assets/images/placeholder.jpg'}" alt="${item.name}" onerror="this.src='assets/images/placeholder.jpg'">
                        <div class="order-item-details">
                            <div class="order-item-name">${item.name}</div>
                            <div class="order-item-variant">${item.colorName ? `Color: ${item.colorName}` : ''} | Quantity: ${item.quantity}</div>
                            <div class="order-item-price"> ${item.price.toFixed(2)} EGP each</div>
                        </div>
                    </div>
                `).join('')}
            </div>
            
            <div class="order-summary">
                <div class="summary-row">
                    <span>Subtotal:</span>
                    <span>EGP ${itemsSubtotal.toFixed(2)}</span>
                </div>
                <div class="summary-row">
                    <span>Shipping:</span>
                    <span>EGP ${shippingFee.toFixed(2)}</span>
                </div>
                <div class="summary-row total">
                    <span>Total:</span>
                    <span>EGP ${order.total.toFixed(2)}</span>
                </div>
            </div>
        `;
        
        this.orderResult.innerHTML = orderHTML;
        this.orderResult.style.display = 'block';
        
        // Scroll to result
        this.orderResult.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    generateTimeline(order) {
        const timeline = [];
        const orderDate = new Date(order.date);
        
        // Order Placed
        timeline.push({
            title: 'Order Placed',
            date: orderDate.toLocaleString('en-US', { 
                month: 'long', 
                day: 'numeric', 
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }),
            completed: true,
            icon: 'ri-shopping-cart-line'
        });
        
        // Order Confirmed (assuming immediate confirmation)
        timeline.push({
            title: 'Order Confirmed',
            date: orderDate.toLocaleString('en-US', { 
                month: 'long', 
                day: 'numeric', 
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }),
            completed: true,
            icon: 'ri-check-line'
        });
        
        // Processing
        if (order.status === 'processing' || order.status === 'shipped' || order.status === 'delivered') {
            timeline.push({
                title: 'Order Processing',
                date: orderDate.toLocaleDateString('en-US', { 
                    month: 'long', 
                    day: 'numeric', 
                    year: 'numeric'
                }),
                completed: true,
                icon: 'ri-settings-3-line'
            });
        } else {
            timeline.push({
                title: 'Order Processing',
                date: 'Estimated: ' + new Date(orderDate.getTime() + 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { 
                    month: 'long', 
                    day: 'numeric', 
                    year: 'numeric'
                }),
                completed: false,
                icon: 'ri-settings-3-line'
            });
        }
        
        // Shipped
        if (order.status === 'shipped' || order.status === 'delivered') {
            const shippedDate = order.shippedDate ? new Date(order.shippedDate) : new Date(orderDate.getTime() + 48 * 60 * 60 * 1000);
            timeline.push({
                title: 'Order Shipped',
                date: shippedDate.toLocaleDateString('en-US', { 
                    month: 'long', 
                    day: 'numeric', 
                    year: 'numeric'
                }),
                completed: true,
                icon: 'ri-truck-line'
            });
        } else if (order.status === 'processing') {
            timeline.push({
                title: 'Order Shipped',
                date: 'Estimated: ' + new Date(orderDate.getTime() + 48 * 60 * 60 * 1000).toLocaleDateString('en-US', { 
                    month: 'long', 
                    day: 'numeric', 
                    year: 'numeric'
                }),
                completed: false,
                icon: 'ri-truck-line'
            });
        }
        
        // Delivered
        if (order.status === 'delivered') {
            const deliveredDate = order.deliveredDate ? new Date(order.deliveredDate) : new Date(orderDate.getTime() + 120 * 60 * 60 * 1000);
            timeline.push({
                title: 'Order Delivered',
                date: deliveredDate.toLocaleDateString('en-US', { 
                    month: 'long', 
                    day: 'numeric', 
                    year: 'numeric'
                }),
                completed: true,
                icon: 'ri-home-smile-line'
            });
        } else if (order.status === 'shipped' && order.estimatedDelivery) {
            timeline.push({
                title: 'Order Delivered',
                date: 'Estimated: ' + new Date(order.estimatedDelivery).toLocaleDateString('en-US', { 
                    month: 'long', 
                    day: 'numeric', 
                    year: 'numeric'
                }),
                completed: false,
                icon: 'ri-home-smile-line'
            });
        }
        
        return timeline;
    }

    showLoading() {
        this.loading.style.display = 'block';
        this.orderResult.style.display = 'none';
        this.hideError();
    }

    hideLoading() {
        this.loading.style.display = 'none';
    }

    showError(message) {
        this.errorMessage.innerHTML = `
            <i class="ri-error-warning-line"></i>
            <p>${message}</p>
        `;
        this.errorMessage.style.display = 'block';
        this.orderResult.style.display = 'none';
    }

    hideError() {
        this.errorMessage.style.display = 'none';
    }

    initializeSearchToggle() {
        const orderSearchBtn = document.getElementById('order-search-btn');
        const phoneSearchBtn = document.getElementById('phone-search-btn');
        const orderSearchSection = document.getElementById('order-search-section');
        const phoneSearchSection = document.getElementById('phone-search-section');
        const orderIdInput = document.getElementById('order-id');
        const phoneInput = document.getElementById('phone');
        const searchBtnText = document.getElementById('search-btn-text');
        const sectionHeader = document.querySelector('.section-header p');

        // Order search button click - switch to phone search
        orderSearchBtn.addEventListener('click', () => {
            orderSearchSection.style.display = 'none';
            phoneSearchSection.style.display = 'block';
            orderIdInput.removeAttribute('required');
            phoneInput.setAttribute('required', '');
            searchBtnText.textContent = 'Find Orders';
            sectionHeader.textContent = 'Enter your phone number to find your orders';
        });

        // Phone search button click - switch to order search
        phoneSearchBtn.addEventListener('click', () => {
            orderSearchSection.style.display = 'block';
            phoneSearchSection.style.display = 'none';
            orderIdInput.setAttribute('required', '');
            phoneInput.removeAttribute('required');
            searchBtnText.textContent = 'Track Order';
            sectionHeader.textContent = 'Enter your order ID to check the status of your purchase';
        });
    }

    async handleSubmit(e) {
        e.preventDefault();
        
        // Check which input is visible to determine search type
        const orderSearchSection = document.getElementById('order-search-section');
        const searchType = orderSearchSection.style.display !== 'none' ? 'order' : 'phone';
        
        if (searchType === 'order') {
            const orderId = document.getElementById('order-id').value.trim();
            if (!orderId) return;
            await this.trackOrder(orderId);
        } else {
            const phone = document.getElementById('phone').value.trim();
            if (!phone) return;
            await this.trackByPhone(phone);
        }
    }

    async trackByPhone(phone) {
        console.log('=== FRONTEND PHONE SEARCH DEBUG ===');
        console.log('Searching for phone:', phone);
        
        this.showLoading();
        this.hideError();

        try {
            const orders = await api.get(`/orders/phone/${encodeURIComponent(phone)}`);
            
            if (orders.length === 0) {
                this.showError(`No orders found for phone number: ${phone}`);
                return;
            }

            // Always show order list for phone search (even for single orders)
            this.displayOrderList(orders, phone);
        } catch (error) {
            console.error('Error tracking by phone:', error);
            if (error.status === 401) {
                this.showError('Please sign in to find orders associated with your phone number.');
            } else {
                this.showError('Failed to track order. Please try again.');
            }
        } finally {
            this.hideLoading();
        }
    }

    displayOrderList(orders, phone) {
        const orderListHTML = `
            <div class="order-list">
                <h3>Orders found for ${phone}</h3>
                <div class="order-numbers-list">
                    ${orders.map(order => `
                        <div class="order-number-item" onclick="window.orderTracker.copyOrderNumber('${order.orderNumber}')">
                            <span class="order-number">${order.orderNumber}</span>
                            <span class="order-status status-${order.status}">${order.status}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        
        this.orderResult.innerHTML = orderListHTML;
        this.orderResult.style.display = 'block';
    }

    copyOrderNumber(orderNumber) {
        // Copy to clipboard
        navigator.clipboard.writeText(orderNumber).then(() => {
            // Show success message
            this.showSuccessMessage(`Order number ${orderNumber} copied to clipboard!`);
        }).catch(err => {
            console.error('Failed to copy order number:', err);
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = orderNumber;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            this.showSuccessMessage(`Order number ${orderNumber} copied to clipboard!`);
        });
    }

    showSuccessMessage(message) {
        // Create temporary success message
        const successDiv = document.createElement('div');
        successDiv.className = 'success-message';
        successDiv.innerHTML = `
            <i class="ri-check-line"></i>
            <p>${message}</p>
        `;
        successDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #28a745;
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(40, 167, 69, 0.3);
            z-index: 1000;
            display: flex;
            align-items: center;
            gap: 0.5rem;
            animation: slideIn 0.3s ease;
        `;
        
        document.body.appendChild(successDiv);
        
        // Remove after 3 seconds
        setTimeout(() => {
            successDiv.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                if (successDiv.parentNode) {
                    successDiv.parentNode.removeChild(successDiv);
                }
            }, 300);
        }, 3000);
    }
}

// Initialize the tracker when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.orderTracker = new OrderTracker();
});

// Mobile menu functionality (reuse from main app)
document.getElementById('menu-btn')?.addEventListener('click', () => {
    const navLinks = document.getElementById('nav-links');
    navLinks.classList.toggle('active');
});
