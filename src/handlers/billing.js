const express = require('express');
const serverless = require('serverless-http');
const billingController = require('../controllers/billing.controller');
const billingRepo = require('../repos/billingRepo');
const {verifyWebhookSignature} = require('../middleware/paypalWebHook.middleware');

const app = express();
app.use(express.json());

app.post('/create-subscription', billingController.createSubscription);
app.get('/subscription/:userId', billingController.getSubscription);
app.post('/subscription/:userId', billingController.cancelSubscription);

app.post('/webhook', verifyWebhookSignature, async (req, res) => {
    const event = req.body;
  
    try{
        switch(event.event_type){
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
                console.log(`Payment completed for subscription ${event.resource.billing_agreement_id}`);
            break;
            default:
                console.log(`Unhandled event type: ${event.event_type}`);
        }
        return res.sendStatus(200);
    } catch (error) {
        console.error('Webhook processing error:', error.message);
        return res.status(500).json({error: 'Failed to process webhook'});
    }
});

module.exports.handler = serverless(app);
