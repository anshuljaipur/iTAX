/**
 * ============================================================================
 * CA Pro Tax Suite - Hardened Database Architecture
 * ============================================================================
 */

// Verify that the Dexie dependency loaded successfully from the CDN mirror
if (typeof Dexie === 'undefined') {
    console.error("Critical Failure: Dexie library could not be loaded from CDN.");
    alert("Database dependency failed to load. Please check your internet connection or update the CDN script tag.");
}

const db = new Dexie("CAProDatabase");

// Refined schema definitions matching core practice standards
db.version(1).stores({
    clients: '++id, &pan, clientId, name, mobile, status, resStatus',
    transactions: '++id, clientId, fy, date, voucherNo, incomeHead, category',
    computations: '++id, clientId, fy',
    settings: 'id',
    taxRules: 'fy'
});

class ClientDAO {
    static async saveClient(clientData) {
        try {
            // Auto-generate Client ID if new
            if (!clientData.id && !clientData.clientId) {
                // Fetch the last inserted record based on the internal primary key
                const lastClient = await db.clients.orderBy('id').last();
                
                let nextNum = 1001;
                if (lastClient && lastClient.clientId) {
                    // Extract the number part from "CAP-1003"
                    const parts = lastClient.clientId.split('-');
                    if (parts.length === 2 && !isNaN(parts[1])) {
                        nextNum = parseInt(parts[1], 10) + 1;
                    }
                }
                clientData.clientId = `CAP-${nextNum}`;
            }
            
            clientData.updatedAt = new Date().toISOString();
            
            // Explicitly force string matching for stability
            if (clientData.pan) clientData.pan = clientData.pan.toUpperCase().trim();
            
            return await db.clients.put(clientData);
        } catch (error) {
            console.error("IndexedDB Save Exception:", error);
            throw error;
        }
    }

    static async getClientById(id) {
        return await db.clients.get(Number(id));
    }

    static async getClientByPan(pan) {
        if (!pan) return null;
        return await db.clients.where('pan').equalsIgnoreCase(pan.trim()).first();
    }

    static async getAllClients() {
        return await db.clients.toArray();
    }

    static async deleteClient(id) {
        return await db.transaction('rw', db.clients, db.transactions, db.computations, async () => {
            await db.transactions.where('clientId').equals(id).delete();
            await db.computations.where('clientId').equals(id).delete();
            await db.clients.delete(id);
        });
    }
}

class TransactionDAO {
    static async saveTransaction(txData) {
        txData.updatedAt = new Date().toISOString();
        return await db.transactions.put(txData);
    }

    static async getTransactionsByClientAndFY(clientId, fy) {
        return await db.transactions
            .where('clientId')
            .equals(Number(clientId))
            .filter(tx => tx.fy === fy)
            .toArray();
    }
    
    static async getGroupedTransactions(clientId, fy) {
        const txs = await this.getTransactionsByClientAndFY(clientId, fy);
        const grouped = {
            Salary: [], HouseProperty: [], BusinessProfession: [],
            CapitalGain: [], OtherSources: [], Deductions: [],
            TDS: [], AdvanceTax: []
        };
        txs.forEach(tx => {
            if (grouped[tx.incomeHead]) grouped[tx.incomeHead].push(tx);
        });
        return grouped;
    }

    static async deleteTransaction(id) {
        return await db.transactions.delete(id);
    }
}

class SettingsDAO {
    static async saveSettings(settingsData) {
        settingsData.id = 1;
        return await db.settings.put(settingsData);
    }
    static async getSettings() {
        const settings = await db.settings.get(1);
        return settings || { firmName: "CA Pro Default Firm" };
    }
}

class TaxRuleDAO {
    static async cacheRule(fy, ruleData) {
        return await db.taxRules.put({ fy: fy, rules: ruleData, cachedAt: new Date().toISOString() });
    }
    static async getCachedRule(fy) {
        return await db.taxRules.get(fy);
    }
}

// Global exposure wrapper with ready checks
window.DB = {
    core: db,
    Clients: ClientDAO,
    Transactions: TransactionDAO,
    Settings: SettingsDAO,
    Rules: TaxRuleDAO
};

db.open().then(() => {
    console.log("IndexedDB Workspace safely initialized.");
}).catch(err => {
    console.error("Database open failed critically:", err);
});