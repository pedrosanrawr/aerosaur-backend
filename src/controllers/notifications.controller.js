import { json, notFound } from "../lib/response.js";
import { parseJson } from "../lib/parse.js";
import * as NotificationsService from "../services/notifications.service.js";

function requireUserId(event, ctx) {
  const userId =
    ctx?.userId ||
    event.user?.uid ||
    event.userId ||
    event.requestContext?.authorizer?.jwt?.claims?.sub ||
    event.requestContext?.authorizer?.principalId;

  if (!userId) {
    const err = new Error("Unauthorized");
    err.statusCode = 401;
    throw err;
  }

  return userId;
}

export async function listNotifications(event, ctx) {
  const userId = requireUserId(event, ctx);
  const limit = Number(event.queryStringParameters?.limit ?? 50);
  const data = await NotificationsService.getFullNotificationData(userId, { limit });
  return json(200, data);
}

export async function updateSettings(event, ctx) {
  const userId = requireUserId(event, ctx);
  const body = parseJson(event) ?? {};
  const settings = await NotificationsService.updatePreferences(userId, body);
  return json(200, { settings });
}

export async function registerPushToken(event, ctx) {
  const userId = requireUserId(event, ctx);
  const body = parseJson(event) ?? {};
  const token = await NotificationsService.registerPushToken(userId, body);
  return json(200, { token });
}

export async function unregisterPushToken(event, ctx) {
  const userId = requireUserId(event, ctx);
  const body = parseJson(event) ?? {};
  const result = await NotificationsService.unregisterPushToken(userId, body.token);
  return json(200, result);
}

export async function createNotification(event, ctx) {
  const userId = requireUserId(event, ctx);
  const body = parseJson(event) ?? {};
  const item = await NotificationsService.createNotification({
    userId,
    category: body.category,
    type: body.type,
    severity: body.severity,
    title: body.title,
    body: body.body,
    deviceId: body.deviceId,
    deviceName: body.deviceName,
    data: body.data,
    sendPush: body.sendPush !== false,
  });
  return json(201, { notification: item });
}

export async function markAsRead(event, ctx) {
  const userId = requireUserId(event, ctx);
  const notificationId = event.pathParameters?.notificationId;
  const item = await NotificationsService.markNotificationRead(userId, notificationId);
  if (!item) return notFound("Notification not found");
  return json(200, { notification: item });
}

export async function markAllAsRead(event, ctx) {
  const userId = requireUserId(event, ctx);
  const result = await NotificationsService.markAllAsRead(userId);
  return json(200, result);
}

export async function clearAll(event, ctx) {
  const userId = requireUserId(event, ctx);
  const result = await NotificationsService.clearHistory(userId);
  return json(200, result);
}
