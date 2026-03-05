import * as repo from "../repos/analytics.repo.js";

function getStartDate(range) {
  const now = new Date();

  if (range === "7d") {
    now.setDate(now.getDate() - 7);
  } else if (range === "today") {
    now.setHours(0, 0, 0, 0);
  }

  return now.toISOString().slice(0, 10);
}

export async function getAnalytics(deviceId, range) {
  const fromDate = getStartDate(range);

  const dailyStats = await repo.getDailyStats(deviceId, fromDate);

  return computeFromDaily(dailyStats);
}

function computeFromDaily(rows) {

  if (!rows.length) {
    return {
      aqiTrend: [],
      usageTrend: [],
      summary: {
        aqiAverage7d: 0,
        aqiPeak7d: 0,
        purifierUsageHours7d: 0,
        totalUsageHours7d: 0,
        goodPercentage: 0,
        directHoursToday: 0,
        energySavedPercent: 0
      }
    };
  }

  rows.sort((a, b) => new Date(a.Date) - new Date(b.Date));

  const aqiTrend = [];
  const usageTrend = [];

  let totalAQI = 0;
  let totalCount = 0;
  let peakAQI = 0;

  let totalSeconds = 0;
  let smartSeconds = 0;
  let goodReadings = 0;

  rows.forEach(r => {

    const totalCountDay = r.totalCount || 0;
    const totalAQIDay = r.totalAQI || 0;

    const avgAQI = totalCountDay === 0
      ? 0
      : Math.round(totalAQIDay / totalCountDay);

    aqiTrend.push({
      date: r.Date,
      avgAQI,
      peakAQI: r.peakAQI || 0
    });

    const onSeconds = r.totalOnSeconds || 0;
    const hours = Number((onSeconds / 3600).toFixed(1));

    usageTrend.push({
      date: r.Date,
      hours
    });

    totalAQI += totalAQIDay;
    totalCount += totalCountDay;
    totalSeconds += onSeconds;
    smartSeconds += r.smartSeconds || 0;

    peakAQI = Math.max(peakAQI, r.peakAQI || 0);

    goodReadings += r.goodCount || 0;
  });

  const aqiAverage7d =
    totalCount === 0 ? 0 : Math.round(totalAQI / totalCount);

  const purifierUsageHours7d =
    Number((smartSeconds / 3600).toFixed(1));

  const totalUsageHours7d =
    Number((totalSeconds / 3600).toFixed(1));

  const goodPercentage =
    totalCount === 0
      ? 0
      : Math.round((goodReadings / totalCount) * 100);

  const energySavedPercent =
    totalSeconds === 0
      ? 0
      : Math.round((smartSeconds / totalSeconds) * 100);

  const today = rows[rows.length - 1];

  const directHoursToday =
    today
      ? Number(((today.totalOnSeconds || 0) / 3600).toFixed(1))
      : 0;

  return {
    aqiTrend,
    usageTrend,
    summary: {
      aqiAverage7d,
      aqiPeak7d: peakAQI,
      purifierUsageHours7d,
      totalUsageHours7d,
      goodPercentage,
      directHoursToday,
      energySavedPercent
    }
  };
}