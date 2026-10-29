import { api } from './api.js';

async function getProducts(category = null) {
    try {
        const endpoint = category ? `/products?category=${category}` : '/products';
        const products = await api.get(endpoint);
        return products;
    } catch (error) {
        console.error('Error fetching products:', error);
        return [];
    }
}

async function getProductsPage(options = {}, requestOptions = {}) {
    try {
        const params = new URLSearchParams();
        Object.entries(options).forEach(([key, value]) => {
            if (value !== null && value !== undefined && value !== '') {
                params.set(key, value);
            }
        });

        const response = await api.get(`/products?${params.toString()}`, requestOptions);
        if (Array.isArray(response)) {
            return {
                items: response,
                pagination: {
                    page: Number(options.page) || 1,
                    limit: Number(options.limit) || response.length,
                    total: response.length,
                    totalPages: response.length ? 1 : 0,
                    hasNextPage: false,
                    hasPreviousPage: false
                }
            };
        }
        return response;
    } catch (error) {
        console.error('Error fetching product page:', error);
        throw error;
    }
}

async function getProductMeta() {
    try {
        return await api.get('/products/meta');
    } catch (error) {
        console.error('Error fetching product filter metadata:', error);
        return { categories: [], colors: [] };
    }
}

const getProductById = async (id) => {
    try {
        return await api.get(`/products/${id}`);
    } catch (error) {
        console.error('Error fetching product:', error);
        return null;
    }
};

// Seed function not needed on frontend anymore
const seedProducts = async () => { };

export { getProducts, getProductsPage, getProductMeta, getProductById, seedProducts };