import * as ControlService from "../services/control.service.js";

function json(statusCode, data) {
  return {
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(data),
  };
}

export async function getControl(event) {
  const userId = event.auth?.userId; 
  const deviceId = event.pathParameters?.deviceId;

  if (!deviceId) return json(400, { message: "deviceId is required" });

  const control = await ControlService.getControl({ userId, deviceId });
  return json(200, control);
}

export async function updateControl(event) {
  const userId = event.auth?.userId;
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
}
