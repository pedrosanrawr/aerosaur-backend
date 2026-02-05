import * as DevicesRepo from "../repos/devices.repo.js";

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

export async function listMyDevices(userId) {
  return DevicesRepo.listByOwner(userId);
}

export async function getMyDevice(userId, deviceId) {
  const device = await DevicesRepo.getById(deviceId);
  if (!device) return null;
  if (device.ownerUserId !== userId) forbidden("Device not owned by user");
  return device;
}

export async function registerDevice(userId, { deviceId, name }) {
  if (!deviceId || typeof deviceId !== "string") badRequest("deviceId required");

  const existing = await DevicesRepo.getById(deviceId);

  // If device record doesn't exist, create it.
  // (In production, you might require pre-provisioning. For capstone, this is OK.)
  if (!existing) {
    return DevicesRepo.upsertDevice({
      DeviceId: deviceId,
      name: name ?? deviceId,
      ownerUserId: userId,
      createdAt: new Date().toISOString(),
    });
  }

  // If already owned by someone else → block
  if (existing.ownerUserId && existing.ownerUserId !== userId) {
    forbidden("Device already registered to another user");
  }

  // Bind to this user (or re-bind if empty)
  const bound = await DevicesRepo.bindOwner(deviceId, userId);

  // Optional rename during register
  if (name && typeof name === "string" && name.trim()) {
    return DevicesRepo.updateName(deviceId, name.trim());
  }

  return bound;
}

export async function renameMyDevice(userId, deviceId, newName) {
  if (!newName || typeof newName !== "string") badRequest("name required");

  const device = await DevicesRepo.getById(deviceId);
  if (!device) return null;
  if (device.ownerUserId !== userId) forbidden("Device not owned by user");

  return DevicesRepo.updateName(deviceId, newName.trim());
}
