// assets/js/app.js
import { updateAuthUI, initAuth, restoreSession } from './auth.js';
import { getProductsPage, getProductMeta } from './products.js';
import { addToCart, updateCartCount, getCartItems, updateCartQuantity, removeFromCart } from './cart.js';

const SHIPPING_FEE = 90;
const PRODUCT_PAGE_SIZE = 8;
let productsRequestId = 0;
let searchDebounceTimer;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    // Auth UI
    initAuth();
    const currentUser = await restoreSession();
    updateAuthUI(currentUser);

    // Mobile menu
    const menuBtn = document.getElementById('menu-btn');
    const navLinks = document.querySelector('.nav-links');
    if (menuBtn && navLinks) {
        menuBtn.addEventListener('click', () => {
            navLinks.classList.toggle('active');
        });
    }

    try {
        // Fetch the cart once. The cart page reuses this response instead of
        // making a second identical request during initialization.
        const initialCartItems = await getCartItems();
        updateCartCount(initialCartItems);

        // Load products if on a product page
        const productGrids = document.querySelectorAll('.products-grid');
        if (productGrids.length > 0) {
            const initialSort = document.getElementById('sort-by')?.value || null;
            await Promise.all([
                loadProducts(null, null, initialSort),
                populateFilters()
            ]);

            // Filter/Sort listeners
            const categoryFilter = document.getElementById('category-filter');
            const colorFilter = document.getElementById('color-filter');
            const sortBy = document.getElementById('sort-by');
            const searchInput = document.getElementById('search-input');
            const searchBtn = document.getElementById('search-btn');

            if (categoryFilter) {
                categoryFilter.addEventListener('change', () => {
                    loadProducts(categoryFilter.value, colorFilter ? colorFilter.value : null, sortBy ? sortBy.value : null, searchInput ? searchInput.value : null);
                });
            }

            if (colorFilter) {
                colorFilter.addEventListener('change', () => {
                    loadProducts(categoryFilter ? categoryFilter.value : null, colorFilter.value, sortBy ? sortBy.value : null, searchInput ? searchInput.value : null);
                });
            }

            if (sortBy) {
                sortBy.addEventListener('change', () => {
                    loadProducts(categoryFilter ? categoryFilter.value : null, colorFilter ? colorFilter.value : null, sortBy.value, searchInput ? searchInput.value : null);
                });
            }

            if (searchInput) {
                searchInput.addEventListener('input', () => {
                    clearTimeout(searchDebounceTimer);
                    searchDebounceTimer = setTimeout(() => {
                        loadProducts(categoryFilter ? categoryFilter.value : null, colorFilter ? colorFilter.value : null, sortBy ? sortBy.value : null, searchInput.value, 1);
                    }, 250);
                });
                
                searchInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        clearTimeout(searchDebounceTimer);
                        loadProducts(categoryFilter ? categoryFilter.value : null, colorFilter ? colorFilter.value : null, sortBy ? sortBy.value : null, searchInput.value, 1);
                    }
                });
            }

            if (searchBtn) {
                searchBtn.addEventListener('click', () => {
                    loadProducts(categoryFilter ? categoryFilter.value : null, colorFilter ? colorFilter.value : null, sortBy ? sortBy.value : null, searchInput ? searchInput.value : null);
                });
            }
        }

        // Load product slider if on index page
        const productSlider = document.getElementById('product-slider');
        if (productSlider) {
            await loadProductSlider();
            initSliderControls();
        }

        // Initialize cart page if present
        if (document.getElementById('cart-items')) {
            await renderCartPage(initialCartItems);
        }

        // Add to cart delegation
        document.addEventListener('click', (e) => {
            if (e.target.closest('.add-to-cart')) {
                e.preventDefault();
                e.stopPropagation();
                const btn = e.target.closest('.add-to-cart');
                const productId = parseInt(btn.dataset.productId);
                let colorId = btn.dataset.colorId; // Get color ID from button data
                
                // Validate colorId - if it's null, undefined, or empty string, set to null
                if (colorId === 'null' || colorId === 'undefined' || colorId === '') {
                    colorId = null;
                }
                
                let quantity = 1;
                const scope = btn.closest('div') || document;
                const qtyInput = scope.querySelector('.quantity-input');
                if (qtyInput) {
                    const q = parseInt(qtyInput.value);
                    if (!isNaN(q) && q > 0) quantity = q;
                }
                if (productId) {
                    addToCart(productId, quantity, colorId ? parseInt(colorId) : null).then(() => {
                        // success - show notification
                        showNotification('Item added to cart!');
                    }).catch(error => {
                        console.error('Add to cart error:', error);
                        alert(error.message || 'Failed to add to cart');
                    });
                }
            }
        });

    } catch (error) {
        console.error('Error initializing app:', error);
    }
});

