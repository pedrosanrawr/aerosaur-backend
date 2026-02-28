const billingService = require('../services/billingService');
const billingRepo = require('../repos/billingRepo');

async function createSubscription(req, res) {
  try {
    const { planId, userId } = req.body;

    if (!planId || !userId) {
      return res.status(400).json({ error: 'planId and userId are required' });
    }

    const subscription = await billingService.createSubscription({ planId, userId });

    const approvalUrl = subscription.links.find(l => l.rel === 'approve').href;

    // Save pending subscription to DynamoDB
    await billingRepo.saveSubscription({
      userId,
      subscriptionId: subscription.id,
      planId,
      status: 'PENDING',
      approvalUrl,
    });

    return res.status(201).json({
      subscriptionId: subscription.id,
      approvalUrl,
    });
  } catch (error) {
    console.error('createSubscription error:', error.message);
    return res.status(500).json({ error: 'Failed to create subscription' });
  }
}

async function getSubscription(req, res) {
  try {
    const { userId } = req.params;
    const record = await billingRepo.getSubscriptionByUser(userId);

    if (!record) {
      return res.status(404).json({ error: 'No subscription found' });
    }

    // Get latest status from PayPal
    const liveData = await billingService.getSubscription(record.subscriptionId);

    return res.status(200).json({
      subscriptionId: record.subscriptionId,
      status: liveData.status,
      nextBillingTime: liveData.billing_info?.next_billing_time,
      planId: record.planId,
    });
  } catch (error) {
    console.error('getSubscription error:', error.message);
    return res.status(500).json({ error: 'Failed to get subscription' });
  }
}

async function cancelSubscription(req, res) {
  try {
    const { userId } = req.params;
    const { reason } = req.body;

    const record = await billingRepo.getSubscriptionByUser(userId);
    if (!record) return res.status(404).json({ error: 'No subscription found' });

    await billingService.cancelSubscription(record.subscriptionId, reason);
    await billingRepo.updateSubscriptionStatus(userId, record.subscriptionId, 'CANCELLED');

    return res.status(200).json({ message: 'Subscription cancelled successfully' });
  } catch (error) {
    console.error('cancelSubscription error:', error.message);
    return res.status(500).json({ error: 'Failed to cancel subscription' });
  }
}

module.exports = { createSubscription, getSubscription, cancelSubscription };