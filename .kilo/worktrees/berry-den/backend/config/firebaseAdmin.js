const admin = require('firebase-admin');
const path = require('path');

let serviceAccount;

// 1. Try to construct from individual environment variables
if (!serviceAccount && process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
  try {
    const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY;
    const cleanPrivateKey = rawPrivateKey
      .replace(/^"/, '')        // Strip leading quote if present
      .replace(/"$/, '')        // Strip trailing quote if present
      .replace(/\\n/g, '\n');   // Convert literal \n to actual newlines
    
    serviceAccount = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: cleanPrivateKey
    };
  } catch (error) {
    console.error('Failed to parse individual Firebase environment variables:', error);
  }
}

// 3. Fallback to local serviceAccountKey.json file (e.g. for local dev)
if (!serviceAccount) {
  try {
    serviceAccount = require(path.join(__dirname, 'serviceAccountKey.json'));
  } catch (error) {
    console.log('[Firebase] Local serviceAccountKey.json not found, relying on environment variables.');
  }
}

let db = null;

if (!serviceAccount) {
  console.error('[Firebase Error] Firebase Admin Service Account Key is missing! Set FIREBASE_SERVICE_ACCOUNT, set individual FIREBASE_* env variables, or add config/serviceAccountKey.json.');
} else {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    db = admin.firestore();
    console.log('[Firebase] Admin initialized successfully.');
  } catch (error) {
    console.error('[Firebase Error] Failed to initialize Firebase Admin:', error);
  }
}

module.exports = { admin, db };


