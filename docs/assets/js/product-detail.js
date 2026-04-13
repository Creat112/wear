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

    // Get images for slider - use color images if available, fallback to product image
    const getImages = () => {
        if (selectedColor && selectedColor.images && selectedColor.images.length > 0) {
            return selectedColor.images;
        }
        if (selectedColor && selectedColor.image) {
            return [selectedColor.image];
        }
        if (product.image) {
            return [product.image];
        }
        return ['assets/images/placeholder.jpg'];
    };
    
    const currentImages = getImages();
    let currentImageIndex = 0;

    container.innerHTML = `
        <div class="product-detail-grid">
            <div class="product-image-section">
                <div class="image-slider" style="position: relative; width: 100%;">
                    <img src="${currentImages[0]}" alt="${product.name}" class="product-main-image" id="main-image" style="width: 100%; height: auto; object-fit: cover;">
                    
                    ${currentImages.length > 1 ? `
                        <button id="prev-image" style="position: absolute; left: 10px; top: 50%; transform: translateY(-50%); background: rgba(0,0,0,0.5); color: white; border: none; width: 40px; height: 40px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 18px; z-index: 10;">
                            <i class="ri-arrow-left-s-line"></i>
                        </button>
                        <button id="next-image" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: rgba(0,0,0,0.5); color: white; border: none; width: 40px; height: 40px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 18px; z-index: 10;">
                            <i class="ri-arrow-right-s-line"></i>
                        </button>
                        <div class="image-dots" style="position: absolute; bottom: 10px; left: 50%; transform: translateX(-50%); display: flex; gap: 8px; z-index: 10;">
                            ${currentImages.map((_, i) => `
                                <span class="image-dot ${i === 0 ? 'active' : ''}" data-index="${i}" style="width: 10px; height: 10px; border-radius: 50%; background: ${i === 0 ? '#8b5cf6' : 'rgba(255,255,255,0.7)'}; cursor: pointer; transition: all 0.2s;"></span>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
                
                ${currentImages.length > 1 ? `
                    <div class="thumbnail-strip" style="display: flex; gap: 10px; margin-top: 15px; overflow-x: auto; padding: 5px;">
                        ${currentImages.map((img, i) => `
                            <img src="${img}" class="thumbnail ${i === 0 ? 'active' : ''}" data-index="${i}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 8px; cursor: pointer; border: 2px solid ${i === 0 ? '#8b5cf6' : 'transparent'}; transition: all 0.2s;">
                        `).join('')}
                    </div>
                ` : ''}
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
                                    data-images='${JSON.stringify(color.images || [])}'
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
                    <div class="size-selection" style="margin: 20px 0;">
                        <h3 style="margin-bottom: 12px; font-size: 1rem;">Select Size:</h3>
                        <div class="size-options" id="size-options" style="display: flex; flex-wrap: wrap; gap: 10px;">
                            ${product.sizes.map(size => `
                                <button 
                                    class="size-btn ${size.id === selectedSize.id ? 'active' : ''}" 
                                    data-size-id="${size.id}"
                                    data-size-name="${size.sizeName}"
                                    data-size-code="${size.sizeCode}"
                                    data-price="${size.price}"
                                    title="${size.sizeName}"
                                    style="
                                        min-width: 60px;
                                        padding: 12px 20px;
                                        border: 2px solid ${size.id === selectedSize.id ? '#8b5cf6' : '#e5e7eb'};
                                        border-radius: 8px;
                                        background: ${size.id === selectedSize.id ? 'linear-gradient(135deg, #8b5cf6, #7c3aed)' : '#ffffff'};
                                        color: ${size.id === selectedSize.id ? '#ffffff' : '#374151'};
                                        font-weight: 600;
                                        font-size: 0.95rem;
                                        cursor: pointer;
                                        transition: all 0.2s ease;
                                        box-shadow: ${size.id === selectedSize.id ? '0 4px 12px rgba(139, 92, 246, 0.3)' : '0 2px 4px rgba(0,0,0,0.05)'};
                                    "
                                    onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.15)';"
                                    onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='${size.id === selectedSize.id ? '0 4px 12px rgba(139, 92, 246, 0.3)' : '0 2px 4px rgba(0,0,0,0.05)'}';"
                                >
                                    <span class="size-code">${size.sizeCode || size.sizeName}</span>
                                </button>
                            `).join('')}
                        </div>
                        <p class="selected-size-name" style="margin-top: 12px; font-size: 0.9rem; color: #6b7280;">
                            Selected: <strong id="selected-size-display" style="color: #8b5cf6;">${selectedSize.sizeName}</strong>
                        </p>
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

            const imagesData = e.currentTarget.dataset.images;
            let colorImages = [];
            try {
                colorImages = JSON.parse(imagesData);
            } catch (e) { colorImages = image ? [image] : []; }
            
            selectedColor = { id: colorId, colorName, price, stock, image, colorCode, images: colorImages };

            // Update UI
            colorBtns.forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');

            updatePriceAndStock(price, stock);
            updateImageSlider(colorImages, image);
            document.getElementById('selected-color-display').textContent = colorName;
        });
    });

    // Size selection - only for display, doesn't affect stock/quantity
    const sizeBtns = document.querySelectorAll('.size-btn');
    sizeBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const sizeId = parseInt(e.currentTarget.dataset.sizeId);
            const sizeName = e.currentTarget.dataset.sizeName;
            const sizeCode = e.currentTarget.dataset.sizeCode;
            const price = parseFloat(e.currentTarget.dataset.price);

            selectedSize = { id: sizeId, sizeName, sizeCode, price };

            // Update UI styling for active state
            sizeBtns.forEach(b => {
                b.classList.remove('active');
                b.style.borderColor = '#e5e7eb';
                b.style.background = '#ffffff';
                b.style.color = '#374151';
                b.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)';
            });
            e.currentTarget.classList.add('active');
            e.currentTarget.style.borderColor = '#8b5cf6';
            e.currentTarget.style.background = 'linear-gradient(135deg, #8b5cf6, #7c3aed)';
            e.currentTarget.style.color = '#ffffff';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(139, 92, 246, 0.3)';

            document.getElementById('selected-size-display').textContent = sizeName;
        });
    });

    // Image slider functionality
    const mainImage = document.getElementById('main-image');
    const prevBtn = document.getElementById('prev-image');
    const nextBtn = document.getElementById('next-image');
    const thumbnails = document.querySelectorAll('.thumbnail');
    const dots = document.querySelectorAll('.image-dot');
    
    if (mainImage && currentImages.length > 1) {
        const updateImage = (index) => {
            currentImageIndex = index;
            mainImage.src = currentImages[index];
            
            // Update thumbnails
            thumbnails.forEach((t, i) => {
                t.style.borderColor = i === index ? '#8b5cf6' : 'transparent';
                t.classList.toggle('active', i === index);
            });
            
            // Update dots
            dots.forEach((d, i) => {
                d.style.background = i === index ? '#8b5cf6' : 'rgba(255,255,255,0.7)';
                d.classList.toggle('active', i === index);
            });
        };
        
        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                const newIndex = currentImageIndex === 0 ? currentImages.length - 1 : currentImageIndex - 1;
                updateImage(newIndex);
            });
        }
        
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                const newIndex = currentImageIndex === currentImages.length - 1 ? 0 : currentImageIndex + 1;
                updateImage(newIndex);
            });
        }
        
        thumbnails.forEach((t) => {
            t.addEventListener('click', () => {
                const index = parseInt(t.dataset.index);
                updateImage(index);
            });
        });
        
        dots.forEach((d) => {
            d.addEventListener('click', () => {
                const index = parseInt(d.dataset.index);
                updateImage(index);
            });
        });
    }

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

function updateImageSlider(images, fallbackImage) {
    const imageSection = document.querySelector('.product-image-section');
    const mainImage = document.getElementById('main-image');
    const currentImages = images && images.length > 0 ? images : (fallbackImage ? [fallbackImage] : []);
    
    if (currentImages.length === 0) return;
    
    // Update main image
    mainImage.src = currentImages[0];
    
    // Rebuild thumbnail strip
    const thumbnailStrip = imageSection.querySelector('.thumbnail-strip');
    if (thumbnailStrip) {
        if (currentImages.length > 1) {
            thumbnailStrip.innerHTML = currentImages.map((img, i) => `
                <img src="${img}" class="thumbnail ${i === 0 ? 'active' : ''}" data-index="${i}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 8px; cursor: pointer; border: 2px solid ${i === 0 ? '#8b5cf6' : 'transparent'}; transition: all 0.2s;">
            `).join('');
            
            // Re-attach thumbnail events
            thumbnailStrip.querySelectorAll('.thumbnail').forEach(t => {
                t.addEventListener('click', () => {
                    const index = parseInt(t.dataset.index);
                    document.getElementById('main-image').src = currentImages[index];
                    thumbnailStrip.querySelectorAll('.thumbnail').forEach((th, i) => {
                        th.style.borderColor = i === index ? '#8b5cf6' : 'transparent';
                    });
                });
            });
        } else {
            thumbnailStrip.style.display = 'none';
        }
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
