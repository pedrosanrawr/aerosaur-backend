import dotenv from "dotenv";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

function main() {
  dotenv.config();

  const requiredVars = [
    "PAYPAL_CLIENT_ID",
    "PAYPAL_SECRET",
    "PAYPAL_WEBHOOK_ID",
    "PAYPAL_BASE_URL",
    "FIREBASE_SERVICE_ACCOUNT_JSON",
    "IOT_DATA_ENDPOINT",
    "PAYMAYA_PUBLIC_KEY",
    "PAYMAYA_SECRET_KEY",
    "PAYMAYA_WEBHOOK_SECRET",
    "PAYMAYA_ENV",
    "APP_URL",
  ];

  const missing = requiredVars.filter((name) => !process.env[name]);

  if (missing.length) {
    console.error(`Missing deploy env vars: ${missing.join(", ")}`);
    process.exit(1);
  }

  const overrides = [
    `StageName=${process.env.STAGE_NAME || "prod"}`,
    `PaypalClientId=${process.env.PAYPAL_CLIENT_ID}`,
    `PaypalSecret=${process.env.PAYPAL_SECRET}`,
    `PaypalWebhookId=${process.env.PAYPAL_WEBHOOK_ID}`,
    `PaypalBaseUrl=${process.env.PAYPAL_BASE_URL}`,
    `FirebaseServiceAccountJson=${process.env.FIREBASE_SERVICE_ACCOUNT_JSON}`,
    `IoTDataEndpoint=${process.env.IOT_DATA_ENDPOINT}`,
    `PaymayaPublicKey=${process.env.PAYMAYA_PUBLIC_KEY}`,
    `PaymayaSecretKey=${process.env.PAYMAYA_SECRET_KEY}`,
    `PaymayaWebhookSecret=${process.env.PAYMAYA_WEBHOOK_SECRET}`,
    `PaymayaEnv=${process.env.PAYMAYA_ENV}`,
    `AppUrl=${process.env.APP_URL}`,
  ];

  const args = [
    "deploy",
    "--config-env",
    "default",
    "--parameter-overrides",
    ...overrides,
  ];
  const result = spawnSync("sam", args, {
    stdio: "inherit",
    shell: false,
  });

  process.exit(result.status ?? 1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
