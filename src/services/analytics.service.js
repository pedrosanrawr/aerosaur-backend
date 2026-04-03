import * as repo from "../repos/analytics.repo.js";
import * as DevicesRepo from "../repos/devices.repo.js";

const ANALYTICS_TIME_ZONE = "Asia/Manila";

function formatLocalDate(date) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: ANALYTICS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(date);
}

function startOfLocalDay(date) {
  return new Date(`${formatLocalDate(date)}T00:00:00`);
}

function dayNameFromLocalDate(dateText) {
  const dayNames = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const [year, month, day] = dateText.split("-").map(Number);
  return dayNames[new Date(year, month - 1, day).getDay()];
}

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
    const start = startOfLocalDay(now);
    start.setDate(start.getDate() - 6);
    return formatLocalDate(start);
  } else if (range === "today") {
    return formatLocalDate(now);
  }

  return formatLocalDate(now);
}

export async function getAnalytics({ deviceId, range, userId }) {
  await ensureDeviceAccess(deviceId, userId);

  const fromDate = getStartDate(range);

  const dailyStats = await repo.getDailyStats(deviceId, fromDate);

  return computeFromDaily(dailyStats, range);
}

function computeFromDaily(rows, range) {
  const today = startOfLocalDay(new Date());
  const days = [];

  if (range === "today") {
    days.push(formatLocalDate(today));
  } else {
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      days.push(formatLocalDate(d));
    }
  }

  const rowMap = {};
  rows.forEach(r => {
    rowMap[r.Date] = r;
  });

  const aqiTrend = [];
  const usageTrend = [];
  let totalUsageHours7d = 0;

  days.forEach(date => {

    const r = rowMap[date] || {};
    const usageHours = Number(((r.totalOnSeconds || 0) / 3600).toFixed(1));

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
      day: dayNameFromLocalDate(date),
      hours: usageHours
    });

    totalUsageHours7d += usageHours;

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
      totalUsageHours7d: Number(totalUsageHours7d.toFixed(1)),
      goodPercentage,
      directHoursToday,
      energySavedPercent
    }
  };
}
