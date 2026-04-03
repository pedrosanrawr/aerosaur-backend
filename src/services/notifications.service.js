import crypto from "crypto";
import admin from "firebase-admin";
import * as NotificationsRepo from "../repos/notifications.repo.js";
import { ensureFirebaseAdmin } from "../lib/auth_firebase.js";

export const DEFAULT_SETTINGS = {
  enabled: true,
  alerts: true,
  monitoring: true,
  device: true,
  system: true,
  energy: true,
  smartMode: true,
  pushEnabled: true,
};

const NOTIFICATION_COOLDOWNS_MS = {
  harmful_gas_detected: 15 * 60 * 1000,
  aqi_unhealthy: 45 * 60 * 1000,
  aqi_dangerous: 45 * 60 * 1000,
  device_online: 20 * 60 * 1000,
  device_offline: 20 * 60 * 1000,
  smart_mode_adjustment: 10 * 60 * 1000,
  high_daily_usage: 12 * 60 * 60 * 1000,
};

const CATEGORY_TO_SETTING = {
  monitoring: "monitoring",
  device: "device",
  system: "system",
  energy: "energy",
  smart_mode: "smartMode",
};

function getCooldownMs(type) {
  return NOTIFICATION_COOLDOWNS_MS[type] ?? 0;
}

function isTypeLevelDedup(type) {
  return (
    type === "harmful_gas_detected" ||
    type === "aqi_unhealthy" ||
    type === "aqi_dangerous" ||
    type === "device_online" ||
    type === "device_offline" ||
    type === "high_daily_usage"
  );
}

function normalizeSettings(input = {}) {
  return {
    ...DEFAULT_SETTINGS,
    ...Object.fromEntries(
      Object.entries(input).filter(([, value]) => typeof value === "boolean")
    ),
  };
}

function normalizeNotification(item) {
  if (!item) return null;

  return {
    id: item.id ?? item.CreatedAt,
    notificationId: item.CreatedAt,
    createdAt: item.createdAt,
    category: item.category,
    type: item.type,
    severity: item.severity,
    title: item.title,
    body: item.body,
    isRead: !!item.isRead,
    readAt: item.readAt ?? null,
    deviceId: item.deviceId ?? null,
    deviceName: item.deviceName ?? null,
    data: item.data ?? {},
    pushedAt: item.pushedAt ?? null,
  };
}

async function getEffectiveSettings(userId) {
  const item = await NotificationsRepo.getSettings(userId);
  return normalizeSettings(item?.settings);
}

async function shouldCreateNotification({
  userId,
  type,
  deviceId = null,
  title,
  body,
  data = {},
}) {
  const cooldownMs = getCooldownMs(type);
  if (!cooldownMs) return true;

  const recentItems = await NotificationsRepo.getHistory(userId, 30);
  const nowMs = Date.now();

  const duplicate = recentItems.find((item) => {
    if (item.type !== type) return false;
    if ((item.deviceId ?? null) !== (deviceId ?? null)) return false;

    const createdAtMs = Date.parse(item.createdAt ?? "");
    if (!Number.isFinite(createdAtMs)) return false;
    if (nowMs - createdAtMs > cooldownMs) return false;

    if (type === "smart_mode_adjustment") {
      return JSON.stringify(item.data?.patch ?? {}) === JSON.stringify(data.patch ?? {});
    }

    if (type === "high_daily_usage") {
      return true;
    }

    if (isTypeLevelDedup(type)) {
      return true;
    }

    return item.title === title && item.body === body;
  });

  return !duplicate;
}

function shouldSendPush(settings, { category, severity }) {
  if (!settings.enabled || !settings.pushEnabled) return false;

  const categorySetting = CATEGORY_TO_SETTING[category];
  if (categorySetting && settings[categorySetting] === false) return false;

  if ((severity === "warning" || severity === "critical") && settings.alerts === false) {
    return false;
  }

  return true;
}

