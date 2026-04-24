import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// הגדרות Firebase מתוך משתני הסביבה של Vercel/Vite
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// שימוש ב-Database ID הספציפי שהגדרת (saban-db או default)
const dbId = import.meta.env.VITE_FIREBASE_DATABASE_ID || '(default)';
export const db = getFirestore(app, dbId);

export const googleProvider = new GoogleAuthProvider();
export const signIn = () => signInWithPopup(auth, googleProvider);
export const signOut = () => auth.signOut();
