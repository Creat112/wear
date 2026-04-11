// Premium Admin JS for Secondary Site (API Integrated)
import { api } from './api.js';

// Auth Check
const currentUser = JSON.parse(sessionStorage.getItem('currentUser') || localStorage.getItem('currentUser'));
if (!currentUser || currentUser.role !== 'admin') {
    window.location.href = 'login.html';
    throw new Error('Not authenticated or authorized');
}

document.addEventListener('DOMContentLoaded', async () => {
    initDashboard();
    initModalLogic();
    initOrderDetailsModal();

    // Logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('currentUser');
            sessionStorage.removeItem('currentUser');
            window.location.href = 'login.html';
        });
    }

    // Export CSV
    const exportBtn = document.getElementById('export-orders');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportOrdersCSV);
    }

    const searchInput = document.getElementById('order-search');
    if (searchInput) {
        searchInput.addEventListener('input', () => loadOrders());
    }

    const addDiscountBtn = document.getElementById('btn-add-discount');
    if (addDiscountBtn) {
        addDiscountBtn.addEventListener('click', () => {
            const code = document.getElementById('new-discount-code').value;
            const value = document.getElementById('new-discount-percent').value;
            if (code && value) addDiscount(code, value);
        });
    }
});

function initDashboard() {
    // Tab Navigation
    const navItems = document.querySelectorAll('.nav-item[data-tab]');
    const views = document.querySelectorAll('.view-panel');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const targetTab = item.dataset.tab;

            // Update UI
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            views.forEach(view => view.classList.remove('active'));
            document.getElementById(`tab-${targetTab}`).classList.add('active');

            // Load Data
            if (targetTab === 'products') loadProducts();
            if (targetTab === 'orders') loadOrders();
            if (targetTab === 'stats') loadStats();
            if (targetTab === 'discounts') loadDiscounts();
        });
    });

    // Default Load
    loadStats();

    // Polling for new orders (every 15s)
    setInterval(pollOrders, 15000);
}

// ------ API WRAPPERS ------
const getAllProducts = async () => {
    try {
        return await api.get('/products?includeDisabled=true');
    } catch (err) {
        console.error('Error fetching products:', err);
        return [];
    }
};

const getProductById = async (id) => {
    // Since API doesn't have explicit getById in original, we filter from all
    // Or we can use the /products/:id if it exists. Original didn't use it, but safe to assume standard REST
    // Actually, original used logic: products.find(x => x.id === id) from getAllProducts()
    const products = await getAllProducts();
    return products.find(p => p.id === id);
};

const getOrders = async () => {
    try {
        return await api.get('/orders');
    } catch (err) {
        console.error('Error fetching orders:', err);
        return [];
    }
};

const saveProduct = async (product) => {
    // If it's an update and image is empty, don't send it to prevent overwriting
    if (product.id && (!product.image || product.image === '')) {
        delete product.image;
    }

    // Convert ID to number if needed, though API likely handles it
    if (product.id) {
        return await api.put(`/products/${product.id}`, product);
    } else {
        return await api.post('/products', product);
    }
};

const deleteProduct = async (id) => {
    return await api.delete(`/products/${id}`);
};

const updateOrder = async (id, status) => {
    return await api.put(`/orders/${id}`, { status });
};

const deleteOrder = async (id) => {
    return await api.delete(`/orders/${id}`);
};


