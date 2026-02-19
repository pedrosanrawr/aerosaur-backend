import { withAuth } from "../middleware/auth.middleware.js";
import * as ReadingsController from "../controllers/readings.controller.js";

export const handler = withAuth(async (event, ctx) => {
  switch (event.routeKey) {
    case "GET /devices/{deviceId}/readings/latest":
      return ReadingsController.getLatest(event, ctx);

    case "GET /devices/{deviceId}/readings":
      return ReadingsController.query(event, ctx);

    case "POST /devices/{deviceId}/readings":
      return ReadingsController.ingest(event);

    default:
      return {
        statusCode: 404,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: "Not found" }),
      };
  }
});
