import express from 'express';
import { getAnalytics } from './analytics.controller.js';

const router = express.Router();

router.get('/:deviceId', getAnalytics);

export default router;