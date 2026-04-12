import { api } from './api.js';

const getUserId = () => {
    const user = JSON.parse(localStorage.getItem('currentUser') || sessionStorage.getItem('currentUser'));
    return user ? user.id : null;
};

export const addToCart = async (productId, quantity = 1, colorId = null, sizeId = null) => {
    const userId = getUserId();
    if (!userId) {
        alert("Please login to add items to cart");
        window.location.href = 'login.html';
        return;
    }

    try {
        await api.post('/cart', { productId, quantity, userId, colorId, sizeId });
        await updateCartCount();
    } catch (error) {
        console.error('Add to cart error:', error);
        // Re-throw with meaningful message
        throw new Error(error.error || error.message || 'Failed to add to cart');
    }
};

export const getCartItems = async () => {
    const userId = getUserId();
    if (!userId) return [];

    try {
        return await api.get(`/cart?userId=${userId}`);
    } catch (error) {
        console.error('Get cart error:', error);
        return [];
    }
};

export const updateCartQuantity = async (id, quantity) => {
    try {
        await api.put(`/cart/${id}`, { quantity });
        await updateCartCount();
    } catch (error) {
        console.error('Update quantity error:', error);
    }
};

export const removeFromCart = async (id) => {
    try {
        await api.delete(`/cart/${id}`);
        await updateCartCount();
    } catch (error) {
        console.error('Remove item error:', error);
    }
};

export const clearCart = async () => {
    const userId = getUserId();
    if (!userId) return;
    try {
        await api.delete(`/cart?userId=${userId}`);
        await updateCartCount();
    } catch (error) {
        console.error('Clear cart error:', error);
    }
};

export const updateCartCount = async () => {
    const items = await getCartItems();
    const count = items.reduce((sum, item) => sum + item.quantity, 0);
    document.querySelectorAll('.cart-count').forEach(el => el.textContent = count);
};

// Checkout logic (simulated)
document.addEventListener('DOMContentLoaded', () => {
    const checkoutBtn = document.getElementById("proceed-to-checkout");
    if (!checkoutBtn) return;

    checkoutBtn.addEventListener("click", async () => {
        const items = await getCartItems();
        if (items.length === 0) {
            alert("Your cart is empty");
            return;
        }
        // Save items to local storage just for the checkout page display (if that page is static)
        // or the checkout page could fetch from API too. 
        // For compability with existing checkout.html (which likely reads from localStorage or previously passed data),
        // we'll update checkout.html or just pass data via localStorage "checkoutItems".
        localStorage.setItem("checkoutItems", JSON.stringify(items));

        // Clear cart on backend? 
        // Usually you clear AFTER payment. But here we just simulating.
        // Let's keep it in cart until "Pay" is clicked on checkout page.

        window.location.href = "checkout.html";
    });
});
