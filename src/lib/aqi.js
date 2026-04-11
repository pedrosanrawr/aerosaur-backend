function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

export function normalizeAqi(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(clamp(n, 0, 500));
}

export function aqiCategory(aqi) {
  aqi = normalizeAqi(aqi);
  if (aqi <= 50) return "Good";
  if (aqi <= 100) return "Moderate";
  if (aqi <= 200) return "Unhealthy";
  return "Dangerous";
}

export function aqiPercent(aqi) {
  aqi = normalizeAqi(aqi);
  return Math.round(clamp(100 - (aqi / 200) * 100, 0, 100));
}
