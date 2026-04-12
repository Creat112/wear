// product-detail.js
import { api } from './api.js';
import { addToCart, updateCartCount } from './cart.js';
import { updateAuthUI, initAuth } from './auth.js';

let currentProduct = null;
let selectedColor = null;
let selectedSize = null;

document.addEventListener('DOMContentLoaded', async () => {
    // Auth UI
    initAuth();
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || sessionStorage.getItem('currentUser'));
    updateAuthUI(currentUser);

    // Mobile menu
    const menuBtn = document.getElementById('menu-btn');
    const navLinks = document.getElementById('nav-links');
    if (menuBtn && navLinks) {
        menuBtn.addEventListener('click', () => {
            navLinks.classList.toggle('active');
        });
    }

    // Update cart count
    await updateCartCount();

    // Get product ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('id');

    if (!productId) {
        showError('Product not found');
        return;
    }

    await loadProductDetail(productId);
});

async function loadProductDetail(productId) {
    try {
        const product = await api.get(`/products/${productId}`);
        currentProduct = product;

        if (!product) {
            showError('Product not found');
            return;
        }

        renderProductDetail(product);
    } catch (error) {
        console.error('Error loading product:', error);
        showError('Failed to load product details');
    }
}

function renderProductDetail(product) {
    const container = document.getElementById('product-detail-content');

    // Select first color by default and set main image
    if (product.colors && product.colors.length > 0) {
        selectedColor = product.colors[0];
        // Update main image to the first color's image if it exists
        const mainImage = document.getElementById('main-image');
        if (mainImage && selectedColor.image) {
            mainImage.src = selectedColor.image;
        }
    }

    // Select first size by default
    if (product.sizes && product.sizes.length > 0) {
        selectedSize = product.sizes[0];
    }

    const hasDiscount = product.discount && product.discount > 0;
    const displayPrice = selectedColor ? selectedColor.price : (selectedSize ? selectedSize.price : product.price);
    const displayStock = selectedColor ? selectedColor.stock : (selectedSize ? selectedSize.stock : product.stock);

    container.innerHTML = `
        <div class="product-detail-grid">
            <div class="product-image-section">
                <img src="${selectedColor && selectedColor.image ? selectedColor.image : product.image}" alt="${product.name}" class="product-main-image" id="main-image">
            </div>
            
            <div class="product-info-section">
                <h1 class="product-title">${product.name}</h1>
                
                <div class="product-price">
                    ${hasDiscount ? `
                        <span class="original-price">EGP ${product.originalPrice.toFixed(2)}</span>
                        <span class="current-price">EGP ${displayPrice.toFixed(2)}</span>
                        <span class="discount-badge">${product.discount}% OFF</span>
                    ` : `
                        <span class="current-price">EGP ${displayPrice.toFixed(2)}</span>
                    `}
                </div>

                <div class="product-description">
                    <p>${product.description || 'No description available.'}</p>
                </div>

                ${product.colors && product.colors.length > 0 ? `
                    <div class="color-selection">
                        <h3>Select Color:</h3>
                        <div class="color-options" id="color-options">
                            ${product.colors.map(color => `
                                <button 
                                    class="color-btn ${color.id === selectedColor.id ? 'active' : ''}" 
                                    data-color-id="${color.id}"
                                    data-color-name="${color.colorName}"
                                    data-color-code="${color.colorCode}"
                                    data-price="${color.price}"
                                    data-stock="${color.stock}"
                                    data-image="${color.image}"
                                    style="background-color: ${color.colorCode}; ${color.colorCode === '#FFFFFF' || color.colorCode === '#ffffff' ? 'border: 2px solid #ddd;' : ''}"
                                    title="${color.colorName}"
                                >
                                    <span class="color-name">${color.colorName}</span>
                                </button>
                            `).join('')}
                            
                        </div>
                        <br>
                        <br>
                        <br>
                        <p class="selected-color-name">Selected: <strong id="selected-color-display">${selectedColor.colorName}</strong></p>
                    </div>
                ` : ''}

                ${product.sizes && product.sizes.length > 0 ? `
                    <div class="size-selection">
                        <h3>Select Size:</h3>
                        <div class="size-options" id="size-options">
                            ${product.sizes.map(size => `
                                <button 
                                    class="size-btn ${size.id === selectedSize.id ? 'active' : ''}" 
                                    data-size-id="${size.id}"
                                    data-size-name="${size.sizeName}"
                                    data-size-code="${size.sizeCode}"
                                    data-price="${size.price}"
                                    data-stock="${size.stock}"
                                    title="${size.sizeName}"
                                >
                                    <span class="size-code">${size.sizeCode || size.sizeName}</span>
                                </button>
                            `).join('')}
                        </div>
                        <p class="selected-size-name">Selected: <strong id="selected-size-display">${selectedSize.sizeName}</strong></p>
                    </div>
                ` : ''}

                <div class="stock-info">
                    <p class="stock-status ${displayStock > 0 ? 'in-stock' : 'out-of-stock'}" id="stock-status">
                        ${displayStock > 0 ? `<i class="ri-checkbox-circle-fill"></i> In Stock (${displayStock} available)` : '<i class="ri-close-circle-fill"></i> Out of Stock'}
                    </p>
                </div>

                <div class="quantity-section">
                    <label for="quantity">Quantity:</label>
                    <div class="quantity-controls">
                        <button class="qty-btn" id="qty-minus">-</button>
                        <input type="number" id="quantity" class="quantity-input" value="1" min="1" max="${displayStock}">
                        <button class="qty-btn" id="qty-plus">+</button>
                    </div>
                </div>

                <div class="action-buttons">
                    <button class="btn btn-primary add-to-cart-btn" id="add-to-cart-btn" ${displayStock === 0 ? 'disabled' : ''}>
                        <i class="ri-shopping-cart-line"></i> Add to Cart
                    </button>
                    <button class="btn btn-outline" onclick="shareProductDetail(${product.id}, '${product.name}')">
                        <i class="ri-share-line"></i> Share
                    </button>
                    <button class="btn btn-outline" onclick="window.location.href='products.html'">
                        <i class="ri-arrow-left-line"></i> Continue Shopping
                    </button>
                </div>

                <div id="error-message" class="error-message" style="display: none;"></div>
            </div>
        </div>
    `;

    // Attach event listeners
    attachEventListeners();
}

