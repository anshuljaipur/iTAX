/**
 * ============================================================================
 * CA Pro Tax Suite - Main Application Logic
 * ============================================================================
 */

// 1. Import Firebase Auth
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const auth = getAuth();

// 2. The Auth Observer (This replaces your old manual login form)
onAuthStateChanged(auth, async (user) => {
    if (user) {
        console.log("User authenticated via Google:", user.uid);
        
        // Lock in the user ID so the Database engine (database.js) can use it
        window.currentUserUid = user.uid; 
        
        // Hide the Login Screen and Show the Workspace
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('workspace').style.display = 'block';
        
        // Safe to load data now!
        await initializeWorkspace();
    } else {
        console.log("User logged out");
        window.currentUserUid = null;
        
        // Hide the Workspace and Show the Login Screen
        document.getElementById('workspace').style.display = 'none';
        document.getElementById('loginScreen').style.display = 'flex'; 
    }
});

// 3. Initialize Workspace (Fixed Capitalization)
async function initializeWorkspace() {
    try {
        console.log("Initializing workspace data...");
        
        // FIXED: Using uppercase 'Clients' and 'Settings' to match database.js
        const clients = await window.DB.Clients.getAllClients(); 
        console.log("Successfully loaded clients:", clients);
        
        const settings = await window.DB.Settings.getSettings();
        
        if (settings && settings.firmName) {
            // Update firm name in the UI if you have a display element for it
            const firmNameDisplay = document.getElementById('firmNameDisplay');
            if (firmNameDisplay) {
                firmNameDisplay.innerText = settings.firmName;
            }
        }

        // Call your existing UI render functions here
        // renderClientList(clients);
        // updateDashboard();

    } catch (error) {
        console.error("Error initializing workspace:", error);
    }
}

// 4. Base Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    
    // --- DELETE OR COMMENT OUT YOUR OLD LOGIN LISTENER ---
    // const loginForm = document.getElementById('loginForm');
    // loginForm.addEventListener('submit', async (e) => { ... });

    // Handle Logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            signOut(auth).then(() => {
                console.log("Successfully logged out.");
            }).catch((error) => {
                console.error("Logout error:", error);
            });
        });
    }

    // --- PASTE ALL YOUR OTHER EXISTING EVENT LISTENERS BELOW ---
    // (e.g., adding clients, opening modals, saving transactions)
});

// --- PASTE ALL YOUR OTHER EXISTING FUNCTIONS BELOW ---
// (e.g., renderClientList, handleFormSubmit, calculateTax, etc.)
