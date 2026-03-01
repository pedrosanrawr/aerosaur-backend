import crypto from "crypto";
import { IoTDataPlaneClient, PublishCommand } from "@aws-sdk/client-iot-data-plane";
import * as ControlRepo from "../repos/control.repo.js";

const IOT_ENDPOINT = process.env.IOT_ENDPOINT;

const rawEndpoint = (process.env.IOT_ENDPOINT || process.env.IOT_DATA_ENDPOINT || "").trim();

const endpointHost = rawEndpoint
  .replace(/^https?:\/\//, "")  
  .replace(/\/+$/, "");      

const iot = endpointHost.length
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
      topic: `devices/${deviceId}/cmd`,
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

  console.log("AUTH userId:", userId);
  console.log("DEVICE ownerUserId:", device?.ownerUserId);
  console.log("DEVICE deviceId:", deviceId);

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

  const pub = await publishCommand(deviceId, cleanPatch, { requestedBy: userId });

  const updated = await ControlRepo.upsertControl(deviceId, {
    ...cleanPatch,
    lastCmdId: pub.cmdId ?? null,
    lastPublishOk: pub.published ?? false,
  });

  return updated;
}