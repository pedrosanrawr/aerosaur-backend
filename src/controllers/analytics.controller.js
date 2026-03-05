import * as service from "../services/analytics.service.js";

export async function getAnalytics(deviceId, range) {
  const data = await service.getAnalytics(deviceId, range);

  return {
    statusCode: 200,
    body: JSON.stringify(data)
  };
}