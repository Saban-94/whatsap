import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// מלשינון חיבור - בדיקת משתני סביבה בקונסול
const debugConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ? "✅ מוגדר" : "❌ חסר",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "❌ חסר",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ? "✅ מוגדר" : "❌ חסר",
};

console.log("🛠️ SabanOS Debug - בדיקת חיבור Firebase:", debugConfig);
console.log("🌐 דומיין נוכחי (Domain):", window.location.hostname);

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

// חיבור למסד הנתונים
const dbId = import.meta.env.VITE_FIREBASE_DATABASE_ID || '(default)';
export const db = getFirestore(app, dbId);

export const googleProvider = new GoogleAuthProvider();

export const signIn = async () => {
  console.log("🚀 ניסיון התחברות מול דומיין:", firebaseConfig.authDomain);
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    console.error("❌ שגיאת התחברות מפורטת:", error.code, error.message);
    if (error.code === 'auth/unauthorized-domain') {
      console.error("📍 הפתרון: תוסיף את '" + window.location.hostname + "' ל-Authorized Domains ב-Firebase Console.");
    }
    throw error;
  }
};

export const signOut = () => auth.signOut();
