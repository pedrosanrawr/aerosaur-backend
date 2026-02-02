function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

export const USERS_TABLE = required("USERS_TABLE");
export const DEVICES_TABLE = required("DEVICES_TABLE");
export const READINGS_TABLE = required("READINGS_TABLE");
export const CONTROL_TABLE = required("CONTROL_TABLE");
export const NOTIFICATIONS_TABLE = required("NOTIFICATIONS_TABLE");
