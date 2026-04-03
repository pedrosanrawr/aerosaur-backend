import * as DevicesRepo from "../repos/devices.repo.js";
import * as NotificationsService from "./notifications.service.js";
import { publishFactoryReset } from "../lib/iot.js";
import QRCode from "qrcode";

const DEFAULT_DEVICE_ONLINE_TIMEOUT_MS = 2 * 60 * 1000;

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

function getDeviceOnlineTimeoutMs() {
  const raw = Number(process.env.DEVICE_ONLINE_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_DEVICE_ONLINE_TIMEOUT_MS;
}

function getOfflineSweepBatchSize() {
  const raw = Number(process.env.DEVICE_OFFLINE_SWEEP_BATCH_SIZE);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 100;
}

function isHeartbeatFresh(lastSeen) {
  const lastSeenMs = Date.parse(lastSeen ?? "");
  return Number.isFinite(lastSeenMs) && Date.now() - lastSeenMs <= getDeviceOnlineTimeoutMs();
}

export function withEffectiveConnectionStatus(device) {
  if (!device) return device;

  return {
    ...device,
    online: !!device.online && isHeartbeatFresh(device.lastSeen),
  };
}

async function maybeMarkDeviceOffline(device) {
  if (!device?.ownerUserId) return withEffectiveConnectionStatus(device);
  if (!device.online) return withEffectiveConnectionStatus(device);
  if (isHeartbeatFresh(device.lastSeen)) return withEffectiveConnectionStatus(device);

  const updated = await DevicesRepo.markOfflineIfOnline(device.DeviceId);

  if (updated) {
    try {
      await NotificationsService.emitDeviceConnectivityNotification({
        device: updated,
        online: false,
      });
    } catch (err) {
      console.warn("Automatic offline notification failed:", err.message);
    }

    return withEffectiveConnectionStatus(updated);
  }

  return withEffectiveConnectionStatus({
    ...device,
    online: false,
  });
}

export async function sweepOfflineDevices() {
  let cursor = null;
  let scanned = 0;
  let markedOffline = 0;
  let notificationsSent = 0;
  const batchSize = getOfflineSweepBatchSize();

  do {
    const page = await DevicesRepo.listOnlineDevices({ limit: batchSize, cursor });
    cursor = page.cursor;

    for (const device of page.items) {
      scanned += 1;

      const beforeOnline = !!device.online;
      const updated = await maybeMarkDeviceOffline(device);

      if (beforeOnline && !updated.online) {
        markedOffline += 1;
        notificationsSent += 1;
      }
    }
  } while (cursor);

  return {
    scanned,
    markedOffline,
    notificationsSent,
  };
}

export async function listMyDevices(userId) {
  const devices = await DevicesRepo.listByOwner(userId);
  return Promise.all(devices.map(maybeMarkDeviceOffline));
}

export async function getMyDevice(userId, deviceId) {
  if (!deviceId || typeof deviceId !== "string") badRequest("deviceId required");

  const device = await DevicesRepo.getById(deviceId);
  if (!device) return null;
  if (device.ownerUserId !== userId) forbidden("Device not owned by user");
  return maybeMarkDeviceOffline(device);
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

  const device = await DevicesRepo.bindOwnerAndMaybeRename(deviceId, userId, name);
  const qrCode = await QRCode.toDataURL(deviceId);
  return { ...withEffectiveConnectionStatus(device), qrCode };
}

export async function renameMyDevice(userId, deviceId, newName) {
  if (!deviceId || typeof deviceId !== "string") badRequest("deviceId required");
  if (!newName || typeof newName !== "string" || !newName.trim())
    badRequest("name required");

  const device = await DevicesRepo.getById(deviceId);
  if (!device) return null;
  if (device.ownerUserId !== userId) forbidden("Device not owned by user");

  const updated = await DevicesRepo.updateName(deviceId, newName.trim());
  return withEffectiveConnectionStatus(updated);
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

  return withEffectiveConnectionStatus(updated);
}
