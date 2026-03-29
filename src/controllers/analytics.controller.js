import * as service from "../services/analytics.service.js";

export async function getAnalytics(deviceId, range, userId) {
  const data = await service.getAnalytics({ deviceId, range, userId });

  return {
    statusCode: 200,
    body: JSON.stringify(data)
  };
}
