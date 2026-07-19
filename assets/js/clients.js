/**
 * ============================================================================
 * CA Pro Tax Suite - Client Management Module (Firebase Ready)
 * ============================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const clientForm = document.getElementById('clientForm');
    const clientTableBody = document.getElementById('clientTableBody');
    const btnCancelEdit = document.getElementById('btnCancelEdit');

    // --- Global Event Listener for Tab Navigation ---
    document.addEventListener('viewChanged', (e) => {
        if (e.detail.view === 'clients') {
            refreshClientTable();
        }
    });

    // --- Dynamic Age Calculator ---
    const dobInput = document.getElementById('clientDob');
    if(dobInput) {
        dobInput.addEventListener('change', (e) => {
            if (!e.target.value) return;
            const dob = new Date(e.target.value);
            const diffMs = Date.now() - dob.getTime();
            const ageDt = new Date(diffMs);
            document.getElementById('clientAge').value = Math.abs(ageDt.getUTCFullYear() - 1970);
        });
    }

    // --- Form Submit (Handles both New Saves and Edits) ---
    if (clientForm) {
        clientForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            // 1. Gather data from your index.html form
            const clientData = {
                id: document.getElementById('clientId').value ? Number(document.getElementById('clientId').value) : null,
                pan: document.getElementById('clientPan').value.toUpperCase(),
                aadhaar: document.getElementById('clientAadhaar').value,
                status: document.getElementById('clientStatus').value,
                name: document.getElementById('clientName').value.toUpperCase(),
                fatherName: document.getElementById('clientFatherName').value,
                dob: document.getElementById('clientDob').value,
                gender: document.getElementById('clientGender').value,
                resStatus: document.getElementById('clientResStatus').value,
                mobile: document.getElementById('clientMobile').value,
                email: document.getElementById('clientEmail').value,
                ifsc: document.getElementById('clientIfsc').value.toUpperCase(),
                address: document.getElementById('clientAddress').value
            };

            try {
                // 2. STRICT DUPLICATE PAN VALIDATION (For New Clients Only)
                if (!clientData.id) {
                    const existingClient = await window.DB.Clients.getClientByPan(clientData.pan);
                    if (existingClient) {
                        window.showToast(`Error: A client with PAN ${clientData.pan} already exists!`, 'danger');
                        return; // 🛑 Stops the save completely
                    }
                }

                // 3. Push to Firebase via our bridge function in database.js
                await window.DB.Clients.saveClient(clientData);
                
                window.showToast('Client data saved successfully!', 'success');
                clientForm.reset();
                document.getElementById('clientId').value = ''; // clear hidden id

                // 4. Force UI back to the Directory Tab
                const listTabEl = document.getElementById('client-list-tab');
                if (listTabEl) {
                    const listTab = new bootstrap.Tab(listTabEl);
                    listTab.show();
                }

                // 5. Pull the fresh data from the cloud and redraw the table!
                await refreshClientTable();

            } catch (error) {
                console.error("Error saving client:", error);
                window.showToast('Error saving client. Check console.', 'danger');
            }
        });
    }

    // --- Core Table Rendering Logic ---
    async function refreshClientTable() {
        if (!clientTableBody) return;
        
        try {
            // Fetch directly from Firestore
            const clients = await window.DB.Clients.getAllClients();
            console.log("Firebase Data Pulled:", clients); // <-- Debugging line
            
            clientTableBody.innerHTML = ''; // Clear old rows

            if (!clients || clients.length === 0) {
                clientTableBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">No clients found. Add a new client.</td></tr>';
                
                // Update dashboard counter
                const dashCounter = document.getElementById('dash-total-clients');
                if (dashCounter) dashCounter.innerText = '0';
                return;
            }

            // Update dashboard counter
            const dashCounter = document.getElementById('dash-total-clients');
            if (dashCounter) dashCounter.innerText = clients.length;

            // Draw new rows
            clients.forEach(client => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td class="fw-bold text-secondary">${client.id}</td>
                    <td class="text-uppercase fw-bold text-primary">${client.pan}</td>
                    <td>${client.name}</td>
                    <td><span class="badge bg-primary">${client.status}</span></td>
                    <td>${client.mobile || '-'}</td>
                    <td>
                        <button class="btn btn-sm btn-outline-info me-1" onclick="window.editClient(${client.id})" title="Edit Client"><i class="fa-solid fa-pen"></i></button>
                        <button class="btn btn-sm btn-outline-danger" onclick="window.deleteClient(${client.id})" title="Delete Client"><i class="fa-solid fa-trash"></i></button>
                    </td>
                `;
                clientTableBody.appendChild(tr);
            });
        } catch (error) {
            console.error("Error fetching clients for table:", error);
            clientTableBody.innerHTML = '<tr><td colspan="6" class="text-center text-danger py-4"><i class="fa-solid fa-triangle-exclamation"></i> Error loading data from cloud.</td></tr>';
        }
    }

    // --- Global Edit Function ---
    window.editClient = async (id) => {
        try {
            const client = await window.DB.Clients.getClientById(id);
            if (!client) return;

            document.getElementById('clientId').value = client.id;
            document.getElementById('clientPan').value = client.pan || '';
            document.getElementById('clientAadhaar').value = client.aadhaar || '';
            document.getElementById('clientStatus').value = client.status || 'Individual';
            document.getElementById('clientName').value = client.name || '';
            document.getElementById('clientFatherName').value = client.fatherName || '';
            document.getElementById('clientDob').value = client.dob || '';
            
            if (client.dob) {
                const event = new Event('change');
                document.getElementById('clientDob').dispatchEvent(event);
            }

            document.getElementById('clientGender').value = client.gender || 'Male';
            document.getElementById('clientResStatus').value = client.resStatus || 'ROR';
            document.getElementById('clientMobile').value = client.mobile || '';
            document.getElementById('clientEmail').value = client.email || '';
            document.getElementById('clientIfsc').value = client.ifsc || '';
            document.getElementById('clientAddress').value = client.address || '';

            const addTabEl = document.getElementById('client-add-tab');
            if (addTabEl) {
                const addTab = new bootstrap.Tab(addTabEl);
                addTab.show();
            }

        } catch (error) {
            console.error("Error loading client details:", error);
            window.showToast("Could not load client data for editing.", "danger");
        }
    };

    // --- Global Delete Function ---
    window.deleteClient = async (id) => {
        if(confirm('Are you sure you want to delete this client? This will permanently remove their profile and all associated transactions.')) {
            try {
                await window.DB.Clients.deleteClient(id);
                window.showToast('Client deleted successfully.', 'info');
                refreshClientTable(); 
            } catch (error) {
                console.error("Error deleting client:", error);
                window.showToast('Error deleting client.', 'danger');
            }
        }
    };

    // --- Cancel Edit Button ---
    if (btnCancelEdit) {
        btnCancelEdit.addEventListener('click', () => {
            if (clientForm) clientForm.reset();
            document.getElementById('clientId').value = '';
            
            const listTabEl = document.getElementById('client-list-tab');
            if (listTabEl) {
                const listTab = new bootstrap.Tab(listTabEl);
                listTab.show();
            }
        });
    }
});
