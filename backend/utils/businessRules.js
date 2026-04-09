/**
 * Business Rules for SAVX Store
 * Tax calculation, shipping rates, and other business logic
 */

// Tax configuration for Egypt
const TAX_CONFIG = {
    rate: 0.14, // 14% VAT in Egypt
    applicable: true,
    minOrderForTaxExempt: 1000 // Orders above 1000 EGP may qualify for tax exemption
};

// Shipping configuration
const SHIPPING_CONFIG = {
    cairo: {
        baseRate: 50,
        freeShippingThreshold: 500
    },
    alexandria: {
        baseRate: 60,
        freeShippingThreshold: 600
    },
    otherGovernorates: {
        baseRate: 80,
        freeShippingThreshold: 800
    }
};

/**
 * Calculate tax for an order
 * @param {number} subtotal - Order subtotal before tax and shipping
 * @param {string} city - Customer city for potential tax exemption
 * @returns {object} - Tax amount and breakdown
 */
function calculateTax(subtotal, city = '') {
    if (!TAX_CONFIG.applicable) {
        return {
            amount: 0,
            rate: 0,
            exempt: true,
            message: 'No tax applicable'
        };
    }

    // Check for tax exemption (business logic)
    const isExempt = subtotal >= TAX_CONFIG.minOrderForTaxExempt;
    
    if (isExempt) {
        return {
            amount: 0,
            rate: TAX_CONFIG.rate,
            exempt: true,
            message: `Tax exempt for orders over ${TAX_CONFIG.minOrderForTaxExempt} EGP`
        };
    }

    const taxAmount = Math.round(subtotal * TAX_CONFIG.rate * 100) / 100;
    
    return {
        amount: taxAmount,
        rate: TAX_CONFIG.rate,
        exempt: false,
        message: `${(TAX_CONFIG.rate * 100).toFixed(0)}% VAT applied`
    };
}

/**
 * Calculate shipping cost
 * @param {number} subtotal - Order subtotal
 * @param {string} governorate - Shipping governorate
 * @param {number} weight - Package weight in kg (optional)
 * @returns {object} - Shipping cost and breakdown
 */
function calculateShipping(subtotal, governorate = '', weight = 1) {
    let shippingConfig;
    let region = 'otherGovernorates';

    // Determine shipping region based on governorate
    const cairoGovernorates = ['cairo', 'al qahira', 'القاهرة'];
    const alexandriaGovernorates = ['alexandria', 'alex', 'الإسكندرية'];
    
    const lowerGov = governorate.toLowerCase();
    
    if (cairoGovernorates.some(gov => lowerGov.includes(gov))) {
        shippingConfig = SHIPPING_CONFIG.cairo;
        region = 'cairo';
    } else if (alexandriaGovernorates.some(gov => lowerGov.includes(gov))) {
        shippingConfig = SHIPPING_CONFIG.alexandria;
        region = 'alexandria';
    } else {
        shippingConfig = SHIPPING_CONFIG.otherGovernorates;
    }

    // Check for free shipping
    if (subtotal >= shippingConfig.freeShippingThreshold) {
        return {
            amount: 0,
            baseRate: shippingConfig.baseRate,
            region: region,
            freeShipping: true,
            message: `Free shipping for orders over ${shippingConfig.freeShippingThreshold} EGP`
        };
    }

    // Additional weight-based charges (if applicable)
    let weightSurcharge = 0;
    if (weight > 5) {
        weightSurcharge = Math.ceil((weight - 5) / 2) * 20; // 20 EPG per additional 2kg
    }

    const totalShipping = shippingConfig.baseRate + weightSurcharge;

    return {
        amount: totalShipping,
        baseRate: shippingConfig.baseRate,
        weightSurcharge: weightSurcharge,
        region: region,
        freeShipping: false,
        message: `Standard shipping to ${region}`
    };
}

/**
 * Calculate order total with tax and shipping
 * @param {number} subtotal - Order subtotal
 * @param {object} shippingInfo - Shipping information
 * @param {object} discount - Discount information (optional)
 * @returns {object} - Complete order breakdown
 */
