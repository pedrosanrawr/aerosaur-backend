import * as ControlService from "../services/control.service.js";

function json(statusCode, data) {
  return {
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(data),
  };
}

function handleError(err) {
  const statusCode = err?.statusCode || 500;
  return json(statusCode, { message: err?.message || "Internal Server Error" });
}

export async function getControl(event) {
  try {
    const userId = event.auth?.userId;
    const deviceId = event.pathParameters?.deviceId;
    if (!deviceId) return json(400, { message: "deviceId is required" });

    const control = await ControlService.getControl({ userId, deviceId });
    return json(200, control);
  } catch (err) {
    return handleError(err);
  }
}

export async function updateControl(event) {
  try {
    const userId = event.userId;
    const deviceId = event.pathParameters?.deviceId;
    if (!deviceId) return json(400, { message: "deviceId is required" });

    let patch = {};
    try {
      patch = JSON.parse(event.body || "{}");
    } catch {
      return json(400, { message: "Invalid JSON body" });
    }

    const updated = await ControlService.updateControl({ userId, deviceId, patch });
    return json(200, updated);
  } catch (err) {
    return handleError(err);
  }
}