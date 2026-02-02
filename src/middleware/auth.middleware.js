import { unauthorized, json } from "../lib/response.js";
import { verifyBearerAuthHeader } from "../lib/firebaseAdmin.js";
import { parseJsonBody } from "../lib/parse.js";

export function withAuth(next) {
  return async (event, ctx = {}) => {
    try {
      if ((event?.requestContext?.http?.method || event?.httpMethod || "") === "OPTIONS") {
        return json(200, { ok: true });
      }

      const authHeader = event?.headers?.authorization || event?.headers?.Authorization || "";
      const decoded = await verifyBearerAuthHeader(authHeader);

      ctx.userId = decoded.uid;
      ctx.decoded = decoded;

      const body = parseJsonBody(event);
      if (body === null) return json(400, { message: "Invalid JSON body" });
      ctx.body = body;

      return await next(event, ctx);
    } catch (e) {
      return unauthorized(e?.message || "Unauthorized");
    }
  };
}
