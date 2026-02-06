import * as repo from './analytics.repo.js';

export const getDashboardData = async (deviceId) => {
  const startOfWeek = new Date(); 
  const logs = await repo.getWeeklyLogs(deviceId, startOfWeek, new Date());

  const aqiTrend = processAQITrend(logs);

  const usageData = await repo.getUsageStats(deviceId, startOfWeek, new Date());
  const totalUsage = usageData.reduce((acc, curr) => acc + curr.totalHours, 0);

  const energySaved = calculateEnergySavings(logs, usageData);

  return {
    aqiTrend,
    usage: {
      dailyBreakdown: usageData,
      totalUsage,
      averageUsage: totalUsage / 7
    },
    metrics: {
      goodAQITime: calculatePercentInGoodAQI(logs), 
      energySaved
    }
  };
};