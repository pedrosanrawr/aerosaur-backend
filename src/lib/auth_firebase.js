import admin from "firebase-admin";

function initFirebaseAdmin(serviceJson) {
  if (admin.apps.length) return;

  const raw = JSON.parse(serviceJson);

  if (raw.private_key && raw.private_key.includes("\\n")) {
    raw.private_key = raw.private_key.replace(/\\n/g, "\n");
  }

  admin.initializeApp({
    credential: admin.credential.cert(raw),
    projectId: raw.project_id,
  });
}

export async function verifyBearerAuthHeader(authHeader) {
  const match = (authHeader || "").match(/^Bearer\s+(.+)$/i);
  const token = match ? match[1] : null;
  if (!token) throw new Error("Missing Authorization Bearer token");

  const serviceJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!serviceJson) throw new Error("Missing env FIREBASE_SERVICE_ACCOUNT_JSON");

  initFirebaseAdmin(serviceJson);
  return await admin.auth().verifyIdToken(token);
}
