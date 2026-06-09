// frontend/src/config/firebase.ts
// Firebase web SDK — all credentials read from environment variables.
// Never hardcode credentials in source code.

import { initializeApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY             as string,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN         as string,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID          as string,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET      as string,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID              as string,
};

const app = initializeApp(firebaseConfig);
export const auth: Auth = getAuth(app);
export default app;
