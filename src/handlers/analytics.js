import { getAnalytics } from "../controllers/analytics.controller.js";

app.get('/devices/:deviceId/analytics/7d', requirePremium, analyticsController.get7d);
app.get('/devices/:deviceId/analytics/today', requirePremium, analyticsController.getToday);

export const handler = async (event) => {
  try {
    const deviceId = event.pathParameters.deviceId;

    const path = event.rawPath;

    let range = "7d";
    if (path.includes("today")) {
      range = "today";
    }

    return await getAnalytics(deviceId, range);

  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Analytics error" })
    };
  }
};