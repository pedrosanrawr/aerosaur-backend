import express from 'express';
import serverless from 'serverless-http';
import * as paymayaRepo from '../repos/paymayaSubscription.repo.js';
import { verifyPaymayaWebhook } from '../middleware/paymayaWebhook.middleware.js';

const app = express();

// Raw body MUST be before express.json()
app.use('/paymaya/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());

app.post('/paymaya/webhook', verifyPaymayaWebhook, async (req, res) => {
  const { id: paymentId, status, metadata } = req.body;
  const { userId, planId } = metadata || {};

  try {
    switch (status) {
      case 'PAYMENT_SUCCESS':
        await paymayaRepo.updatePaymentStatus(userId, paymentId, 'ACTIVE', planId);
        console.log(`[PayMaya Webhook] Premium GRANTED — userId: ${userId}, plan: ${planId}`);
        break;
      case 'PAYMENT_FAILED':
        await paymayaRepo.updatePaymentStatus(userId, paymentId, 'FAILED', planId);
        console.log(`[PayMaya Webhook] Payment FAILED — userId: ${userId}`);
        break;
      case 'PAYMENT_EXPIRED':
        await paymayaRepo.updatePaymentStatus(userId, paymentId, 'EXPIRED', planId);
        console.log(`[PayMaya Webhook] Payment EXPIRED — userId: ${userId}`);
        break;
      default:
        console.log(`[PayMaya Webhook] Unhandled status: ${status}`);
    }

    return res.sendStatus(200);
  } catch (error) {
    console.error('[PayMaya Webhook] Processing error:', error.message);
    return res.status(500).json({ error: 'Failed to process webhook' });
  }
});

export const handler = serverless(app, { basePath: '/prod' });
