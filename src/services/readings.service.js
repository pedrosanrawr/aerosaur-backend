import * as ReadingsRepo from "../repos/readings.repo.js";
import * as DevicesRepo from "../repos/devices.repo.js";
import * as AnalyticsRepo from "../repos/analytics.repo.js";
import * as ControlRepo from "../repos/control.repo.js";
import { withEffectiveConnectionStatus } from "./devices.service.js";
import { publishCommand } from "../services/control.service.js";
import * as NotificationsService from "../services/notifications.service.js";
import { buildSmartModePatch } from "../lib/smartmode.js";
import { aqiCategory, aqiPercent, computeAQI } from "../lib/aqi.js";

const AQI_DEADBAND = 5;
const FORCE_INTERVAL_SEC = 60;
const EMA_ALPHA = 0.25;
const SMART_MODE_COOLDOWN_SEC = 30;
const MANUAL_OVERRIDE_COOLDOWN_MS = 2 * 60 * 1000;

function ema(prev, next, alpha) {
  if (prev == null) return next;
  return alpha * next + (1 - alpha) * prev;
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

function normalizePayloadFanSpeed(payload) {
  if ("fanSpeed" in payload && payload?.fanSpeed != null) {
    const normalized = String(payload.fanSpeed).toUpperCase();
    return normalized === "OFF" ? "OFF" : normalized;
  }

  if (!("fan_speed" in payload)) return null;

  const numeric = Number(payload?.fan_speed);
  if (!Number.isFinite(numeric)) return null;
  if (numeric <= 0) return "OFF";
  if (numeric >= 60) return "FAST";
  if (numeric >= 41) return "MODERATE";
  if (numeric >= 40) return "SLOW";
  return null;
}

function parseReportedBoolean(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "on", "enabled", "active"].includes(normalized)) {
      return true;
    }
    if (["false", "0", "off", "disabled", "inactive"].includes(normalized)) {
      return false;
    }
  }
  return null;
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

async function handleSmartMode(device, aqi) {
  try {
    const control = await ControlRepo.getControl(device.DeviceId);
    if (!control || !control.smartMode) return;

    if (
      control.lastManualOverrideAt &&
      Date.now() - Number(control.lastManualOverrideAt) < MANUAL_OVERRIDE_COOLDOWN_MS
    ) {
      return;
    }

    const nowSec = Math.floor(Date.now() / 1000);

    if (
      control.lastSmartUpdateSec &&
      nowSec - control.lastSmartUpdateSec < SMART_MODE_COOLDOWN_SEC
    ) {
      return;
    }


    let patch = {};
    patch = buildSmartModePatch({
      aqi,
      control,
    });

    if (
      (patch.fanSpeed === undefined || patch.fanSpeed === control.fanSpeed) &&
      (patch.power === undefined || patch.power === control.power)
    ) {
      return;
    }

    if (!Object.keys(patch).length) return;

    const pub = await publishCommand(device.DeviceId, patch, {
      source: "smart-mode-auto",
    });

    await ControlRepo.upsertControl(device.DeviceId, {
      ...control,
      ...patch,
      lastCmdId: pub.cmdId ?? null,
      lastPublishOk: pub.published ?? false,
      lastSmartUpdateSec: nowSec,
    });

    await NotificationsService.emitSmartModeNotification({
      device,
      patch,
      aqi,
    });

    console.log("SMART MODE AUTO:", { deviceId: device.DeviceId, aqi, patch });

  } catch (err) {
    console.error("Smart mode auto error:", err);
  }
}

