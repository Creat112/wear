const express = require('express');
const router = express.Router();
const { getDB } = require('../database/init');

/**
 * GET /api/health
 * Health check endpoint for monitoring
 */
router.get('/', async (req, res) => {
    const healthCheck = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        version: process.env.npm_package_version || '1.0.0',
        services: {}
    };

    try {
        // Check database connection
        const db = getDB();
        if (db) {
            try {
                const [rows] = await db.execute('SELECT 1 as test');
                healthCheck.services.database = {
                    status: 'connected',
                    responseTime: Date.now() - new Date(healthCheck.timestamp).getTime()
                };
            } catch (dbError) {
                healthCheck.services.database = {
                    status: 'error',
                    error: dbError.message
                };
                healthCheck.status = 'degraded';
            }
        } else {
            healthCheck.services.database = {
                status: 'disconnected'
            };
            healthCheck.status = 'degraded';
        }

        // Check email service
        try {
            const { getEmailService } = require('../utils/emailService');
            const emailService = getEmailService();
            healthCheck.services.email = {
                status: emailService ? 'configured' : 'not_configured',
                service: emailService || 'none'
            };
        } catch (emailError) {
            healthCheck.services.email = {
                status: 'error',
                error: emailError.message
            };
        }

        // Check payment services
        const paymentServices = {};
        
        // Check Paymob
        if (process.env.PAYMOB_API_KEY && process.env.PAYMOB_INTEGRATION_ID) {
            paymentServices.paymob = {
                status: 'configured',
                test_mode: process.env.NODE_ENV !== 'production'
            };
        } else {
            paymentServices.paymob = {
                status: 'not_configured'
            };
            healthCheck.status = 'degraded';
        }

        // Check Stripe
        if (process.env.STRIPE_SECRET_KEY) {
            paymentServices.stripe = {
                status: 'configured',
                test_mode: process.env.STRIPE_SECRET_KEY.includes('test_')
            };
        } else {
            paymentServices.stripe = {
                status: 'not_configured'
            };
        }

        healthCheck.services.payments = paymentServices;

        // Check memory usage
        const memUsage = process.memoryUsage();
        healthCheck.system = {
            memory: {
                rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
                heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
                heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
                external: `${Math.round(memUsage.external / 1024 / 1024)}MB`
            },
            nodeVersion: process.version,
            platform: process.platform
        };

        // Determine HTTP status code
        const statusCode = healthCheck.status === 'ok' ? 200 : 
                          healthCheck.status === 'degraded' ? 200 : 503;

        res.status(statusCode).json(healthCheck);

    } catch (error) {
        console.error('Health check error:', error);
        res.status(503).json({
            status: 'error',
            timestamp: new Date().toISOString(),
            error: error.message
        });
    }
});

/**
 * GET /api/health/ready
 * Readiness probe for Kubernetes/container orchestration
 */
router.get('/ready', async (req, res) => {
    try {
        const db = getDB();
        if (!db) {
            return res.status(503).json({
                status: 'not_ready',
                reason: 'database_not_connected'
            });
        }

        // Test database connection
        await db.execute('SELECT 1 as test');

        // Check critical environment variables
        const criticalVars = [
            'PAYMOB_API_KEY',
            'PAYMOB_INTEGRATION_ID',
            'DB_HOST',
            'DB_USER'
        ];

        const missingVars = criticalVars.filter(varName => !process.env[varName]);
        
        if (missingVars.length > 0) {
            return res.status(503).json({
                status: 'not_ready',
                reason: 'missing_environment_variables',
                missing: missingVars
            });
        }

        res.status(200).json({
            status: 'ready',
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        res.status(503).json({
            status: 'not_ready',
            reason: error.message
        });
    }
});

/**
 * GET /api/health/live
 * Liveness probe for Kubernetes/container orchestration
 */
router.get('/live', (req, res) => {
    res.status(200).json({
        status: 'alive',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

module.exports = router;
