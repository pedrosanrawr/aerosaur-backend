import * as service from './analytics.service.js';

export const fetchDashboardData = async (req) => {
  const deviceId = req.query.deviceId || "default_dev";
  return await service.generateInsights(deviceId);
};