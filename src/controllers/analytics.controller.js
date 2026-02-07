import * as service from './analytics.service.js';

export const getAnalytics = async (req, res) => {
  try {
    const { deviceId } = req.params;
    if (!deviceId) return res.status(400).json({ message: "Device ID required" });

    const data = await service.getDashboardData(deviceId);
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};