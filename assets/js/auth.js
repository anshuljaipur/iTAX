import { auth, provider } from './firebase-init.js';
import { signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

document.addEventListener('DOMContentLoaded', () => {
    const loginScreen = document.getElementById('login-screen');
    const appContainer = document.getElementById('app-container');
    const btnLogin = document.getElementById('btnGoogleLogin');
    const btnLogout = document.getElementById('btnLogout');

    // Global variable to track the logged-in user ID
    window.currentUserUid = null; 

    // Handle Login Button
    btnLogin.addEventListener('click', async () => {
        try {
            await signInWithPopup(auth, provider);
        } catch (error) {
            console.error("Login failed", error);
            alert("Login Failed: " + error.message);
        }
    });

    // Handle Logout Button
    if (btnLogout) {
        btnLogout.addEventListener('click', async () => {
            await signOut(auth);
            window.location.reload(); // Refresh to clear memory
            localStorage.removeItem('activeView');
            localStorage.removeItem('activeFY');
        });
    }

    // Monitor Auth State
    onAuthStateChanged(auth, (user) => {
        if (user) {
            // User is signed in
            window.currentUserUid = user.uid;
            loginScreen.classList.add('hidden');
            appContainer.classList.remove('hidden');
            
            // Dispatch event so database.js knows it can load data
            document.dispatchEvent(new CustomEvent('userAuthenticated', { detail: { user } }));
        } else {
            // User is signed out
            window.currentUserUid = null;
            loginScreen.classList.remove('hidden');
            appContainer.classList.add('hidden');
        }
    });
});