// ------ MODAL LOGIC ------
function initModalLogic() {
    const modal = document.getElementById('product-modal');
    const openBtn = document.getElementById('btn-add-product');
    const closeBtn = document.getElementById('close-modal');
    const form = document.getElementById('product-form');
    const addColorBtn = document.getElementById('add-color-btn');

    if (openBtn) {
        openBtn.addEventListener('click', () => {
            resetForm();
            modal.classList.add('active');
        });
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            modal.classList.remove('active');
        });
    }

    // Close on outside click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('active');
    });

    if (addColorBtn) {
        addColorBtn.addEventListener('click', () => addColorRow());
    }

    if (form) {
        form.addEventListener('submit', handleProductSubmit);
    }

    // Auto-calc logic
    const priceInput = document.getElementById('p-price');
    const discountInput = document.getElementById('p-discount');

    function updateCalc() {
        const p = parseFloat(priceInput.value) || 0;
        const d = parseFloat(discountInput.value) || 0;
        if (p > 0) {
            if (d > 0 && d < 100) {
                const orig = p / (1 - (d / 100));
                document.getElementById('p-original-price').value = orig.toFixed(2);
            } else {
                document.getElementById('p-original-price').value = p.toFixed(2);
            }
        }
    }

    if (priceInput) priceInput.addEventListener('input', updateCalc);
    if (discountInput) discountInput.addEventListener('input', updateCalc);
}

function resetForm() {
    document.getElementById('product-form').reset();
    document.getElementById('product-id').value = '';
    document.getElementById('colors-container').innerHTML = '';
    document.getElementById('modal-title').textContent = 'Add New Product';

    // Add one empty color variant by default
    addColorRow();
}

function addColorRow(data = null) {
    const container = document.getElementById('colors-container');
    const div = document.createElement('div');
    div.className = 'color-row';
    div.dataset.existingImage = data ? data.image : ''; // Store existing image for updates

    // HTML structure for color row - preserving "Image Upload" for variant
    div.innerHTML = `
        <div style="flex:1; display:flex; flex-direction:column; gap:4px;">
            <input class="c-name" placeholder="Color Name" value="${data ? data.colorName : ''}" required style="width:100%;">
            <input class="c-price" type="number" placeholder="Price" value="${data ? data.price : ''}" required style="width:100%;">
        </div>
        <div style="display:flex; flex-direction:column; gap:4px; align-items:center;">
             <input class="c-code" type="color" value="${data ? data.colorCode : '#000000'}" style="width: 40px; padding: 0; cursor: pointer;">
             <div style="position:relative;">
                <input class="c-image" type="file" accept="image/*" style="display:none;" id="file-${data ? data.id : Date.now()}">
                <label for="file-${data ? data.id : Date.now()}" class="btn-small" style="padding:4px 8px; font-size:16px; display:flex; align-items:center; justify-content:center; cursor:pointer;" title="Upload Variant Image">
                    <i class="ri-image-add-line"></i>
                </label>
             </div>
        </div>
        <div style="width:60px;">
            <input class="c-stock" type="number" placeholder="Qty" value="${data ? data.stock : 0}" required style="width: 100%;">
            <img class="c-preview" src="${data ? data.image : ''}" style="width:30px; height:30px; margin-top:4px; object-fit:cover; display:${data && data.image ? 'block' : 'none'}; border-radius:4px;">
        </div>
        <button type="button" onclick="this.parentElement.remove()" class="btn-small" style="background: rgba(239, 68, 68, 0.2); color: #ef4444; border:none; height: fit-content; align-self: center;"><i class="ri-delete-bin-line"></i></button>
    `;

    // Preview Logic for Variant Image
    const fileInput = div.querySelector('.c-image');
    const preview = div.querySelector('.c-preview');

    fileInput.addEventListener('change', async (e) => {
        if (e.target.files[0]) {
            try {
                const b64 = await compressImage(e.target.files[0], 400, 400, 0.8);
                const reader = new FileReader();
                reader.readAsDataURL(b64);
                reader.onload = () => {
                    preview.src = reader.result;
                    preview.style.display = 'block';
                    // We will store this in a data attribute or read it on submit
                    div.dataset.newImage = reader.result;
                };
            } catch (err) { console.error(err); }
        }
    });

    container.appendChild(div);
}

