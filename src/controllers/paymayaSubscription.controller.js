const subscriptionService = require('../services/paymayaSubscription.service');
const webhookService      = require('../services/paymayaWebhook.service');

const createCheckout = async (req, res) => {
  const { userId, planId, buyer, redirectUrls } = req.body;

  if (!userId || !planId) {
    return res.status(400).json({ error: 'userId and planId are required' });
  }

  try {
    const result = await subscriptionService.createPremiumCheckout({
      userId, planId, buyer, redirectUrls,
    });
    return res.status(201).json(result);
  } catch (err) {
    if (err.message.startsWith('Invalid planId')) {
      return res.status(400).json({ error: err.message });
    }
    console.error('[createCheckout]', err.message);
    return res.status(502).json({ error: 'Failed to create checkout session' });
  }
};

const getPaymentStatus = async (req, res) => {
  const { paymentId } = req.params;

  try {
    const result = await subscriptionService.fetchAndSyncStatus(paymentId);
    return res.status(200).json(result);
  } catch (err) {
    console.error('[getPaymentStatus]', err.message);
    return res.status(502).json({ error: 'Failed to fetch payment status' });
  }
};

const getPremiumStatus = async (req, res) => {
  const { userId } = req.params;

  try {
    const result = await subscriptionService.getUserPremiumStatus(userId);
    return res.status(200).json(result);
  } catch (err) {
    console.error('[getPremiumStatus]', err.message);
    return res.status(500).json({ error: 'Failed to fetch premium status' });
  }
};

const handleWebhook = async (req, res) => {
  res.status(200).json({ received: true });

  const signature = req.headers['x-signature'];

  try {
    await webhookService.handleWebhookEvent(req.body, signature);
  } catch (err) {
    if (err.message === 'INVALID_SIGNATURE') {
      console.warn('[Webhook] Rejected — invalid signature');
    } else {
      console.error('[Webhook] Processing error:', err.message);
    }
  }
};

module.exports = { createCheckout, getPaymentStatus, getPremiumStatus, handleWebhook };