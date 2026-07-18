/**
 * ============================================================================
 * CA Pro Tax Suite - Backup & Restore Module
 * ============================================================================
 * Purpose: Securely exports and imports the entire IndexedDB database to/from 
 * a local JSON file. Ensures no client data is lost if the browser cache is cleared.
 * ============================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
    
    // Bind Sidebar Dropdown Links
    const btnNavBackup = document.getElementById('btn-backup');
    const btnNavRestore = document.getElementById('btn-restore'); // Note: For input files in nav, usually better handled via a hidden input, but we'll trigger the settings one.

    // Bind Settings View Buttons
    document.addEventListener('viewChanged', (e) => {
        if (e.detail.view === 'settings') {
            const btnSettingsBackup = document.getElementById('btnSettingsBackup');
            const fileSettingsRestore = document.getElementById('btnSettingsRestore');

            if (btnSettingsBackup) {
                btnSettingsBackup.addEventListener('click', generateFullBackup);
            }
            if (fileSettingsRestore) {
                fileSettingsRestore.addEventListener('change', (event) => {
                    handleRestore(event.target.files[0]);
                });
            }
        }
    });

    if (btnNavBackup) {
        btnNavBackup.addEventListener('click', (e) => {
            e.preventDefault();
            generateFullBackup();
        });
    }

    /**
     * ========================================================================
     * EXPORT LOGIC
     * ========================================================================
     */
    async function generateFullBackup() {
        try {
            window.showToast("Preparing secure backup...", "info");
            
            const backupData = {
                timestamp: new Date().toISOString(),
                version: "1.0",
                data: {}
            };

            // Dynamically fetch all tables in the Dexie DB
            const tables = window.DB.core.tables;
            
            for (let table of tables) {
                backupData.data[table.name] = await table.toArray();
            }

            // Convert to JSON and trigger download
            const jsonString = JSON.stringify(backupData);
            const blob = new Blob([jsonString], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            const dateStr = new Date().toISOString().split('T')[0];
            a.download = `CA_Pro_Backup_${dateStr}.json`;
            
            document.body.appendChild(a);
            a.click();
            
            // Cleanup
            setTimeout(() => {
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
            }, 0);
            
            window.showToast("Backup downloaded successfully.", "success");

        } catch (error) {
            console.error("Backup failed:", error);
            window.showToast("Failed to generate backup.", "danger");
        }
    }

    /**
     * ========================================================================
     * IMPORT LOGIC
     * ========================================================================
     */
    async function handleRestore(file) {
        if (!file) return;

        if (file.type !== "application/json" && !file.name.endsWith('.json')) {
            window.showToast("Invalid file format. Please upload a JSON backup.", "danger");
            return;
        }

        const confirmRestore = confirm("WARNING: Restoring will overwrite all existing data in the system. Do you want to proceed?");
        if (!confirmRestore) return;

        const reader = new FileReader();
        
        reader.onload = async (e) => {
            try {
                const backup = JSON.parse(e.target.result);
                
                if (!backup.data || !backup.version) {
                    throw new Error("Invalid CA Pro backup file structure.");
                }

                window.showToast("Restoring database, please wait...", "info");

                // Execute within a Dexie transaction for safety
                await window.DB.core.transaction('rw', window.DB.core.tables, async () => {
                    for (const tableName of Object.keys(backup.data)) {
                        const table = window.DB.core.table(tableName);
                        // Clear existing data
                        await table.clear();
                        // Bulk add imported data
                        if (backup.data[tableName].length > 0) {
                            await table.bulkAdd(backup.data[tableName]);
                        }
                    }
                });

                window.showToast("Database restored successfully! Reloading...", "success");
                
                // Reload to re-initialize UI with new data
                setTimeout(() => {
                    window.location.reload();
                }, 2000);

            } catch (error) {
                console.error("Restore failed:", error);
                window.showToast("Restore failed: " + error.message, "danger");
            }
        };

        reader.readAsText(file);
    }
});