/**
 * ============================================================================
 * CA Pro Tax Suite - Firebase Cloud Firestore Engine
 * ============================================================================
 */
import { db } from './firebase-init.js';
import { 
    collection, doc, setDoc, getDoc, getDocs, query, where, deleteDoc 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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
            clientData.id = Date.now(); // Generate numeric ID to maintain UI compatibility
            const docRef = doc(db, `${getUserPath()}/clients`, String(clientData.id));
            await setDoc(docRef, clientData);
            return clientData.id;
        },
        async updateClient(clientData) {
            const docRef = doc(db, `${getUserPath()}/clients`, String(clientData.id));
            await setDoc(docRef, clientData, { merge: true });
        },
        async getAllClients() {
            if (!window.currentUserUid) return [];
            const colRef = collection(db, `${getUserPath()}/clients`);
            const snapshot = await getDocs(colRef);
            return snapshot.docs.map(docSnap => docSnap.data());
        },
        async getClientById(id) {
            const docRef = doc(db, `${getUserPath()}/clients`, String(id));
            const snap = await getDoc(docRef);
            return snap.exists() ? snap.data() : null;
        },
        async deleteClient(id) {
            await deleteDoc(doc(db, `${getUserPath()}/clients`, String(id)));
            await window.DB.Transactions.deleteTransactionsByClient(id);
        }
    },
    
    Transactions: {
        async saveTransaction(txData) {
            if (!txData.id) txData.id = Date.now(); // Generate numeric ID if new
            const docRef = doc(db, `${getUserPath()}/transactions`, String(txData.id));
            await setDoc(docRef, txData, { merge: true });
            return txData.id;
        },
        async getTransactionsByClientAndFY(clientId, fy) {
            if (!window.currentUserUid) return [];
            const colRef = collection(db, `${getUserPath()}/transactions`);
            const q = query(colRef, where("clientId", "==", Number(clientId)), where("fy", "==", fy));
            const snapshot = await getDocs(q);
            
            // Sort by date before returning
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
            
            // Batch delete all transactions for this client
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