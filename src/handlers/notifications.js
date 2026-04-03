import { withAuth } from "../middleware/auth.middleware.js";
import { json } from "../lib/response.js";
import * as NotificationsController from "../controllers/notifications.controller.js";

export const handler = withAuth(async (event, ctx) => {
  switch (event.routeKey) {
    case "GET /notifications":
      return NotificationsController.listNotifications(event, ctx);

    case "PATCH /notifications/settings":
      return NotificationsController.updateSettings(event, ctx);

    case "POST /notifications/tokens":
      return NotificationsController.registerPushToken(event, ctx);

    case "DELETE /notifications/tokens":
      return NotificationsController.unregisterPushToken(event, ctx);

    case "POST /notifications":
      return NotificationsController.createNotification(event, ctx);

    case "POST /notifications/mark-all-read":
      return NotificationsController.markAllAsRead(event, ctx);

    case "POST /notifications/{notificationId}/read":
      return NotificationsController.markAsRead(event, ctx);

    case "DELETE /notifications/clear-all":
      return NotificationsController.clearAll(event, ctx);

    default:
      return json(404, { message: "Route not found", routeKey: event.routeKey });
  }
});
