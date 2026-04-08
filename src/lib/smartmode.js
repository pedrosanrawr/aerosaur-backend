export const SMART_MODE_POWER_OFF_AQI = 20;

export const trees = [
  (aqi) => (aqi <= 50 ? "SLOW" : aqi <= 100 ? "MODERATE" : "FAST"),
  (aqi) => (aqi <= 45 ? "SLOW" : aqi <= 90 ? "MODERATE" : "FAST"),
  (aqi) => (aqi <= 55 ? "SLOW" : aqi <= 110 ? "MODERATE" : "FAST"),
];

export function predictFanSpeed(aqi) {
  const votes = trees.map((tree) => tree(aqi));

  const counts = {};
  for (const vote of votes) counts[vote] = (counts[vote] || 0) + 1;

  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

export function buildSmartModePatch({
  aqi,
  control = {},
  forcePowerOn = false,
}) {
  const patch = {};

  if (control.autoAdjust && control.power !== false) {
    patch.fanSpeed = predictFanSpeed(aqi);
  }

  if (forcePowerOn && control.power === false) {
    patch.power = true;
  } else if (control.autoOff) {
    patch.power = aqi > SMART_MODE_POWER_OFF_AQI;
  }

  return patch;
}
