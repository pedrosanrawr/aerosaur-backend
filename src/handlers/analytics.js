import { getAnalytics } from "../controllers/analytics.controller.js";

export const handler = async (event) => {
  try {
    const deviceId = event.pathParameters?.deviceId;

    if (!deviceId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Missing deviceId" }),
      };
    }

    const path = event.rawPath || "";

    let range = "7d";
    if (path.includes("today")) {
      range = "today";
    }

    return await getAnalytics(deviceId, range);

  } catch (error) {
    console.error("Analytics error:", error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Analytics error"
      }),
    };
  }
};