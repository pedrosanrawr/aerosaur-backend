import express from 'express';
import serverless from 'serverless-http';
import { createCheckout } from '../controllers/paymayaSubscription.controller.js';

const app = express();
app.use(express.json());

app.post('/paymaya/checkout', createCheckout);

export const handler = serverless(app, { basePath: '/prod' });