async function dispatchPushNotification(userId, notification) {
  const tokens = await NotificationsRepo.listPushTokens(userId);
  if (!tokens.length) {
    return { sent: false, reason: "no_tokens" };
  }

  ensureFirebaseAdmin();

  const registrationTokens = tokens.map((item) => item.token).filter(Boolean);
  if (!registrationTokens.length) {
    return { sent: false, reason: "no_valid_tokens" };
  }

  const response = await admin.messaging().sendEachForMulticast({
    tokens: registrationTokens,
    notification: {
      title: notification.title,
      body: notification.body,
    },
    data: {
      notificationId: notification.CreatedAt,
      category: notification.category,
      type: notification.type,
      severity: notification.severity,
      deviceId: notification.deviceId ?? "",
    },
    android: {
      priority: "high",
      notification: {
        channelId: "aerosaur-alerts",
        sound: "default",
      },
    },
  });

  const staleTokens = [];

  response.responses.forEach((result, index) => {
    const errorCode = result.error?.code;
    if (
      errorCode === "messaging/registration-token-not-registered" ||
      errorCode === "messaging/invalid-registration-token"
    ) {
      staleTokens.push(registrationTokens[index]);
    }
  });

  if (staleTokens.length) {
    await Promise.all(staleTokens.map((token) => NotificationsRepo.deletePushToken(userId, token)));
  }

  return {
    sent: response.successCount > 0,
    successCount: response.successCount,
    failureCount: response.failureCount,
  };
}

function buildNotification({
  category,
  type,
  severity = "info",
  title,
  body,
  deviceId = null,
  deviceName = null,
  data = {},
}) {
  if (!category || !type || !title || !body) {
    throw new Error("category, type, title, and body are required");
  }

  const createdAt = new Date().toISOString();
  const id = crypto.randomUUID();

  return {
    id,
    CreatedAt: NotificationsRepo.makeNotificationKey(createdAt, id),
    createdAt,
    entityType: "notification",
    category,
    type,
    severity,
    title,
    body,
    isRead: false,
    readAt: null,
    deviceId,
    deviceName,
    data,
  };
}

export async function getFullNotificationData(userId, { limit = 50 } = {}) {
  const [settings, history] = await Promise.all([
    getEffectiveSettings(userId),
    NotificationsRepo.getHistory(userId, limit),
  ]);

  const items = history.map(normalizeNotification);
  const unreadCount = items.filter((item) => !item.isRead).length;

  return {
    settings,
    items,
    unreadCount,
  };
}

export async function updatePreferences(userId, settingsPatch) {
  const current = await getEffectiveSettings(userId);
  const settings = normalizeSettings({ ...current, ...settingsPatch });
  await NotificationsRepo.putSettings(userId, settings);
  return settings;
}

export async function markNotificationRead(userId, notificationId) {
  const item = await NotificationsRepo.markAsRead(userId, notificationId);
  return normalizeNotification(item);
}

export async function markAllAsRead(userId) {
  return NotificationsRepo.markAllAsRead(userId);
}

export async function clearHistory(userId) {
  return NotificationsRepo.clearHistory(userId);
}

export async function registerPushToken(userId, tokenData) {
  if (!tokenData?.token || typeof tokenData.token !== "string") {
    throw new Error("token is required");
  }

  const saved = await NotificationsRepo.putPushToken(userId, {
    token: tokenData.token,
    platform: tokenData.platform ?? "android",
    deviceId: tokenData.deviceId ?? null,
    appVersion: tokenData.appVersion ?? null,
  });

  return {
    platform: saved.platform,
    deviceId: saved.deviceId,
    appVersion: saved.appVersion,
    updatedAt: saved.updatedAt,
  };
}

export async function unregisterPushToken(userId, token) {
  if (!token || typeof token !== "string") {
    throw new Error("token is required");
  }

  return NotificationsRepo.deletePushToken(userId, token);
}

export async function createNotification({
  userId,
  category,
  type,
  severity = "info",
  title,
  body,
  deviceId = null,
  deviceName = null,
  data = {},
  sendPush = true,
}) {
  if (!userId) {
    throw new Error("userId is required");
  }

  const allowed = await shouldCreateNotification({
    userId,
    type,
    deviceId,
    title,
    body,
    data,
  });

  if (!allowed) {
    return {
      skipped: true,
      reason: "cooldown_active",
      type,
      deviceId,
    };
  }

  const settings = await getEffectiveSettings(userId);
  const notification = buildNotification({
    category,
    type,
    severity,
    title,
    body,
    deviceId,
    deviceName,
    data,
  });

  const item = {
    UserId: userId,
    ...notification,
  };

  let pushResult = { sent: false, reason: "disabled" };

  if (sendPush && shouldSendPush(settings, { category, severity })) {
    try {
      pushResult = await dispatchPushNotification(userId, item);
      if (pushResult.sent) {
        item.pushedAt = new Date().toISOString();
      }
    } catch (error) {
      console.warn("Push notification failed:", error?.message || error);
      pushResult = { sent: false, reason: "push_failed" };
    }
  }

  await NotificationsRepo.putNotification(item);

  return {
    ...normalizeNotification(item),
    push: pushResult,
  };
}

