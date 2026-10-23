// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const firebaseConfig = Object.freeze({
  apiKey: "AIzaSyBkt-5W1vLcGvWgJTv95KbpbrnMf7Rm0JU",
  authDomain: "bn-max.com",
  projectId: "bn-store-4f0c0",
  storageBucket: "bn-store-4f0c0.firebasestorage.app",
  messagingSenderId: "281646513182",
  appId: "1:281646513182:web:002c7b1138fe5b8106c20f"
});

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

export const appId = "bn-store-main-app";
export const ADMIN_UID = "CLdxfaDVBGMzQke9sjBXPIctBFQ2";
