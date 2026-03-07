import * as billingRepo from '../repos/billing.repo.js';

export async function requirePremium(req, res, next) {
  try {
    const userId = req.user?.userId; 

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const subscription = await billingRepo.getSubscriptionByUserId(userId);

    if (!subscription || subscription.status !== 'ACTIVE') {
      return res.status(403).json({ 
        error: 'Premium subscription required',
        message: 'Please subscribe to access this feature'
      });
    }

    next();
  } catch (error) {
    console.error('requirePremium error:', error.message);
    return res.status(500).json({ error: 'Failed to verify subscription' });
  }
}