import { ok } from "../lib/response.js";
import * as service from './notification.service.js';

export const getNotifications = async (req, res, next) => {
  try {
    const userId = req.user?.id || "peter_dones_01";
    const data = await service.getFullNotificationData(userId);
    
    return ok(res, {
      status: "ok",
      service: "aerosaur-backend",
      data
    });
  } catch (error) {
    next(error);
  }
};

export const updateSettings = async (req, res, next) => {
  try {
    const userId = req.user?.id || "peter_dones_01";
    const updated = await service.updatePreferences(userId, req.body);
    return ok(res, { message: "Settings updated", settings: updated });
  } catch (error) {
    next(error);
  }
};

export const handleHistoryAction = async (req, res, next) => {
  try {
    const { action } = req.params; // 'read_all' or 'clear_all'
    const userId = req.user?.id || "peter_dones_01";
    await service.performHistoryAction(userId, action);
    return ok(res, { message: `Action ${action} successful` });
  } catch (error) {
    next(error);
  }
};