import { getApps, initializeApp, getApp } from "firebase/app";
import { getAuth, signOut } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: "telegram-mini-app-d28ab.firebaseapp.com",
  projectId: "telegram-mini-app-d28ab",
  storageBucket: "telegram-mini-app-d28ab.firebasestorage.app",
  messagingSenderId: "37701664057",
  appId: "1:37701664057:web:9bb71dc025d29ec7ce7ce8",
  measurementId: "G-K2GE50FVMP"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db, signOut };
