/**
 * ============================================================================
 * CA Pro Tax Suite - Firm Settings Module
 * ============================================================================
 * Purpose: Manages the CA Firm profile (Name, FRN, GSTIN, Address).
 * Data is globally accessible via DB.Settings for generating PDFs & Invoices.
 * ============================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
    const settingsView = document.getElementById('view-settings');

    document.addEventListener('viewChanged', async (e) => {
        if (e.detail.view === 'settings') {
            await initializeSettingsUI();
            await loadSettingsData();
        }
    });

    /**
     * ========================================================================
     * UI GENERATOR
     * ========================================================================
     */
    async function initializeSettingsUI() {
        if (settingsView.querySelector('.settings-app-container')) return;

        settingsView.innerHTML = `
            <div class="settings-app-container">
                <h2 class="fw-bold mb-4">Firm Configuration</h2>
                
                <div class="row">
                    <div class="col-lg-8">
                        <div class="card glass-panel p-4 shadow-sm">
                            <form id="settingsForm">
                                <h5 class="text-primary border-bottom pb-2 mb-3"><i class="fa-solid fa-building"></i> Firm Details</h5>
                                <div class="row g-3">
                                    <div class="col-md-12">
                                        <label class="form-label">Firm Name *</label>
                                        <input type="text" class="form-control fw-bold text-primary" id="setFirmName" required>
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label">Proprietor / Partner Name</label>
                                        <input type="text" class="form-control" id="setCaName">
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label">Firm Registration Number (FRN)</label>
                                        <input type="text" class="form-control" id="setFrn">
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label">CA Membership Number</label>
                                        <input type="text" class="form-control" id="setMemNo">
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label">Firm GSTIN</label>
                                        <input type="text" class="form-control text-uppercase" id="setGstin" maxlength="15">
                                    </div>

                                    <h5 class="text-primary border-bottom pb-2 mb-3 mt-4"><i class="fa-solid fa-address-book"></i> Contact Information</h5>
                                    
                                    <div class="col-md-6">
                                        <label class="form-label">Official Email</label>
                                        <input type="email" class="form-control" id="setEmail">
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label">Contact Number</label>
                                        <input type="text" class="form-control" id="setPhone">
                                    </div>
                                    <div class="col-12">
                                        <label class="form-label">Office Address</label>
                                        <textarea class="form-control" id="setAddress" rows="3"></textarea>
                                    </div>

                                    <div class="col-12 text-end mt-4">
                                        <button type="submit" class="btn btn-primary px-4"><i class="fa-solid fa-save"></i> Save Configuration</button>
                                    </div>
                                </div>
                            </form>
                        </div>
                    </div>
                    
                    <div class="col-lg-4">
                        <div class="card glass-panel p-4 shadow-sm mb-4">
                            <h5 class="text-primary border-bottom pb-2 mb-3"><i class="fa-solid fa-database"></i> Database Management</h5>
                            <p class="text-muted small">Since this software runs completely offline, it is highly recommended to regularly backup your IndexedDB data.</p>
                            <button class="btn btn-outline-primary w-100 mb-2" id="btnSettingsBackup"><i class="fa-solid fa-download"></i> Download Full Backup (JSON)</button>
                            <label class="btn btn-outline-danger w-100">
                                <i class="fa-solid fa-upload"></i> Restore from Backup
                                <input type="file" id="btnSettingsRestore" class="d-none" accept=".json">
                            </label>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Bind Save Event
        document.getElementById('settingsForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const settingsData = {
                firmName: document.getElementById('setFirmName').value,
                caName: document.getElementById('setCaName').value,
                frn: document.getElementById('setFrn').value,
                membershipNo: document.getElementById('setMemNo').value,
                gstin: document.getElementById('setGstin').value.toUpperCase(),
                email: document.getElementById('setEmail').value,
                phone: document.getElementById('setPhone').value,
                address: document.getElementById('setAddress').value
            };

            try {
                await window.DB.Settings.saveSettings(settingsData);
                window.showToast("Firm Settings saved successfully.", "success");
            } catch (err) {
                console.error(err);
                window.showToast("Failed to save settings.", "danger");
            }
        });
        
        // Note: The Backup/Restore logic attached to these buttons will be handled 
        // in the global backup.js module to prevent code duplication.
    }

    /**
     * ========================================================================
     * DATA LOADING
     * ========================================================================
     */
    async function loadSettingsData() {
        try {
            const settings = await window.DB.Settings.getSettings();
            
            document.getElementById('setFirmName').value = settings.firmName || '';
            document.getElementById('setCaName').value = settings.caName || '';
            document.getElementById('setFrn').value = settings.frn || '';
            document.getElementById('setMemNo').value = settings.membershipNo || '';
            document.getElementById('setGstin').value = settings.gstin || '';
            document.getElementById('setEmail').value = settings.email || '';
            document.getElementById('setPhone').value = settings.phone || '';
            document.getElementById('setAddress').value = settings.address || '';
        } catch (err) {
            console.error("Error loading settings:", err);
        }
    }
});