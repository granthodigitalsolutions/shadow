const admin = require('firebase-admin');

let serviceAccount;

if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
  try {
    const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY;
    const cleanPrivateKey = rawPrivateKey
      .replace(/^"/, '')        
      .replace(/"$/, '')        
      .replace(/\\n/g, '\n');   
    
    serviceAccount = {
      projectId: process.env.FIREBASE_PROJECT_ID.trim(),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL.trim(),
      privateKey: cleanPrivateKey
    };
  } catch (error) {
    console.error('Failed to parse Firebase environment variables:', error);
  }
}

if (!admin.apps.length) {
  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET ? process.env.FIREBASE_STORAGE_BUCKET.trim() : 'team-shadowkai.firebasestorage.app'
    });
  } else {
    // Attempt default initialization if Vercel environment variables are set properly or default credentials exist
    try {
      admin.initializeApp();
    } catch (e) {
      console.warn('Firebase initialization failed. Ensure environment variables are set.');
    }
  }
}

const db = admin.firestore();
const storage = admin.storage();

module.exports = { admin, db, storage };
