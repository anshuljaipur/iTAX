/**
 * ============================================================================
 * CA Pro Tax Suite - Core Tax Computation Engine (Classic CA Tabular Format)
 * ============================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
    const compView = document.getElementById('view-computation');
    let currentClient = null;
    let currentFY = null;
    let taxRules = null;
    let computedData = null; // Store for PDF export

    document.addEventListener('viewChanged', async (e) => {
        if (e.detail.view === 'computation') {
            if (currentFY && currentFY !== e.detail.fy) {
                const resultsContainer = document.getElementById('compResults');
                const clientSelect = document.getElementById('compClientSelect');
                if (resultsContainer) resultsContainer.classList.add('hidden');
                if (clientSelect) clientSelect.value = '';
                currentClient = null;
            }
            
            currentFY = e.detail.fy;
            await initializeComputationUI();
            await populateComputationClientDropdown();
        }
    });

    async function loadTaxRules(fy) {
        let rules = await window.DB.Rules.getCachedRule(fy);
        if (rules) return rules.rules;

        try {
            const response = await fetch(`data/tax_rules/${fy}.json`);
            if (!response.ok) throw new Error("Rules file not found for " + fy);
            const data = await response.json();
            await window.DB.Rules.cacheRule(fy, data);
            return data;
        } catch (error) {
            console.error("Failed to load tax rules:", error);
            window.showToast(`Error loading rules for ${fy}. Ensure JSON file exists.`, "danger");
            return null;
        }
    }

    async function initializeComputationUI() {
        if (compView.querySelector('.comp-app-container')) return;

        compView.innerHTML = `
            <div class="comp-app-container">
                <div class="d-flex justify-content-between align-items-center mb-4">
                    <h2 class="fw-bold">Income Tax Computation</h2>
                    <div class="d-flex gap-2">
                        <select id="compClientSelect" class="form-select fw-bold border-primary shadow-sm" style="min-width: 250px;">
                            <option value="">-- Select Client --</option>
                        </select>
                        <button id="btnExportCompPDF" class="btn btn-danger shadow-sm hidden"><i class="fa-solid fa-file-pdf"></i> Export PDF</button>
                    </div>
                </div>

                <div id="compLoader" class="text-center py-5 hidden">
                    <div class="spinner-border text-primary" role="status"></div>
                    <p class="mt-2 text-muted">Generating Computation Statement...</p>
                </div>

                <div id="compResults" class="hidden mt-4">
                    <div class="border rounded bg-white" style="box-shadow: none !important; transform: none !important;">
                        <div class="table-responsive">
                            <table class="table table-bordered table-sm mb-0 align-middle" id="classicComputationTable" style="font-size: 0.9rem;">
                                <!-- Rendered Dynamically -->
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('compClientSelect').addEventListener('change', async (e) => {
            const val = e.target.value;
            const btnPdf = document.getElementById('btnExportCompPDF');
            
            if (val) {
                document.getElementById('compResults').classList.add('hidden');
                btnPdf.classList.add('hidden');
                document.getElementById('compLoader').classList.remove('hidden');
                
                currentClient = await window.DB.Clients.getClientById(parseInt(val));
                taxRules = await loadTaxRules(currentFY);
                
                if (taxRules) {
                    await performTaxComputation();
                    btnPdf.classList.remove('hidden');
                }
                
                document.getElementById('compLoader').classList.add('hidden');
            } else {
                document.getElementById('compResults').classList.add('hidden');
                btnPdf.classList.add('hidden');
            }
        });

        document.getElementById('btnExportCompPDF').addEventListener('click', generateComputationPDF);
    }

    async function populateComputationClientDropdown() {
        const select = document.getElementById('compClientSelect');
        if (!select) return;

        const clients = await window.DB.Clients.getAllClients();
        select.innerHTML = '<option value="">-- Select Client --</option>';
        clients.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = `${c.name} (${c.pan})`;
            select.appendChild(opt);
        });
    }

    /**
     * ========================================================================
     * COMPUTATION LOGIC
     * ========================================================================
     */
    async function performTaxComputation() {
        if (!currentClient || !taxRules) return;

        const allTxs = await window.DB.Transactions.getTransactionsByClientAndFY(currentClient.id, currentFY);
        
        const inc = {
            salary: sumAmounts(allTxs.filter(tx => tx.incomeHead === 'Salary')),
            hp: sumAmounts(allTxs.filter(tx => tx.incomeHead === 'HouseProperty')),
            b_44ad: sumAmounts(allTxs.filter(tx => tx.incomeHead === 'Business_44AD')),
            b_speculation: sumAmounts(allTxs.filter(tx => tx.incomeHead === 'Business_Speculation')),
            b_normal: sumAmounts(allTxs.filter(tx => tx.incomeHead === 'Business_Normal')),
            stcg: sumAmounts(allTxs.filter(tx => tx.incomeHead === 'STCG')),
            ltcg: sumAmounts(allTxs.filter(tx => tx.incomeHead === 'LTCG')),
            os_interest: sumAmounts(allTxs.filter(tx => tx.incomeHead === 'OS_Interest')),
            os_dividend: sumAmounts(allTxs.filter(tx => tx.incomeHead === 'OS_Dividend')),
            os_normal: sumAmounts(allTxs.filter(tx => tx.incomeHead === 'OS_Normal'))
        };
        
        let deductions = sumAmounts(allTxs.filter(tx => tx.incomeHead === 'Deductions'));
        let tds = sumAmounts(allTxs.filter(tx => tx.incomeHead === 'TDS'));

        let salaryStdDed = inc.salary > taxRules.standardDeduction ? taxRules.standardDeduction : inc.salary;
        
        // --- OLD REGIME MATH ---
        let oldNetSal = inc.salary > 0 ? inc.salary - salaryStdDed : 0;
        let oldGti = oldNetSal + inc.hp + inc.b_44ad + inc.b_speculation + inc.b_normal + inc.stcg + inc.ltcg + inc.os_interest + inc.os_dividend + inc.os_normal;
        let oldTotalInc = Math.max(0, oldGti - deductions);
        let oldTax = calculateTaxFromSlabs(oldTotalInc, determineOldSlab(currentClient.age, taxRules.oldRegime));
        let oldRebate = calculateRebate(oldTotalInc, oldTax, taxRules.oldRegime.rebate87A);
        let oldPostRebate = oldTax - oldRebate;
        let oldCess = oldPostRebate * taxRules.cessRate; 
        let oldNetTax = Math.round(oldPostRebate + oldCess);
        let oldPayable = oldNetTax - tds;

        // --- NEW REGIME MATH ---
        let newNetSal = inc.salary > 0 ? inc.salary - salaryStdDed : 0;
        let newGti = newNetSal + inc.hp + inc.b_44ad + inc.b_speculation + inc.b_normal + inc.stcg + inc.ltcg + inc.os_interest + inc.os_dividend + inc.os_normal; 
        let newTotalInc = newGti; 
        let newTax = calculateTaxFromSlabs(newTotalInc, taxRules.newRegime.slabs);
        let newRebate = calculateRebate(newTotalInc, newTax, taxRules.newRegime.rebate87A);
        let newPostRebate = newTax - newRebate;
        let newCess = newPostRebate * taxRules.cessRate;
        let newNetTax = Math.round(newPostRebate + newCess);
        let newPayable = newNetTax - tds;

        computedData = { inc, salaryStdDed, deductions, tds, oldGti, oldTotalInc, oldTax, oldRebate, oldCess, oldNetTax, oldPayable, newGti, newTotalInc, newTax, newRebate, newCess, newNetTax, newPayable };

        renderClassicTable();
        document.getElementById('compResults').classList.remove('hidden');
    }

    /**
     * ========================================================================
     * CLASSIC CA TABLE RENDERER (UI)
     * ========================================================================
     */
    function renderClassicTable() {
        const table = document.getElementById('classicComputationTable');
        const fyParts = currentFY.replace('FY', '').split('_'); 
        const ayStr = `${parseInt(fyParts[0]) + 1}-${(parseInt(fyParts[1]) + 1).toString().padStart(2, '0')}`;
        const f = (amt) => amt.toLocaleString('en-IN', {minimumFractionDigits: 2});

        table.innerHTML = `
            <thead class="table-light">
                <tr>
                    <th colspan="3" class="text-center fs-5 py-3">INCOME TAX STATEMENT FOR FY 20${fyParts[0]}-20${fyParts[1]} (ASSESSMENT YEAR 20${ayStr})</th>
                </tr>
                <tr>
                    <td colspan="2"><b>Name:</b> ${currentClient.name}</td>
                    <td><b>PAN:</b> ${currentClient.pan}</td>
                </tr>
                <tr>
                    <td colspan="2"><b>Status:</b> ${currentClient.status}</td>
                    <td><b>Age/DOB:</b> ${currentClient.age} (${currentClient.dob})</td>
                </tr>
                <tr class="bg-secondary text-white">
                    <th width="60%">PARTICULARS</th>
                    <th width="20%" class="text-end">OLD REGIME (RS.)</th>
                    <th width="20%" class="text-end">NEW REGIME (115BAC) (RS.)</th>
                </tr>
            </thead>
            <tbody>
                <!-- SALARY -->
                <tr class="table-light"><td colspan="3" class="fw-bold">I. Income from Salary (Sec 15-17)</td></tr>
                <tr><td class="ps-4">Gross Salary</td><td class="text-end">${f(computedData.inc.salary)}</td><td class="text-end">${f(computedData.inc.salary)}</td></tr>
                <tr><td class="ps-4">Less: Standard Deduction u/s 16(ia)</td><td class="text-end text-danger">-${f(computedData.salaryStdDed)}</td><td class="text-end text-danger">-${f(computedData.salaryStdDed)}</td></tr>
                
                <!-- HOUSE PROPERTY -->
                <tr class="table-light"><td colspan="3" class="fw-bold">II. Income from House Property (Sec 22-27)</td></tr>
                <tr><td class="ps-4">Net House Property Rental Income</td><td class="text-end">${f(computedData.inc.hp)}</td><td class="text-end">${f(computedData.inc.hp)}</td></tr>
                
                <!-- BUSINESS -->
                <tr class="table-light"><td colspan="3" class="fw-bold">III. Profits & Gains of Business or Profession (Sec 28-44D)</td></tr>
                <tr><td class="ps-4">Retail Business - Presumptive (Sec 44AD)</td><td class="text-end">${f(computedData.inc.b_44ad)}</td><td class="text-end">${f(computedData.inc.b_44ad)}</td></tr>
                <tr><td class="ps-4">Intraday / Speculation Share Trading (Sec 43(5))</td><td class="text-end">${f(computedData.inc.b_speculation)}</td><td class="text-end">${f(computedData.inc.b_speculation)}</td></tr>
                <tr><td class="ps-4">F&O Trading / Regular Business or Profession</td><td class="text-end">${f(computedData.inc.b_normal)}</td><td class="text-end">${f(computedData.inc.b_normal)}</td></tr>

                <!-- CAPITAL GAINS -->
                <tr class="table-light"><td colspan="3" class="fw-bold">IV. Capital Gains (Sec 45)</td></tr>
                <tr><td class="ps-4">Short-Term Capital Gains (STCG u/s 111A / Normal)</td><td class="text-end">${f(computedData.inc.stcg)}</td><td class="text-end">${f(computedData.inc.stcg)}</td></tr>
                <tr><td class="ps-4">Long-Term Capital Gains (LTCG u/s 112 / 112A)</td><td class="text-end">${f(computedData.inc.ltcg)}</td><td class="text-end">${f(computedData.inc.ltcg)}</td></tr>

                <!-- OTHER SOURCES -->
                <tr class="table-light"><td colspan="3" class="fw-bold">V. Income from Other Sources (Sec 56-59)</td></tr>
                <tr><td class="ps-4">Bank Deposit Interest (Savings / FD u/s 56(2)(i))</td><td class="text-end">${f(computedData.inc.os_interest)}</td><td class="text-end">${f(computedData.inc.os_interest)}</td></tr>
                <tr><td class="ps-4">Dividend Income from Shares</td><td class="text-end">${f(computedData.inc.os_dividend)}</td><td class="text-end">${f(computedData.inc.os_dividend)}</td></tr>
                <tr><td class="ps-4">Other Miscellaneous Income</td><td class="text-end">${f(computedData.inc.os_normal)}</td><td class="text-end">${f(computedData.inc.os_normal)}</td></tr>

                <!-- GROSS TOTAL INCOME -->
                <tr class="bg-light fw-bold border-top border-2 border-dark">
                    <td>Gross Total Income (I + II + III + IV + V)</td>
                    <td class="text-end text-primary">${f(computedData.oldGti)}</td>
                    <td class="text-end text-primary">${f(computedData.newGti)}</td>
                </tr>

                <!-- DEDUCTIONS -->
                <tr class="table-light"><td colspan="3" class="fw-bold">VI. Deductions under Chapter VI-A (Sec 80C to 80U)</td></tr>
                <tr><td class="ps-4">Total Allowed Deductions</td><td class="text-end text-danger">-${f(computedData.deductions)}</td><td class="text-end text-muted">NA</td></tr>

                <!-- TOTAL INCOME -->
                <tr class="bg-light fw-bold border-top border-2 border-dark">
                    <td>Total Taxable Income (Rounded Off)</td>
                    <td class="text-end text-success">${f(computedData.oldTotalInc)}</td>
                    <td class="text-end text-success">${f(computedData.newTotalInc)}</td>
                </tr>

                <!-- TAX COMPUTATION -->
                <tr class="table-light"><td colspan="3" class="fw-bold">VII. Tax Computation</td></tr>
                <tr><td class="ps-4">Tax on Total Income</td><td class="text-end">${f(computedData.oldTax)}</td><td class="text-end">${f(computedData.newTax)}</td></tr>
                <tr><td class="ps-4">Less: Rebate u/s 87A</td><td class="text-end text-danger">-${f(computedData.oldRebate)}</td><td class="text-end text-danger">-${f(computedData.newRebate)}</td></tr>
                <tr><td class="ps-4">Add: Health & Education Cess @ 4%</td><td class="text-end">${f(computedData.oldCess)}</td><td class="text-end">${f(computedData.newCess)}</td></tr>
                
                <tr class="bg-light fw-bold">
                    <td class="ps-4">Total Tax Liability</td>
                    <td class="text-end">${f(computedData.oldNetTax)}</td>
                    <td class="text-end">${f(computedData.newNetTax)}</td>
                </tr>
                <tr><td class="ps-4">Less: TDS / Advance Tax Paid</td><td class="text-end text-danger">-${f(computedData.tds)}</td><td class="text-end text-danger">-${f(computedData.tds)}</td></tr>

                <!-- NET TAX PAYABLE -->
                <tr class="bg-dark text-white fw-bold fs-6">
                    <td>Net Tax Payable / (Refundable)</td>
                    <td class="text-end ${computedData.oldPayable < 0 ? 'text-info' : 'text-warning'}">${f(computedData.oldPayable)}</td>
                    <td class="text-end ${computedData.newPayable < 0 ? 'text-info' : 'text-warning'}">${f(computedData.newPayable)}</td>
                </tr>
            </tbody>
        `;
    }

    /**
     * ========================================================================
     * PDF EXPORT (Bypassed Array Generation)
     * ========================================================================
     */
    async function generateComputationPDF() {
        try {
            const jsPDF = window.jspdf.jsPDF;
            const doc = new jsPDF('p', 'pt', 'a4');

            const settings = await window.DB.Settings.getSettings();
            const firmName = settings.firmName || "CA PRO TAX FIRM";

            const fyParts = currentFY.replace('FY', '').split('_');
            const ayStr = `${parseInt(fyParts[0]) + 1}-${(parseInt(fyParts[1]) + 1).toString().padStart(2, '0')}`;
            const safeName = currentClient.name.replace(/[^a-z0-9]/gi, '_').toUpperCase();
            
            const pan = currentClient.pan || "XXXXXXXXXX";
            const maskedPan = pan.length >= 6 ? pan.substring(0, pan.length - 6) + "******" : "******";
            const fileName = `${safeName}_${maskedPan}_AY-${ayStr}_Computation.pdf`;

            // Branding Elements
            doc.setFontSize(16);
            doc.setFont("helvetica", "bold");
            doc.text(firmName.toUpperCase(), 40, 50);
            
            doc.setFontSize(11);
            doc.text("INCOME TAX COMPUTATION STATEMENT", 40, 70);
            
            doc.setFontSize(10);
            doc.setFont("helvetica", "normal");
            doc.text(`Financial Year: 20${fyParts[0]}-20${fyParts[1]}   |   Assessment Year: 20${ayStr}`, 40, 85);
            
            doc.text(`Name: ${currentClient.name}`, 40, 110);
            doc.text(`PAN: ${currentClient.pan}`, 350, 110);
            doc.text(`Status: ${currentClient.status}`, 40, 125);
            doc.text(`Age/DOB: ${currentClient.age} (${currentClient.dob || 'N/A'})`, 350, 125);

            const f = (amt) => amt.toLocaleString('en-IN', {minimumFractionDigits: 2});
            const c = computedData;

            const tableBody = [
                // SALARY
                [{ content: 'I. Income from Salary (Sec 15-17)', colSpan: 3, styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }],
                ['Gross Salary', f(c.inc.salary), f(c.inc.salary)],
                ['Less: Standard Deduction u/s 16(ia)', `-${f(c.salaryStdDed)}`, `-${f(c.salaryStdDed)}`],
                
                // HOUSE PROPERTY
                [{ content: 'II. Income from House Property (Sec 22-27)', colSpan: 3, styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }],
                ['Net House Property Rental Income', f(c.inc.hp), f(c.inc.hp)],
                
                // BUSINESS
                [{ content: 'III. Profits & Gains of Business or Profession (Sec 28-44D)', colSpan: 3, styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }],
                ['Retail Business - Presumptive (Sec 44AD)', f(c.inc.b_44ad), f(c.inc.b_44ad)],
                ['Intraday / Speculation Share Trading (Sec 43(5))', f(c.inc.b_speculation), f(c.inc.b_speculation)],
                ['F&O Trading / Regular Business or Profession', f(c.inc.b_normal), f(c.inc.b_normal)],

                // CAPITAL GAINS
                [{ content: 'IV. Capital Gains (Sec 45)', colSpan: 3, styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }],
                ['Short-Term Capital Gains (STCG u/s 111A / Normal)', f(c.inc.stcg), f(c.inc.stcg)],
                ['Long-Term Capital Gains (LTCG u/s 112 / 112A)', f(c.inc.ltcg), f(c.inc.ltcg)],

                // OTHER SOURCES
                [{ content: 'V. Income from Other Sources (Sec 56-59)', colSpan: 3, styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }],
                ['Bank Deposit Interest (Savings / FD u/s 56(2)(i))', f(c.inc.os_interest), f(c.inc.os_interest)],
                ['Dividend Income from Shares', f(c.inc.os_dividend), f(c.inc.os_dividend)],
                ['Other Miscellaneous Income', f(c.inc.os_normal), f(c.inc.os_normal)],

                // GTI
                [{ content: 'Gross Total Income (I + II + III + IV + V)', styles: { fontStyle: 'bold' } }, { content: f(c.oldGti), styles: { fontStyle: 'bold' } }, { content: f(c.newGti), styles: { fontStyle: 'bold' } }],

                // DEDUCTIONS
                [{ content: 'VI. Deductions under Chapter VI-A (Sec 80C to 80U)', colSpan: 3, styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }],
                ['Total Allowed Deductions', `-${f(c.deductions)}`, 'NA'],

                // TOTAL INCOME
                [{ content: 'Total Taxable Income (Rounded Off)', styles: { fontStyle: 'bold' } }, { content: f(c.oldTotalInc), styles: { fontStyle: 'bold', textColor: [0, 100, 0] } }, { content: f(c.newTotalInc), styles: { fontStyle: 'bold', textColor: [0, 100, 0] } }],

                // TAX COMPUTATION
                [{ content: 'VII. Tax Computation', colSpan: 3, styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }],
                ['Tax on Total Income', f(c.oldTax), f(c.newTax)],
                ['Less: Rebate u/s 87A', `-${f(c.oldRebate)}`, `-${f(c.newRebate)}`],
                ['Add: Health & Education Cess @ 4%', f(c.oldCess), f(c.newCess)],

                // LIABILITY
                [{ content: 'Total Tax Liability', styles: { fontStyle: 'bold' } }, { content: f(c.oldNetTax), styles: { fontStyle: 'bold' } }, { content: f(c.newNetTax), styles: { fontStyle: 'bold' } }],
                ['Less: TDS / Advance Tax Paid', `-${f(c.tds)}`, `-${f(c.tds)}`],

                // FINAL PAYABLE
                [{ content: 'Net Tax Payable / (Refundable)', styles: { fontStyle: 'bold', fillColor: [40, 50, 60], textColor: [255,255,255] } }, { content: f(c.oldPayable), styles: { fontStyle: 'bold', fillColor: [40, 50, 60], textColor: [255,255,255] } }, { content: f(c.newPayable), styles: { fontStyle: 'bold', fillColor: [40, 50, 60], textColor: [255,255,255] } }]
            ];

            doc.autoTable({
                startY: 145,
                head: [['PARTICULARS', 'OLD REGIME (RS.)', 'NEW REGIME (115BAC) (RS.)']],
                body: tableBody,
                theme: 'grid',
                styles: { fontSize: 8.5, cellPadding: 4.5, lineColor: [200, 200, 200], lineWidth: 0.5 },
                headStyles: { fillColor: [220, 220, 220], textColor: [0, 0, 0], fontStyle: 'bold' },
                columnStyles: {
                    0: { halign: 'left', cellWidth: 'auto' },
                    1: { halign: 'right', cellWidth: 110 },
                    2: { halign: 'right', cellWidth: 110 }
                }
            });

            doc.save(fileName);
            window.showToast("Computation PDF Generated Successfully!", "success");

        } catch (error) {
            console.error("PDF Generation Error:", error);
            window.showToast("Critical Error generating PDF. Check Console.", "danger");
        }
    }

    /**
     * ========================================================================
     * MATH UTILS
     * ========================================================================
     */
    function sumAmounts(arr) { return arr.reduce((sum, item) => sum + item.amount, 0); }

    function determineOldSlab(age, rules) {
        if (age >= 80) return rules.slabs_super_senior;
        if (age >= 60) return rules.slabs_senior;
        return rules.slabs_individual;
    }

    function calculateTaxFromSlabs(income, slabs) {
        let tax = 0;
        for (let slab of slabs) {
            if (income > slab.min) {
                let taxableInThisSlab = Math.min(income, slab.max) - slab.min;
                tax += taxableInThisSlab * slab.rate;
            }
        }
        return tax;
    }

    function calculateRebate(income, tax, rebateRules) {
        if (income <= rebateRules.incomeLimit) { return Math.min(tax, rebateRules.maxRebate); }
        if (rebateRules.marginalReliefApplicable && income > rebateRules.incomeLimit) {
            let incomeExceedingLimit = income - rebateRules.incomeLimit;
            if (tax > incomeExceedingLimit) { return tax - incomeExceedingLimit; }
        }
        return 0;
    }
});