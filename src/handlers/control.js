import { withAuth } from "../middleware/auth.middleware.js";
import * as ControlController from "../controllers/control.controller.js";

export const handler = withAuth(async (event, ctx) => {
  switch (event.routeKey) {
    case "GET /devices/{deviceId}/control":
      return ControlController.getControl(event, ctx);

    case "PUT /devices/{deviceId}/control":
      return ControlController.updateControl(event, ctx);

    default:
      return {
        statusCode: 404,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: "Not Found" }),
      };
  }
});