// Populate both filters with one small metadata request.
async function populateFilters() {
    const categoryFilter = document.getElementById('category-filter');
    const colorFilter = document.getElementById('color-filter');
    if (!categoryFilter && !colorFilter) return;

    try {
        const { categories = [], colors = [] } = await getProductMeta();

        if (categoryFilter) {
            categoryFilter.innerHTML = '<option value="">All Categories</option>';
            categories.forEach(category => {
                const option = document.createElement('option');
                option.value = category.toLowerCase();
                option.textContent = category.charAt(0).toUpperCase() + category.slice(1);
                categoryFilter.appendChild(option);
            });
        }

        if (colorFilter) {
            colorFilter.innerHTML = '<option value="">All Colors</option>';
            colors.forEach(color => {
                const option = document.createElement('option');
                option.value = color.toLowerCase();
                option.textContent = color;
                colorFilter.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error populating catalog filters:', error);
    }
}

function productSkeletonMarkup(count = PRODUCT_PAGE_SIZE) {
    return Array.from({ length: count }, () => `
        <div class="product-card skeleton-card" aria-hidden="true">
            <div class="skeleton skeleton-product-image"></div>
            <div class="skeleton-card-content">
                <div class="skeleton skeleton-line skeleton-line-short"></div>
                <div class="skeleton skeleton-line"></div>
                <div class="skeleton skeleton-line skeleton-line-price"></div>
                <div class="skeleton skeleton-button"></div>
            </div>
        </div>
    `).join('');
}

function showProductSkeletons() {
    document.querySelectorAll('.products-grid').forEach(container => {
        container.innerHTML = productSkeletonMarkup();
    });
}

function renderPagination(pagination, filters) {
    const container = document.getElementById('products-pagination');
    if (!container || !pagination || pagination.totalPages <= 1) {
        if (container) container.innerHTML = '';
        return;
    }

    const { page, totalPages } = pagination;
    const button = (label, targetPage, disabled = false, current = false) => `
        <button class="pagination-btn${current ? ' active' : ''}" data-page="${targetPage}" ${disabled ? 'disabled' : ''}>
            ${label}
        </button>
    `;
    const pages = [];
    const start = Math.max(1, page - 2);
    const end = Math.min(totalPages, page + 2);
    for (let pageNumber = start; pageNumber <= end; pageNumber += 1) {
        pages.push(button(pageNumber, pageNumber, false, pageNumber === page));
    }

    container.innerHTML = `
        ${button('<i class="ri-arrow-left-s-line"></i>', page - 1, !pagination.hasPreviousPage)}
        <div class="pagination-pages">${pages.join('')}</div>
        ${button('<i class="ri-arrow-right-s-line"></i>', page + 1, !pagination.hasNextPage)}
    `;
    container.querySelectorAll('[data-page]').forEach(control => {
        control.addEventListener('click', () => {
            const targetPage = Number(control.dataset.page);
            if (targetPage > 0) {
                loadProducts(filters.category, filters.color, filters.sortBy, filters.searchQuery, targetPage);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });
    });
}

async function loadProducts(category = null, color = null, sortBy = null, searchQuery = null, page = 1) {
    const containers = document.querySelectorAll('.products-grid');
    if (containers.length === 0) return;

    const requestId = ++productsRequestId;
    const filters = { category, color, sortBy, searchQuery };
    showProductSkeletons();

    try {
        const response = await getProductsPage({
            page,
            limit: PRODUCT_PAGE_SIZE,
            category,
            color,
            sort: sortBy,
            search: searchQuery
        });
        if (requestId !== productsRequestId) return;

        const products = response.items || [];
        renderPagination(response.pagination, filters);

        if (products.length === 0) {
            containers.forEach(container => {
                container.innerHTML = '<p class="no-products">No products found matching your criteria.</p>';
            });
            return;
        }

        const html = products.map(product => {
            const hasDiscount = product.discount && product.discount > 0;
            const hasColors = product.colors && product.colors.length > 0;

            // Calculate total stock from all colors
            const totalStock = hasColors
                ? product.colors.reduce((sum, color) => sum + (color.stock || 0), 0)
                : product.stock || 0;

            // Determine stock badge
            let stockBadgeClass = 'out-of-stock';
            let stockBadgeText = 'Out of Stock';
            if (totalStock > 10) {
                stockBadgeClass = 'in-stock';
                stockBadgeText = 'In Stock';
            } else if (totalStock > 0) {
                stockBadgeClass = 'low-stock';
                stockBadgeText = `Only ${totalStock} left`;
            }

            return `
                <div class="product-card">
                    <span class="stock-badge ${stockBadgeClass}">${stockBadgeText}</span>
                    <div class="product-image-container">
                        <img src="${product.image}" alt="${product.name}" loading="lazy" decoding="async" onclick="window.location.href='product-detail.html?id=${product.id}'">
                        <button class="share-btn" onclick="shareProduct(${product.id}, '${product.name}')" title="Share product">
                            <i class="ri-share-line"></i>
                        </button>
                    </div>
                    <div class="product-info">
                        ${product.category ? `<p class="category">${product.category}</p>` : ''}
                        <h3 onclick="window.location.href='product-detail.html?id=${product.id}'">${product.name}</h3>
                        
                        <div class="price-container">
                            ${hasDiscount ? `
                                <span class="original-price">EGP ${product.originalPrice.toFixed(2)}</span>
                                <span class="price">${product.price.toFixed(2)}EGP</span>
                                
                            ` : `
                                <span class="price">${product.price ? product.price.toFixed(2) : '0.00'}EGP</span>
                            `}
                        </div>

                        ${hasColors ? `
                            <div class="color-preview">
                                ${product.colors.slice(0, 5).map((color, index) => `
                                    <div 
                                        class="color-dot clickable" 
                                        style="background-color: ${color.colorCode}; ${color.colorCode === '#FFFFFF' || color.colorCode === '#ffffff' ? 'border-color: #999;' : ''}"
                                        title="${color.colorName}"
                                        data-product-id="${product.id}"
                                        data-color-id="${color.id}"
                                        data-color-image="${color.image || product.image}"
                                        onclick="changeProductImage(this, ${product.id})"
                                    ></div>
                                `).join('')}
                                ${product.colors.length > 5 ? `<span style="font-size: 0.85rem; color: #666;">+${product.colors.length - 5} more</span>` : ''}
                            </div>
                        ` : ''}

                        <button class="btn add-to-cart" data-product-id="${product.id}" ${hasColors ? `data-color-id="${product.colors[0].id}"` : ''} ${totalStock === 0 ? 'disabled' : ''}>
                            <i class="ri-shopping-cart-line"></i> Add to Cart
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        containers.forEach(container => {
            container.innerHTML = html;
        });
    } catch (error) {
        console.error('Error loading products:', error);
        if (requestId === productsRequestId) {
            containers.forEach(container => {
                container.innerHTML = `
                    <div class="catalog-error">
                        <i class="ri-wifi-off-line"></i>
                        <p>We couldn't load the products right now.</p>
                        <button class="btn retry-products">Try again</button>
                    </div>
                `;
                container.querySelector('.retry-products')?.addEventListener('click', () => {
                    loadProducts(category, color, sortBy, searchQuery, page);
                });
            });
        }
    }
}

function cartSkeletonMarkup(count = 2) {
    return Array.from({ length: count }, () => `
        <div class="cart-item cart-skeleton" aria-hidden="true">
            <div class="skeleton skeleton-cart-image"></div>
            <div class="cart-skeleton-details">
                <div class="skeleton skeleton-line skeleton-line-short"></div>
                <div class="skeleton skeleton-line"></div>
                <div class="skeleton skeleton-line skeleton-line-price"></div>
            </div>
            <div class="cart-skeleton-actions">
                <div class="skeleton skeleton-button"></div>
                <div class="skeleton skeleton-line skeleton-line-short"></div>
            </div>
        </div>
    `).join('');
}

async function renderCartPage(items = null) {
    const container = document.getElementById('cart-items');
    const subtotalEl = document.getElementById('subtotal');
    const shippingEl = document.getElementById('shipping-fee');
    const totalEl = document.getElementById('total');
    if (!container) return;

    try {
        if (items === null) {
            container.innerHTML = cartSkeletonMarkup();
            items = await getCartItems();
        }
        updateCartCount(items);

        if (!items || items.length === 0) {
            container.innerHTML = `
                <div class="empty-cart">
                    <p>Your cart is empty</p>
                    <a href="products.html" class="btn">Continue Shopping</a>
                </div>`;
            if (subtotalEl) subtotalEl.textContent = 'EGP 0.00';
            if (shippingEl) shippingEl.textContent = 'EGP 0.00';
            if (totalEl) totalEl.textContent = 'EGP 0.00';
            return;
        }

        let subtotal = 0;
        const html = items.map(item => {
            // item already includes product details from the API join
            const line = item.price * item.quantity;
            subtotal += line;
            
            // Use color-specific image if available, otherwise main product image
            const displayImage = item.colorImage || item.image;
            const variantDisplay = [];
            if (item.colorName) variantDisplay.push(`Color: ${item.colorName}`);
            if (item.sizeName) variantDisplay.push(`Size: ${item.sizeName}`);
            const variantInfo = variantDisplay.length > 0 ? `<p class="variant-info" style="font-size: 0.9rem; color: #666;">${variantDisplay.join(' | ')}</p>` : '';
            
            return `
            <div class="cart-item" data-id="${item.id}" data-product-id="${item.productId}">
                <img src="${displayImage}" alt="${item.name}" class="cart-item-image" loading="lazy" decoding="async" style="width: 80px; height: 80px; object-fit: cover; margin-right: 1rem;" />
                <div class="cart-item-details" style="flex: 1;">
                    <h3>${item.name}</h3>
                    ${variantInfo}
                    <p class="price">${item.price.toFixed(2)}EGP</p>
                    <div class="quantity-controls" style="margin: 0.5rem 0;">
                        <input type="number" class="qty-input" min="1" value="${item.quantity}" style="width: 50px;" />
                    </div>
                </div>
                <div class="actions">
                     <button class="btn btn-outline remove-item" style="color: red; border-color: red;">Remove</button>
                     <div class="line-total" style="font-weight: bold;">EGP ${line.toFixed(2)}</div>
                </div>
            </div>`;
        }).join('');

        container.innerHTML = html;
        if (subtotalEl) subtotalEl.textContent = `EGP ${subtotal.toFixed(2)}`;
        if (shippingEl) shippingEl.textContent = `EGP ${SHIPPING_FEE.toFixed(2)}`;
        if (totalEl) totalEl.textContent = `EGP ${(subtotal + SHIPPING_FEE).toFixed(2)}`;

        // Helper to update UI line total
        const updateLineTotal = (itemEl, price, qty) => {
            const lineTotal = itemEl.querySelector('.line-total');
            lineTotal.textContent = `EGP ${(price * qty).toFixed(2)}`;
        };

        // Events
        container.onchange = async (e) => {
            if (e.target.classList.contains('qty-input')) {
                const itemEl = e.target.closest('.cart-item');
                const id = itemEl.dataset.id; // cart item id
                const price = parseFloat(itemEl.querySelector('.price').textContent.replace('EGP', ''));
                const qty = parseInt(e.target.value);

                if (qty > 0) {
                    updateLineTotal(itemEl, price, qty);
                    await updateCartQuantity(id, qty);
                    // refresh whole cart to get correct totals is safest, or just update totals manually
                    await renderCartPage();
                }
            }
        };

        container.onclick = async (e) => {
            if (e.target.classList.contains('remove-item')) {
                const itemEl = e.target.closest('.cart-item');
                const id = itemEl.dataset.id;
                await removeFromCart(id);
                await renderCartPage();
            }
        };

    } catch (err) {
        console.error("Error rendering cart:", err);
    }
}

// Product Slider Functions
function showSliderSkeleton() {
    const slider = document.getElementById('product-slider');
    if (!slider) return;
    slider.innerHTML = Array.from({ length: 4 }, () => `
        <div class="slider-product-card slider-skeleton" aria-hidden="true">
            <div class="skeleton skeleton-slider-image"></div>
            <div class="product-info">
                <div class="skeleton skeleton-line"></div>
                <div class="skeleton skeleton-line skeleton-line-price"></div>
            </div>
        </div>
    `).join('');
}

async function loadProductSlider() {
    const slider = document.getElementById('product-slider');
    if (!slider) return;
    showSliderSkeleton();

    try {
        const response = await getProductsPage({
            page: 1,
            limit: 12,
            sort: 'newest',
            inStock: true
        });
        const products = response.items || [];

        // Create slider items for all product color variants
        const sliderItems = [];
        
        products.forEach(product => {
            if (product.colors && product.colors.length > 0) {
                // Add each color variant as a separate slider item
                product.colors.forEach(color => {
                    // Only show color variants that can currently be purchased.
                    if (Number(color.stock) > 0) {
                        sliderItems.push({
                            ...product,
                            selectedColor: color,
                            displayImage: color.image || product.image,
                            displayPrice: color.price || product.price,
                            colorName: color.colorName,
                            colorCode: color.colorCode,
                            stock: Number(color.stock)
                        });
                    }
                });
            } else {
                // Add product without color variants
                if (Number(product.stock) > 0) {
                    sliderItems.push({
                        ...product,
                        selectedColor: null,
                        displayImage: product.image,
                        displayPrice: product.price,
                        colorName: null,
                        colorCode: null,
                        stock: Number(product.stock)
                    });
                }
            }
        });

        if (sliderItems.length === 0) {
            slider.innerHTML = '<p class="no-products">No products available.</p>';
            return;
        }

        const html = sliderItems.map(item => {
            const hasDiscount = item.discount && item.discount > 0;
            return `
                <div class="slider-product-card" onclick="window.location.href='product-detail.html?id=${item.id}${item.selectedColor ? '&color=' + item.selectedColor.id : ''}'">
                    <img src="${item.displayImage}" alt="${item.name}" loading="lazy" decoding="async">
                    <div class="product-info">
                        <h3>${item.name}</h3>
                        ${item.colorName ? `
                            <div class="color-info">
                                <div class="color-dot" style="background-color: ${item.colorCode}; ${item.colorCode === '#FFFFFF' || item.colorCode === '#ffffff' ? 'border-color: #999;' : ''}"></div>
                                <span>${item.colorName}</span>
                            </div>
                        ` : ''}
                        <div class="price">
                            ${hasDiscount ? `
                                <span class="original-price">EGP ${item.originalPrice ? item.originalPrice.toFixed(2) : ''}</span> <br>
                                <span class="decreased">EGP ${item.displayPrice.toFixed(2)}</span>
                            ` : `EGP ${item.displayPrice.toFixed(2)}`}
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        slider.innerHTML = html;
    } catch (error) {
        console.error('Error loading product slider:', error);
        slider.innerHTML = '<p class="no-products">Products are temporarily unavailable.</p>';
    }
}

function initSliderControls() {
    const slider = document.getElementById('product-slider');
    const prevBtn = document.getElementById('slider-prev');
    const nextBtn = document.getElementById('slider-next');
    
    if (!slider || !prevBtn || !nextBtn) return;

    const scrollAmount = 300; // Adjust scroll amount as needed

    prevBtn.addEventListener('click', () => {
        slider.scrollBy({
            left: -scrollAmount,
            behavior: 'smooth'
        });
    });

    nextBtn.addEventListener('click', () => {
        slider.scrollBy({
            left: scrollAmount,
            behavior: 'smooth'
        });
    });

    // Optional: Auto-scroll functionality
    let autoScrollInterval;
    let isPaused = false;

    const startAutoScroll = () => {
        if (!isPaused) {
            autoScrollInterval = setInterval(() => {
                if (slider.scrollLeft >= slider.scrollWidth - slider.clientWidth) {
                    slider.scrollTo({ left: 0, behavior: 'smooth' });
                } else {
                    slider.scrollBy({ left: 150, behavior: 'smooth' });
                }
            }, 3000);
        }
    };

    const stopAutoScroll = () => {
        clearInterval(autoScrollInterval);
    };

    // Pause auto-scroll on hover
    slider.addEventListener('mouseenter', () => {
        isPaused = true;
        stopAutoScroll();
    });

    slider.addEventListener('mouseleave', () => {
        isPaused = false;
        startAutoScroll();
    });

    // Start auto-scroll
    startAutoScroll();
}

// Share product function
function shareProduct(productId, productName) {
    event.stopPropagation();
    
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

// Change product image when color is clicked
window.changeProductImage = function(colorDot, productId) {
    event.stopPropagation();
    
    // Get the color image and color ID
    const colorImage = colorDot.dataset.colorImage;
    const colorId = colorDot.dataset.colorId;
    
    // Update product image
    const productCard = colorDot.closest('.product-card');
    const productImage = productCard.querySelector('.product-image-container img');
    if (productImage && colorImage) {
        productImage.src = colorImage;
    }
    
    // Update add to cart button with selected color ID
    const addToCartBtn = productCard.querySelector('.add-to-cart');
    if (addToCartBtn && colorId) {
        addToCartBtn.dataset.colorId = colorId;
    }
};
