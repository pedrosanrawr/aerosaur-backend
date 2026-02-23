import express from 'express';
import { ok } from "../lib/response.js";
import * as controller from "./analytics.controller.js";

const router = express.Router();

export const handler = async (req, res, next) => {
  try {
    const insights = await controller.fetchDashboardData(req);

    return ok(res, {
      status: "ok",
      service: "aerosaur-analytics-v2",
      timestamp: new Date().toISOString(),
      data: {
        user: { name: "Peter Dones", status: "online" },
        aqiTrend: insights.aqiChart,
        purifierUsage: insights.usageChart,
        metrics: insights.summaryCards,
        usageSummary: insights.usageStats
      }
    });
  } catch (error) {
    next(error);
  }
};


router.get('/', handler);

export default router;