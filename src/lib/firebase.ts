import { getApps, initializeApp, getApp } from "firebase/app";
import { getAuth, signOut } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: "login-and-sign-up-e39e4.firebaseapp.com",
  projectId: "login-and-sign-up-e39e4",
  storageBucket: "login-and-sign-up-e39e4.firebasestorage.app",
  messagingSenderId: "1025789251454",
  appId: "1:1025789251454:web:ffe54a3db2f480737b6d2f",
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db, signOut };
