import * as ReadingsService from "../services/readings.service.js";
import { json } from "../lib/response.js";

export const handler = async (event) => {
  try {
    const deviceId = event.deviceId;
    const payload = event.payload ?? event;

    if (!deviceId) {
      console.log("Telemetry ingest missing deviceId:", JSON.stringify(event));
      return json(400, { message: "Missing deviceId" });
    }

    console.log("Telemetry ingest hit:", { deviceId });

    const result = await ReadingsService.ingest({ deviceId, payload });

    console.log("Telemetry ingest ok:", { deviceId, status: result.status });
    return json(result.status, result.body);
  } catch (e) {
    console.error("Telemetry ingest failed:", e);
    return json(500, { message: "Telemetry ingest failed", error: e?.message });
  }
};
