const { v4: uuidv4 } = require('uuid');
const { paymayaClient, publicAuthHeader, secretAuthHeader } = require('../libraries/paymayaClient');
const { getPlan } = require('../lib/paymayaPlanConfig');
const subscriptionRepo = require('../repos/paymayaSubscription.repo');
const userRepo         = require('../repos/paymayaUser.repo');

const createPremiumCheckout = async ({ userId, planId, buyer, redirectUrls }) => {
  const plan = getPlan(planId);
  const referenceId = uuidv4();

  const { data } = await paymayaClient.post('/checkout', {
    totalAmount: {
      value:    plan.amount,
      currency: plan.currency,
      details:  { subtotal: plan.amount },
    },
    buyer,
    items: [{
      name:        plan.name,
      quantity:    1,
      code:        plan.planId,
      description: plan.description,
      amount:      { value: plan.amount },
      totalAmount: { value: plan.amount },
    }],
    redirectUrl: {
      success: redirectUrls?.success || `${process.env.APP_URL}/payment/success`,
      failure: redirectUrls?.failure || `${process.env.APP_URL}/payment/failed`,
      cancel:  redirectUrls?.cancel  || `${process.env.APP_URL}/payment/cancel`,
    },
    requestReferenceNumber: referenceId,
    metadata: { userId, planId },
  }, {
    headers: { Authorization: publicAuthHeader() },
  });

  await subscriptionRepo.createSubscription({
    paymentId:   data.checkoutId,
    referenceId,
    userId,
    planId,
    amount:      plan.amount,
    currency:    plan.currency,
    status:      'PENDING',
    checkoutUrl: data.redirectUrl,
    createdAt:   new Date().toISOString(),
    updatedAt:   new Date().toISOString(),
  });

  return {
    checkoutId:  data.checkoutId,
    checkoutUrl: data.redirectUrl,
    referenceId,
    plan,
  };
};

const fetchAndSyncStatus = async (paymentId) => {
  const { data } = await paymayaClient.get(`/checkout/${paymentId}`, {
    headers: { Authorization: secretAuthHeader() },
  });

  await subscriptionRepo.updateSubscriptionStatus(paymentId, data.status);

  return {
    paymentId,
    status:        data.status,
    amount:        data.totalAmount,
    transactionId: data.transactionReferenceNumber,
    paymentMethod: data.paymentScheme,
  };
};

const getUserPremiumStatus = async (userId) => {
  const user = await userRepo.getUserById(userId);
  if (!user) return { isPremium: false };

  if (user.isPremium && user.premiumExpiresAt) {
    const expired = new Date() > new Date(user.premiumExpiresAt);
    if (expired) {
      await userRepo.revokePremiumAccess(userId);
      return { isPremium: false, reason: 'EXPIRED' };
    }
  }

  return {
    isPremium:        user.isPremium || false,
    premiumPlan:      user.premiumPlan || null,
    premiumExpiresAt: user.premiumExpiresAt || null,
  };
};

module.exports = { createPremiumCheckout, fetchAndSyncStatus, getUserPremiumStatus };