import express from 'express';
import serverless from 'serverless-http';
import { getPremiumStatus } from '../controllers/paymayaSubscription.controller.js';

const app = express();
app.use(express.json());

app.get('/paymaya/premium/:userId', getPremiumStatus);

export const handler = serverless(app, { basePath: '/prod' });