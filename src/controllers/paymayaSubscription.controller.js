import * as subscriptionService from '../services/paymayaSubscription.service.js';

export const createCheckout = async (req, res) => {
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

export const getPaymentStatus = async (req, res) => {
  const { paymentId } = req.params;
  const { userId } = req.query; // userId needed for table key lookup

  if (!userId) {
    return res.status(400).json({ error: 'userId is required as query param' });
  }

  try {
    const result = await subscriptionService.fetchAndSyncStatus(userId, paymentId);
    return res.status(200).json(result);
  } catch (err) {
    console.error('[getPaymentStatus]', err.message);
    return res.status(502).json({ error: 'Failed to fetch payment status' });
  }
};

export const getPremiumStatus = async (req, res) => {
  const { userId } = req.params;

  try {
    const result = await subscriptionService.getUserPremiumStatus(userId);
    return res.status(200).json(result);
  } catch (err) {
    console.error('[getPremiumStatus]', err.message);
    return res.status(500).json({ error: 'Failed to fetch premium status' });
  }
};