function attachEventListeners() {
    // Color selection
    const colorBtns = document.querySelectorAll('.color-btn');
    colorBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const colorId = parseInt(e.currentTarget.dataset.colorId);
            const colorName = e.currentTarget.dataset.colorName;
            const price = parseFloat(e.currentTarget.dataset.price);
            const stock = parseInt(e.currentTarget.dataset.stock);
            const image = e.currentTarget.dataset.image;
            const colorCode = e.currentTarget.dataset.colorCode;

            selectedColor = { id: colorId, colorName, price, stock, image, colorCode };

            // Update UI
            colorBtns.forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');

            updatePriceAndStock(price, stock);
            updateImage(image);
            document.getElementById('selected-color-display').textContent = colorName;
        });
    });

    // Size selection
    const sizeBtns = document.querySelectorAll('.size-btn');
    sizeBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const sizeId = parseInt(e.currentTarget.dataset.sizeId);
            const sizeName = e.currentTarget.dataset.sizeName;
            const sizeCode = e.currentTarget.dataset.sizeCode;
            const price = parseFloat(e.currentTarget.dataset.price);
            const stock = parseInt(e.currentTarget.dataset.stock);

            selectedSize = { id: sizeId, sizeName, sizeCode, price, stock };

            // Update UI
            sizeBtns.forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');

            updatePriceAndStock(price, stock);
            document.getElementById('selected-size-display').textContent = sizeName;
        });
    });

    // Quantity controls
    const qtyInput = document.getElementById('quantity');
    const qtyMinus = document.getElementById('qty-minus');
    const qtyPlus = document.getElementById('qty-plus');

    qtyMinus.addEventListener('click', () => {
        const current = parseInt(qtyInput.value);
        if (current > 1) {
            qtyInput.value = current - 1;
        }
    });

    qtyPlus.addEventListener('click', () => {
        const current = parseInt(qtyInput.value);
        const max = parseInt(qtyInput.max);
        if (current < max) {
            qtyInput.value = current + 1;
        }
    });

    qtyInput.addEventListener('change', (e) => {
        const value = parseInt(e.target.value);
        const max = parseInt(e.target.max);
        if (value < 1) e.target.value = 1;
        if (value > max) e.target.value = max;
    });

    // Add to cart
    const addToCartBtn = document.getElementById('add-to-cart-btn');
    addToCartBtn.addEventListener('click', handleAddToCart);
}

