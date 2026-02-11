import * as ReadingsService from '../services/readings.service.js';
import { ok } from '../lib/response.js';

export const getReadings = async (req, res, next) => {
    try {
        const { deviceId } = req.params;
        const { limit, lastEvaluatedKey } = req.query;

        if (!deviceId) {
            return res.status(400).json({ message: "Device ID is required" });
        }
        const options = {};
        if (limit) options.limit = parseInt(limit, 10);
        if (lastEvaluatedKey) options.lastEvaluatedKey = lastEvaluatedKey;
        const readings = await ReadingsService.getReadings(deviceId, options);
        return ok(res, { readings });
    }
    catch (error) {
        next(error);

    }
};