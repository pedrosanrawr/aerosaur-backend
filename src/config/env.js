import dotenv from "dotenv";

dotenv.config();

function required(name) {
  const v = process.env[name];
  if (!v) {
    throw new Error(`Missing env ${name}`);
  }
  return v;
}

// DynamoDB tables
export const USERS_TABLE = required("USERS_TABLE");
export const DEVICES_TABLE = required("DEVICES_TABLE");
export const READINGS_TABLE = required("READINGS_TABLE");
export const CONTROL_TABLE = required("CONTROL_TABLE");
export const NOTIFICATIONS_TABLE = required("NOTIFICATIONS_TABLE");

// Billing
export const BILLING_TABLE = required("BILLING_TABLE");

// PayPal
export const PAYPAL_CLIENT_ID = required("PAYPAL_CLIENT_ID");
export const PAYPAL_SECRET = required("PAYPAL_SECRET");
export const PAYPAL_BASE_URL = required("PAYPAL_BASE_URL");
export const PAYPAL_WEBHOOK_ID = process.env.PAYPAL_WEBHOOK_ID || "";

// Firebase
export const FIREBASE_SERVICE_ACCOUNT = JSON.parse(
  required("FIREBASE_SERVICE_ACCOUNT_JSON")
);

// IoT
export const IOT_DATA_ENDPOINT = required("IOT_DATA_ENDPOINT");