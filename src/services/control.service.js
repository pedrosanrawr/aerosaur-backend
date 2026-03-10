import crypto from "crypto";
import { IoTDataPlaneClient, PublishCommand } from "@aws-sdk/client-iot-data-plane";
import * as ControlRepo from "../repos/control.repo.js";
import * as ReadingsRepo from "../repos/readings.repo.js";

const IOT_ENDPOINT = process.env.IOT_ENDPOINT;

const iot =
  IOT_ENDPOINT && IOT_ENDPOINT.trim().length > 0
    ? new IoTDataPlaneClient({ endpoint: `https://${IOT_ENDPOINT}` })
    : null;

const ALLOWED_FAN_SPEED = new Set(["SLOW", "MODERATE", "FAST"]);

const trees = [
  (aqi) => aqi <= 50  ? "SLOW" : aqi <= 100 ? "MODERATE" : "FAST",
  (aqi) => aqi <= 48  ? "SLOW" : aqi <= 98  ? "MODERATE" : "FAST",
  (aqi) => aqi <= 52  ? "SLOW" : aqi <= 102 ? "MODERATE" : "FAST",
  (aqi) => aqi <= 50  ? "SLOW" : aqi <= 95  ? "MODERATE" : "FAST",
  (aqi) => aqi <= 55  ? "SLOW" : aqi <= 100 ? "MODERATE" : "FAST",
];

function predictFanSpeed(aqi) {
  const votes = trees.map((tree) => tree(aqi));
  const count = {};
  for (const v of votes) count[v] = (count[v] || 0) + 1;
  return Object.keys(count).sort((a, b) => count[b] - count[a])[0];
}

function getAqiSettings(aqi) {
  const fanSpeed = predictFanSpeed(aqi);
  if (fanSpeed === "SLOW") return { fanSpeed, power: false };
  return { fanSpeed, power: true };
}

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

  if (Object.keys(clean).length === 0) {
    const err = new Error("No valid control fields provided");
    err.statusCode = 400;
    throw err;
  }

  return clean;
}

async function publishCommand(deviceId, patch, meta = {}) {
  if (!iot) return { published: false, reason: "IOT_ENDPOINT not set" };

  const payload = {
    cmdId: crypto.randomUUID(),
    deviceId,
    ...patch,
    ts: Date.now(),
    ...meta,
  };

  await iot.send(
    new PublishCommand({
      topic: `aerosaur/${deviceId}/cmd`,
      qos: 1,
      payload: Buffer.from(JSON.stringify(payload)),
    })
  );

  return { published: true, cmdId: payload.cmdId };
}

export async function getControl({ userId, deviceId }) {
  const device = await ControlRepo.getDevice(deviceId);
  if (!device) {
    const err = new Error("Device not found");
    err.statusCode = 404;
    throw err;
  }
  if (device.ownerUserId !== userId) {
    const err = new Error("Forbidden");
    err.statusCode = 403;
    throw err;
  }

  const control = await ControlRepo.getControl(deviceId);
  return (
    control ?? {
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
  if (!device) {
    const err = new Error("Device not found");
    err.statusCode = 404;
    throw err;
  }
  if (device.ownerUserId !== userId) {
    const err = new Error("Forbidden");
    err.statusCode = 403;
    throw err;
  }

  const cleanPatch = sanitizePatch(patch);

  if ((cleanPatch.smartMode || cleanPatch.autoAdjust) && "aqi" in patch) {
    const aqi = Number(patch.aqi);
    if (!isNaN(aqi)) {
      const settings = getAqiSettings(aqi);
      cleanPatch.fanSpeed = settings.fanSpeed;
      cleanPatch.power = settings.power;
    }
  }

  const updated = await ControlRepo.upsertControl(deviceId, cleanPatch);
  const pub = await publishCommand(deviceId, cleanPatch, { requestedBy: userId });

  return { ...updated, lastCmdId: pub.cmdId ?? null };
}

export async function autoAdjustFanSpeed({ deviceId }) {
  const control = await ControlRepo.getControl(deviceId);

  if (!control?.autoAdjust) return null;

  const latest = await ReadingsRepo.getLatestDisplayItem(deviceId);
  if (!latest || latest.aqi == null) return null;

  const aqi = Number(latest.aqi);
  if (isNaN(aqi)) return null;

  const { fanSpeed, power } = getAqiSettings(aqi);

  if (control.fanSpeed === fanSpeed && control.power === power) return null;

  const updated = await ControlRepo.upsertControl(deviceId, { fanSpeed, power });
  await publishCommand(deviceId, { fanSpeed, power }, { triggeredBy: "autoAdjust", aqi });

  return updated;
}