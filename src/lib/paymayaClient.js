import axios from 'axios';

const PAYMAYA_BASE_URL = process.env.PAYMAYA_ENV === 'production'
  ? 'https://pg.maya.ph/checkout/v1'
  : 'https://pg-sandbox.maya.ph/checkout/v1';
  
export const publicAuthHeader = () => {
  const encoded = Buffer.from(`${process.env.PAYMAYA_PUBLIC_KEY}:`).toString('base64');
  return `Basic ${encoded}`;
};

export const secretAuthHeader = () => {
  const encoded = Buffer.from(`${process.env.PAYMAYA_SECRET_KEY}:`).toString('base64');
  return `Basic ${encoded}`;
};

export const paymayaClient = axios.create({
  baseURL: PAYMAYA_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

paymayaClient.interceptors.response.use(
  (res) => res,
  (err) => {
    console.error('[PayMaya Error]', err.response?.data || err.message);
    return Promise.reject(err);
  }
);

const PLANS = {
  PREMIUM_MONTHLY: {
    planId:      'PREMIUM_MONTHLY',
    name:        'Premium Monthly',
    description: 'Full access to all premium features for 1 month',
    amount:      9.99,
    currency:    'PHP',
    durationDays: 30,
  },
};

export const getPlan = (planId) => {
  const plan = PLANS[planId];
  if (!plan) throw new Error(`Invalid planId: ${planId}`);
  return plan;
};

export { PLANS };