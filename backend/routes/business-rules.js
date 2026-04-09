const express = require('express');
const router = express.Router();
const { 
    calculateTax, 
    calculateShipping, 
    calculateOrderTotal, 
    getSupportedGovernorates 
} = require('../utils/businessRules');

/**
 * GET /api/business-rules/governorates
 * Get list of supported governorates with shipping rates
 */
router.get('/governorates', (req, res) => {
    try {
        const governorates = getSupportedGovernorates();
        res.json({
            success: true,
            data: governorates
        });
    } catch (error) {
        console.error('Error fetching governorates:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch governorates'
        });
    }
});

/**
 * POST /api/business-rules/calculate-tax
 * Calculate tax for given amount
 */
router.post('/calculate-tax', (req, res) => {
    try {
        const { subtotal, city } = req.body;
        
        if (!subtotal || subtotal <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Valid subtotal is required'
            });
        }

        const tax = calculateTax(parseFloat(subtotal), city);
        
        res.json({
            success: true,
            data: tax
        });
    } catch (error) {
        console.error('Error calculating tax:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to calculate tax'
        });
    }
});

/**
 * POST /api/business-rules/calculate-shipping
 * Calculate shipping cost
 */
router.post('/calculate-shipping', (req, res) => {
    try {
        const { subtotal, governorate, weight } = req.body;
        
        if (!subtotal || subtotal < 0) {
            return res.status(400).json({
                success: false,
                error: 'Valid subtotal is required'
            });
        }

        const shipping = calculateShipping(
            parseFloat(subtotal), 
            governorate || '', 
            weight ? parseFloat(weight) : 1
        );
        
        res.json({
            success: true,
            data: shipping
        });
    } catch (error) {
        console.error('Error calculating shipping:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to calculate shipping'
        });
    }
});

/**
 * POST /api/business-rules/calculate-total
 * Calculate complete order total with tax and shipping
 */
router.post('/calculate-total', (req, res) => {
    try {
        const { subtotal, shippingInfo, discount } = req.body;
        
        if (!subtotal || subtotal <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Valid subtotal is required'
            });
        }

        if (!shippingInfo) {
            return res.status(400).json({
                success: false,
                error: 'Shipping information is required'
            });
        }

        const total = calculateOrderTotal(
            parseFloat(subtotal), 
            shippingInfo, 
            discount
        );
        
        res.json({
            success: true,
            data: total
        });
    } catch (error) {
        console.error('Error calculating order total:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to calculate order total'
        });
    }
});

/**
 * GET /api/business-rules/config
 * Get current business configuration
 */
router.get('/config', (req, res) => {
    try {
        const config = {
            tax: {
                rate: 0.14,
                applicable: true,
                minOrderForTaxExempt: 1000
            },
            shipping: {
                cairo: { baseRate: 50, freeShippingThreshold: 500 },
                alexandria: { baseRate: 60, freeShippingThreshold: 600 },
                otherGovernorates: { baseRate: 80, freeShippingThreshold: 800 }
            },
            currency: 'EGP'
        };
        
        res.json({
            success: true,
            data: config
        });
    } catch (error) {
        console.error('Error fetching business config:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch business configuration'
        });
    }
});

module.exports = router;