export async function ingest({ deviceId, payload, userId = null }) {
  const rawDevice = await DevicesRepo.getDeviceById(deviceId);
  const device = withEffectiveConnectionStatus(rawDevice);
  if (!device) {
    return { status: 404, body: { message: "Device not found" } };
  }

  if (userId) {
    if (device.ownerUserId !== userId) {
      return { status: 403, body: { message: "Forbidden" } };
    }
  }

  const now = new Date();
  const iso = payload?.ts ? new Date(payload.ts).toISOString() : now.toISOString();
  const nowSec = Math.floor(new Date(iso).getTime() / 1000);
  const date = iso.slice(0, 10);

  const raw = {
    DeviceId: deviceId,
    Timestamp: ReadingsRepo.makeRawSortKey(iso),

    pm25: payload?.pm25 ?? null,
    pm10: payload?.pm10 ?? null,
    vocsPpm: payload?.vocsPpm ?? null,
    tempC: payload?.tempC ?? null,
    humidity: payload?.humidity ?? null,
    harmfulGasDetected: !!payload?.harmfulGasDetected,

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

  await handleSmartMode(device, next.aqi);

  try {
    await DevicesRepo.updateConnectionStatus(deviceId, {
      online: true,
      lastSeen: iso,
    });
  } catch (err) {
    console.warn("Device status update failed:", err.message);
  }

  let control = null;

  try {
    control = await ControlRepo.getControl(deviceId);
  } catch (err) {
    console.warn("Control fetch failed:", err.message);
  }

  const reportedPatch = {};
  const reportedPower = parseReportedBoolean(payload?.power);
  if ("power" in (payload ?? {}) && reportedPower !== null) {
    reportedPatch.reportedPower = reportedPower;
  }

  const reportedFanSpeed = normalizePayloadFanSpeed(payload ?? {});
  if (reportedFanSpeed) {
    reportedPatch.reportedFanSpeed = reportedFanSpeed;
  }

  const reportedSmartMode = parseReportedBoolean(payload?.smartMode);
  if ("smartMode" in (payload ?? {}) && reportedSmartMode !== null) {
    reportedPatch.reportedSmartMode = reportedSmartMode;
  }

  const reportedAutoAdjust = parseReportedBoolean(payload?.autoAdjust);
  if ("autoAdjust" in (payload ?? {}) && reportedAutoAdjust !== null) {
    reportedPatch.reportedAutoAdjust = reportedAutoAdjust;
  }

  const reportedAutoOff = parseReportedBoolean(payload?.autoOff);
  if ("autoOff" in (payload ?? {}) && reportedAutoOff !== null) {
    reportedPatch.reportedAutoOff = reportedAutoOff;
  }

  if (Object.keys(reportedPatch).length) {
    try {
      control = await ControlRepo.upsertControl(deviceId, {
        ...(control ?? {}),
        ...reportedPatch,
      });
    } catch (err) {
      console.warn("Control mirror update failed:", err.message);
    }
  }

  const fanOn =
    payload?.power ??
    (
      payload?.fan_speed !== undefined
        ? payload.fan_speed > 0
        : undefined
    ) ??
    control?.power ??
    false;

  const smartMode =
    payload?.smartMode ??
    control?.smartMode ??
    false;

  try {
    const analytics = await AnalyticsRepo.updateDailyStats(deviceId, date, {
      aqi: aqiSmooth,
      isOn: fanOn,
      smartMode,
      sampledAtSec: nowSec,
    });

    const prevOnSeconds = (analytics.totalOnSeconds || 0) - (analytics.elapsedSec || 0);
    const crossedHighUsage = prevOnSeconds < 8 * 3600 && analytics.totalOnSeconds >= 8 * 3600;

    if (crossedHighUsage) {
      await NotificationsService.emitEnergyNotification({
        device,
        totalOnSeconds: analytics.totalOnSeconds,
      });
    }
  } catch (err) {
    console.warn("Daily analytics update failed:", err.message);
  }

  try {
    await NotificationsService.emitTelemetryNotifications({
      device,
      previousReading: prev,
      latestReading: next,
      previousOnline: device.online ?? null,
    });
  } catch (err) {
    console.warn("Telemetry notification emit failed:", err.message);
  }

  return {
    status: 201,
    body: {
      savedRaw: true,
      displayUpdated,
      latest: displayUpdated ? next : prev ?? null,
    },
  };
}
