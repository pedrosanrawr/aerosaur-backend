import crypto from "crypto";
import { IoTDataPlaneClient, PublishCommand } from "@aws-sdk/client-iot-data-plane";
import * as ControlRepo from "../repos/control.repo.js";
import * as ReadingsRepo from "../repos/readings.repo.js";
import { buildSmartModePatch } from "../lib/smartmode.js";
import { normalizeAqi } from "../lib/aqi.js";
import { ALLOWED_FAN_SPEED, normalizeFanSpeed, toFanSpeedValue } from "../lib/fan-speed.js";

const rawEndpoint = (process.env.IOT_ENDPOINT || process.env.IOT_DATA_ENDPOINT || "").trim();

const endpointHost = rawEndpoint
  .replace(/^https?:\/\//, "")
  .replace(/\/+$/, "");

const iot = endpointHost
  ? new IoTDataPlaneClient({ endpoint: `https://${endpointHost}` })
  : null;

const CONTROL_COMMAND_FIELDS = ["power", "smartMode", "autoAdjust", "autoOff", "fanSpeed"];
const ONE_SHOT_COMMAND_FIELDS = ["clearWifiCredentials"];
const MANUAL_OVERRIDE_FIELDS = ["power", "fanSpeed", "smartMode", "autoAdjust", "autoOff"];

function parseBooleanField(value, fieldName) {
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

  const err = new Error(fieldName + " must be a boolean");
  err.statusCode = 400;
  throw err;
}

function sanitizePatch(patch) {
  const clean = {};

  if ("power" in patch) clean.power = parseBooleanField(patch.power, "power");
  if ("smartMode" in patch) clean.smartMode = parseBooleanField(patch.smartMode, "smartMode");
  if ("autoAdjust" in patch) clean.autoAdjust = parseBooleanField(patch.autoAdjust, "autoAdjust");
  if ("autoOff" in patch) clean.autoOff = parseBooleanField(patch.autoOff, "autoOff");

  if ("fanSpeed" in patch) {
    const s = String(patch.fanSpeed || "").toUpperCase();
    if (!ALLOWED_FAN_SPEED.has(s)) {
      const err = new Error("fanSpeed must be SLOW, MODERATE, or FAST");
      err.statusCode = 400;
      throw err;
    }
    clean.fanSpeed = s;
  }

  if ("clearWifiCredentials" in patch) {
    if (patch.clearWifiCredentials !== true) {
      const err = new Error("clearWifiCredentials must be true when provided");
      err.statusCode = 400;
      throw err;
    }
    clean.clearWifiCredentials = true;
  }

  if (!Object.keys(clean).length) {
    const err = new Error("No valid control fields provided");
    err.statusCode = 400;
    throw err;
  }

  return clean;
}

function pickCommandPatch(control = {}, oneShot = {}) {
  return Object.fromEntries(
    [...CONTROL_COMMAND_FIELDS, ...ONE_SHOT_COMMAND_FIELDS]
      .filter((field) => field in control || field in oneShot)
      .map((field) => [field, field in oneShot ? oneShot[field] : control[field]])
  );
}

function buildEffectiveControl(control = {}) {
  const effective = { ...control };

  if (
    typeof effective.power !== "boolean" &&
    typeof control.reportedPower === "boolean"
  ) {
    effective.power = control.reportedPower;
  }

  if (typeof control.reportedSmartMode === "boolean") {
    effective.smartMode = control.reportedSmartMode;
  }

  if (typeof control.reportedAutoAdjust === "boolean") {
    effective.autoAdjust = control.reportedAutoAdjust;
  }

  if (typeof control.reportedAutoOff === "boolean") {
    effective.autoOff = control.reportedAutoOff;
  }

  if (effective.power === false) {
    effective.fanSpeed = "OFF";
    return effective;
  }

  const requestedFanSpeed = normalizeFanSpeed(control.fanSpeed);
  if (requestedFanSpeed) {
    effective.fanSpeed = requestedFanSpeed;
  }

  const reportedFanSpeed = normalizeFanSpeed(
    control.reportedFanSpeed ?? control.fan_speed
  );
  if (reportedFanSpeed && (effective.smartMode || !requestedFanSpeed)) {
    effective.fanSpeed = reportedFanSpeed;
  }

  return effective;
}

export async function publishCommand(deviceId, patch, meta = {}) {
  if (!iot) {
    console.warn("IoT not configured — skipping publish");
    return { published: false, reason: "IOT endpoint missing" };
  }

  const payload = {
    cmdId: crypto.randomUUID(),
    deviceId,
    ...patch,
    ts: Date.now(),
    ...meta,
  };

  if ("fanSpeed" in payload) {
    payload.fan_speed = toFanSpeedValue(payload.fanSpeed);
  }

  await iot.send(
    new PublishCommand({
      topic: `devices/${deviceId}/cmd`,
      qos: 1,
      payload: Buffer.from(JSON.stringify(payload)),
    })
  );

  return { published: true, cmdId: payload.cmdId };
}

export async function getControl({ userId, deviceId }) {
  const device = await ControlRepo.getDevice(deviceId);

  if (!device) throw Object.assign(new Error("Device not found"), { statusCode: 404 });
  if (device.ownerUserId !== userId) throw Object.assign(new Error("Forbidden"), { statusCode: 403 });

  const control = (await ControlRepo.getControl(deviceId)) ?? {
      deviceId,
      power: false,
      smartMode: false,
      autoAdjust: false,
      autoOff: false,
      fanSpeed: "OFF",
      updatedAt: null,
    };

  return buildEffectiveControl(control);
}

export async function updateControl({ userId, deviceId, patch }) {
  const device = await ControlRepo.getDevice(deviceId);

  if (!device) throw Object.assign(new Error("Device not found"), { statusCode: 404 });
  if (device.ownerUserId !== userId) throw Object.assign(new Error("Forbidden"), { statusCode: 403 });

  const cleanPatch = sanitizePatch(patch);
  const hasExplicitPower = Object.prototype.hasOwnProperty.call(cleanPatch, "power");
  if (cleanPatch.power === false) {
    cleanPatch.smartMode = false;
  }
  const oneShotPatch = {};
  if (cleanPatch.clearWifiCredentials == true) {
    oneShotPatch.clearWifiCredentials = true;
    delete cleanPatch.clearWifiCredentials;
  }

  const current = await ControlRepo.getControl(deviceId) || {};
  const isPowerOffRequest = cleanPatch.power === false;
  const blockedWhileOff = ["smartMode", "autoAdjust", "autoOff", "fanSpeed"].some(
    (field) => Object.prototype.hasOwnProperty.call(cleanPatch, field)
  );
  if (
    current.power === false &&
    cleanPatch.power !== true &&
    !isPowerOffRequest &&
    blockedWhileOff
  ) {
    throw Object.assign(
      new Error("Turn the device on before changing smart mode or fan speed"),
      { statusCode: 400 }
    );
  }
  const enablingSmartMode = cleanPatch.smartMode === true && !current.smartMode;

  let finalPatch = {
    ...pickCommandPatch(current),
    ...cleanPatch,
  };

  if (finalPatch.smartMode) {
    try {
      const readings = await ReadingsRepo.getRecentReadings(deviceId, 5);

      if (readings?.length) {
        const recentAqis = readings
          .map((reading) => normalizeAqi(reading?.aqi))
          .filter((aqi) => Number.isFinite(aqi));

        if (!recentAqis.length) {
          throw new Error("No firmware-reported AQI readings available for smart mode");
        }

        const avgAqi =
          recentAqis.reduce((sum, aqi) => sum + aqi, 0) / recentAqis.length;
        const smartModePatch = buildSmartModePatch({
          aqi: avgAqi,
          control: finalPatch,
          forcePowerOn: enablingSmartMode && !hasExplicitPower,
        });
        if (hasExplicitPower) {
          delete smartModePatch.power;
        }
        finalPatch = {
          ...finalPatch,
          ...smartModePatch,
        };
      } else if (!hasExplicitPower && enablingSmartMode && finalPatch.power === false) {
        finalPatch.power = true;
      }
    } catch (err) {
      console.error("Smart mode error:", err);
      if (!hasExplicitPower && enablingSmartMode && finalPatch.power === false) {
        finalPatch.power = true;
      }
    }
  }

  const commandPatch = pickCommandPatch(finalPatch, oneShotPatch);
  const hasManualOverride = MANUAL_OVERRIDE_FIELDS.some((field) =>
    Object.prototype.hasOwnProperty.call(cleanPatch, field)
  );

  const pub = await publishCommand(deviceId, commandPatch, {
    requestedBy: userId,
  });

  return await ControlRepo.upsertControl(deviceId, {
    ...finalPatch,
    ...(hasManualOverride ? { lastManualOverrideAt: Date.now() } : {}),
    ...(oneShotPatch.clearWifiCredentials == true
      ? { lastClearWifiCredentialsRequestedAt: Date.now() }
      : {}),
    lastCmdId: pub.cmdId ?? null,
    lastPublishOk: pub.published ?? false,
  });
}



