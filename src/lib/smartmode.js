export const trees = [
  (aqi) => (aqi <= 50 ? "SLOW" : aqi <= 100 ? "MODERATE" : "FAST"),
  (aqi) => (aqi <= 45 ? "SLOW" : aqi <= 90 ? "MODERATE" : "FAST"),
  (aqi) => (aqi <= 55 ? "SLOW" : aqi <= 110 ? "MODERATE" : "FAST"),
];

export function predictFanSpeed(aqi) {
  const votes = trees.map((tree) => tree(aqi));

  const counts = {};
  for (const v of votes) counts[v] = (counts[v] || 0) + 1;

  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}