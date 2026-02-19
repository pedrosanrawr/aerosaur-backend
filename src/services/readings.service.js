import * as ReadingsRepo from "../repos/readings.repo.js";
import * as DevicesRepo from "../repos/devices.repo.js";

const AQI_DEADBAND = 5;       
const FORCE_INTERVAL_SEC = 60; 
const EMA_ALPHA = 0.25;

function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

function aqiCategory(aqi) {
  if (aqi <= 50) return "Good";
  if (aqi <= 100) return "Moderate";
  if (aqi <= 200) return "Unhealthy";
  return "Dangerous";
}

function aqiPercent(aqi) {
  return Math.round(clamp(100 - (aqi / 200) * 100, 0, 100));
}

function ema(prev, next, alpha) {
  if (prev == null) return next;
  return alpha * next + (1 - alpha) * prev;
}

const PM25_BREAKPOINTS = [
  { cLo: 0.0,   cHi: 12.0,   iLo: 0,   iHi: 50 },
  { cLo: 12.1,  cHi: 35.4,   iLo: 51,  iHi: 100 },
  { cLo: 35.5,  cHi: 55.4,   iLo: 101, iHi: 150 },
  { cLo: 55.5,  cHi: 150.4,  iLo: 151, iHi: 200 },
  { cLo: 150.5, cHi: 250.4,  iLo: 201, iHi: 300 },
  { cLo: 250.5, cHi: 350.4,  iLo: 301, iHi: 400 },
  { cLo: 350.5, cHi: 500.4,  iLo: 401, iHi: 500 },
];

const PM10_BREAKPOINTS = [
  { cLo: 0,   cHi: 54,   iLo: 0,   iHi: 50 },
  { cLo: 55,  cHi: 154,  iLo: 51,  iHi: 100 },
  { cLo: 155, cHi: 254,  iLo: 101, iHi: 150 },
  { cLo: 255, cHi: 354,  iLo: 151, iHi: 200 },
  { cLo: 355, cHi: 424,  iLo: 201, iHi: 300 },
  { cLo: 425, cHi: 504,  iLo: 301, iHi: 400 },
  { cLo: 505, cHi: 604,  iLo: 401, iHi: 500 },
];

function calcAQIFromBreakpoints(C, table) {
  if (C == null || Number.isNaN(C)) return null;

  const max = table[table.length - 1];
  if (C > max.cHi) C = max.cHi;

  const bp = table.find((b) => C >= b.cLo && C <= b.cHi);
  if (!bp) return null;

  const { cLo, cHi, iLo, iHi } = bp;
  const I = ((iHi - iLo) / (cHi - cLo)) * (C - cLo) + iLo;
  return Math.round(I);
}

function truncatePM25(x) {
  return Math.floor(x * 10) / 10;
}
function truncatePM10(x) {
  return Math.floor(x);
}

export function computeAQI({ pm25, pm10 }) {
  const pm25C = pm25 == null ? null : truncatePM25(Number(pm25));
  const pm10C = pm10 == null ? null : truncatePM10(Number(pm10));

  const aqiPm25 = pm25C == null ? null : calcAQIFromBreakpoints(pm25C, PM25_BREAKPOINTS);
  const aqiPm10 = pm10C == null ? null : calcAQIFromBreakpoints(pm10C, PM10_BREAKPOINTS);

  const candidates = [
    { name: "pm25", value: aqiPm25 },
    { name: "pm10", value: aqiPm10 },
  ].filter((x) => x.value != null);

  if (candidates.length === 0) return { aqi: 0, primary: null, aqiPm25: null, aqiPm10: null };

  const maxOne = candidates.reduce((best, cur) => (cur.value > best.value ? cur : best));
  return {
    aqi: maxOne.value,
    primary: maxOne.name,
    aqiPm25,
    aqiPm10,
  };
}


function shouldUpdateDisplay(prev, next, nowSec) {
  if (!prev) return true;

  if ((nowSec - (prev.updatedAtSec ?? 0)) >= FORCE_INTERVAL_SEC) return true;

  if (prev.harmfulGasDetected !== next.harmfulGasDetected) return true;

  if (prev.aqiCategory !== next.aqiCategory) return true;

  const diff = Math.abs((next.aqi ?? 0) - (prev.aqi ?? 0));
  if (diff >= AQI_DEADBAND) return true;

  return false;
}

async function ensureDeviceAccess(deviceId, userId) {
  const device = await DevicesRepo.getDeviceById(deviceId);
  if (!device) return { ok: false, status: 404, body: { message: "Device not found" } };
  if (device.ownerUserId !== userId) return { ok: false, status: 403, body: { message: "Forbidden" } };
  return { ok: true, device };
}

export async function getLatest({ deviceId, userId }) {
  const access = await ensureDeviceAccess(deviceId, userId);
  if (!access.ok) return { status: access.status, body: access.body };

  const item = await ReadingsRepo.getLatestDisplayItem(deviceId);
  if (!item) return { status: 404, body: { message: "No readings yet" } };
  return { status: 200, body: item };
}

export async function query({ deviceId, userId, from, to, limit }) {
  const access = await ensureDeviceAccess(deviceId, userId);
  if (!access.ok) return { status: access.status, body: access.body };

  const items = await ReadingsRepo.queryRaw(deviceId, { from, to, limit });
  return { status: 200, body: { items } };
}

export async function ingest({ deviceId, payload }) {
  const now = new Date();
  const iso = payload.ts ? new Date(payload.ts).toISOString() : now.toISOString();
  const nowSec = Math.floor(new Date(iso).getTime() / 1000);

  const raw = {
    DeviceId: deviceId,
    Timestamp: ReadingsRepo.makeRawSortKey(iso),

    pm25: payload.pm25 ?? null,
    pm10: payload.pm10 ?? null,
    vocsPpm: payload.vocsPpm ?? null,
    tempC: payload.tempC ?? null,
    humidity: payload.humidity ?? null,
    harmfulGasDetected: !!payload.harmfulGasDetected,

    ingestedAtSec: nowSec,
  };

  await ReadingsRepo.putRawItem(raw);

  const prev = await ReadingsRepo.getLatestDisplayItem(deviceId);

  const { aqi, primary, aqiPm25, aqiPm10 } = computeAQI(raw);
  const aqiEma = ema(prev?.aqiEma, aqi, EMA_ALPHA);
  const aqiSmooth = Math.round(aqiEma);

  const next = {
    DeviceId: deviceId,
    Timestamp: ReadingsRepo.LATEST_SK,
    pm25: raw.pm25,
    pm10: raw.pm10,
    vocsPpm: raw.vocsPpm,
    tempC: raw.tempC,
    humidity: raw.humidity,
    harmfulGasDetected: raw.harmfulGasDetected,
    aqi: aqiSmooth,
    aqiEma,
    aqiPrimaryPollutant: primary,
    aqiPm25,
    aqiPm10,
    aqiCategory: aqiCategory(aqiSmooth),
    aqiPercent: aqiPercent(aqiSmooth),
    updatedAtSec: nowSec,
    sourceRawTimestamp: raw.Timestamp,
  };

  const displayUpdated = shouldUpdateDisplay(prev, next, nowSec);
  if (displayUpdated) {
    await ReadingsRepo.putLatestItem(next);
  }

  await DevicesRepo.updateConnectionStatus(deviceId, {
    online: true,
    lastSeen: iso,
  });

  return {
    status: 201,
    body: {
      savedRaw: true,
      displayUpdated,
      latest: displayUpdated ? next : prev ?? null,
    },
  };
}
