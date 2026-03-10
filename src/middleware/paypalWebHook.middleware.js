import { paypalRequest } from '../lib/paypalClient.js';
import { PAYPAL_CLIENT_ID, PAYPAL_WEBHOOK_ID } from '../config/env.js';

export async function verifyWebhookSignature(req, res, next) {
  try {
    console.log('=== WEBHOOK DEBUG ===');
    console.log('Headers:', JSON.stringify(req.headers));
    console.log('Body type:', typeof req.body);
    console.log('Body:', JSON.stringify(req.body));
    console.log('WEBHOOK_ID:', PAYPAL_WEBHOOK_ID);
    console.log('CLIENT_ID:', PAYPAL_CLIENT_ID ? 'SET' : 'NOT SET');

    const webhookEvent = typeof req.body === 'string'
      ? JSON.parse(req.body)
      : req.body;

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

    console.log('Verification result:', JSON.stringify(verification));

    if (verification.verification_status !== 'SUCCESS') {
      return res.status(400).json({ error: 'Invalid webhook signature' });
    }

    req.body = webhookEvent;
    next();
  } catch (error) {
    console.error('Webhook verification error:', error.message);
    console.error('Full error:', JSON.stringify(error.response?.data));
    return res.status(500).json({ error: 'Failed to verify webhook' });
  }
}