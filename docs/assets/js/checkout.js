import { api } from './api.js';

let selectedLocation = null;

window.addEventListener("DOMContentLoaded", () => {
    // We get items from localStorage passed from cart page
    let checkoutItems = [];
    try {
        checkoutItems = JSON.parse(localStorage.getItem("checkoutItems")) || [];
    } catch (error) {
        console.error('localStorage access blocked:', error);
        // Fallback: try sessionStorage or show message
        try {
            checkoutItems = JSON.parse(sessionStorage.getItem("checkoutItems")) || [];
        } catch (sessionError) {
            console.error('sessionStorage also blocked:', sessionError);
            alert('Your browser is blocking local storage. Please enable storage access or use a different browser to complete your purchase.');
            return;
        }
    }
    const listContainer = document.getElementById("checkout-list");
    const totalSpan = document.getElementById("order-total");
    const checkoutForm = document.getElementById("checkoutForm");

    let total = 0;

    if (checkoutItems.length === 0) {
        if (listContainer) listContainer.innerHTML = "<p>Your cart is empty.</p>";
        if (totalSpan) totalSpan.textContent = "EGP 0.00";
        return;
    }

    // Render items
    if (listContainer) {
        checkoutItems.forEach(item => {
            const li = document.createElement("li");
            li.style.display = "flex";
            li.style.alignItems = "center";
            li.style.justifyContent = "space-between";
            li.style.marginBottom = "10px";
            li.style.padding = "10px";
            li.style.border = "1px solid #ddd";
            li.style.borderRadius = "8px";
            
            // Create item details
            const itemDetails = document.createElement("div");
            itemDetails.style.flex = "1";
            itemDetails.innerHTML = `
                <div style="font-weight: 600; color: #333;">${item.name}</div>
                ${item.colorName ? `<div style="font-size: 0.9rem; color: #666;">Color: ${item.colorName}</div>` : ''}
                <div style="font-size: 0.9rem; color: #666;">Qty: ${item.quantity}</div>
            `;
            
            // Create price
            const itemPrice = document.createElement("div");
            itemPrice.style.fontWeight = "600";
            itemPrice.style.color = "#27ae60";
            itemPrice.textContent = `${(item.price * item.quantity).toFixed(2)}EGP`;
            
            li.appendChild(itemDetails);
            li.appendChild(itemPrice);
            listContainer.appendChild(li);
            
            total += item.price * item.quantity;
        });
    }

    let appliedDiscount = null;

    // Generate unique order number using timestamp + random
    function generateOrderNumber() {
        const timestamp = Date.now().toString(36).toUpperCase(); // Base36 timestamp
        const random = Math.floor(100 + Math.random() * 900); // 3-digit random
        return `ORD-${timestamp}-${random}`;
    }
    
    function updateTotal() {
        if (!totalSpan) return;
        if (appliedDiscount) {
            let discountAmt = 0;
            if (appliedDiscount.discount_type === 'percentage') {
                discountAmt = total * (appliedDiscount.percentage / 100);
            } else if (appliedDiscount.discount_type === 'fixed') {
                discountAmt = appliedDiscount.fixed_amount;
            }
            const finalTotal = Math.max(0, total - discountAmt); // Ensure total doesn't go negative
            totalSpan.innerHTML = `<del style="font-size:14px; color:#94a3b8;">EGP ${total.toFixed(2)}</del> EGP ${finalTotal.toFixed(2)}`;
        } else {
            totalSpan.textContent = `EGP ${total.toFixed(2)}`;
        }
    }

    updateTotal();

    const applyPromoBtn = document.getElementById('applyPromoBtn');
    const promoCodeInput = document.getElementById('promoCode');
    const promoMessage = document.getElementById('promoMessage');

    if (applyPromoBtn && promoCodeInput) {
        applyPromoBtn.addEventListener('click', async () => {
            const code = promoCodeInput.value.trim().toUpperCase();
            if (!code) return;

            try {
                const res = await api.post('/discounts/validate', { code });
                if (res.success) {
                    appliedDiscount = { 
                        code: res.code, 
                        discount_type: res.discount_type,
                        percentage: res.percentage || 0,
                        fixed_amount: res.fixed_amount || 0
                    };
                    promoMessage.style.color = '#10b981'; // Green
                    promoMessage.innerHTML = `Code <strong>${res.code}</strong> applied (${res.displayText})`;
                    updateTotal();
                } else {
                    appliedDiscount = null;
                    promoMessage.style.color = '#ef4444'; // Red
                    promoMessage.textContent = res.error || 'Invalid code.';
                    updateTotal();
                }
            } catch (err) {
                appliedDiscount = null;
                promoMessage.style.color = '#ef4444'; 
                promoMessage.textContent = err.message || 'Invalid code.';
                updateTotal();
            }
        });
    }

    // Location handling (existing code)
    // ... (keep existing location code)

    // Map Setup
    if (document.getElementById('map')) {
        const map = L.map('map').setView([30.0444, 31.2357], 6);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(map);

        let marker = null;
        map.on('click', function (e) {
            const { lat, lng } = e.latlng;
            if (marker) map.removeLayer(marker);
            marker = L.marker([lat, lng]).addTo(map);
            selectedLocation = { lat, lng };
        });

        const gpsBtn = document.getElementById('gps-btn');
        if (gpsBtn) {
            gpsBtn.addEventListener('click', () => {
                navigator.geolocation.getCurrentPosition((pos) => {
                    const { latitude, longitude } = pos.coords;
                    if (marker) map.removeLayer(marker);
                    marker = L.marker([latitude, longitude]).addTo(map);
                    map.setView([latitude, longitude], 12);
                    selectedLocation = { lat: latitude, lng: longitude };
                }, (err) => {
                    alert('Unable to fetch your location.');
                });
            });
        }
    }

    // Handle Form Submit
    if (checkoutForm) {
        let isSubmitting = false; // Prevent double submission
        
        checkoutForm.addEventListener("submit", async function (e) {
            e.preventDefault();
            
            // Prevent double-click
            if (isSubmitting) {
                e.preventDefault();
                return false;
            }
            isSubmitting = true;
            
            // Disable submit button
            const submitBtn = document.getElementById('submit-order-btn');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Placing Order...';
            }

            const fullName = document.getElementById("fullName").value;
            const email = document.getElementById("email").value;
            const phone = document.getElementById("phone").value;
            const secondaryPhone = document.getElementById("secondaryPhone").value || null;
            const governorate = document.getElementById("governorate").value;
            const city = document.getElementById("city").value;
            const address = document.getElementById("address").value;
            const notes = document.getElementById("notes").value || "No notes";
            const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked').value;

            // Calculate discount based on type
            let discountAmount = 0;
            if (appliedDiscount) {
                if (appliedDiscount.discount_type === 'percentage') {
                    discountAmount = total * (appliedDiscount.percentage / 100);
                } else if (appliedDiscount.discount_type === 'fixed') {
                    discountAmount = appliedDiscount.fixed_amount;
                }
            }
            const finalOrderTotal = Math.max(0, total - discountAmount);

            const orderData = {
                customer: { fullName, email, phone, secondaryPhone },
                shipping: { governorate, city, address, notes, location: selectedLocation },
                items: checkoutItems,
                total: finalOrderTotal,
                discountCode: appliedDiscount ? appliedDiscount.code : null,
                discountAmount: discountAmount,
                orderNumber: generateOrderNumber(),
                date: new Date().toISOString()
            };

            try {
                if (paymentMethod === 'paymob') {
                    // Handle Paymob payment
                    await handlePaymobPayment(orderData);
                } else {
                    // Handle other payment methods (existing logic)
                    const result = await api.post('/orders', orderData);

                    if (result.success || result.orderId) {
                        sessionStorage.setItem("currentOrder", JSON.stringify(orderData));
                        localStorage.removeItem("checkoutItems");
                        window.location.href = "thank-you.html";
                    } else {
                        alert('Failed to place order: ' + (result.error || 'Unknown error'));
                        isSubmitting = false; // Reset on error
                        // Re-enable submit button
                        if (submitBtn) {
                            submitBtn.disabled = false;
                            submitBtn.textContent = 'Place Order';
                        }
                    }
                }
            } catch (error) {
                console.error('Order error:', error);
                alert('Error placing order. Please try again.');
                isSubmitting = false; // Reset on error
                // Re-enable submit button
                const submitBtn = document.getElementById('submit-order-btn');
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Place Order';
                }
            }
        });
    }

    // Handle Paymob payment
    async function handlePaymobPayment(orderData) {
        try {
            // First create the order
            const orderResult = await api.post('/orders', orderData);
            
            if (!orderResult.success && !orderResult.orderId) {
                throw new Error('Failed to create order');
            }

            const orderId = orderResult.orderId || orderResult.id;
            
            // Initialize Paymob payment
            const paymob = new PaymobPayment();
            
            // Format order data for Paymob
            const paymobOrderData = paymob.formatOrderData(
                { id: orderId, total: orderData.total },
                {
                    firstName: orderData.customer.fullName.split(' ')[0],
                    lastName: orderData.customer.fullName.split(' ')[1] || '',
                    email: orderData.customer.email,
                    phoneNumber: orderData.customer.phone,
                },
                orderData.items
            );

            // Create payment session
            const session = await paymob.createPaymentSession(paymobOrderData);
            
            // Store order info for result page
            sessionStorage.setItem("currentOrder", JSON.stringify(orderData));
            sessionStorage.setItem("pendingOrderId", orderId);
            localStorage.removeItem("checkoutItems");
            
            // Redirect to Paymob payment page
            window.location.href = session.paymentUrl;
            
        } catch (error) {
            console.error('Paymob payment error:', error);
            showPaymentError(error.message);
        }
    }

    // Show payment error and return to checkout
    function showPaymentError(message) {
        // Create error message element
        const errorDiv = document.createElement('div');
        errorDiv.className = 'payment-error';
        errorDiv.style.cssText = `
            background: #f8d7da;
            color: #721c24;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
            border: 1px solid #f5c6cb;
        `;
        errorDiv.innerHTML = `
            <h4 style="margin: 0 0 10px 0;">
                <i class="ri-error-warning-line"></i> Payment Failed
            </h4>
            <p style="margin: 0;">${message}</p>
            <p style="margin: 10px 0 0 0;">Please try again or choose a different payment method.</p>
        `;

        // Insert error message before order summary
        const orderSummary = document.querySelector('.order-summary');
        orderSummary.parentNode.insertBefore(errorDiv, orderSummary);

        // Scroll to error message
        errorDiv.scrollIntoView({ behavior: 'smooth' });

        // Remove error after 10 seconds
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.parentNode.removeChild(errorDiv);
            }
        }, 10000);
    }

    // Card formatting and validation
    function initializeCardFormatting() {
        const cardNumberInput = document.getElementById('cardNumber');
        const expiryDateInput = document.getElementById('expiryDate');
        const cvvInput = document.getElementById('cvv');

        // Format card number (add spaces every 4 digits)
        cardNumberInput.addEventListener('input', function(e) {
            let value = e.target.value.replace(/\s/g, '');
            let formattedValue = value.match(/.{1,4}/g)?.join(' ') || value;
            e.target.value = formattedValue;
        });

        // Format expiry date (MM/YY)
        expiryDateInput.addEventListener('input', function(e) {
            let value = e.target.value.replace(/\D/g, '');
            if (value.length >= 2) {
                value = value.slice(0, 2) + '/' + value.slice(2, 4);
            }
            e.target.value = value;
        });

        // Only allow numbers for CVV
        cvvInput.addEventListener('input', function(e) {
            e.target.value = e.target.value.replace(/\D/g, '');
        });

        // Card type detection (for validation purposes)
        cardNumberInput.addEventListener('input', function(e) {
            const value = e.target.value.replace(/\s/g, '');
            // Basic validation - ensure credit card option is selected when typing card number
            if (value.length > 0) {
                document.getElementById('creditcard').checked = true;
                // Trigger the change event to show card details
                document.getElementById('creditcard').dispatchEvent(new Event('change'));
            }
        });
    }

    // Initialize card formatting
    initializeCardFormatting();
    
    // Payment method toggle
    function initializePaymentToggle() {
        const paymobRadio = document.getElementById('paymob');
        const cashRadio = document.getElementById('cash');
        const cardDetails = document.querySelector('.card-details');
        
        function toggleCardDetails() {
            // Hide card details for both Paymob and Cash on Delivery
            // Paymob handles card details on their own page
            cardDetails.classList.add('hidden');
            
            // Remove required attribute from card fields
            document.getElementById('cardNumber').removeAttribute('required');
            document.getElementById('expiryDate').removeAttribute('required');
            document.getElementById('cvv').removeAttribute('required');
            document.getElementById('cardName').removeAttribute('required');
        }
        
        // Add event listeners
        paymobRadio.addEventListener('change', toggleCardDetails);
        cashRadio.addEventListener('change', toggleCardDetails);
        
        // Initialize on page load
        toggleCardDetails();
    }
    
    // Initialize payment toggle
    initializePaymentToggle();
});
