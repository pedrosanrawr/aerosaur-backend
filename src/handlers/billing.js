import express from 'express';
import serverless from 'serverless-http';
import * as billingController from '../controllers/billing.controller.js';
import * as billingRepo from '../repos/billing.repo.js';
import { verifyWebhookSignature } from '../middleware/paypalWebHook.middleware.js';

const app = express();
app.use(express.json());

app.post('/billing/subscription', billingController.createSubscription);
app.get('/billing/subscription/:userId', billingController.getSubscription);
app.delete('/billing/subscription/:userId', billingController.cancelSubscription);


app.post('/billing/webhook', verifyWebhookSignature, async (req, res) => {
  const event = req.body;

  try {
    switch (event.event_type) {
      case 'BILLING.SUBSCRIPTION.ACTIVATED':
        await billingRepo.updateSubscriptionStatus(
          event.resource.custom_id,
          event.resource.id,
          'ACTIVE'
        );
        break;

      case 'BILLING.SUBSCRIPTION.CANCELLED':
        await billingRepo.updateSubscriptionStatus(
          event.resource.custom_id,
          event.resource.id,
          'CANCELLED'
        );
        break;

      case 'BILLING.SUBSCRIPTION.PAYMENT.FAILED':
        await billingRepo.updateSubscriptionStatus(
          event.resource.custom_id,
          event.resource.id,
          'PAYMENT_FAILED'
        );
        break;

      case 'PAYMENT.SALE.COMPLETED':
        console.log(`Payment completed for subscription: ${event.resource.billing_agreement_id}`);
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