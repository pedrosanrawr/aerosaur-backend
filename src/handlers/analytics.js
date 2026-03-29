import { getAnalytics } from "../controllers/analytics.controller.js";
import { withAuth } from "../middleware/auth.middleware.js";
import { json } from "../lib/response.js";

export const handler = withAuth(async (event, ctx) => {
  try {
    const deviceId = event.pathParameters?.deviceId;

    if (!deviceId) {
      return json(400, { message: "Missing deviceId" });
    }

    const path = event.rawPath || "";

    let range = "7d";
    if (path.includes("today")) {
      range = "today";
    }

    return await getAnalytics(deviceId, range, ctx.userId);

  } catch (error) {
    console.error("Analytics error:", error);

    return json(error?.statusCode || 500, {
      message: error?.message || "Analytics error",
    });
  }
});
