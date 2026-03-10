const { verifyPaymayaSignature } = require('../lib/paymayaWebhookVerifier');
const { getPlan }          = require('../lib/paymayaPlanConfig');
const subscriptionRepo     = require('../repos/paymayaSubscription.repo');
const webhookRepo          = require('../repos/paymayaWebhook.repo');
const userRepo             = require('../repos/paymayaUser.repo');

const handleWebhookEvent = async (payload, signature) => {
  if (!verifyPaymayaSignature(payload, signature)) {
    throw new Error('INVALID_SIGNATURE');
  }

  const { id: paymentId, status, metadata } = payload;
  const { userId, planId } = metadata || {};

  await webhookRepo.logWebhookEvent({ paymentId, event: status, payload });

  await subscriptionRepo.updateSubscriptionStatus(paymentId, status);

  switch (status) {

    case 'PAYMENT_SUCCESS': {
      const plan = getPlan(planId);

      const expiresAt = plan.durationDays
        ? new Date(Date.now() + plan.durationDays * 86400000).toISOString()
        : null;

      await userRepo.grantPremiumAccess({ userId, planId, expiresAt });

      console.log(`[Webhook] Premium GRANTED — userId: ${userId}, plan: ${planId}, expires: ${expiresAt ?? 'never'}`);
      break;
    }

    case 'PAYMENT_FAILED': {
      console.log(`[Webhook] Payment FAILED — userId: ${userId}, paymentId: ${paymentId}`);
      break;
    }

    case 'PAYMENT_EXPIRED': {
      console.log(`[Webhook] Payment EXPIRED — userId: ${userId}, paymentId: ${paymentId}`);
      break;
    }

    default:
      console.warn(`[Webhook] Unhandled status: ${status}`);
  }
};

module.exports = { handleWebhookEvent };