async function handleProductSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('product-id').value;
    const name = document.getElementById('p-name').value;
    const price = parseFloat(document.getElementById('p-price').value);
    const discount = parseFloat(document.getElementById('p-discount').value) || 0;
    const originalPrice = parseFloat(document.getElementById('p-original-price').value) || price;
    const category = document.getElementById('p-category').value;
    const desc = document.getElementById('p-desc').value;
    const imageInput = document.getElementById('p-image');

    // Handle Main Image
    let imageBase64 = '';

    // If editing, try to keep existing image (will be handled by API check, but good to have)
    if (id) {
        const existing = await getProductById(parseInt(id));
        if (existing) imageBase64 = existing.image;
    }

    if (imageInput.files && imageInput.files[0]) {
        // Compress main image
        const blob = await compressImage(imageInput.files[0]);
        imageBase64 = await blobToBase64(blob);
    }

    // Handle Colors
    const colors = [];
    const colorRows = document.querySelectorAll('.color-row');

    for (const row of colorRows) {
        const cPrice = parseFloat(row.querySelector('.c-price').value);
        const cStock = parseInt(row.querySelector('.c-stock').value) || 0;

        // Image logic: New Upload > Existing Data > Empty
        let cImage = row.dataset.newImage || row.dataset.existingImage || '';

        colors.push({
            colorName: row.querySelector('.c-name').value,
            colorCode: row.querySelector('.c-code').value,
            stock: cStock,
            price: cPrice,
            image: cImage
        });
    }

    const product = {
        id: id ? parseInt(id) : null,
        name,
        price,
        discount,
        originalPrice,
        category,
        description: desc,
        stock: colors.reduce((sum, c) => sum + c.stock, 0),
        colors: colors,
        image: imageBase64
    };

    try {
        await saveProduct(product);
        document.getElementById('product-modal').classList.remove('active');
        loadProducts();
    } catch (err) {
        alert('Error: ' + err.message);
    }
}

// ------ HELPERS (Compression) ------
function compressImage(file, maxWidth = 800, maxHeight = 800, quality = 0.7) {
    return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();

        img.onload = () => {
            let { width, height } = img;
            if (width > maxWidth || height > maxHeight) {
                const ratio = Math.min(maxWidth / width, maxHeight / height);
                width *= ratio;
                height *= ratio;
            }
            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);
            canvas.toBlob(resolve, 'image/jpeg', quality);
        };
        img.src = URL.createObjectURL(file);
    });
}

function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

// ------ PRODUCTS ------
async function loadProducts() {
    const list = document.getElementById('products-list');
    try {
        const products = await getAllProducts();
        if (products.length === 0) {
            list.innerHTML = '<div style="padding:20px; text-align:center; color:#94a3b8;">No products found. Add your first one!</div>';
            return;
        }

        let html = `
                <table>
                    <thead>
                        <tr>
                            <th>Product</th>
                            <th>Price</th>
                            <th>Stock</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        `;

        products.forEach(p => {
            html += `
                <tr style="${p.disabled ? 'opacity:0.5;' : ''}">
                    <td>
                        <div style="display:flex; align-items:center; gap:10px;">
                            <img src="${p.image || 'assets/images/placeholder.jpg'}" style="width:40px; height:40px; object-fit:cover; border-radius:6px; background:#334155;">
                            <div>
                                <div style="font-weight:500;">${p.name}</div>
                                <div style="font-size:12px; color:#94a3b8;">${p.category || 'Uncategorized'}</div>
                            </div>
                        </div>
                    </td>
                    <td>EGP ${p.price.toFixed(2)}</td>
                    <td>${p.stock}</td>
                    <td>
                        <span class="badge ${p.disabled ? 'cancelled' : 'delivered'}">${p.disabled ? 'Disabled' : 'Active'}</span>
                        ${(!p.colors || p.colors.length === 0) ? '<span style="color:#f59e0b; font-size:11px; margin-left:6px;" title="No color variants added">⚠️ No Colors</span>' : ''}
                    </td>
                    <td>
                        <button class="btn-small" onclick="editProduct(${p.id})">Edit</button>
                        <button class="btn-small" onclick="toggleProduct(${p.id})" style="margin-left:5px;">${p.disabled ? 'Enable' : 'Disable'}</button>
                        <button class="btn-small" onclick="removeProduct(${p.id})" style="color: #ef4444; border-color: rgba(239, 68, 68, 0.3); margin-left:5px;">Delete</button>
                    </td>
                </tr>
            `;
        });
        html += '</tbody></table>';
        list.innerHTML = html;
    } catch (err) { console.error(err); }
}

