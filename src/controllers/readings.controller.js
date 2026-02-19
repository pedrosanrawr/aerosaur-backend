import { json } from "../lib/response.js";
import * as ReadingsService from "../services/readings.service.js";

export async function getLatest(event, ctx) {
  const deviceId = event.pathParameters?.deviceId;
  const result = await ReadingsService.getLatest({ deviceId, userId: ctx.userId });
  return json(result.status, result.body);
}

export async function query(event, ctx) {
  const deviceId = event.pathParameters?.deviceId;
  const { from, to, limit } = event.queryStringParameters ?? {};
  const result = await ReadingsService.query({ deviceId, userId: ctx.userId, from, to, limit });
  return json(result.status, result.body);
}

export async function ingest(event) {
  const deviceId = event.pathParameters?.deviceId;
  const body = typeof event.body === "string" ? JSON.parse(event.body) : event.body;
  const result = await ReadingsService.ingest({ deviceId, payload: body });
  return json(result.status, result.body);
}
