import { v4 as uuidv4 } from 'uuid';
import { paymayaClient, publicAuthHeader, secretAuthHeader } from '../lib/paymayaClient.js'; 
import { getPlan } from '../lib/paymayaPlanConfig.js';
import * as paymayaRepo from '../repos/paymayaSubscription.repo.js';

export const createPremiumCheckout = async ({ userId, planId, buyer, redirectUrls }) => {
  const plan = getPlan(planId);
  const referenceId = uuidv4();

  const { data } = await paymayaClient.post('/checkouts', {
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

  await paymayaRepo.savePayment({
    userId,
    paymentId:   data.checkoutId,
    referenceId,
    planId,
    amount:      plan.amount,
    currency:    plan.currency,
    status:      'PENDING',
    checkoutUrl: data.checkoutUrl,  
    createdAt:   new Date().toISOString(),
    updatedAt:   new Date().toISOString(),
    expiresAt:   new Date(Date.now() + plan.durationDays * 24 * 60 * 60 * 1000).toISOString(),
  });

  return {
    checkoutId:  data.checkoutId,
    checkoutUrl: data.checkoutUrl,
    referenceId,
    plan,
  };
};

export const fetchAndSyncStatus = async (userId, paymentId) => {
  const { data } = await paymayaClient.get(`/checkouts/${paymentId}`, {
    headers: { Authorization: secretAuthHeader() },
  });

  await paymayaRepo.updatePaymentStatus(userId, paymentId, data.status);

  return {
    paymentId,
    status:        data.status,
    amount:        data.totalAmount,
    transactionId: data.transactionReferenceNumber,
    paymentMethod: data.paymentScheme,
  };
};

export const getUserPremiumStatus = async (userId) => {
  const record = await paymayaRepo.getActivePaymentByUserId(userId);

  if (!record) return { isPremium: false };

  if (record.expiresAt) {
    const expired = new Date() > new Date(record.expiresAt);
    if (expired) {
      await paymayaRepo.updatePaymentStatus(userId, record.paymentId, 'EXPIRED', record.planId);
      return { isPremium: false, reason: 'EXPIRED' };
    }
  }

  return {
    isPremium:   record.status === 'ACTIVE',
    premiumPlan: record.planId || null,
    expiresAt:   record.expiresAt || null,
    features: {
      aiMonitoring:     true,
      aiInsights:       true,
      advancedControls: true,
    },
  };
};