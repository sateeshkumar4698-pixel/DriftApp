/**
 * deleteSeedUsers.mjs — deletes seed_user_03 through seed_user_15
 * Keeps seed_user_01 and seed_user_02.
 * Run:  node scripts/deleteSeedUsers.mjs
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const serviceAccount = JSON.parse(
  readFileSync(resolve(__dirname, '../backend/service-account.json'), 'utf8')
);

const adminPkg = await import(
  resolve(__dirname, '../backend/node_modules/firebase-admin/lib/index.js')
);
const admin = adminPkg.default ?? adminPkg;

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const TO_DELETE = [
  'seed_user_03', 'seed_user_04', 'seed_user_05',
  'seed_user_06', 'seed_user_07', 'seed_user_08',
  'seed_user_09', 'seed_user_10', 'seed_user_11',
  'seed_user_12', 'seed_user_13', 'seed_user_14',
  'seed_user_15',
];

async function run() {
  console.log(`Deleting ${TO_DELETE.length} seed users (keeping seed_user_01 + seed_user_02)…\n`);
  for (const uid of TO_DELETE) {
    await db.collection('users').doc(uid).delete();
    console.log(`  ✓ deleted ${uid}`);
  }
  console.log('\n✅ Done — only seed_user_01 and seed_user_02 remain.');
  process.exit(0);
}

run().catch((err) => {
  console.error('Delete failed:', err.message ?? err);
  process.exit(1);
});
