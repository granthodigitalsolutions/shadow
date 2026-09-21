require('dotenv').config({ path: '../.env' });
const { db } = require('../config/firebaseAdmin.js');

async function migrateCollection(collectionName) {
  const snapshot = await db.collection(collectionName).get();
  console.log(`Migrating ${snapshot.size} documents in ${collectionName}...`);
  
  if (snapshot.size === 0) return;
  
  const batch = db.batch();
  let count = 0;
  
  snapshot.docs.forEach((doc) => {
    const data = doc.data();
    let updates = {};
    
    if (data.isDeleted === undefined) {
      updates.isDeleted = false;
    }
    if (data.schemaVersion === undefined) {
      updates.schemaVersion = 1;
    }
    
    if (Object.keys(updates).length > 0) {
      batch.update(doc.ref, updates);
      count++;
    }
  });
  
  if (count > 0) {
    await batch.commit();
    console.log(`Updated ${count} documents in ${collectionName}.`);
  } else {
    console.log(`No updates needed for ${collectionName}.`);
  }
}

async function run() {
  console.log('--- Migration 003: Standardize Soft Deletes & Schema Version ---');
  
  const collections = [
    'students', 'batches', 'beltTests', 'schools', 'programs', 
    'branches', 'referees', 'admins', 'secretaries', 'feeStructure', 'silambanFees'
  ];
  
  try {
    for (const collection of collections) {
      await migrateCollection(collection);
    }
    console.log('Migration 003 completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Migration 003 failed:', err);
    process.exit(1);
  }
}

run();
