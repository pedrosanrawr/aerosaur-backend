import { json } from "../lib/response.js";
import { parseJson } from "../lib/parse.js";
import * as DevicesService from "../services/devices.service.js";

function requireUserId(event) {
  const userId =
    event.user?.uid ||
    event.userId ||
    event.requestContext?.authorizer?.jwt?.claims?.sub ||
    event.requestContext?.authorizer?.principalId;

  if (!userId || typeof userId !== "string" || !userId.trim()) {
    const err = new Error("Unauthorized");
    err.statusCode = 401;
    throw err;
  }

  return userId;
}

function normalizeDevice(d) {
  if (!d) return d;
  const { DeviceId, ...rest } = d;
  return { ...rest, deviceId: DeviceId };
}

export async function listDevices(event) {
  const userId = requireUserId(event);

  const items = await DevicesService.listMyDevices(userId);

  return json(200, {
    items: items.map(normalizeDevice),
  });
}

export async function registerDevice(event) {
  const userId = requireUserId(event);
  const body = parseJson(event) ?? {};

  const device = await DevicesService.registerDevice(userId, {
    deviceId: body.deviceId,
    name: body.name,
  });

  return json(200, {
    device: normalizeDevice(device),
  });
}

export async function getDevice(event) {
  const userId = requireUserId(event);
  const deviceId = event.pathParameters?.deviceId;

  const device = await DevicesService.getMyDevice(userId, deviceId);
  if (!device) {
    return json(404, { message: "Device not found" });
  }

  return json(200, {
    device: normalizeDevice(device),
  });
}

export async function renameDevice(event) {
  const userId = requireUserId(event);
  const deviceId = event.pathParameters?.deviceId;
  const body = parseJson(event) ?? {};

  const updated = await DevicesService.renameMyDevice(
    userId,
    deviceId,
    body.name
  );

  if (!updated) {
    return json(404, { message: "Device not found" });
  }

  return json(200, {
    device: normalizeDevice(updated),
  });
}
