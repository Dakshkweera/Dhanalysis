// backend/config/firebase.js
// Firebase Admin SDK initialization using validated config.

import admin from 'firebase-admin';
import config from './env.js';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId:   config.FIREBASE.projectId,
      clientEmail: config.FIREBASE.clientEmail,
      privateKey:  config.FIREBASE.privateKey,
    }),
  });
}

export default admin;