window.editProduct = async function (id) {
    const product = await getProductById(id);
    if (!product) return;

    resetForm();
    document.getElementById('modal-title').textContent = 'Edit Product';

    document.getElementById('product-id').value = product.id;
    document.getElementById('p-name').value = product.name;
    document.getElementById('p-price').value = product.price;
    document.getElementById('p-discount').value = product.discount || 0;
    document.getElementById('p-original-price').value = product.originalPrice || '';
    document.getElementById('p-category').value = product.category;
    document.getElementById('p-desc').value = product.description || '';

    // Clear default empty row
    document.getElementById('colors-container').innerHTML = '';

    if (product.colors && product.colors.length > 0) {
        product.colors.forEach(c => addColorRow(c));
    } else {
        addColorRow();
    }

    document.getElementById('product-modal').classList.add('active');
};

window.toggleProduct = async function (id) {
    const product = await getProductById(id);
    if (product) {
        await saveProduct({ ...product, disabled: !product.disabled });
        loadProducts();
    }
}

window.removeProduct = async function (id) {
    if (confirm('Delete this product permanently?')) {
        await deleteProduct(id);
        loadProducts();
    }
}

// ------ ORDERS ------
async function loadOrders() {
    const list = document.getElementById('orders-list');
    try {
        const orders = await getOrders();
        // Update global polling cache
        currentOrdersState = orders;

        const searchQuery = document.getElementById('order-search')?.value.toLowerCase() || '';

        if (!orders || orders.length === 0) {
            list.innerHTML = '<div style="padding:20px; text-align:center; color:#94a3b8;">No orders received yet.</div>';
            return;
        }

        let filteredOrders = orders;
        if (searchQuery) {
            filteredOrders = orders.filter(o => 
                (o.orderNumber || '').toLowerCase().includes(searchQuery) || 
                ('#' + o.id).toLowerCase().includes(searchQuery)
            );
        }

        filteredOrders.sort((a, b) => new Date(b.date) - new Date(a.date));

        let html = `
                <table>
                    <thead>
                        <tr>
                            <th>Order ID</th>
                            <th>Customer</th>
                            <th>Amount</th>
                            <th>Status/Method</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        `;

        filteredOrders.forEach(o => {
            html += `
                <tr>
                    <td><span style="font-family:monospace; color:#94a3b8;">${o.orderNumber || '#' + o.id}</span></td>
                    <td>
                        <div>${o.customer?.fullName || 'Guest'}</div>
                        <div style="font-size:11px; color:#94a3b8;">${new Date(o.date).toLocaleDateString()}</div>
                    </td>
                    <td>EGP ${(o.total || 0).toFixed(2)}</td>
                    <td>
                        <div style="display:flex; gap:5px; flex-wrap:wrap;">
                            <span class="badge ${o.status || 'pending'}">${o.status || 'Pending'}</span>
                            <span class="badge" style="background:#334155;">${o.paymentMethod === 'paymob' ? 'VISA' : 'CASH'}</span>
                        </div>
                    </td>
                    <td>
                        <button onclick="viewOrderDetails('${o.id}')" class="btn-small" style="margin-right:5px;">View Details</button>
                        <select onchange="changeOrderStatus('${o.id}', this.value)" style="background:transparent; color:#94a3b8; border:1px solid rgba(255,255,255,0.1); border-radius:4px; padding:4px;">
                            <option value="pending" ${o.status === 'pending' ? 'selected' : ''}>Pending</option>
                            <option value="processing" ${o.status === 'processing' ? 'selected' : ''}>Processing</option>
                            <option value="shipped" ${o.status === 'shipped' ? 'selected' : ''}>Shipped</option>
                            <option value="delivered" ${o.status === 'delivered' ? 'selected' : ''}>Delivered</option>
                            <option value="cancelled" ${o.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                        </select>
                        <button onclick="deleteOrderClick('${o.id}')" class="btn-small" style="margin-left:5px; color:#ef4444; border-color:rgba(239, 68, 68, 0.3);">Del</button>
                    </td>
                </tr>
            `;
        });
        html += '</tbody></table>';
        list.innerHTML = html;
    } catch (err) { console.error(err); }
}

