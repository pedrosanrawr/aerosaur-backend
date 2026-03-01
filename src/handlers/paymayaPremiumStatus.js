const serverless = require('serverless-http');
const express = require('express');
const { getPaymentStatus } = require('../controllers/paymayaSubscription.controller');

const app = express();
app.use(express.json());
app.get('/subscriptions/:paymentId/status', getPaymentStatus);

module.exports.handler = serverless(app);