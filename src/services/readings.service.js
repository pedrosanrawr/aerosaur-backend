import * as readingsRepository from '../repositories/readings.repository.js';

export async function getReadings(deviceId, options = {}) {
  return await readingsRepository.getReadings(deviceId, options);
}   