window.changeOrderStatus = async function (id, status) {
    await updateOrder(id, status);
    // Notify logic in original was serverside or simulated. We just reload.
    loadOrders();
}

window.deleteOrderClick = async function (id) {
    if (confirm('Delete order? this cannot be undone.')) {
        await deleteOrder(id);
        loadOrders();
        loadStats();
    }
}

// ------ STATS ------
async function loadStats() {
    const orders = await getOrders();
    // Logic from original: Last 30 days
    const now = Date.now();
    const ms30 = 30 * 24 * 60 * 60 * 1000;
    const last30 = orders.filter(o => now - new Date(o.date).getTime() <= ms30);

    const totalRevenue = last30.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    const totalOrders = last30.length;
    const aov = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    document.getElementById('stat-revenue').textContent = `EGP ${totalRevenue.toFixed(2)}`;
    document.getElementById('stat-orders').textContent = totalOrders;
    document.getElementById('stat-aov').textContent = `EGP ${aov.toFixed(2)}`;

    // Populate recent activity
    const activityList = document.getElementById('recent-activity-list');
    if (activityList) {
        const recent = orders.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
        if (recent.length === 0) {
            activityList.innerHTML = '<p style="color:#94a3b8;">No recent activity.</p>';
        } else {
            activityList.innerHTML = recent.map(o => `
                <div style="display:flex; justify-content:space-between; padding:12px; border-bottom:1px solid rgba(255,255,255,0.05);">
                    <div>
                        <div style="font-weight:500;">Order ${o.orderNumber || '#' + o.id}</div>
                        <div style="font-size:12px; color:#94a3b8;">by ${o.customer?.fullName || 'Guest'}</div>
                    </div>
                    <div style="text-align:right;">
                        <div style="color: #10b981;">+EGP ${(o.total || 0).toFixed(2)}</div>
                        <div style="font-size:11px; color:#94a3b8;">${new Date(o.date).toLocaleTimeString()}</div>
                    </div>
                </div>
            `).join('');
        }
    }
}

// ------ POLLING ------
let currentOrdersState = [];
async function pollOrders() {
    const newOrders = await getOrders();
    if (newOrders.length > currentOrdersState.length && currentOrdersState.length > 0) {
        // Simple notification
        const div = document.createElement('div');
        div.style = `
            position: fixed; bottom: 20px; right: 20px; 
            background: #10b981; color: white; padding: 15px 25px; 
            border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.5);
            z-index: 2000; animation: slideUp 0.3s ease-out;
        `;
        div.textContent = `New Order Received!`;
        document.body.appendChild(div);
        setTimeout(() => div.remove(), 5000);

        loadOrders();
        loadStats();
    }
    currentOrdersState = newOrders;
}

