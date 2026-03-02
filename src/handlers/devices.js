import { withAuth } from "../middleware/auth.middleware.js";
import { json } from "../lib/response.js";
import * as DevicesController from "../controllers/devices.controller.js";

export const handler = withAuth(async (event) => {
  switch (event.routeKey) {
    case "GET /devices":
      return DevicesController.listDevices(event);

    case "POST /devices/register":
      return DevicesController.registerDevice(event);

    case "GET /devices/{deviceId}":
      return DevicesController.getDevice(event);

    case "POST /devices/{deviceId}/rename":
      return DevicesController.renameDevice(event);

    case "DELETE /devices/{deviceId}":
      return DevicesController.unregisterDevice(event);

    default:
      return json(404, { message: "Not Found" });
  }
});