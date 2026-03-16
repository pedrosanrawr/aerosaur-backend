import express from 'express';
import serverless from 'serverless-http';
import crypto from 'crypto';
import * as paymayaService from '../services/paymayaSubscription.service.js';
import * as paymayaRepo from '../repos/paymayaSubscription.repo.js';

const app = express();

app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));

// ─────────────────────────────────────────
// POST /paymaya/checkout
// ─────────────────────────────────────────
app.post('/paymaya/checkout', async (req, res) => {
  try {
    const { userId, planId, buyer, redirectUrls } = req.body;

    if (!userId || !planId) {
      return res.status(400).json({ error: 'userId and planId are required' });
    }

    if (!buyer?.firstName || !buyer?.lastName || !buyer?.contact?.email) {
      return res.status(400).json({ error: 'buyer firstName, lastName and email are required' });
    }

    const result = await paymayaService.createPremiumCheckout({
      userId,
      planId,
      buyer,
      redirectUrls,
    });

    return res.status(201).json({
      checkoutId:  result.checkoutId,
      checkoutUrl: result.checkoutUrl,
      referenceId: result.referenceId,
      plan:        result.plan,
    });
  } catch (error) {
    console.error('createCheckout error:', error.message);
    return res.status(500).json({ error: 'Failed to create checkout' });
  }
});

// ─────────────────────────────────────────
// GET /paymaya/status/:paymentId
// ─────────────────────────────────────────
app.get('/paymaya/status/:paymentId', async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'userId query param is required' });
    }

    const result = await paymayaService.fetchAndSyncStatus(userId, paymentId);

    return res.status(200).json(result);
  } catch (error) {
    console.error('getStatus error:', error.message);
    return res.status(500).json({ error: 'Failed to get payment status' });
  }
});

// ─────────────────────────────────────────
// GET /paymaya/premium/:userId
// ─────────────────────────────────────────
app.get('/paymaya/premium/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await paymayaService.getUserPremiumStatus(userId);

    return res.status(200).json(result);
  } catch (error) {
    console.error('getPremiumStatus error:', error.message);
    return res.status(500).json({ error: 'Failed to get premium status' });
  }
});

// ─────────────────────────────────────────
// POST /paymaya/webhook
// ─────────────────────────────────────────
app.post('/paymaya/webhook', async (req, res) => {
  try {
    const webhookSecret = process.env.PAYMAYA_WEBHOOK_SECRET;
    const signature = req.headers['x-signature'];

    if (webhookSecret && signature) {
      const expectedSig = crypto
        .createHmac('sha256', webhookSecret)
        .update(req.rawBody)
        .digest('hex');

      if (signature !== expectedSig) {
        console.error('Invalid webhook signature');
        return res.status(400).json({ error: 'Invalid webhook signature' });
      }
    }

    const event = req.body;
    console.log('PayMaya webhook event:', JSON.stringify(event));

    const checkoutId = event?.id || event?.checkoutId;
    const status = event?.status;
    const userId = event?.metadata?.userId;
    const planId = event?.metadata?.planId;

    if (!checkoutId || !status || !userId) {
      console.error('Missing required webhook fields');
      return res.sendStatus(200);
    }

    switch (status) {
      case 'PAYMENT_SUCCESS':
        await paymayaRepo.updatePaymentStatus(userId, checkoutId, 'ACTIVE', planId);
        console.log(`Payment ACTIVE for user ${userId}`);
        break;
      case 'PAYMENT_FAILED':
        await paymayaRepo.updatePaymentStatus(userId, checkoutId, 'FAILED', planId);
        console.log(`Payment FAILED for user ${userId}`);
        break;
      case 'PAYMENT_EXPIRED':
        await paymayaRepo.updatePaymentStatus(userId, checkoutId, 'EXPIRED', planId);
        console.log(`Payment EXPIRED for user ${userId}`);
        break;
      case 'VOID':
        await paymayaRepo.updatePaymentStatus(userId, checkoutId, 'CANCELLED', planId);
        console.log(`Payment CANCELLED for user ${userId}`);
        break;
      default:
        console.log(`Unhandled PayMaya status: ${status}`);
    }

    return res.sendStatus(200);
  } catch (error) {
    console.error('Webhook processing error:', error.message);
    return res.sendStatus(200);
  }
  
});

export const handler = serverless(app, { basePath: '/prod' });