require('dotenv').config({ path: '../.env' }); // Ensure dotenv runs relative to backend root
const { db } = require('../config/firebaseAdmin.js');

async function deleteCollection(collectionPath, batchSize) {
  const collectionRef = db.collection(collectionPath);
  const query = collectionRef.orderBy('__name__').limit(batchSize);

  return new Promise((resolve, reject) => {
    deleteQueryBatch(query, resolve).catch(reject);
  });
}

async function deleteQueryBatch(query, resolve) {
  const snapshot = await query.get();
  const batchSize = snapshot.size;
  if (batchSize === 0) {
    resolve();
    return;
  }
  const batch = db.batch();
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });
  await batch.commit();
  console.log(`Deleted ${batchSize} documents from collection.`);
  
  process.nextTick(() => {
    deleteQueryBatch(query, resolve);
  });
}

async function run() {
  console.log('--- Migration 001: Cleanup Legacy WhatsApp Collections ---');
  
  try {
    console.log('Deleting whatsapp_queue...');
    await deleteCollection('whatsapp_queue', 500);
    
    console.log('Deleting whatsapp_logs...');
    await deleteCollection('whatsapp_logs', 500);
    
    console.log('Migration 001 completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Migration 001 failed:', err);
    process.exit(1);
  }
}

run();
