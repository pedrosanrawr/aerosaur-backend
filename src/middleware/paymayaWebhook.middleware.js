import { verifyPaymayaSignature } from '../lib/paymayaWebhookVerifier.js';

export async function verifyPaymayaWebhook(req, res, next) {
  try {
    console.log('=== PAYMAYA WEBHOOK DEBUG ===');
    console.log('Headers:', JSON.stringify(req.headers));
    console.log('Body type:', typeof req.body);
    console.log('Body:', JSON.stringify(req.body));

    const signature = req.headers['x-signature'];

    if (!signature) {
      console.warn('[PayMaya Webhook] No signature found in headers');
      return res.status(400).json({ error: 'Missing webhook signature' });
    }

    const payload = typeof req.body === 'string'
      ? req.body
      : JSON.stringify(req.body);

    const isValid = verifyPaymayaSignature(payload, signature);

    console.log('Signature valid:', isValid);

    if (!isValid) {
      return res.status(400).json({ error: 'Invalid webhook signature' });
    }

    // Parse body if it came in as raw string
    req.body = typeof req.body === 'string'
      ? JSON.parse(req.body)
      : req.body;

    next();
  } catch (error) {
    console.error('PayMaya webhook verification error:', error.message);
    return res.status(500).json({ error: 'Failed to verify webhook' });
  }
}