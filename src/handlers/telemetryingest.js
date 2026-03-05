import * as ReadingsService from "../services/readings.service.js";
import { json } from "../lib/response.js";

export const handler = async (event) => {
  try {
    const deviceId = event.deviceId;

    let payload = event.payload ?? event;

    if (typeof payload === "string") {
      payload = JSON.parse(payload);
    }

    if (!deviceId) {
      console.log("Telemetry ingest missing deviceId:", JSON.stringify(event));
      return json(400, { message: "Missing deviceId" });
    }

    console.log("Telemetry ingest hit:", { deviceId, payload });

    const result = await ReadingsService.ingest({ deviceId, payload });

    console.log("Telemetry ingest ok:", { deviceId, status: result.status });

    return json(result.status, result.body);
  } catch (e) {
    console.error("Telemetry ingest failed:", e);
    return json(500, { message: "Telemetry ingest failed", error: e?.message });
  }
};