function calculateOrderTotal(subtotal, shippingInfo, discount = null) {
    // Apply discount if provided
    let discountAmount = 0;
    let discountedSubtotal = subtotal;
    
    if (discount && discount.active) {
        discountAmount = Math.round(subtotal * (discount.percentage / 100) * 100) / 100;
        discountedSubtotal = subtotal - discountAmount;
    }

    // Calculate tax and shipping
    const tax = calculateTax(discountedSubtotal, shippingInfo.city);
    const shipping = calculateShipping(discountedSubtotal, shippingInfo.governorate);

    const total = discountedSubtotal + tax.amount + shipping.amount;

    return {
        subtotal: subtotal,
        discount: {
            amount: discountAmount,
            percentage: discount ? discount.percentage : 0,
            code: discount ? discount.code : null
        },
        discountedSubtotal: discountedSubtotal,
        tax: tax,
        shipping: shipping,
        total: Math.round(total * 100) / 100,
        currency: 'EGP'
    };
}

/**
 * Get list of supported governorates
 * @returns {array} - List of governorates with shipping info
 */
function getSupportedGovernorates() {
    return [
        { name: 'Cairo', code: 'cairo', shippingRate: SHIPPING_CONFIG.cairo.baseRate },
        { name: 'Alexandria', code: 'alexandria', shippingRate: SHIPPING_CONFIG.alexandria.baseRate },
        { name: 'Giza', code: 'giza', shippingRate: SHIPPING_CONFIG.otherGovernorates.baseRate },
        { name: 'Sharkia', code: 'sharkia', shippingRate: SHIPPING_CONFIG.otherGovernorates.baseRate },
        { name: 'Dakahlia', code: 'dakahlia', shippingRate: SHIPPING_CONFIG.otherGovernorates.baseRate },
        { name: 'Kafr El Sheikh', code: 'kafr-el-sheikh', shippingRate: SHIPPING_CONFIG.otherGovernorates.baseRate },
        { name: 'Gharbia', code: 'gharbia', shippingRate: SHIPPING_CONFIG.otherGovernorates.baseRate },
        { name: 'Monufia', code: 'monufia', shippingRate: SHIPPING_CONFIG.otherGovernorates.baseRate },
        { name: 'Qalyubia', code: 'qalyubia', shippingRate: SHIPPING_CONFIG.otherGovernorates.baseRate },
        { name: 'Beheira', code: 'beheira', shippingRate: SHIPPING_CONFIG.otherGovernorates.baseRate },
        { name: 'Ismailia', code: 'ismailia', shippingRate: SHIPPING_CONFIG.otherGovernorates.baseRate },
        { name: 'Suez', code: 'suez', shippingRate: SHIPPING_CONFIG.otherGovernorates.baseRate },
        { name: 'Port Said', code: 'port-said', shippingRate: SHIPPING_CONFIG.otherGovernorates.baseRate },
        { name: 'Damietta', code: 'damietta', shippingRate: SHIPPING_CONFIG.otherGovernorates.baseRate },
        { name: 'Aswan', code: 'aswan', shippingRate: SHIPPING_CONFIG.otherGovernorates.baseRate },
        { name: 'Luxor', code: 'luxor', shippingRate: SHIPPING_CONFIG.otherGovernorates.baseRate },
        { name: 'Qena', code: 'qena', shippingRate: SHIPPING_CONFIG.otherGovernorates.baseRate },
        { name: 'Asyut', code: 'asyut', shippingRate: SHIPPING_CONFIG.otherGovernorates.baseRate },
        { name: 'Faiyum', code: 'faiyum', shippingRate: SHIPPING_CONFIG.otherGovernorates.baseRate },
        { name: 'Minya', code: 'minya', shippingRate: SHIPPING_CONFIG.otherGovernorates.baseRate },
        { name: 'Sohag', code: 'sohag', shippingRate: SHIPPING_CONFIG.otherGovernorates.baseRate },
        { name: 'Red Sea', code: 'red-sea', shippingRate: SHIPPING_CONFIG.otherGovernorates.baseRate },
        { name: 'New Valley', code: 'new-valley', shippingRate: SHIPPING_CONFIG.otherGovernorates.baseRate },
        { name: 'Matrouh', code: 'matrouh', shippingRate: SHIPPING_CONFIG.otherGovernorates.baseRate },
        { name: 'North Sinai', code: 'north-sinai', shippingRate: SHIPPING_CONFIG.otherGovernorates.baseRate },
        { name: 'South Sinai', code: 'south-sinai', shippingRate: SHIPPING_CONFIG.otherGovernorates.baseRate }
    ];
}

module.exports = {
    calculateTax,
    calculateShipping,
    calculateOrderTotal,
    getSupportedGovernorates,
    TAX_CONFIG,
    SHIPPING_CONFIG
};
