import admin from 'firebase-admin';
import path from 'path';
import fs from 'fs';

let initialized = false;

export function initFirebase(): void {
  if (initialized || admin.apps.length > 0) {
    initialized = true;
    return;
  }

  const explicitPath =
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (explicitPath) {
    const resolved = path.isAbsolute(explicitPath)
      ? explicitPath
      : path.resolve(process.cwd(), explicitPath);

    if (!fs.existsSync(resolved)) {
      throw new Error(
        `Firebase service account file not found at: ${resolved}. ` +
          `Set FIREBASE_SERVICE_ACCOUNT_PATH or GOOGLE_APPLICATION_CREDENTIALS to a valid JSON key path.`
      );
    }

    const serviceAccount = JSON.parse(fs.readFileSync(resolved, 'utf8'));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } else {
    // Fall back to Application Default Credentials (useful on GCP).
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
  }

  initialized = true;
}

export { admin };
