import * as repo from "../repos/analytics.repo.js";
import * as DevicesRepo from "../repos/devices.repo.js";

async function ensureDeviceAccess(deviceId, userId) {
  const device = await DevicesRepo.getDeviceById(deviceId);

  if (!device) {
    throw Object.assign(new Error("Device not found"), { statusCode: 404 });
  }

  if (device.ownerUserId !== userId) {
    throw Object.assign(new Error("Forbidden"), { statusCode: 403 });
  }
}

function getStartDate(range) {
  const now = new Date();

  if (range === "7d") {
    now.setDate(now.getDate() - 6);
  } else if (range === "today") {
    now.setHours(0, 0, 0, 0);
  }

  return now.toISOString().slice(0, 10);
}

export async function getAnalytics({ deviceId, range, userId }) {
  await ensureDeviceAccess(deviceId, userId);

  const fromDate = getStartDate(range);

  const dailyStats = await repo.getDailyStats(deviceId, fromDate);

  return computeFromDaily(dailyStats, range);
}

function computeFromDaily(rows, range) {

  const dayNames = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

  const today = new Date();
  const days = [];

  if (range === "today") {
    days.push(today.toISOString().slice(0, 10));
  } else {
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      days.push(d.toISOString().slice(0, 10));
    }
  }

  const rowMap = {};
  rows.forEach(r => {
    rowMap[r.Date] = r;
  });

  const aqiTrend = [];
  const usageTrend = [];

  days.forEach(date => {

    const r = rowMap[date] || {};

    const avgAQI =
      !r.totalCount
        ? 0
        : Math.round((r.totalAQI || 0) / (r.totalCount || 1));

    aqiTrend.push({
      date,
      avgAQI,
      peakAQI: r.peakAQI || 0
    });

    usageTrend.push({
      date,
      day: dayNames[new Date(date).getDay()],
      hours: Number(((r.totalOnSeconds || 0) / 3600).toFixed(1))
    });

  });

  const todayRow = rowMap[days[days.length - 1]] || {};

  const aqiAverageToday =
    !todayRow.totalCount
      ? 0
      : Math.round((todayRow.totalAQI || 0) / todayRow.totalCount);

  const aqiPeakToday = todayRow.peakAQI || 0;

  const directHoursToday =
    Number(((todayRow.totalOnSeconds || 0) / 3600).toFixed(1));

  const goodPercentage =
    !todayRow.totalCount
      ? 0
      : Math.round((todayRow.goodCount || 0) / todayRow.totalCount * 100);

  const energySavedPercent =
    !todayRow.totalOnSeconds
      ? 0
      : Math.round((todayRow.smartSeconds || 0) / todayRow.totalOnSeconds * 100);

  return {
    aqiTrend,
    usageTrend,
    summary: {
      aqiAverageToday,
      aqiPeakToday,
      goodPercentage,
      directHoursToday,
      energySavedPercent
    }
  };
}
