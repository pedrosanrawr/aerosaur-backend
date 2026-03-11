import express from 'express';
import serverless from 'serverless-http';
import * as billingController from '../controllers/billing.controller.js';
import * as billingRepo from '../repos/billing.repo.js';
import { verifyWebhookSignature } from '../middleware/paypalWebHook.middleware.js';

const app = express();

// ✅ Store raw body for webhook verification BEFORE parsing
app.use((req, res, buf, next) => {
  req.rawBody = buf;
  next();
});

app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf; // ✅ capture raw buffer before parsing
  }
}));

app.post('/billing/subscription', billingController.createSubscription);
app.get('/billing/subscription/:userId', billingController.getSubscription);
app.delete('/billing/subscription/:userId', billingController.cancelSubscription);

app.post('/billing/webhook', verifyWebhookSignature, async (req, res) => {
  const event = req.body;
  try {
    switch (event.event_type) {
      case 'BILLING.SUBSCRIPTION.ACTIVATED':
        await billingRepo.updateSubscriptionStatus(event.resource.custom_id, event.resource.id, 'ACTIVE');
        break;
      case 'BILLING.SUBSCRIPTION.CANCELLED':
        await billingRepo.updateSubscriptionStatus(event.resource.custom_id, event.resource.id, 'CANCELLED');
        break;
      case 'BILLING.SUBSCRIPTION.PAYMENT.FAILED':
        await billingRepo.updateSubscriptionStatus(event.resource.custom_id, event.resource.id, 'PAYMENT_FAILED');
        break;
      case 'BILLING.SUBSCRIPTION.EXPIRED':
        await billingRepo.updateSubscriptionStatus(event.resource.custom_id, event.resource.id, 'EXPIRED');
        break;
      case 'BILLING.SUBSCRIPTION.SUSPENDED':
        await billingRepo.updateSubscriptionStatus(event.resource.custom_id, event.resource.id, 'SUSPENDED');
        break;
      case 'BILLING.SUBSCRIPTION.RE-ACTIVATED':
        await billingRepo.updateSubscriptionStatus(event.resource.custom_id, event.resource.id, 'ACTIVE');
        break;
      default:
        console.log(`Unhandled event type: ${event.event_type}`);
    }
    return res.sendStatus(200);
  } catch (error) {
    console.error('Webhook processing error:', error.message);
    return res.status(500).json({ error: 'Failed to process webhook' });
  }
});

export const handler = serverless(app, { basePath: '/prod' });