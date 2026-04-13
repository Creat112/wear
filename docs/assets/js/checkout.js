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

    function renderCheckoutItems() {
        if (!listContainer) return;
        listContainer.innerHTML = "";
        total = 0;

        if (checkoutItems.length === 0) {
            listContainer.innerHTML = "<p>Your cart is empty.</p>";
            if (totalSpan) totalSpan.textContent = "EGP 0.00";
            return;
        }

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
            const variantInfo = [];
            if (item.colorName) variantInfo.push(`Color: ${item.colorName}`);
            if (item.sizeName) variantInfo.push(`Size: ${item.sizeName}`);
            
            itemDetails.innerHTML = `
                <div style="font-weight: 600; color: #333;">${item.name}</div>
                ${variantInfo.length > 0 ? `<div style="font-size: 0.9rem; color: #666;">${variantInfo.join(' | ')}</div>` : ''}
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

        updateTotal();
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

    renderCheckoutItems();

    const applyPromoBtn = document.getElementById('applyPromoBtn');
    const promoCodeInput = document.getElementById('promoCode');
    const promoMessage = document.getElementById('promoMessage');

    if (applyPromoBtn && promoCodeInput) {
        applyPromoBtn.addEventListener('click', async () => {
            const code = promoCodeInput.value.trim().toUpperCase();
            if (!code) return;

            // Get user info from form or localStorage
            const currentUser = JSON.parse(localStorage.getItem('currentUser') || sessionStorage.getItem('currentUser') || '{}');
            const userEmail = document.getElementById('email')?.value.trim() || currentUser?.email || null;
            const userPhone = document.getElementById('phone')?.value.trim() || currentUser?.phone || null;

            // Check if user already used this code locally
            console.log('Checking discount code:', code, 'for user email:', userEmail, 'phone:', userPhone);
            if (userEmail) {
                const usedDiscountsKey = `usedDiscounts_${userEmail}`;
                const usedDiscounts = JSON.parse(localStorage.getItem(usedDiscountsKey) || '[]');
                console.log('Used discounts for', userEmail, ':', usedDiscounts);
                if (usedDiscounts.includes(code)) {
                    console.log('Code already used:', code);
                    appliedDiscount = null;
                    promoMessage.style.color = '#ef4444';
                    promoMessage.textContent = 'You have already used this discount code';
                    updateTotal();
                    return;
                }
            }

            try {
                const res = await api.post('/discounts/validate', { code, userEmail, userPhone });
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

    // Stock Check Function
    async function checkStockAndShowModal(items) {
        const stockIssues = [];
        
        for (const item of items) {
            try {
                let stockCheck;
                if (item.colorId) {
                    // Check color variant stock
                    stockCheck = await api.get(`/products/colors/${item.colorId}/stock`);
                } else if (item.productId) {
                    // Check product-level stock
                    stockCheck = await api.get(`/products/${item.productId}/stock`);
                }
                
                if (stockCheck && stockCheck.stock < item.quantity) {
                    stockIssues.push({
                        ...item,
                        availableStock: stockCheck.stock,
                        requestedQty: item.quantity
                    });
                }
            } catch (err) {
                // If API returns 404 or error, treat as out of stock (0 available)
                console.error(`Stock check failed for item ${item.name}:`, err);
                stockIssues.push({
                    ...item,
                    availableStock: 0,
                    requestedQty: item.quantity
                });
            }
        }
        
        return stockIssues;
    }

    // Show Stock Issue Modal
    function showStockModal(stockIssues, onAdjust, onRemove, onCancel, onRemoveAll) {
        // Remove existing modal
        const existingModal = document.getElementById('stock-modal');
        if (existingModal) existingModal.remove();

        const modal = document.createElement('div');
        modal.id = 'stock-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            padding: 20px;
        `;

        const issue = stockIssues[0]; // Show first issue
        const imageUrl = issue.image || issue.productImage || 'products/Set/Sets Savax Black.jpeg';
        const imagePath = imageUrl.startsWith('http') || imageUrl.startsWith('/') ? imageUrl : '/' + imageUrl;

        modal.innerHTML = `
            <div style="
                background: white;
                border-radius: 16px;
                max-width: 450px;
                width: 100%;
                max-height: 90vh;
                overflow-y: auto;
                box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            ">
                <div style="padding: 24px;">
                    <h2 style="margin: 0 0 16px 0; color: #dc2626; font-size: 20px;">
                        ⚠️ Stock Issue
                    </h2>
                    
                    <div style="display: flex; gap: 16px; margin-bottom: 20px;">
                        <img src="${imagePath}" 
                             style="width: 80px; height: 80px; object-fit: cover; border-radius: 8px;"
                             onerror="this.src='/products/Set/Sets Savax Black.jpeg'">
                        <div>
                            <div style="font-weight: 600; font-size: 16px; margin-bottom: 4px;">
                                ${issue.name || issue.productName}
                            </div>
                            ${issue.colorName ? `<div style="color: #666; font-size: 14px; margin-bottom: 4px;">Color: ${issue.colorName}</div>` : ''}
                            ${issue.sizeName ? `<div style="color: #666; font-size: 14px; margin-bottom: 4px;">Size: ${issue.sizeName}</div>` : ''}
                            <div style="color: #dc2626; font-size: 14px;">
                                Only ${issue.availableStock} left in stock
                            </div>
                            <div style="color: #666; font-size: 13px;">
                                You requested: ${issue.requestedQty}
                            </div>
                        </div>
                    </div>
                    
                    <div style="display: flex; flex-direction: column; gap: 10px;">
                        <button id="btn-adjust" style="
                            padding: 12px 16px;
                            background: #10b981;
                            color: white;
                            border: none;
                            border-radius: 8px;
                            font-weight: 500;
                            cursor: pointer;
                        ">
                            ✓ Adjust quantity to ${issue.availableStock}
                        </button>
                        
                        <button id="btn-remove" style="
                            padding: 12px 16px;
                            background: #f3f4f6;
                            color: #374151;
                            border: 1px solid #d1d5db;
                            border-radius: 8px;
                            font-weight: 500;
                            cursor: pointer;
                        ">
                            🗑️ Remove this product
                        </button>
                        
                        <button id="btn-remove-all" style="
                            padding: 12px 16px;
                            background: #fef3c7;
                            color: #92400e;
                            border: 1px solid #f59e0b;
                            border-radius: 8px;
                            font-weight: 500;
                            cursor: pointer;
                        ">
                            🛒 Remove all products from cart
                        </button>
                        
                        <button id="btn-cancel" style="
                            padding: 12px 16px;
                            background: white;
                            color: #6b7280;
                            border: 1px solid #d1d5db;
                            border-radius: 8px;
                            font-weight: 500;
                            cursor: pointer;
                        ">
                            ✕ Cancel and go back
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Event listeners
        document.getElementById('btn-adjust').onclick = () => {
            modal.remove();
            onAdjust(issue, issue.availableStock);
        };
        document.getElementById('btn-remove').onclick = () => {
            modal.remove();
            onRemove(issue);
        };
        document.getElementById('btn-remove-all').onclick = () => {
            modal.remove();
            onRemoveAll();
        };
        document.getElementById('btn-cancel').onclick = () => {
            modal.remove();
            onCancel();
        };
    }

    // Check for items missing a color selection
    async function checkMissingColors(items) {
        const itemsMissingColor = [];
        
        for (const item of items) {
            // Only check if color is not already selected
            if (!item.colorId) {
                try {
                    const product = await api.get(`/products/${item.productId || item.id}`);
                    if (product && product.colors && product.colors.length > 0) {
                        itemsMissingColor.push({
                            ...item,
                            availableColors: product.colors
                        });
                    }
                } catch (err) {
                    console.error(`Failed to fetch colors for product ${item.productId}:`, err);
                }
            }
        }
        
        return itemsMissingColor;
    }

    // Show Color Picker Modal
    function showColorPickerModal(item, onSelected, onCancel) {
        // Remove existing modal
        const existingModal = document.getElementById('color-picker-modal');
        if (existingModal) existingModal.remove();

        const modal = document.createElement('div');
        modal.id = 'color-picker-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10001;
            padding: 20px;
        `;

        const imageUrl = item.image || item.productImage || 'products/Set/Sets Savax Black.jpeg';
        const imagePath = imageUrl.startsWith('http') || imageUrl.startsWith('/') ? imageUrl : '/' + imageUrl;

        let colorsHtml = item.availableColors.map(color => `
            <div class="color-option" data-id="${color.id}" data-name="${color.colorName}" data-price="${color.price}" style="
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 12px;
                border: 1px solid #e5e7eb;
                border-radius: 10px;
                cursor: pointer;
                transition: all 0.2s;
            " onmouseover="this.style.borderColor='#10b981'; this.style.background='#f0fdf4'" 
               onmouseout="this.style.borderColor='#e5e7eb'; this.style.background='transparent'">
                <div style="width: 30px; height: 30px; border-radius: 50%; background-color: ${color.colorCode || '#ccc'}; border: 1px solid #ddd;"></div>
                <div style="flex: 1;">
                    <div style="font-weight: 500; color: #374151;">${color.colorName}</div>
                    <div style="font-size: 13px; color: #6b7280;">EGP ${Number(color.price).toFixed(2)}</div>
                </div>
                ${color.stock <= 0 ? '<span style="color: #ef4444; font-size: 12px;">Out of Stock</span>' : ''}
            </div>
        `).join('');

        modal.innerHTML = `
            <div style="
                background: white;
                border-radius: 16px;
                max-width: 450px;
                width: 100%;
                max-height: 90vh;
                overflow-y: auto;
                box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            ">
                <div style="padding: 24px;">
                    <h2 style="margin: 0 0 8px 0; color: #1f2937; font-size: 20px;">
                        🎨 Choose a Color
                    </h2>
                    <p style="color: #6b7280; font-size: 14px; margin-bottom: 20px;">
                        Please select a color for <strong>${item.name || item.productName}</strong> to proceed.
                    </p>
                    
                    <div style="display: flex; gap: 16px; margin-bottom: 24px; padding: 12px; background: #f9fafb; border-radius: 12px;">
                        <img src="${imagePath}" 
                             style="width: 60px; height: 60px; object-fit: cover; border-radius: 8px;"
                             onerror="this.src='/products/Set/Sets Savax Black.jpeg'">
                        <div>
                            <div style="font-weight: 600; font-size: 15px; color: #374151;">
                                ${item.name || item.productName}
                            </div>
                            <div style="color: #6b7280; font-size: 13px;">Quantity: ${item.quantity}</div>
                        </div>
                    </div>
                    
                    <div id="color-options-container" style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 24px;">
                        ${colorsHtml}
                    </div>
                    
                    <button id="btn-cancel-picker" style="
                        width: 100%;
                        padding: 12px;
                        background: white;
                        color: #6b7280;
                        border: 1px solid #d1d5db;
                        border-radius: 8px;
                        font-weight: 500;
                        cursor: pointer;
                    ">
                        ✕ Cancel
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Selection logic
        const options = modal.querySelectorAll('.color-option');
        options.forEach(opt => {
            opt.onclick = () => {
                const id = opt.dataset.id;
                const name = opt.dataset.name;
                const price = opt.dataset.price;
                const color = item.availableColors.find(c => c.id == id);
                
                if (color && color.stock <= 0) {
                    alert('This color is out of stock. Please choose another one.');
                    return;
                }
                
                modal.remove();
                onSelected({ id, name, price });
            };
        });

        document.getElementById('btn-cancel-picker').onclick = () => {
            modal.remove();
            onCancel();
        };
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

            // Check for missing colors before proceeding
            const itemsMissingColor = await checkMissingColors(checkoutItems);
            if (itemsMissingColor.length > 0) {
                isSubmitting = false;
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Place Order';
                }
                
                const item = itemsMissingColor[0]; // Propmt for the first missing color item
                showColorPickerModal(
                    item,
                    (selected) => {
                        // Find item in original checkoutItems and update it
                        const idx = checkoutItems.findIndex(i => (i.productId || i.id) === (item.productId || item.id) && !i.colorId);
                        if (idx > -1) {
                            checkoutItems[idx].colorId = selected.id;
                            checkoutItems[idx].colorName = selected.name;
                            checkoutItems[idx].price = Number(selected.price);
                            localStorage.setItem('checkoutItems', JSON.stringify(checkoutItems));
                            
                            // Re-render UI and total
                            renderCheckoutItems();
                            
                            // Reset submission state and trigger submit again to proceed
                            isSubmitting = false;
                            checkoutForm.dispatchEvent(new Event('submit'));
                        }
                    },
                    () => {
                        // User cancelled color selection, do nothing
                    }
                );
                return;
            }

            // Check stock before proceeding
            const stockIssues = await checkStockAndShowModal(checkoutItems);
            
            if (stockIssues.length > 0) {
                // Show modal with stock issues
                isSubmitting = false;
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Place Order';
                }
                
                showStockModal(
                    stockIssues,
                    // onAdjust - adjust quantity to available stock
                    (issue, newQty) => {
                        const itemIndex = checkoutItems.findIndex(item => 
                            (item.productId === issue.productId && item.colorId === issue.colorId)
                        );
                        if (itemIndex > -1) {
                            checkoutItems[itemIndex].quantity = newQty;
                            localStorage.setItem('checkoutItems', JSON.stringify(checkoutItems));
                            window.location.reload(); // Reload to show updated quantities
                        }
                    },
                    // onRemove - remove this product
                    (issue) => {
                        checkoutItems = checkoutItems.filter(item => 
                            !(item.productId === issue.productId && item.colorId === issue.colorId)
                        );
                        localStorage.setItem('checkoutItems', JSON.stringify(checkoutItems));
                        window.location.reload();
                    },
                    // onCancel - do nothing, user goes back to checkout
                    () => {
                        // Just close modal, user can edit cart manually
                    },
                    // onRemoveAll - clear entire cart
                    () => {
                        localStorage.removeItem('checkoutItems');
                        window.location.href = 'cart.html';
                    }
                );
                return;
            }

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
                // Cash on Delivery - direct order placement
                console.log('About to place order. appliedDiscount:', appliedDiscount);
                const result = await api.post('/orders', orderData);
                console.log('Order result:', result);

                if (result.success || result.orderId) {
                    console.log('Order success! Storing discount if exists...');
                    // Store used discount code to prevent reuse
                    if (appliedDiscount && appliedDiscount.code) {
                        const userEmail = document.getElementById("email").value;
                        const usedDiscountsKey = `usedDiscounts_${userEmail}`;
                        const usedDiscounts = JSON.parse(localStorage.getItem(usedDiscountsKey) || '[]');
                        console.log('Storing used discount:', appliedDiscount.code, 'for user:', userEmail);
                        if (!usedDiscounts.includes(appliedDiscount.code)) {
                            usedDiscounts.push(appliedDiscount.code);
                            localStorage.setItem(usedDiscountsKey, JSON.stringify(usedDiscounts));
                            console.log('Discount stored. Used discounts now:', usedDiscounts);
                        }
                        // Clear applied discount
                        appliedDiscount = null;
                        localStorage.removeItem('appliedDiscount');
                    } else {
                        console.log('No applied discount to store');
                    }
                    
                    // Verify discount was stored
                    const verifyKey = `usedDiscounts_${document.getElementById("email").value}`;
                    const verifyData = localStorage.getItem(verifyKey);
                    console.log('Verification - localStorage key:', verifyKey, 'value:', verifyData);
                    
                    sessionStorage.setItem("currentOrder", JSON.stringify(orderData));
                    localStorage.removeItem("checkoutItems");
                    
                    // Small delay to ensure localStorage is persisted
                    setTimeout(() => {
                        window.location.href = "thank-you.html";
                    }, 100);
                } else {
                    alert('Failed to place order: ' + (result.error || 'Unknown error'));
                    isSubmitting = false; // Reset on error
                    // Re-enable submit button
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.textContent = 'Place Order';
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
});
