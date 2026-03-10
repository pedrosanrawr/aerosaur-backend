const axios = require('axios');

const PAYMAYA_BASE_URL = process.env.PAYMAYA_ENV === 'production'
  ? 'https://pg.maya.ph/payments/v1'
  : 'https://pg-sandbox.maya.ph/payments/v1';

const publicAuthHeader = () => {
  const encoded = Buffer.from(`${process.env.PAYMAYA_PUBLIC_KEY}:`).toString('base64');
  return `Basic ${encoded}`;
};

const secretAuthHeader = () => {
  const encoded = Buffer.from(`${process.env.PAYMAYA_SECRET_KEY}:`).toString('base64');
  return `Basic ${encoded}`;
};

const paymayaClient = axios.create({
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

module.exports = { paymayaClient, publicAuthHeader, secretAuthHeader };