// ------ CSV EXPORT ------
async function exportOrdersCSV() {
    const orders = await getOrders();
    if (!orders.length) return alert('No orders to export');

    const rows = [['orderNumber', 'date', 'total', 'customerName', 'customerEmail', 'shippingAddress', 'itemsJSON']];
    orders.forEach(o => {
        rows.push([
            o.orderNumber || '',
            o.date || '',
            o.total || 0,
            o.customer?.fullName || '',
            o.customer?.email || '',
            `${o.shipping?.address || ''}, ${o.shipping?.city || ''}, ${o.shipping?.governorate || ''}`,
            JSON.stringify(o.items || [])
        ]);
    });

    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orders_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

// ------ ORDER DETAILS MODAL ------
function initOrderDetailsModal() {
    const modal = document.getElementById('order-details-modal');
    const closeBtn = document.getElementById('close-order-modal');

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            modal.classList.remove('active');
        });
    }

    // Close on outside click
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.remove('active');
        });
    }
}

window.viewOrderDetails = async function (orderId) {
    try {
        const orders = await getOrders();
        const order = orders.find(o => o.id == orderId);
        
        if (!order) {
            console.error('Order not found. Looking for ID:', orderId, 'Available orders:', orders.map(o => ({ id: o.id, orderNumber: o.orderNumber })));
            alert('Order not found');
            return;
        }
        
        // Debug: Log order items to see what productImage contains
        console.log('Order items:', order.items?.map(item => ({ 
            name: item.name, 
            productImage: item.productImage,
            hasImage: !!item.productImage 
        })));

        const modal = document.getElementById('order-details-modal');
        const content = document.getElementById('order-details-content');

        content.innerHTML = `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
                <div>
                    <h3 style="margin-bottom: 10px; color: #10b981;">Order Information</h3>
                    <p><strong>Order Number:</strong> ${order.orderNumber || '#' + order.id}</p>
                    <p><strong>Date:</strong> ${new Date(order.date).toLocaleString()}</p>
                    <p><strong>Status:</strong> <span class="badge ${order.status || 'pending'}">${order.status || 'Pending'}</span></p>
                    <p><strong>Payment Method:</strong> ${order.paymentMethod === 'paymob' ? 'VISA/Card' : 'Cash on Delivery'}</p>
                    <p><strong>Total Amount:</strong> <strong style="color: #10b981;">EGP ${(order.total || 0).toFixed(2)}</strong></p>
                </div>
                <div>
                    <h3 style="margin-bottom: 10px; color: #3b82f6;">Customer Information</h3>
                    <p><strong>Name:</strong> ${order.customer?.fullName || 'N/A'}</p>
                    <p><strong>Email:</strong> ${order.customer?.email || 'N/A'}</p>
                    <p><strong>Phone:</strong> ${order.customer?.phone || 'N/A'}</p>
                </div>
            </div>
            
            <div style="margin-bottom: 20px;">
                <h3 style="margin-bottom: 10px; color: #f59e0b;">Shipping Address</h3>
                <p>${order.shipping?.address || 'N/A'}</p>
                <p>${order.shipping?.city || 'N/A'}, ${order.shipping?.governorate || 'N/A'}</p>
                ${order.shipping?.notes ? `<p><strong>Notes:</strong> ${order.shipping.notes}</p>` : ''}
            </div>
            
            <div>
                <h3 style="margin-bottom: 10px; color: #8b5cf6;">Order Items</h3>
                <div style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 8px;">
                    ${order.items && order.items.length > 0 ? order.items.map(item => `
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; padding: 15px 0; border-bottom: 1px solid rgba(255,255,255,0.1);">
                            <div style="display: flex; align-items: center; gap: 15px; flex: 1; min-width: 0;">
                                <img src="${item.productImage ? (item.productImage.startsWith('http') || item.productImage.startsWith('/') ? item.productImage : '/' + item.productImage) : 'products/Set/Sets Savax Black.jpeg'}" alt="${item.name}" onerror="this.src='/products/Set/Sets Savax Black.jpeg'" style="width: 60px; height: 60px; object-fit: cover; border-radius: 4px; flex-shrink: 0;">
                                <div style="flex: 1; min-width: 0;">
                                    <div style="font-weight: 500; word-wrap: break-word; overflow-wrap: break-word;">${item.name}</div>
                                    <div style="font-size: 12px; color: #94a3b8;">
                                        ${item.colorName && item.colorName.trim() ? `Color: ${item.colorName}` : '<span style="color:#f59e0b;">⚠️ No Color</span>'} | Qty: ${item.quantity}
                                    </div>
                                </div>
                            </div>
                            <div style="text-align: right; flex-shrink: 0; margin-left: 15px;">
                                <div style="font-weight: 500;">EGP ${(item.price * item.quantity).toFixed(2)}</div>
                                <div style="font-size: 12px; color: #94a3b8;">EGP ${item.price.toFixed(2)} each</div>
                            </div>
                        </div>
                    `).join('') : '<p>No items found</p>'}
                </div>
            </div>
        `;

        modal.classList.add('active');
    } catch (error) {
        console.error('Error loading order details:', error);
        alert('Error loading order details');
    }
};

