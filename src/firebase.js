import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCz37f904hHjPbyAalPw2rCdyRBa115jZg",
  authDomain: "web2026-a4f35.firebaseapp.com",
  projectId: "web2026-a4f35",
  storageBucket: "web2026-a4f35.firebasestorage.app",
  messagingSenderId: "1079552478152",
  appId: "1:1079552478152:web:389cffb76b0756c4ee8efd"
};

const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.authDomain &&
  firebaseConfig.projectId &&
  firebaseConfig.appId
);

const app = isFirebaseConfigured ? initializeApp(firebaseConfig) : null;

export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;
export { isFirebaseConfigured };
