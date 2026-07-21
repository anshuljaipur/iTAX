/**
 * ============================================================================
 * CA Pro Tax Suite - Firebase Cloud Firestore Engine (Verbose Debugging)
 * ============================================================================
 */
import { db } from './firebase-init.js';
import { collection, getDocs, getDoc, setDoc, addDoc, updateDoc, doc, deleteDoc, query, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Helper to securely get the active user's database path
function getUserPath() {
    if (!window.currentUserUid) {
        throw new Error("Security Exception: Cannot access database. No user is logged in.");
    }
    return `users/${window.currentUserUid}`;
}

window.DB = {
   Clients: {
        async addClient(clientData) {
            console.log("[Firebase DB] Starting addClient task...");
            clientData.id = Date.now(); 
            const targetPath = `${getUserPath()}/clients`;
            console.log(`[Firebase DB] Attempting write to -> Path: ${targetPath} | Doc ID: ${clientData.id}`);
            const docRef = doc(db, targetPath, String(clientData.id));
            await setDoc(docRef, clientData);
            console.log("[Firebase DB] Write successful! Data is in the cloud.");
            return clientData.id;
        },
        async updateClient(clientData) {
            const docRef = doc(db, `${getUserPath()}/clients`, String(clientData.id));
            await setDoc(docRef, clientData, { merge: true });
        },
        async saveClient(clientData) {
            console.log("[Firebase DB] saveClient router triggered. Checking for existing ID...");
            if (clientData.id) {
                console.log("[Firebase DB] ID found. Routing to updateClient...");
                await window.DB.Clients.updateClient(clientData);
                return clientData.id;
            } else {
                console.log("[Firebase DB] No ID found. Routing to addClient...");
                return await window.DB.Clients.addClient(clientData);
            }
        },
        async getAllClients() {
            console.log("[Firebase DB] Fetching all clients from cloud...");
            if (!window.currentUserUid) return [];
            const colRef = collection(db, `${getUserPath()}/clients`);
            const snapshot = await getDocs(colRef);
            console.log(`[Firebase DB] Cloud returned ${snapshot.docs.length} documents.`);
            return snapshot.docs.map(docSnap => docSnap.data());
        },
        async getClientByPan(panNumber) {
            console.log(`[Firebase DB] Validating duplicate PAN: ${panNumber}...`);
            if (!window.currentUserUid) return null;
            const colRef = collection(db, `${getUserPath()}/clients`);
            const q = query(colRef, where("pan", "==", panNumber));
            const snapshot = await getDocs(q);
            if (!snapshot.empty) {
                console.log("[Firebase DB] Duplicate PAN found in cloud!");
                return snapshot.docs[0].data();
            }
            console.log("[Firebase DB] PAN is unique.");
            return null;
        },

        // ---> THE RESTORED FUNCTION <---
        async getClientById(id) {
            console.log(`[Firebase DB] Fetching single client ID: ${id}...`);
            if (!window.currentUserUid) return null;
            const docRef = doc(db, `${getUserPath()}/clients`, String(id));
            const snap = await getDoc(docRef);
            if (snap.exists()) {
                return snap.data();
            } else {
                console.warn(`[Firebase DB] Client ID ${id} not found!`);
                return null;
            }
        },
        
        async deleteClient(id) {
            await deleteDoc(doc(db, `${getUserPath()}/clients`, String(id)));
            await window.DB.Transactions.deleteTransactionsByClient(id);
        }
    },
    
    Transactions: {
        async saveTransaction(txData) {
            if (!txData.id) txData.id = Date.now();
            const docRef = doc(db, `${getUserPath()}/transactions`, String(txData.id));
            await setDoc(docRef, txData, { merge: true });
            return txData.id;
        },
        async getTransactionsByClientAndFY(clientId, fy) {
            if (!window.currentUserUid) return [];
            const colRef = collection(db, `${getUserPath()}/transactions`);
            const q = query(colRef, where("clientId", "==", Number(clientId)), where("fy", "==", fy));
            const snapshot = await getDocs(q);
            const results = snapshot.docs.map(docSnap => docSnap.data());
            return results.sort((a, b) => new Date(a.date) - new Date(b.date));
        },
        
        // ---> NEW FUNCTION ADDED HERE <---
        async getAllTransactionsByFY(fy) {
            console.log(`[Firebase DB] Fetching ALL transactions for FY: ${fy}...`);
            if (!window.currentUserUid) return [];
            const colRef = collection(db, `${getUserPath()}/transactions`);
            const q = query(colRef, where("fy", "==", fy));
            const snapshot = await getDocs(q);
            const results = snapshot.docs.map(docSnap => docSnap.data());
            return results.sort((a, b) => new Date(a.date) - new Date(b.date));
        },

        async deleteTransaction(id) {
            await deleteDoc(doc(db, `${getUserPath()}/transactions`, String(id)));
        },
        async deleteTransactionsByClient(clientId) {
            const colRef = collection(db, `${getUserPath()}/transactions`);
            const q = query(colRef, where("clientId", "==", Number(clientId)));
            const snapshot = await getDocs(q);
            const deletePromises = snapshot.docs.map(docSnap => 
                deleteDoc(doc(db, `${getUserPath()}/transactions`, docSnap.id))
            );
            await Promise.all(deletePromises);
        }
    },
    
    Settings: {
        async getSettings() {
            if (!window.currentUserUid) return { firmName: "CA PRO TAX FIRM" };
            const docRef = doc(db, `${getUserPath()}/settings`, "main");
            const snap = await getDoc(docRef);
            return snap.exists() ? snap.data() : { firmName: "CA PRO TAX FIRM" };
        },
        async saveSettings(settingsData) {
            const docRef = doc(db, `${getUserPath()}/settings`, "main");
            await setDoc(docRef, settingsData, { merge: true });
        }
    },
    
    Rules: {
        async getCachedRule(fy) {
            if (!window.currentUserUid) return null;
            const docRef = doc(db, `${getUserPath()}/rules`, fy);
            const snap = await getDoc(docRef);
            return snap.exists() ? snap.data() : null;
        },
        async cacheRule(fy, ruleData) {
            const docRef = doc(db, `${getUserPath()}/rules`, fy);
            await setDoc(docRef, { rules: ruleData });
        }
    }
};
