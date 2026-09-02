import {
    api,
    getAccessToken,
    setAccessToken,
    clearAuthStorage,
    refreshAccessToken
} from './api.js';

const getStoredUser = () => {
    try {
        return JSON.parse(
            localStorage.getItem('currentUser') ||
            sessionStorage.getItem('currentUser') ||
            'null'
        );
    } catch (error) {
        return null;
    }
};

const storeUser = (user, remember = false) => {
    localStorage.removeItem('currentUser');
    sessionStorage.removeItem('currentUser');
    (remember ? localStorage : sessionStorage).setItem('currentUser', JSON.stringify(user));
};

// Restore the user from the HttpOnly refresh cookie when a page opens in a
// new tab or after the short-lived access token has been cleared.
const restoreSession = async () => {
    const storedUser = getStoredUser();
    if (!storedUser && !getAccessToken()) return null;
    if (getAccessToken() && storedUser) return storedUser;

    const result = await refreshAccessToken();
    if (result?.user) {
        storeUser(result.user, Boolean(localStorage.getItem('currentUser')));
        return result.user;
    }

    if (storedUser) clearAuthStorage();
    return null;
};

const initAuth = () => {
    const currentUser = getStoredUser();
    if (currentUser) updateAuthUI(currentUser);

    const loginForm = document.getElementById('login-form');
    if (loginForm) loginForm.addEventListener('submit', handleLogin);

    const signupForm = document.getElementById('signup-form');
    if (signupForm) signupForm.addEventListener('submit', handleSignup);
};

const handleLogin = async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const rememberMe = document.getElementById('remember-me')?.checked;

    if (!email || !password) {
        alert('Please fill in all fields');
        return;
    }

    try {
        const result = await api.post('/auth/login', { email, password, rememberMe });
        finishLogin(result.user, result.accessToken, rememberMe);
    } catch (error) {
        console.error('Login error:', error);
        alert(error.message || 'Login failed');
    }
};

const finishLogin = (user, accessToken, remember = false) => {
    setAccessToken(accessToken);
    storeUser(user, remember);
    updateAuthUI(user);

    alert('Login successful!');
    setTimeout(() => {
        window.location.href = user.role === 'admin' ? 'admin.html' : 'index.html';
    }, 1000);
};

const handleSignup = async (e) => {
    e.preventDefault();
    const fullname = document.getElementById('fullname').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;

    if (password !== confirmPassword) {
        alert('Passwords do not match');
        return;
    }

    try {
        const result = await api.post('/auth/signup', { name: fullname, email, password });
        finishLogin(result.user, result.accessToken, true);
        alert('Account created successfully!');
    } catch (error) {
        console.error('Signup error:', error);
        alert(error.message || 'Signup failed');
    }
};

const updateAuthUI = (user) => {
    const loginLink = document.querySelector('a[href="login.html"]');
    if (user && loginLink) {
        loginLink.textContent = `Hi, ${user.name}`;
        loginLink.href = '#';
        loginLink.onclick = async (e) => {
            e.preventDefault();
            if (confirm('Logout?')) await logout();
        };
    }
};

const logout = async () => {
    try {
        await api.post('/auth/logout');
    } catch (error) {
        console.error('Logout error:', error);
    } finally {
        clearAuthStorage();
        window.location.href = 'index.html';
    }
};

export {
    initAuth,
    logout,
    updateAuthUI,
    restoreSession,
    getStoredUser
};