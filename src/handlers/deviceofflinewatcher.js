import * as DevicesService from "../services/devices.service.js";

export const handler = async () => {
  const result = await DevicesService.sweepOfflineDevices();
  console.log("Device offline sweep complete:", result);
  return result;
};
