import express from 'express';
import serverless from 'serverless-http';
import { getPaymentStatus } from '../controllers/paymayaSubscription.controller.js';

const app = express();
app.use(express.json());

app.get('/paymaya/status/:paymentId', getPaymentStatus);

export const handler = serverless(app, { basePath: '/prod' });