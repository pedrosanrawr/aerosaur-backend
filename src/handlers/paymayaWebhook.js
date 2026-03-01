const serverless = require('serverless-http');
const express = require('express');
const { handleWebhook } = require('../controllers/paymayaSubscription.controller');

const app = express();
app.use(express.json());
app.post('/subscriptions/webhook', handleWebhook);

module.exports.handler = serverless(app);