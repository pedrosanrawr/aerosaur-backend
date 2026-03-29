import crypto from "crypto";
import { IoTDataPlaneClient, PublishCommand } from "@aws-sdk/client-iot-data-plane";
import * as ControlRepo from "../repos/control.repo.js";
import * as ReadingsRepo from "../repos/readings.repo.js";
import { predictFanSpeed } from "../lib/smartmode.js";
import { computeAQI } from "../lib/aqi.js";

const rawEndpoint = (process.env.IOT_ENDPOINT || process.env.IOT_DATA_ENDPOINT || "").trim();

const endpointHost = rawEndpoint
  .replace(/^https?:\/\//, "")
  .replace(/\/+$/, "");

const iot = endpointHost
  ? new IoTDataPlaneClient({ endpoint: `https://${endpointHost}` })
  : null;

const ALLOWED_FAN_SPEED = new Set(["SLOW", "MODERATE", "FAST"]);

function sanitizePatch(patch) {
  const clean = {};

  if ("power" in patch) clean.power = !!patch.power;
  if ("smartMode" in patch) clean.smartMode = !!patch.smartMode;
  if ("autoAdjust" in patch) clean.autoAdjust = !!patch.autoAdjust;
  if ("autoOff" in patch) clean.autoOff = !!patch.autoOff;

  if ("fanSpeed" in patch) {
    const s = String(patch.fanSpeed || "").toUpperCase();
    if (!ALLOWED_FAN_SPEED.has(s)) {
      const err = new Error("fanSpeed must be SLOW, MODERATE, or FAST");
      err.statusCode = 400;
      throw err;
    }
    clean.fanSpeed = s;
  }

  if (!Object.keys(clean).length) {
    const err = new Error("No valid control fields provided");
    err.statusCode = 400;
    throw err;
  }

  return clean;
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

  return (
    (await ControlRepo.getControl(deviceId)) ?? {
      deviceId,
      power: false,
      smartMode: false,
      autoAdjust: false,
      autoOff: false,
      fanSpeed: "SLOW",
      updatedAt: null,
    }
  );
}

export async function updateControl({ userId, deviceId, patch }) {
  const device = await ControlRepo.getDevice(deviceId);

  if (!device) throw Object.assign(new Error("Device not found"), { statusCode: 404 });
  if (device.ownerUserId !== userId) throw Object.assign(new Error("Forbidden"), { statusCode: 403 });

  const cleanPatch = sanitizePatch(patch);

  const current = await ControlRepo.getControl(deviceId) || {};

  let finalPatch = { ...current, ...cleanPatch };

  delete finalPatch.DeviceId;
  delete finalPatch.updatedAt;

  if (finalPatch.smartMode) {
    try {
      const readings = await ReadingsRepo.getRecentReadings(deviceId, 5);

      if (readings?.length) {
        const recentAqis = readings
          .map((reading) => computeAQI(reading).aqi)
          .filter((aqi) => Number.isFinite(aqi));

        if (!recentAqis.length) {
          throw new Error("No AQI-capable readings available for smart mode");
        }

        const avgAqi =
          recentAqis.reduce((sum, aqi) => sum + aqi, 0) / recentAqis.length;

        const predictedSpeed = predictFanSpeed(avgAqi);

        if (finalPatch.autoAdjust) {
          finalPatch.fanSpeed = predictedSpeed;
        }

        if (finalPatch.autoOff) {
          if (avgAqi <= 20) {
            finalPatch.power = false;
          } else {
            finalPatch.power = true;
          }
        }
      }
    } catch (err) {
      console.error("Smart mode error:", err);
    }
  }

  const pub = await publishCommand(deviceId, finalPatch, {
    requestedBy: userId,
  });

  return await ControlRepo.upsertControl(deviceId, {
    ...finalPatch,
    lastCmdId: pub.cmdId ?? null,
    lastPublishOk: pub.published ?? false,
  });
}
