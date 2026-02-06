import express from 'express';
import { ok } from "../lib/response.js";
import * as controller from "./notification.controller.js";

const router = express.Router();

export const handler = async (req, res, next) => {
  try {
    const { method, path } = req;
    let result;

    
    if (method === 'GET' && path === '/') {
      result = await controller.fetchAll(req);
    } 
    else if (method === 'PATCH' && path === '/settings') {
      result = await controller.patchSettings(req);
    }

  
    return ok(res, {
      status: "ok",
      service: "aerosaur-notification-service",
      timestamp: new Date().toISOString(),
      data: result
    });

  } catch (error) {
    next(error); 
  }
};

router.get('/', handler);
router.patch('/settings', handler);

export default router;