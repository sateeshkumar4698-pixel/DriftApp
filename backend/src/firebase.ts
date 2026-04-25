import admin from 'firebase-admin';
import path from 'path';
import fs from 'fs';

let initialized = false;

export function initFirebase(): void {
  if (initialized || admin.apps.length > 0) {
    initialized = true;
    return;
  }

  // ── Option 1: JSON string in env var (recommended for Railway / cloud) ────
  // Set FIREBASE_SERVICE_ACCOUNT_JSON to the full contents of service-account.json
  const jsonEnv = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (jsonEnv) {
    const serviceAccount = JSON.parse(jsonEnv);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    initialized = true;
    return;
  }

  // ── Option 2: File path (local dev) ──────────────────────────────────────
  const filePath =
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (filePath) {
    const resolved = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(process.cwd(), filePath);

    if (!fs.existsSync(resolved)) {
      throw new Error(`Service account file not found: ${resolved}`);
    }
    const serviceAccount = JSON.parse(fs.readFileSync(resolved, 'utf8'));
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    initialized = true;
    return;
  }

  // ── Option 3: Google Application Default Credentials (GCP / Cloud Run) ───
  admin.initializeApp({ credential: admin.credential.applicationDefault() });
  initialized = true;
}

export { admin };
