/**
 * ============================================================================
 * CA Pro Tax Suite - Transaction Engine
 * ============================================================================
 * Purpose: Dynamic DOM generation and logic for voucher/income/expense entry.
 * Includes smart FY auto-routing, extended heads, and full Edit/Update support.
 * ============================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
    const txView = document.getElementById('view-transactions');
    let currentActiveClientForTx = null;
    let currentEditTxId = null; // Tracks if we are editing an existing transaction

    // Listen for SPA view change
    document.addEventListener('viewChanged', async (e) => {
        if (e.detail.view === 'transactions') {
            await initializeTransactionUI();
            await populateClientDropdown();
        }
    });

    /**
     * ========================================================================
     * UI GENERATOR
     * ========================================================================
     */
    async function initializeTransactionUI() {
        if (txView.querySelector('.tx-app-container')) return;

        txView.innerHTML = `
            <div class="tx-app-container">
                <div class="d-flex justify-content-between align-items-center mb-4">
                    <h2 class="fw-bold">Transaction Entry</h2>
                    <div class="d-flex gap-2">
                        <select id="txClientSelect" class="form-select fw-bold border-primary shadow-sm" style="min-width: 250px;">
                            <option value="">-- Select Client First --</option>
                        </select>
                        <button class="btn btn-primary shadow-sm" id="btnShowTxForm" disabled><i class="fa-solid fa-plus"></i> New Entry</button>
                    </div>
                </div>

                <!-- Transaction Form (Hidden by default) -->
                <div class="card glass-panel p-4 mb-4 hidden" id="txFormCard">
                    <h5 class="text-primary border-bottom pb-2 mb-3" id="txFormTitle">Add New Transaction</h5>
                    <form id="txForm">
                        <div class="row g-3">
                            <div class="col-md-2">
                                <label class="form-label">Date *</label>
                                <input type="date" class="form-control" id="txDate" required>
                            </div>
                            <div class="col-md-2">
                                <label class="form-label">Voucher No</label>
                                <input type="text" class="form-control" id="txVoucher" placeholder="Auto / Manual">
                            </div>
                            <div class="col-md-3">
                                <label class="form-label">Income Head *</label>
                                <select class="form-select" id="txHead" required>
                                    <optgroup label="Income from Salary">
                                        <option value="Salary">Salary Income (Sec 15-17)</option>
                                    </optgroup>
                                    <optgroup label="Income from House Property">
                                        <option value="HouseProperty">House Property Rental Income (Sec 22-27)</option>
                                    </optgroup>
                                    <optgroup label="Profits & Gains of Business/Profession">
                                        <option value="Business_44AD">Retail Business - Presumptive (Sec 44AD)</option>
                                        <option value="Business_Speculation">Intraday / Speculation Trading (Sec 43(5))</option>
                                        <option value="Business_Normal">F&O Trading / Regular Profession (Sec 28-44D)</option>
                                    </optgroup>
                                    <optgroup label="Income from Capital Gains">
                                        <option value="STCG">Short-Term Capital Gain - Shares/Other (Sec 111A/45)</option>
                                        <option value="LTCG">Long-Term Capital Gain - Shares/Other (Sec 112/112A)</option>
                                    </optgroup>
                                    <optgroup label="Income from Other Sources">
                                        <option value="OS_Interest">Bank Deposit Interest - Savings/FD (Sec 56(2)(i))</option>
                                        <option value="OS_Dividend">Dividend Income from Shares (Sec 56(2)(i))</option>
                                        <option value="OS_Normal">Other Miscellaneous Income (Sec 56-59)</option>
                                        <option value="Exempt">Exempt Income / Agricultural (Sec 10)</option>
                                    </optgroup>
                                    <optgroup label="Tax Adjustments">
                                        <option value="Deductions">Chapter VI-A Deductions (Sec 80C to 80U)</option>
                                        <option value="TDS">TDS / TCS / Advance Tax (Sec 192-206C)</option>
                                    </optgroup>
                                </select>
                            </div>
                            <div class="col-md-3">
                                <label class="form-label">Category *</label>
                                <input type="text" class="form-control" id="txCategory" placeholder="e.g., SBI FD Interest, 80C, Rent" required>
                            </div>
                            <div class="col-md-2">
                                <label class="form-label">Amount (₹) *</label>
                                <input type="number" step="0.01" class="form-control" id="txAmount" required>
                            </div>
                            <div class="col-md-12">
                                <label class="form-label">Description / Remarks</label>
                                <input type="text" class="form-control" id="txDescription" placeholder="Narration...">
                            </div>
                            <div class="col-12 text-end">
                                <button type="button" class="btn btn-secondary" id="btnCancelTx">Cancel</button>
                                <button type="submit" class="btn btn-primary"><i class="fa-solid fa-save"></i> Save Entry</button>
                            </div>
                        </div>
                    </form>
                </div>

                <!-- Transactions DataGrid -->
                <div class="card glass-panel p-3">
                    <div class="table-responsive">
                        <table class="table table-hover align-middle table-sm" id="txTable">
                            <thead class="table-light">
                                <tr>
                                    <th>Date</th>
                                    <th>Vch No</th>
                                    <th>Head</th>
                                    <th>Category</th>
                                    <th>Description</th>
                                    <th class="text-end">Amount (₹)</th>
                                    <th class="text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody id="txTableBody">
                                <tr><td colspan="7" class="text-center text-muted py-4">Select a client to view transactions.</td></tr>
                            </tbody>
                            <tfoot id="txTableFoot" class="table-light hidden">
                                <tr>
                                    <td colspan="5" class="text-end fw-bold">Total:</td>
                                    <td class="text-end fw-bold text-primary" id="txTotalAmount">0.00</td>
                                    <td></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            </div>
        `;

        bindUIEvents();
    }

    /**
     * ========================================================================
     * LOGIC & BINDINGS
     * ========================================================================
     */
    async function populateClientDropdown() {
        const select = document.getElementById('txClientSelect');
        if (!select) return;

        const clients = await window.DB.Clients.getAllClients();
        const currentVal = select.value;
        
        select.innerHTML = '<option value="">-- Select Client First --</option>';
        clients.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = `${c.name} (${c.pan})`;
            select.appendChild(opt);
        });

        if (currentVal && clients.find(c => c.id == currentVal)) {
            select.value = currentVal;
            currentActiveClientForTx = parseInt(currentVal);
            document.getElementById('btnShowTxForm').disabled = false;
            loadTransactionsForClient();
        }
    }

    function bindUIEvents() {
        const select = document.getElementById('txClientSelect');
        const btnNew = document.getElementById('btnShowTxForm');
        const formCard = document.getElementById('txFormCard');
        const btnCancel = document.getElementById('btnCancelTx');
        const txForm = document.getElementById('txForm');
        const txFormTitle = document.getElementById('txFormTitle');

        select.addEventListener('change', (e) => {
            const val = e.target.value;
            if (val) {
                currentActiveClientForTx = parseInt(val);
                btnNew.disabled = false;
                loadTransactionsForClient();
            } else {
                currentActiveClientForTx = null;
                btnNew.disabled = true;
                document.getElementById('txTableBody').innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4">Select a client to view transactions.</td></tr>`;
                document.getElementById('txTableFoot').classList.add('hidden');
                formCard.classList.add('hidden');
            }
        });

        btnNew.addEventListener('click', () => {
            txForm.reset();
            currentEditTxId = null; 
            txFormTitle.innerText = "Add New Transaction";
            formCard.classList.remove('hidden');
        });

        btnCancel.addEventListener('click', () => {
            txForm.reset();
            currentEditTxId = null; 
            formCard.classList.add('hidden');
        });

        txForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            if (!currentActiveClientForTx) {
                window.showToast("No client selected.", "danger");
                return;
            }

            const dateVal = document.getElementById('txDate').value;
            const txDateObj = new Date(dateVal);
            const y = txDateObj.getFullYear();
            const m = txDateObj.getMonth() + 1; 
            
            let calculatedFY = "";
            if (m >= 4) {
                calculatedFY = `FY${y}_${(y + 1).toString().slice(-2)}`;
            } else {
                calculatedFY = `FY${y - 1}_${y.toString().slice(-2)}`;
            }

            const txData = {
                clientId: currentActiveClientForTx,
                fy: calculatedFY,
                date: dateVal,
                voucherNo: document.getElementById('txVoucher').value || `VCH-${Date.now().toString().slice(-6)}`,
                incomeHead: document.getElementById('txHead').value,
                category: document.getElementById('txCategory').value,
                description: document.getElementById('txDescription').value,
                amount: parseFloat(document.getElementById('txAmount').value)
            };

            if (currentEditTxId) {
                txData.id = currentEditTxId;
            }

            try {
                await window.DB.Transactions.saveTransaction(txData);
                
                const globalFySelect = document.getElementById('global-fy-selector');
                if (globalFySelect.value !== calculatedFY) {
                    globalFySelect.value = calculatedFY;
                    const event = new CustomEvent('viewChanged', { detail: { view: 'transactions', fy: calculatedFY } });
                    document.dispatchEvent(event);
                    window.showToast(`Saved and moved to ${calculatedFY.replace('_', '-')}`, "success");
                } else {
                    window.showToast(currentEditTxId ? "Transaction updated." : "Transaction saved.", "success");
                }

                txForm.reset();
                currentEditTxId = null;
                formCard.classList.add('hidden');
                loadTransactionsForClient();
            } catch (err) {
                window.showToast("Error saving transaction.", "danger");
                console.error(err);
            }
        });
    }

    async function loadTransactionsForClient() {
        const tbody = document.getElementById('txTableBody');
        const tfoot = document.getElementById('txTableFoot');
        const totalEl = document.getElementById('txTotalAmount');
        const fy = document.getElementById('global-fy-selector').value;

        if (!currentActiveClientForTx) return;

        try {
            const txs = await window.DB.Transactions.getTransactionsByClientAndFY(currentActiveClientForTx, fy);
            tbody.innerHTML = '';

            if (txs.length === 0) {
                tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4">No transactions found for ${fy.replace('_','-')}</td></tr>`;
                tfoot.classList.add('hidden');
                return;
            }

            let total = 0;
            txs.forEach(tx => {
                total += tx.amount;
                
                let badgeColor = 'bg-secondary';
                if(tx.incomeHead === 'Salary') badgeColor = 'bg-info text-dark';
                if(tx.incomeHead.includes('Business')) badgeColor = 'bg-success';
                if(tx.incomeHead.includes('CG')) badgeColor = 'bg-primary';
                if(tx.incomeHead.includes('OS_')) badgeColor = 'bg-dark';
                if(tx.incomeHead === 'Deductions') badgeColor = 'bg-warning text-dark';
                if(tx.incomeHead === 'TDS') badgeColor = 'bg-danger';

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${new Date(tx.date).toLocaleDateString('en-IN')}</td>
                    <td class="text-muted small">${tx.voucherNo}</td>
                    <td><span class="badge ${badgeColor}">${tx.incomeHead.replace('_', ' ')}</span></td>
                    <td>${tx.category}</td>
                    <td>${tx.description || '-'}</td>
                    <td class="text-end fw-bold">₹ ${tx.amount.toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
                    <td class="text-center" style="min-width: 90px;">
                        <button class="btn btn-sm btn-outline-primary btn-edit-tx me-1" data-id="${tx.id}"><i class="fa-solid fa-pen"></i></button>
                        <button class="btn btn-sm btn-outline-danger btn-delete-tx" data-id="${tx.id}"><i class="fa-solid fa-trash"></i></button>
                    </td>
                `;
                tbody.appendChild(tr);
            });

            totalEl.textContent = `₹ ${total.toLocaleString('en-IN', {minimumFractionDigits: 2})}`;
            tfoot.classList.remove('hidden');

            // Attach Edit Events
            document.querySelectorAll('.btn-edit-tx').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = parseInt(e.currentTarget.getAttribute('data-id'));
                    const txToEdit = txs.find(t => t.id === id);
                    
                    if (txToEdit) {
                        currentEditTxId = txToEdit.id;
                        document.getElementById('txFormTitle').innerText = "Edit Transaction";
                        document.getElementById('txDate').value = txToEdit.date;
                        document.getElementById('txVoucher').value = txToEdit.voucherNo;
                        document.getElementById('txHead').value = txToEdit.incomeHead;
                        document.getElementById('txCategory').value = txToEdit.category;
                        document.getElementById('txAmount').value = txToEdit.amount;
                        document.getElementById('txDescription').value = txToEdit.description || '';
                        document.getElementById('txFormCard').classList.remove('hidden');
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                    }
                });
            });

            // Attach Delete Events
            document.querySelectorAll('.btn-delete-tx').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    if(confirm("Delete this transaction?")) {
                        const id = parseInt(e.currentTarget.getAttribute('data-id'));
                        await window.DB.Transactions.deleteTransaction(id);
                        window.showToast("Transaction deleted.", "info");
                        loadTransactionsForClient();
                    }
                });
            });

        } catch (error) {
            console.error("Error loading transactions", error);
        }
    }
});