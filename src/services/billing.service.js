import { paypalRequest } from '../lib/paypalClient.js';

export async function createProduct(name) {
  return await paypalRequest('POST', '/v1/catalogs/products', {
    name,
    type: 'SERVICE',
    category: 'SOFTWARE',
  });
}

export async function createPlan(productId, name, price, intervalUnit, intervalCount) {
  return await paypalRequest('POST', '/v1/billing/plans', {
    product_id: productId,
    name,
    billing_cycles: [
      {
        frequency: {
          interval_unit: intervalUnit,
          interval_count: intervalCount,
        },
        tenure_type: 'REGULAR',
        sequence: 1,
        total_cycles: 0,
        pricing_scheme: {
          fixed_price: {
            value: price,
            currency_code: 'PHP',
          },
        },
      },
    ],
    payment_preferences: {
      auto_bill_outstanding: true,
      payment_failure_threshold: 3,
    },
  });
}

export async function createSubscription(planId, userId) {
  return await paypalRequest('POST', '/v1/billing/subscriptions', {
    plan_id: planId,
    application_context: {
      brand_name: 'Aerosaur',
      user_action: 'SUBSCRIBE_NOW',
      return_url: `https://aerosaur.com/billing/success?userId=${userId}`,
      cancel_url: `https://aerosaur.com/billing/cancel?userId=${userId}`,
    },
    custom_id: userId,
  });
}

export async function getSubscription(subscriptionId) {
  return await paypalRequest('GET', `/v1/billing/subscriptions/${subscriptionId}`);
}

export async function cancelSubscription(subscriptionId) {
  return await paypalRequest(
    'POST',
    `/v1/billing/subscriptions/${subscriptionId}/cancel`,
    { reason: 'User requested cancellation' }
  );
}