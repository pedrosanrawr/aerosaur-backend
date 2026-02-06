import { unauthorized, json } from "../lib/response.js";
import { verifyBearerAuthHeader } from "../lib/auth_firebase.js";
import { parseJsonBody } from "../lib/parse.js";

export function withAuth(next) {
  return async (event, ctx = {}) => {
    try {
      const method =
        event?.requestContext?.http?.method || event?.httpMethod || "";
      if (method === "OPTIONS") {
        return json(200, { ok: true });
      }

      const authHeader =
        event?.headers?.authorization || event?.headers?.Authorization || "";
      const decoded = await verifyBearerAuthHeader(authHeader);

      ctx.userId = decoded.uid;
      ctx.decoded = decoded;
      event.userId = decoded.uid;
      event.user = { uid: decoded.uid, ...decoded };

      const hasBody =
        event?.body != null && String(event.body).trim().length > 0;

      if (hasBody) {
        const body = parseJsonBody(event);
        if (body === null) return json(400, { message: "Invalid JSON body" });
        ctx.body = body;
      } else {
        ctx.body = null;
      }

      return await next(event, ctx);
    } catch (e) {
      return unauthorized(e?.message || "Unauthorized");
    }
  };
}
