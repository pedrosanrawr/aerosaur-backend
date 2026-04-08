import * as billingRepo from '../repos/billing.repo.js';

export async function requirePremium(req, res, next) {
  try {
    const userId = req.user?.userId; 

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const subscription = await billingRepo.getSubscriptionByUserId(userId);

    if (!subscription) {
      return res.status(403).json({ 
        error: 'Premium subscription required',
        message: 'Please subscribe to access this feature'
      });
    }

    const status = (subscription.status || '').toUpperCase();

    if (status === 'ACTIVE') {
      return next();
    }

    if (status === 'CANCELLED' && subscription.expiresAt) {
      const expired = new Date() > new Date(subscription.expiresAt);
      if (!expired) {
        return next();
      }
    }

    return res.status(403).json({ 
      error: 'Premium subscription required',
      message: 'Please subscribe to access this feature'
    });
  } catch (error) {
    console.error('requirePremium error:', error.message);
    return res.status(500).json({ error: 'Failed to verify subscription' });
  }
}
