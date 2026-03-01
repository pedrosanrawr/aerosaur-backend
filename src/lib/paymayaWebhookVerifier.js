const crypto = require('crypto');

const verifyPaymayaSignature = (payload, signature) => {
  const hmac = crypto.createHmac('sha512', process.env.PAYMAYA_WEBHOOK_SECRET);
  hmac.update(typeof payload === 'string' ? payload : JSON.stringify(payload));
  const computed = hmac.digest('hex');
  return computed === signature;
};

module.exports = { verifyPaymayaSignature };