export async function emitTelemetryNotifications({
  device,
  previousReading,
  latestReading,
  previousOnline = null,
}) {
  if (!device?.ownerUserId) return [];

  const created = [];
  const deviceName = device.name ?? device.DeviceId;

  if (previousOnline === false) {
    created.push(
      await createNotification({
        userId: device.ownerUserId,
        category: "device",
        type: "device_online",
        title: "Device Connected",
        body: `${deviceName} is back online`,
        deviceId: device.DeviceId,
        deviceName,
      })
    );
  }

  if (latestReading?.harmfulGasDetected && !previousReading?.harmfulGasDetected) {
    created.push(
      await createNotification({
        userId: device.ownerUserId,
        category: "monitoring",
        type: "harmful_gas_detected",
        severity: "critical",
        title: "Device Alert",
        body: `${deviceName} detected harmful gas levels`,
        deviceId: device.DeviceId,
        deviceName,
        data: {
          harmfulGasDetected: true,
        },
      })
    );
  }

  const previousAqi = Number(previousReading?.aqi ?? 0);
  const currentAqi = Number(latestReading?.aqi ?? 0);
  const crossedUnhealthy = previousAqi < 101 && currentAqi >= 101;
  const crossedDangerous = previousAqi < 151 && currentAqi >= 151;

  if (crossedDangerous || crossedUnhealthy) {
    created.push(
      await createNotification({
        userId: device.ownerUserId,
        category: "monitoring",
        type: crossedDangerous ? "aqi_dangerous" : "aqi_unhealthy",
        severity: crossedDangerous ? "critical" : "warning",
        title: "Air Quality Alert",
        body: `${deviceName} AQI is ${currentAqi} (${latestReading?.aqiCategory ?? "Unknown"})`,
        deviceId: device.DeviceId,
        deviceName,
        data: {
          aqi: currentAqi,
          aqiCategory: latestReading?.aqiCategory ?? null,
        },
      })
    );
  }

  return created;
}

export async function emitSmartModeNotification({ device, patch, aqi }) {
  if (!device?.ownerUserId || !patch || !Object.keys(patch).length) return null;

  const fragments = [];
  if (patch.fanSpeed !== undefined) fragments.push(`fan set to ${patch.fanSpeed}`);
  if (patch.power !== undefined) fragments.push(`power ${patch.power ? "on" : "off"}`);

  if (!fragments.length) return null;

  return createNotification({
    userId: device.ownerUserId,
    category: "smart_mode",
    type: "smart_mode_adjustment",
    title: "Smart Mode Changes",
    body: `${device.name ?? device.DeviceId} adjusted automatically: ${fragments.join(", ")}`,
    deviceId: device.DeviceId,
    deviceName: device.name ?? device.DeviceId,
    data: { aqi, patch },
  });
}

export async function emitEnergyNotification({ device, totalOnSeconds }) {
  if (!device?.ownerUserId) return null;

  return createNotification({
    userId: device.ownerUserId,
    category: "energy",
    type: "high_daily_usage",
    severity: "warning",
    title: "Energy Report",
    body: `${device.name ?? device.DeviceId} has been running for ${Math.round(totalOnSeconds / 3600)} hours today`,
    deviceId: device.DeviceId,
    deviceName: device.name ?? device.DeviceId,
    data: { totalOnSeconds },
  });
}

export async function emitDeviceConnectivityNotification({ device, online }) {
  if (!device?.ownerUserId) return null;

  return createNotification({
    userId: device.ownerUserId,
    category: "device",
    type: online ? "device_online" : "device_offline",
    severity: online ? "info" : "warning",
    title: online ? "Device Connected" : "Device Offline",
    body: online
      ? `${device.name ?? device.DeviceId} is online`
      : `${device.name ?? device.DeviceId} is offline`,
    deviceId: device.DeviceId,
    deviceName: device.name ?? device.DeviceId,
    data: { online: !!online },
  });
}
