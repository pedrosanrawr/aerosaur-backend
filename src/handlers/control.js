import { ok } from "../lib/response.js";

export const handler = async () => {
  return ok({
    status: "ok",
    service: "aerosaur-backend",
    timestamp: new Date().toISOString(),
  });
};