const {paypalRequest} = require('../lib/paypalClient');

async function createProduct(name){
    return await paypalRequest('POST', '/v1/catalogs/products', {
        name,
        type: 'SERVICE',
        category: 'SOFTWARE'
    });
}

async function createPlan(productId, name, price, intervalUnt, intervalCount){
    return await paypalRequest('POST', '/v1/billing/plans', {
        product_id: productId,
        name,
        billing_cycles: [
            {
                frequency: {
                    interval_unit: intervalUnt,
                    interval_count: intervalCount
                },
                tenure_type: 'REGULAR',
                sequence: 1,
                total_cycles: 0,
                pricing_scheme: {
                    fixed_price: {
                        value: price,
                        currency_code: 'PHP'
                    }
                }
            }
        ],
        payment_preferences: {
            auto_bill_outstanding: true,
            payment_failure_threshold: 3,
        }
    });    
};

async function createSubscription(planId, userId){
    return await paypalRequest('POST', '/v1/billing/subscriptions', {
        plan_id: planId,
        application_context: {
            brand_name: 'Aerosaur',
            user_action: 'SUBSCRIBE_NOW',
            return_url: `https://aerosaur.com/billing/success?userId=${userId}`,
            cancel_url: `https://aerosaur.com/billing/cancel?userId=${userId}`  
        },
        custom_id: userId,
    });
}      

async function getSubscription(subscriptionId){
    return await paypalRequest('GET', `/v1/billing/subscriptions/${subscriptionId}`);
}

async function cancelSubscription(subscriptionId){
    return await paypalRequest('POST', `/v1/billing/subscriptions/${subscriptionId}/cancel`, {
        reason: 'User requested cancellation'
    });
}

module.exports = {
    createProduct,
    createPlan,
    createSubscription,
    getSubscription,
    cancelSubscription
}