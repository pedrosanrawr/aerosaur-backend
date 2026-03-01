const serverless = require('serverless-http');
const express = require('express');
const { createCheckout } = require('../controllers/paymayaSubscription.controller');

const app = express();
app.use(express.json());
app.post('/subscriptions/checkout', createCheckout);

module.exports.handler = serverless(app);