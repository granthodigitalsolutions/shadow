require('dotenv').config({ path: '../.env' });
const { db } = require('../config/firebaseAdmin.js');

const isDryRun = process.argv.includes('--dry-run');

const COLLECTION_MAP = [
  { from: 'secretaries', to: 'coaches' },
  { from: 'secretarySchools', to: 'coachSchools' },
  { from: 'secretaryRequests', to: 'coachRequests' },
];

const BATCH_LIMIT = 500;

// Pure additive copy: preserves document IDs, never mutates or deletes the
// source collection. Uses .set() (not .add()) so re-running is safe/idempotent
// — needed for the delta-resync step right before frontend cutover.
async function copyCollection(from, to) {
  const snapshot = await db.collection(from).get();
  console.log(`${from} -> ${to}: ${snapshot.size} documents found.`);

  if (snapshot.size === 0) return { copied: 0 };

  if (isDryRun) {
    const sampleIds = snapshot.docs.slice(0, 5).map((d) => d.id);
    console.log(`  [dry-run] would copy ${snapshot.size} docs. Sample IDs: ${sampleIds.join(', ')}`);
    return { copied: 0 };
  }

  const docs = snapshot.docs;
  let copied = 0;

  for (let i = 0; i < docs.length; i += BATCH_LIMIT) {
    const chunk = docs.slice(i, i + BATCH_LIMIT);
    const batch = db.batch();
    chunk.forEach((docSnap) => {
      batch.set(db.collection(to).doc(docSnap.id), docSnap.data());
    });
    await batch.commit();
    copied += chunk.length;
    console.log(`  committed ${copied}/${docs.length}`);
  }

  return { copied };
}

// Adds roles.coach as a clone of the current roles.secretary value, without
// touching roles.secretary — so the still-live old frontend keeps working
// until the new frontend (reading roles.coach) is deployed.
async function migrateAuthSettings() {
  const ref = db.collection('auth_settings').doc('global');
  const snap = await ref.get();

  if (!snap.exists) {
    console.log('auth_settings/global: doc does not exist, nothing to migrate.');
    return;
  }

  const data = snap.data();
  const secretaryConfig = data?.roles?.secretary;

  if (!secretaryConfig) {
    console.log('auth_settings/global: no roles.secretary found, nothing to migrate.');
    return;
  }

  console.log(`auth_settings/global: roles.coach ${isDryRun ? 'would be set' : 'set'} to clone of roles.secretary:`, JSON.stringify(secretaryConfig));

  if (isDryRun) return;

  await ref.set({ roles: { coach: secretaryConfig } }, { merge: true });
}

async function verify() {
  console.log('\n--- Verification ---');
  for (const { from, to } of COLLECTION_MAP) {
    const [fromSnap, toSnap] = await Promise.all([
      db.collection(from).get(),
      db.collection(to).get(),
    ]);
    const match = fromSnap.size === toSnap.size ? 'OK' : 'MISMATCH';
    console.log(`${from} (${fromSnap.size}) vs ${to} (${toSnap.size}): ${match}`);
  }
}

async function run() {
  console.log(`--- Migration 004: Secretary -> Coach ${isDryRun ? '(DRY RUN)' : ''} ---`);

  try {
    for (const { from, to } of COLLECTION_MAP) {
      await copyCollection(from, to);
    }
    await migrateAuthSettings();

    if (!isDryRun) {
      await verify();
    }

    console.log(`Migration 004 ${isDryRun ? 'dry-run ' : ''}completed successfully.`);
    process.exit(0);
  } catch (err) {
    console.error('Migration 004 failed:', err);
    process.exit(1);
  }
}

run();
