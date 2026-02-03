import { withAuth } from "../middleware/auth.middleware.js";
import { json } from "../lib/response.js";
import * as UsersController from "../controllers/users.controller.js";

export const handler = withAuth(async (event, ctx) => {
  switch (event.routeKey) {
    case "GET /users/me":
      return UsersController.getMe(event, ctx);

    case "POST /users/profile":
      return UsersController.upsertProfile(event, ctx);

    default:
      return json(404, { message: "Route not found", routeKey: event.routeKey });
  }
});