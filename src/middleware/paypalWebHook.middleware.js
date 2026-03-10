import { paypalRequest } from '../lib/paypalClient.js';
import { PAYPAL_CLIENT_ID, PAYPAL_WEBHOOK_ID } from '../config/env.js';

export async function verifyWebhookSignature(req, res, next) {
  try {

    const rawBody = Buffer.isBuffer(req.body) 
      ? req.body.toString('utf8')
      : typeof req.body === 'string' 
        ? req.body 
        : JSON.stringify(req.body);

    const webhookEvent = JSON.parse(rawBody);

    const verification = await paypalRequest(
      'POST',
      '/v1/notifications/verify-webhook-signature',
      {
        auth_algo: req.headers['paypal-auth-algo'],
        cert_url: req.headers['paypal-cert-url'],
        client_id: PAYPAL_CLIENT_ID,
        webhook_id: PAYPAL_WEBHOOK_ID,
        webhook_event: webhookEvent, // ✅ now a proper JSON object
        transmission_id: req.headers['paypal-transmission-id'],
        transmission_sig: req.headers['paypal-transmission-sig'],
        transmission_time: req.headers['paypal-transmission-time'],
      }
    );

    console.log('Verification result:', verification.verification_status);

    if (verification.verification_status !== 'SUCCESS') {
      return res.status(400).json({ error: 'Invalid webhook signature' });
    }

    req.body = webhookEvent; // ✅ restore parsed body for handler
    next();
  } catch (error) {
    console.error('Webhook verification error:', error.message);
    console.error('Full error:', JSON.stringify(error.response?.data));
    return res.status(500).json({ error: 'Failed to verify webhook' });
  }
}
