/**
 * ============================================================================
 * CA Pro Tax Suite - Client Master Module
 * ============================================================================
 * Purpose: Handles client onboarding, list rendering, validation, and CRUD.
 * ============================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
    const clientForm = document.getElementById('clientForm');
    const clientTableBody = document.getElementById('clientTableBody');
    const clientDob = document.getElementById('clientDob');
    const clientAge = document.getElementById('clientAge');
    
    let currentEditId = null;

    // Listen for SPA view change to trigger data load
    document.addEventListener('viewChanged', (e) => {
        if (e.detail.view === 'clients') {
            loadClientsTable();
        }
    });

    /**
     * ========================================================================
     * EVENT LISTENERS & VALIDATION
     * ========================================================================
     */

    // Auto-calculate age based on DOB
    if (clientDob) {
        clientDob.addEventListener('change', function() {
            if (this.value) {
                const birthDate = new Date(this.value);
                const today = new Date();
                let age = today.getFullYear() - birthDate.getFullYear();
                const m = today.getMonth() - birthDate.getMonth();
                if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                    age--;
                }
                clientAge.value = age > 0 ? age : 0;
            } else {
                clientAge.value = '';
            }
        });
    }

    // Handle Form Submission
    if (clientForm) {
        clientForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            // Basic PAN Format Validation (Format: 5 letters, 4 numbers, 1 letter)
            const pan = document.getElementById('clientPan').value.toUpperCase();
            const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
            if (!panRegex.test(pan)) {
                window.showToast("Invalid PAN Format.", "danger");
                return;
            }

            // Construct Client Object Safely (Removed the problematic ID line)
            const clientData = {
                clientId: document.getElementById('clientId').value,
                pan: pan,
                aadhaar: document.getElementById('clientAadhaar').value,
                status: document.getElementById('clientStatus').value,
                name: document.getElementById('clientName').value,
                fatherName: document.getElementById('clientFatherName').value,
                dob: document.getElementById('clientDob').value,
                age: document.getElementById('clientAge').value,
                gender: document.getElementById('clientGender').value,
                resStatus: document.getElementById('clientResStatus').value,
                mobile: document.getElementById('clientMobile').value,
                email: document.getElementById('clientEmail').value,
                ifsc: document.getElementById('clientIfsc').value.toUpperCase(),
                address: document.getElementById('clientAddress').value,
            };

            // ONLY attach the ID if we are editing an existing client
            if (currentEditId) {
                clientData.id = currentEditId;
            }

            try {
                // Check for duplicate PAN (only if new client)
                if (!currentEditId) {
                    const existing = await window.DB.Clients.getClientByPan(pan);
                    if (existing) {
                        window.showToast("PAN already exists in the database!", "warning");
                        return;
                    }
                }

                await window.DB.Clients.saveClient(clientData);
                window.showToast("Client saved successfully!", "success");
                
                // Reset form and switch tab
                clientForm.reset();
                currentEditId = null;
                document.getElementById('clientId').value = '';
                
                const listTab = new bootstrap.Tab(document.getElementById('client-list-tab'));
                listTab.show();
                
                loadClientsTable();
            } catch (error) {
                console.error(error);
                window.showToast("Error saving client.", "danger");
            }
        });
    }

    // Handle Cancel Edit Button
    const btnCancelEdit = document.getElementById('btnCancelEdit');
    if (btnCancelEdit) {
        btnCancelEdit.addEventListener('click', () => {
            // Clear the form and reset the edit ID
            clientForm.reset();
            currentEditId = null;
            document.getElementById('clientId').value = '';
            
            // Switch back to the Client Directory tab
            const listTab = new bootstrap.Tab(document.getElementById('client-list-tab'));
            listTab.show();
        });
    }
    
    /**
     * ========================================================================
     * DATA RENDERING
     * ========================================================================
     */
    async function loadClientsTable() {
        if (!clientTableBody) return;
        
        try {
            const clients = await window.DB.Clients.getAllClients();
            clientTableBody.innerHTML = '';

            if (clients.length === 0) {
                clientTableBody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">No clients found. Add a new client.</td></tr>`;
                return;
            }

            clients.forEach(client => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td class="fw-bold text-primary">${client.clientId}</td>
                    <td class="text-uppercase fw-bold">${client.pan}</td>
                    <td>${client.name}</td>
                    <td><span class="badge bg-secondary">${client.status}</span></td>
                    <td>${client.mobile || 'N/A'}</td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary btn-edit" data-id="${client.id}"><i class="fa-solid fa-pen"></i></button>
                        <button class="btn btn-sm btn-outline-danger btn-delete" data-id="${client.id}"><i class="fa-solid fa-trash"></i></button>
                    </td>
                `;
                clientTableBody.appendChild(tr);
            });

            attachTableEvents();
        } catch (error) {
            console.error("Failed to load clients:", error);
        }
    }

    function attachTableEvents() {
        // Edit Buttons
        document.querySelectorAll('.btn-edit').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = parseInt(e.currentTarget.getAttribute('data-id'));
                const client = await window.DB.Clients.getClientById(id);
                if (client) {
                    populateFormForEdit(client);
                }
            });
        });

        // Delete Buttons
        document.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = parseInt(e.currentTarget.getAttribute('data-id'));
                if (confirm("Are you sure you want to delete this client? This will delete all associated transactions and computations.")) {
                    await window.DB.Clients.deleteClient(id);
                    window.showToast("Client deleted.", "success");
                    loadClientsTable();
                }
            });
        });
    }

    function populateFormForEdit(client) {
        currentEditId = client.id;
        document.getElementById('clientId').value = client.clientId || '';
        document.getElementById('clientPan').value = client.pan || '';
        document.getElementById('clientAadhaar').value = client.aadhaar || '';
        document.getElementById('clientStatus').value = client.status || 'Individual';
        document.getElementById('clientName').value = client.name || '';
        document.getElementById('clientFatherName').value = client.fatherName || '';
        document.getElementById('clientDob').value = client.dob || '';
        document.getElementById('clientAge').value = client.age || '';
        document.getElementById('clientGender').value = client.gender || 'Male';
        document.getElementById('clientResStatus').value = client.resStatus || 'ROR';
        document.getElementById('clientMobile').value = client.mobile || '';
        document.getElementById('clientEmail').value = client.email || '';
        document.getElementById('clientIfsc').value = client.ifsc || '';
        document.getElementById('clientAddress').value = client.address || '';

        // Switch to add/edit tab
        const addTab = new bootstrap.Tab(document.getElementById('client-add-tab'));
        addTab.show();
    }
});