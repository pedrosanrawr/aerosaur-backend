import admin from "firebase-admin";

export function ensureFirebaseAdmin(serviceJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  if (admin.apps.length) return admin;

  if (!serviceJson) throw new Error("Missing env FIREBASE_SERVICE_ACCOUNT_JSON");

  const raw = JSON.parse(serviceJson);

  if (raw.private_key && raw.private_key.includes("\\n")) {
    raw.private_key = raw.private_key.replace(/\\n/g, "\n");
  }

  admin.initializeApp({
    credential: admin.credential.cert(raw),
    projectId: raw.project_id,
  });

  return admin;
}

export async function verifyBearerAuthHeader(authHeader) {
  const match = (authHeader || "").match(/^Bearer\s+(.+)$/i);
  const token = match ? match[1] : null;
  if (!token) throw new Error("Missing Authorization Bearer token");

  ensureFirebaseAdmin();
  return await admin.auth().verifyIdToken(token);
}
