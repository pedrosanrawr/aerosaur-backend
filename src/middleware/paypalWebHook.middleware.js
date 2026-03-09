import { paypalRequest } from '../lib/paypalClient.js';
import { PAYPAL_CLIENT_ID, PAYPAL_WEBHOOK_ID } from '../config/env.js';

export async function verifyWebhookSignature(req, res, next) {

  try {
    const webhookEvent = typeof req.body === 'string' 
      ? JSON.parse(req.body)  
      : req.body;         
         
    const rawBody = req.body instanceof Buffer ? req.body : Buffer.from(JSON.stringify(req.body));
    
    const verification = await paypalRequest(
      'POST',
      '/v1/notifications/verify-webhook-signature',
      {
        auth_algo: req.headers['paypal-auth-algo'],
        cert_url: req.headers['paypal-cert-url'],
        client_id: PAYPAL_CLIENT_ID,
        webhook_id: PAYPAL_WEBHOOK_ID,
        webhook_event: webhookEvent,
        transmission_id: req.headers['paypal-transmission-id'],
        transmission_sig: req.headers['paypal-transmission-sig'],
        transmission_time: req.headers['paypal-transmission-time'],
      }
    );

    if (verification.verification_status !== 'SUCCESS') {
      return res.status(400).json({ error: 'Invalid webhook signature' });
    }

    req.body = webhookEvent; 
    next();
  } catch (error) {
    console.error('Webhook verification error:', error.message);
    return res.status(500).json({ error: 'Failed to verify webhook' });
  }
}