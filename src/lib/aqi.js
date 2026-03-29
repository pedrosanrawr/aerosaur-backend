function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

const PM25_BREAKPOINTS = [
  { cLo: 0.0, cHi: 12.0, iLo: 0, iHi: 50 },
  { cLo: 12.1, cHi: 35.4, iLo: 51, iHi: 100 },
  { cLo: 35.5, cHi: 55.4, iLo: 101, iHi: 150 },
  { cLo: 55.5, cHi: 150.4, iLo: 151, iHi: 200 },
  { cLo: 150.5, cHi: 250.4, iLo: 201, iHi: 300 },
  { cLo: 250.5, cHi: 350.4, iLo: 301, iHi: 400 },
  { cLo: 350.5, cHi: 500.4, iLo: 401, iHi: 500 },
];

const PM10_BREAKPOINTS = [
  { cLo: 0, cHi: 54, iLo: 0, iHi: 50 },
  { cLo: 55, cHi: 154, iLo: 51, iHi: 100 },
  { cLo: 155, cHi: 254, iLo: 101, iHi: 150 },
  { cLo: 255, cHi: 354, iLo: 151, iHi: 200 },
  { cLo: 355, cHi: 424, iLo: 201, iHi: 300 },
  { cLo: 425, cHi: 504, iLo: 301, iHi: 400 },
  { cLo: 505, cHi: 604, iLo: 401, iHi: 500 },
];

function calcAQIFromBreakpoints(C, table) {
  if (C == null || Number.isNaN(C)) return null;

  const max = table[table.length - 1];
  if (C > max.cHi) C = max.cHi;

  const bp = table.find((b) => C >= b.cLo && C <= b.cHi);
  if (!bp) return null;

  const { cLo, cHi, iLo, iHi } = bp;
  const I = ((iHi - iLo) / (cHi - cLo)) * (C - cLo) + iLo;
  return Math.round(I);
}

function truncatePM25(x) {
  return Math.floor(x * 10) / 10;
}

function truncatePM10(x) {
  return Math.floor(x);
}

export function aqiCategory(aqi) {
  if (aqi <= 50) return "Good";
  if (aqi <= 100) return "Moderate";
  if (aqi <= 200) return "Unhealthy";
  return "Dangerous";
}

export function aqiPercent(aqi) {
  return Math.round(clamp(100 - (aqi / 200) * 100, 0, 100));
}

export function computeAQI({ pm25, pm10 }) {
  const pm25C = pm25 == null ? null : truncatePM25(Number(pm25));
  const pm10C = pm10 == null ? null : truncatePM10(Number(pm10));

  const aqiPm25 =
    pm25C == null ? null : calcAQIFromBreakpoints(pm25C, PM25_BREAKPOINTS);
  const aqiPm10 =
    pm10C == null ? null : calcAQIFromBreakpoints(pm10C, PM10_BREAKPOINTS);

  const candidates = [
    { name: "pm25", value: aqiPm25 },
    { name: "pm10", value: aqiPm10 },
  ].filter((x) => x.value != null);

  if (candidates.length === 0) {
    return { aqi: 0, primary: null, aqiPm25: null, aqiPm10: null };
  }

  const maxOne = candidates.reduce((best, cur) =>
    cur.value > best.value ? cur : best
  );

  return {
    aqi: maxOne.value,
    primary: maxOne.name,
    aqiPm25,
    aqiPm10,
  };
}
