// Shared API client with short-lived access-token handling.
const API_BASE = '/api';
const ACCESS_TOKEN_KEY = 'accessToken';
let refreshPromise = null;

export const getAccessToken = () => sessionStorage.getItem(ACCESS_TOKEN_KEY);

export const setAccessToken = (token) => {
    if (token) {
        sessionStorage.setItem(ACCESS_TOKEN_KEY, token);
    } else {
        sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    }
};

export const clearAuthStorage = () => {
    sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem('currentUser');
    sessionStorage.removeItem('currentUser');
};

const updateStoredUser = (user) => {
    if (!user) return;
    const storage = localStorage.getItem('currentUser') ? localStorage : sessionStorage;
    storage.setItem('currentUser', JSON.stringify(user));
};

// The refresh token is an HttpOnly cookie, so JavaScript never reads it.
export const refreshAccessToken = async () => {
    if (refreshPromise) return refreshPromise;

    refreshPromise = (async () => {
        try {
            const response = await fetch(`${API_BASE}/auth/refresh`, {
                method: 'POST',
                credentials: 'same-origin'
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok || !result.accessToken) {
                setAccessToken(null);
                return null;
            }
            setAccessToken(result.accessToken);
            updateStoredUser(result.user);
            return result;
        } catch (error) {
            setAccessToken(null);
            return null;
        } finally {
            refreshPromise = null;
        }
    })();

    return refreshPromise;
};

const request = async (endpoint, { method = 'GET', data, retry = true } = {}) => {
    const headers = {};
    const token = getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    if (data !== undefined) headers['Content-Type'] = 'application/json';

    const response = await fetch(`${API_BASE}${endpoint}`, {
        method,
        headers,
        credentials: 'same-origin',
        body: data === undefined ? undefined : JSON.stringify(data)
    });
    const result = await response.json().catch(() => ({}));

    if (
        response.status === 401 &&
        retry &&
        !endpoint.startsWith('/auth/')
    ) {
        const refreshed = await refreshAccessToken();
        if (refreshed) {
            return request(endpoint, { method, data, retry: false });
        }
    }

    if (!response.ok) {
        const error = new Error(result.error || `API Error: ${response.statusText}`);
        error.status = response.status;
        throw error;
    }
    return result;
};

export const api = {
    get: endpoint => request(endpoint),
    post: (endpoint, data) => request(endpoint, { method: 'POST', data }),
    put: (endpoint, data) => request(endpoint, { method: 'PUT', data }),
    delete: endpoint => request(endpoint, { method: 'DELETE' })
};