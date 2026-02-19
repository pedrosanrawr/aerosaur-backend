import * as DevicesRepo from "../repos/devices.repo.js";
import { publishFactoryReset } from "../lib/iot.js";

function forbidden(msg = "Forbidden") {
  const err = new Error(msg);
  err.statusCode = 403;
  throw err;
}

function badRequest(msg = "Bad request") {
  const err = new Error(msg);
  err.statusCode = 400;
  throw err;
}

function notFound(msg = "Not found") {
  const err = new Error(msg);
  err.statusCode = 404;
  throw err;
}

export async function listMyDevices(userId) {
  return DevicesRepo.listByOwner(userId);
}

export async function getMyDevice(userId, deviceId) {
  if (!deviceId || typeof deviceId !== "string") badRequest("deviceId required");

  const device = await DevicesRepo.getById(deviceId);
  if (!device) return null;
  if (device.ownerUserId !== userId) forbidden("Device not owned by user");
  return device;
}

export async function registerDevice(userId, { deviceId, name }) {
  if (!deviceId || typeof deviceId !== "string") badRequest("deviceId required");

  const existing = await DevicesRepo.getById(deviceId);

  if (!existing) {
    notFound("Invalid device code / device not provisioned");
  }

  if (existing.ownerUserId && existing.ownerUserId !== userId) {
    forbidden("Device already registered to another user");
  }

  return DevicesRepo.bindOwnerAndMaybeRename(deviceId, userId, name);
}

export async function renameMyDevice(userId, deviceId, newName) {
  if (!deviceId || typeof deviceId !== "string") badRequest("deviceId required");
  if (!newName || typeof newName !== "string" || !newName.trim())
    badRequest("name required");

  const device = await DevicesRepo.getById(deviceId);
  if (!device) return null;
  if (device.ownerUserId !== userId) forbidden("Device not owned by user");

  return DevicesRepo.updateName(deviceId, newName.trim());
}

export async function unregisterMyDevice(userId, deviceId) {
  if (!deviceId || typeof deviceId !== "string") badRequest("deviceId required");

  const device = await DevicesRepo.getById(deviceId);
  if (!device) return null;
  if (device.ownerUserId !== userId) forbidden("Device not owned by user");

  const updated = await DevicesRepo.unbindOwner(deviceId, userId);

  try {
    await publishFactoryReset(deviceId);
  } catch (e) {
    console.log("Factory reset publish failed:", {
      deviceId,
      err: e?.message || String(e),
    });
  }

  return updated;
}