// ------ DISCOUNTS ------
async function loadDiscounts() {
    const list = document.getElementById('discounts-list');
    try {
        const discounts = await api.get('/discounts');
        if (!discounts || discounts.length === 0) {
            list.innerHTML = '<div style="padding:20px; text-align:center; color:#94a3b8;">No discount codes added yet.</div>';
            return;
        }

        let html = `
            <table>
                <thead>
                    <tr>
                        <th>Code</th>
                        <th>Type</th>
                        <th>Value</th>
                        <th>Status</th>
                        <th>Created At</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
        `;

        discounts.forEach(d => {
            const discountType = d.discount_type || 'percentage';
            const valueDisplay = discountType === 'percentage' 
                ? `${d.percentage || d.discount_value || 0}%` 
                : `EGP ${d.fixed_amount || d.discount_value || 0}`;
            
            html += `
                <tr style="${!d.active ? 'opacity:0.5;' : ''}">
                    <td><strong>${d.code}</strong></td>
                    <td>${discountType === 'percentage' ? 'Percentage' : 'Fixed Amount'}</td>
                    <td>${valueDisplay}</td>
                    <td><span class="badge ${d.active ? 'delivered' : 'cancelled'}">${d.active ? 'Active' : 'Inactive'}</span></td>
                    <td>${new Date(d.created_at).toLocaleDateString()}</td>
                    <td>
                        <button class="btn-small" onclick="toggleDiscount(${d.id})" style="margin-right:5px;">${d.active ? 'Disable' : 'Enable'}</button>
                        <button class="btn-small" onclick="removeDiscount(${d.id})" style="color: #ef4444; border-color: rgba(239, 68, 68, 0.3);">Del</button>
                    </td>
                </tr>
            `;
        });
        html += '</tbody></table>';
        list.innerHTML = html;
    } catch (err) { console.error(err); }
}

async function addDiscount(code, value) {
    try {
        const discountTypeSelect = document.getElementById('discount-type');
        const discountType = discountTypeSelect?.value || 'percentage';
        
        const payload = { 
            code, 
            discount_type: discountType,
            [discountType === 'percentage' ? 'percentage' : 'fixed_amount']: parseFloat(value) 
        };
        
        await api.post('/discounts', payload);
        document.getElementById('new-discount-code').value = '';
        document.getElementById('new-discount-percent').value = '';
        loadDiscounts();
    } catch (err) {
        alert(err.message || 'Error occurred');
    }
}

window.toggleDiscount = async function(id) {
    try {
        await api.put(`/discounts/${id}/toggle`);
        loadDiscounts();
    } catch (err) { console.error(err); }
};

window.removeDiscount = async function(id) {
    if (confirm('Delete this discount code?')) {
        try {
            await api.delete(`/discounts/${id}`);
            loadDiscounts();
        } catch (err) { console.error(err); }
    }
};