function updatePriceAndStock(price, stock) {
    const hasDiscount = currentProduct.discount && currentProduct.discount > 0;

    // Update price
    const currentPriceEl = document.querySelector('.current-price');
    currentPriceEl.textContent = `EGP ${price.toFixed(2)}`;

    // Update stock
    const stockStatus = document.getElementById('stock-status');
    const qtyInput = document.getElementById('quantity');
    const addToCartBtn = document.getElementById('add-to-cart-btn');

    if (stock > 0) {
        stockStatus.innerHTML = `<i class="ri-checkbox-circle-fill"></i> In Stock (${stock} available)`;
        stockStatus.className = 'stock-status in-stock';
        qtyInput.max = stock;
        if (parseInt(qtyInput.value) > stock) {
            qtyInput.value = stock;
        }
        addToCartBtn.disabled = false;
    } else {
        stockStatus.innerHTML = '<i class="ri-close-circle-fill"></i> Out of Stock';
        stockStatus.className = 'stock-status out-of-stock';
        qtyInput.max = 0;
        qtyInput.value = 0;
        addToCartBtn.disabled = true;
    }
}

function updateImage(imageSrc) {
    const mainImage = document.getElementById('main-image');
    if (imageSrc && imageSrc !== '' && imageSrc !== mainImage.src) {
        mainImage.src = imageSrc;
        // Add a smooth transition effect
        mainImage.style.opacity = '0';
        setTimeout(() => {
            mainImage.style.opacity = '1';
        }, 100);
    }
}

async function handleAddToCart() {
    // Check if product requires color selection
    if (currentProduct.colors && currentProduct.colors.length > 0 && !selectedColor) {
        showErrorMessage('Please select a color');
        return;
    }

    // Check if product requires size selection
    if (currentProduct.sizes && currentProduct.sizes.length > 0 && !selectedSize) {
        showErrorMessage('Please select a size');
        return;
    }

    const quantity = parseInt(document.getElementById('quantity').value);

    if (quantity < 1) {
        showErrorMessage('Please select a valid quantity');
        return;
    }

    // Check stock based on selected variant (color or size)
    const selectedStock = selectedColor ? selectedColor.stock : (selectedSize ? selectedSize.stock : currentProduct.stock);
    if (quantity > selectedStock) {
        showErrorMessage(`Only ${selectedStock} items available in stock`);
        return;
    }

    try {
        await addToCart(currentProduct.id, quantity, selectedColor ? selectedColor.id : null, selectedSize ? selectedSize.id : null);
        showSuccessMessage(`Added ${quantity} item(s) to cart!`);

        // Optionally redirect to cart after a delay
        setTimeout(() => {
            // window.location.href = 'cart.html';
        }, 1500);
    } catch (error) {
        console.error('Add to cart error:', error);
        showErrorMessage(error.message || 'Failed to add to cart');
    }
}

function showErrorMessage(message) {
    const errorEl = document.getElementById('error-message');
    errorEl.textContent = message;
    errorEl.style.display = 'block';
    errorEl.className = 'error-message';

    setTimeout(() => {
        errorEl.style.display = 'none';
    }, 5000);
}

function showSuccessMessage(message) {
    const errorEl = document.getElementById('error-message');
    errorEl.textContent = message;
    errorEl.style.display = 'block';
    errorEl.className = 'success-message';

    setTimeout(() => {
        errorEl.style.display = 'none';
    }, 3000);
}

function showError(message) {
    const container = document.getElementById('product-detail-content');
    container.innerHTML = `
        <div class="error-container">
            <i class="ri-error-warning-line"></i>
            <h2>${message}</h2>
            <a href="products.html" class="btn">Back to Products</a>
        </div>
    `;
}

// Share product function for detail page
function shareProductDetail(productId, productName) {
    const productUrl = `${window.location.origin}/product-detail.html?id=${productId}`;
    const shareText = `Check out this ${productName} from SAVX Store!`;
    
    // Check if Web Share API is available
    if (navigator.share) {
        navigator.share({
            title: productName,
            text: shareText,
            url: productUrl
        }).catch(err => console.log('Error sharing:', err));
    } else {
        // Fallback for desktop browsers
        copyToClipboard(productUrl);
    }
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showNotification('Link copied to clipboard!');
    });
}

function showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'share-notification';
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #28a745;
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        z-index: 10000;
        font-size: 14px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}
