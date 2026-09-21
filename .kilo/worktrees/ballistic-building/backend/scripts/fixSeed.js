const { db } = require('../config/firebaseAdmin');

async function fixSeed() {
  const snapshot = await db.collection('students').where('registrationType', '==', 'individual').get();
  const batch = db.batch();
  
  snapshot.forEach(doc => {
    batch.update(doc.ref, { updatedAt: new Date().toISOString() });
  });
  
  await batch.commit();
  console.log(`Updated ${snapshot.size} individual students with updatedAt`);
  process.exit(0);
}

fixSeed().catch(console.error);
