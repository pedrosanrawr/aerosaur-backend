import crypto from "crypto";
import { IoTDataPlaneClient, PublishCommand } from "@aws-sdk/client-iot-data-plane";
import * as ControlRepo from "../repos/control.repo.js";

const IOT_ENDPOINT = process.env.IOT_ENDPOINT;

// Create client only if configured
const iot =
  IOT_ENDPOINT && IOT_ENDPOINT.trim().length > 0
    ? new IoTDataPlaneClient({ endpoint: `https://${IOT_ENDPOINT}` })
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

  // If no recognized fields
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
  // 1) ownership check
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

  // 2) get existing control, return defaults if missing
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
  // 1) ownership check
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

  // 2) validate + sanitize
  const cleanPatch = sanitizePatch(patch);

  // 3) update DynamoDB (source of truth for desired state)
  const updated = await ControlRepo.upsertControl(deviceId, cleanPatch);

  // 4) publish MQTT command to device
  const pub = await publishCommand(deviceId, cleanPatch, { requestedBy: userId });

  // 5) return updated state (+ cmdId if you want to show “sent”)
  return { ...updated, lastCmdId: pub.cmdId ?? null };
}
