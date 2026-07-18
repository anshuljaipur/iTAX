import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyB2ioY3pormlB8-PaZAxwFMAGYvm8ox87s",
    authDomain: "ca-pro-tax-suite.firebaseapp.com",
    projectId: "ca-pro-tax-suite",
    storageBucket: "ca-pro-tax-suite.firebasestorage.app",
    messagingSenderId: "1017214259263",
    appId: "1:1017214259263:web:57f32e8fd78b584661688a"
  };


// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
export const db = getFirestore(app);