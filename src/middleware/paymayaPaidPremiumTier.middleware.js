import * as paymayaRepo from '../repos/paymayaSubscription.repo.js';

export async function requirePaymayaPremium(req, res, next) {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const subscription = await paymayaRepo.getActivePaymentByUserId(userId);

    if (!subscription || subscription.status !== 'ACTIVE') {
      return res.status(403).json({
        error: 'Premium subscription required',
        message: 'Please subscribe to access AI monitoring features'
      });
    }

    if (subscription.expiresAt) {
      const expired = new Date() > new Date(subscription.expiresAt);
      if (expired) {
        return res.status(403).json({
          error: 'Premium subscription expired',
          message: 'Your premium subscription has expired. Please renew to continue.'
        });
      }
    }

    next();
  } catch (error) {
    console.error('requirePaymayaPremium error:', error.message);
    return res.status(500).json({ error: 'Failed to verify subscription' });
  }
}