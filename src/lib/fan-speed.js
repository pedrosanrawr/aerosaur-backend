export const FAN_SPEED_VALUES = Object.freeze({
  OFF: 0,
  SLOW: 88,
  MODERATE: 92,
  FAST: 100,
});

export const ALLOWED_FAN_SPEED = new Set(["SLOW", "MODERATE", "FAST"]);

export function normalizeFanSpeed(value) {
  if (value == null) return null;

  if (typeof value === "string") {
    const normalized = value.trim().toUpperCase();
    if (ALLOWED_FAN_SPEED.has(normalized) || normalized === "OFF") {
      return normalized;
    }
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  if (numeric <= FAN_SPEED_VALUES.OFF) return "OFF";
  if (numeric >= FAN_SPEED_VALUES.FAST) return "FAST";
  if (numeric >= FAN_SPEED_VALUES.MODERATE) return "MODERATE";
  if (numeric >= FAN_SPEED_VALUES.SLOW) return "SLOW";
  return null;
}

export function toFanSpeedValue(value) {
  const normalized = normalizeFanSpeed(value);
  if (!normalized) return null;
  return FAN_SPEED_VALUES[normalized] ?? null;
}
