require('dotenv').config({ path: '../.env' }); // Ensure dotenv runs relative to backend root
const { db } = require('../config/firebaseAdmin.js');

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
  console.log(`Deleted ${batchSize} documents from subcollection.`);
  
  process.nextTick(() => {
    deleteQueryBatch(query, resolve);
  });
}

async function run() {
  console.log('--- Migration 002: Remove batches/{batchId}/students subcollections ---');
  
  try {
    const batchesSnapshot = await db.collection('batches').get();
    console.log(`Found ${batchesSnapshot.size} batches. Iterating to delete students subcollections...`);
    
    for (const batchDoc of batchesSnapshot.docs) {
      const batchId = batchDoc.id;
      const subcollectionRef = db.collection(`batches/${batchId}/students`);
      const query = subcollectionRef.orderBy('__name__').limit(500);
      
      await new Promise((resolve, reject) => {
        deleteQueryBatch(query, resolve).catch(reject);
      });
    }
    
    console.log('Migration 002 completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Migration 002 failed:', err);
    process.exit(1);
  }
}

run();
