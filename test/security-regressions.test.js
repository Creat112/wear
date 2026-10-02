const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const jwt = require('jsonwebtoken');

const dbPath = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), 'savx-security-tests-')),
    'test.sqlite'
);
process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-jwt';
process.env.SQLITE_PATH = dbPath;
process.env.NODE_ENV = 'test';
process.env.DB_HOST = '';
process.env.DB_USER = '';
process.env.DB_PASSWORD = '';
process.env.DB_NAME = '';
process.env.DB_PORT = '';

const { initDB, getDB } = require('../backend/database/init');
const app = require('../backend/server');

let server;
let baseUrl;

test.before(async () => {
    await initDB();
    server = await new Promise((resolve) => {
        const httpServer = app.listen(0, '127.0.0.1', () => resolve(httpServer));
    });
    baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    fs.rmSync(path.dirname(dbPath), { recursive: true, force: true });
});

async function request(pathname, options = {}) {
    const response = await fetch(`${baseUrl}${pathname}`, {
        ...options,
        headers: {
            ...(options.body ? { 'content-type': 'application/json' } : {}),
            ...(options.headers || {})
        }
    });
    const text = await response.text();
    return {
        response,
        body: text ? JSON.parse(text) : null
    };
}

function cookieValue(response) {
    const setCookie = response.headers.get('set-cookie') || '';
    const match = setCookie.match(/savx_refresh_token=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : null;
}

async function createUser(name, email, password = 'password-123') {
    const result = await request('/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ name, email, password })
    });
    assert.equal(result.response.status, 201);
    return {
        ...result.body,
        refreshToken: cookieValue(result.response)
    };
}

test('signup and login issue access tokens without exposing password hashes', async () => {
    const email = `security-login-${Date.now()}@example.test`;
    const signup = await createUser('Login Test', email);

    assert.equal(typeof signup.accessToken, 'string');
    assert.equal(signup.user.email, email);
    assert.equal(signup.user.role, 'customer');
    assert.equal('password' in signup.user, false);

    const login = await request('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password: 'password-123' })
    });
    assert.equal(login.response.status, 200);
    assert.equal(typeof login.body.accessToken, 'string');
    assert.equal('password' in login.body.user, false);
});

test('invalid and expired access tokens return 401, while customers cannot use admin routes', async () => {
    const invalid = await request('/api/auth/me', {
        headers: { authorization: 'Bearer not-a-jwt' }
    });
    assert.equal(invalid.response.status, 401);

    const expiredToken = jwt.sign(
        { sub: '1', role: 'customer' },
        process.env.JWT_SECRET,
        { algorithm: 'HS256', expiresIn: -1 }
    );
    const expired = await request('/api/auth/me', {
        headers: { authorization: `Bearer ${expiredToken}` }
    });
    assert.equal(expired.response.status, 401);

    const user = await createUser(
        'Authorization Test',
        `security-auth-${Date.now()}@example.test`
    );
    const adminRoute = await request('/api/products', {
        method: 'POST',
        headers: { authorization: `Bearer ${user.accessToken}` },
        body: JSON.stringify({ name: 'Not Authorized' })
    });
    assert.equal(adminRoute.response.status, 403);
});

test('refresh tokens rotate and logout revokes the active refresh token', async () => {
    const user = await createUser(
        'Refresh Test',
        `security-refresh-${Date.now()}@example.test`
    );
    assert.ok(user.refreshToken);

    const rotated = await request('/api/auth/refresh', {
        method: 'POST',
        headers: { cookie: `savx_refresh_token=${encodeURIComponent(user.refreshToken)}` }
    });
    assert.equal(rotated.response.status, 200);
    const rotatedRefreshToken = cookieValue(rotated.response);
    assert.ok(rotatedRefreshToken);
    assert.notEqual(rotatedRefreshToken, user.refreshToken);

    const reused = await request('/api/auth/refresh', {
        method: 'POST',
        headers: { cookie: `savx_refresh_token=${encodeURIComponent(user.refreshToken)}` }
    });
    assert.equal(reused.response.status, 401);

    const logout = await request('/api/auth/logout', {
        method: 'POST',
        headers: { cookie: `savx_refresh_token=${encodeURIComponent(rotatedRefreshToken)}` }
    });
    assert.equal(logout.response.status, 200);

    const afterLogout = await request('/api/auth/refresh', {
        method: 'POST',
        headers: { cookie: `savx_refresh_token=${encodeURIComponent(rotatedRefreshToken)}` }
    });
    assert.equal(afterLogout.response.status, 401);
});

