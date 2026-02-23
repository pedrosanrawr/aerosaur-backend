import * as repo from './analytics.repo.js';

export const generateInsights = async (deviceId) => {
  const rawData = await repo.getWeeklySensorData(deviceId);

  const totalUsage = rawData.reduce((sum, d) => sum + d.usage, 0);
  const latestUsage = rawData[rawData.length - 1].usage;

  return {
    aqiChart: rawData.map(d => ({ label: d.day, peak: d.peak, avg: d.average })),
    usageChart: rawData.map(d => ({ label: d.day, value: d.usage })),
    
    summaryCards: [
      { id: "aqi_mod", label: "Time in Moderate AQI today", value: "61%", color: "orange" },
      { id: "direct_hrs", label: "Direct Hours", value: latestUsage.toFixed(1), color: "blue" },
      { id: "energy_sav", label: "Energy saved (Smart Mode)", value: "25%", color: "purple" }
    ],
    usageStats: {
      total: `${totalUsage.toFixed(1)}h`,
      daily: `${(totalUsage / 7).toFixed(1)}h`
    }
  };
};