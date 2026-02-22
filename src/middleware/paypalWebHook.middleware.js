const {paypalRequest} = require('../services/paypal.service');

async function verifyWebhookSignature(req, res, next){
    try {
        const verification = await paypalRequest('POST', '/v1/notifications/verify-webhook-signature', {
            auth_algo: req.headers['paypal-auth-algo'],
            cert_url: req.headers['paypal-cert-url'],
            client_id: process.env.PAYPAL_CLIENT_ID,
            webhook_id: process.env.PAYPAL_WEBHOOK_ID,
            webhook_event: req.body,
            transmission_id: req.headers['paypal-transmission-id'],
            transmission_sig: req.headers['paypal-transmission-sig'],
            transmission_time: req.headers['paypal-transmission-time']
        });
        if(verification.verification_status !== 'SUCCESS'){
            return res.status(400).json({error: 'Invalid webhook signature'});
        }
        next();
    } catch (error) {
        console.error('Webhook verification error:', error.message);
        return res.status(500).json({error: 'Failed to verify webhook'});
    }
}
module.exports = {verifyWebhookSignature};