test('cart and order reads are scoped to the authenticated account', async () => {
    const owner = await createUser(
        'Owner',
        `security-owner-${Date.now()}@example.test`
    );
    const otherUser = await createUser(
        'Other User',
        `security-other-${Date.now()}@example.test`
    );
    const pool = getDB();
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

    const [product] = await pool.execute(
        'INSERT INTO products (name, price, stock) VALUES (?, ?, ?)',
        ['Isolation Product', 25, 10]
    );
    const [ownerCart] = await pool.execute(
        'INSERT INTO cart (productId, quantity, userId, addedAt) VALUES (?, ?, ?, ?)',
        [product.insertId, 1, owner.user.id, now]
    );
    await pool.execute(
        'INSERT INTO cart (productId, quantity, userId, addedAt) VALUES (?, ?, ?, ?)',
        [product.insertId, 2, otherUser.user.id, now]
    );

    const otherCart = await request('/api/cart', {
        headers: { authorization: `Bearer ${otherUser.accessToken}` }
    });
    assert.equal(otherCart.response.status, 200);
    assert.equal(otherCart.body.length, 1);
    assert.equal(otherCart.body[0].quantity, 2);

    const ownerItemFromOtherAccount = await request(`/api/cart/${ownerCart.insertId}`, {
        method: 'PUT',
        headers: { authorization: `Bearer ${otherUser.accessToken}` },
        body: JSON.stringify({ quantity: 3 })
    });
    assert.equal(ownerItemFromOtherAccount.response.status, 404);

    await pool.execute(`
        INSERT INTO orders
            (orderNumber, userId, total, status, date, customerName, customerEmail,
             customerPhone, shippingAddress, shippingCity, shippingGov, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
        'SECURITY-OWNER-ORDER', owner.user.id, 25, 'pending', now,
        'Owner', 'owner@example.test', '01000000000', 'Private address',
        'Private city', 'Private governorate', 'Private notes'
    ]);
    const otherOrders = await request('/api/orders/mine', {
        headers: { authorization: `Bearer ${otherUser.accessToken}` }
    });
    assert.equal(otherOrders.response.status, 200);
    assert.equal(otherOrders.body.length, 0);
});

test('public order tracking omits customer contact and shipping details', async () => {
    const owner = await createUser(
        'Tracking Owner',
        `security-tracking-owner-${Date.now()}@example.test`
    );
    const otherUser = await createUser(
        'Tracking Visitor',
        `security-tracking-other-${Date.now()}@example.test`
    );
    const pool = getDB();
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const orderNumber = 'SECURITY-PUBLIC-ORDER';
    await pool.execute(`
        INSERT INTO orders
            (orderNumber, userId, total, status, date, customerName, customerEmail,
             customerPhone, shippingAddress, shippingCity, shippingGov, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
        orderNumber, owner.user.id, 50, 'pending', now,
        'Private Customer', 'private@example.test', '01111111111',
        'Private street', 'Private city', 'Private governorate', 'Private notes'
    ]);

    const crossAccount = await request(`/api/orders/track/${orderNumber}`, {
        headers: { authorization: `Bearer ${otherUser.accessToken}` }
    });
    assert.equal(crossAccount.response.status, 403);

    const tracked = await request(`/api/orders/track/${orderNumber}`);
    assert.equal(tracked.response.status, 200);
    assert.equal('customer' in tracked.body, false);
    assert.equal('shipping' in tracked.body, false);
    assert.equal(tracked.body.orderNumber, 'SECURITY-PUBLIC-ORDER');
});