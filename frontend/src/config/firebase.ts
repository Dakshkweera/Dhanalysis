
import { initializeApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyBHWY4rIE8D_Xa7aheKb0EbBm2DeJt-8Lc",
  authDomain: "dhanalysis-81762.firebaseapp.com",
  projectId: "dhanalysis-81762",
  storageBucket: "dhanalysis-81762.firebasestorage.app",
  messagingSenderId: "516816780313",
  appId: "1:516816780313:web:4ee12e8a40460773b3fe88"
};

const app = initializeApp(firebaseConfig);
export const auth: Auth = getAuth(app);
