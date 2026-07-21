/**
 * ============================================================================
 * CA Pro Tax Suite - Reporting & Export Engine
 * ============================================================================
 * Purpose: Generates Financial Reports, Transaction Registers, and Computations.
 * Handles export to Professional PDF (jsPDF + AutoTable) and Excel (SheetJS).
 * ============================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
    const reportView = document.getElementById('view-reports');

    document.addEventListener('viewChanged', async (e) => {
        if (e.detail.view === 'reports') {
            await initializeReportsUI();
            await populateReportClients();
        }
    });

    /**
     * ========================================================================
     * UI GENERATOR
     * ========================================================================
     */
    async function initializeReportsUI() {
        if (reportView.querySelector('.reports-app-container')) return;

        reportView.innerHTML = `
            <div class="reports-app-container">
                <div class="d-flex justify-content-between align-items-center mb-4">
                    <h2 class="fw-bold">Report Center</h2>
                </div>

                <div class="card glass-panel p-4 mb-4 shadow-sm">
                    <div class="row g-3 align-items-end">
                        <div class="col-md-3">
                            <label class="form-label fw-bold">Report Type</label>
                            <select id="reportType" class="form-select border-primary">
                                <option value="tx_register">Transaction Register</option>
                                <option value="client_ledger">Client Ledger Summary</option>
                            </select>
                        </div>
                        <div class="col-md-4">
                            <label class="form-label fw-bold">Select Client</label>
                            <select id="reportClient" class="form-select">
                                <option value="ALL">-- All Clients --</option>
                            </select>
                        </div>
                        <div class="col-md-5 text-end">
                            <button id="btnGenerateHTML" class="btn btn-primary"><i class="fa-solid fa-eye"></i> View</button>
                            <button id="btnExportPDF" class="btn btn-danger"><i class="fa-solid fa-file-pdf"></i> PDF</button>
                            <button id="btnExportExcel" class="btn btn-success"><i class="fa-solid fa-file-excel"></i> Excel</button>
                        </div>
                    </div>
                </div>

                <div id="reportOutput" class="card glass-panel p-4 shadow-sm hidden">
                    <h4 id="reportTitle" class="text-center fw-bold text-primary mb-4"></h4>
                    <div class="table-responsive">
                        <table class="table table-bordered table-hover" id="reportTable">
                            <thead class="table-light" id="reportTableHead"></thead>
                            <tbody id="reportTableBody"></tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;

        bindReportEvents();
    }

    async function populateReportClients() {
        const select = document.getElementById('reportClient');
        if (!select) return;

        const clients = await window.DB.Clients.getAllClients();
        select.innerHTML = '<option value="ALL">-- All Clients --</option>';
        clients.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = `${c.name} (${c.pan})`;
            select.appendChild(opt);
        });
    }

    function bindReportEvents() {
        document.getElementById('btnGenerateHTML').addEventListener('click', () => generateReport('html'));
        document.getElementById('btnExportPDF').addEventListener('click', () => generateReport('pdf'));
        document.getElementById('btnExportExcel').addEventListener('click', () => generateReport('excel'));
    }

    /**
     * ========================================================================
     * REPORT DATA GENERATION
     * ========================================================================
     */
    async function generateReport(format) {
        const type = document.getElementById('reportType').value;
        const clientId = document.getElementById('reportClient').value;
        const fy = document.getElementById('global-fy-selector').value; // from app.js state
        
        let reportData = [];
        let headers = [];
        let title = "";

        if (type === 'tx_register') {
            title = `Transaction Register (${fy.replace('_', '-')})`;
            headers = ["Date", "Client", "PAN", "Voucher", "Head", "Category", "Amount (₹)"];
            reportData = await getTransactionRegisterData(clientId, fy);
        }

        if (reportData.length === 0) {
            window.showToast("No data found for the selected criteria.", "warning");
            return;
        }

        if (format === 'html') renderHTMLReport(title, headers, reportData);
        if (format === 'pdf') exportToPDF(title, headers, reportData);
        if (format === 'excel') exportToExcel(title, headers, reportData);
    }

    
        // Map client data to transactions
        const dataRows = [];
        for (let tx of txs) {
            const client = await window.DB.Clients.getClientById(tx.clientId);
            dataRows.push([
                new Date(tx.date).toLocaleDateString('en-IN'),
                client ? client.name : 'Unknown',
                client ? client.pan : 'Unknown',
                tx.voucherNo,
                tx.incomeHead,
                tx.category,
                tx.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })
            ]);
        }
        return dataRows;
    }

    /**
     * ========================================================================
     * EXPORT FORMATS (HTML, PDF, EXCEL)
     * ========================================================================
     */
    function renderHTMLReport(title, headers, data) {
        document.getElementById('reportOutput').classList.remove('hidden');
        document.getElementById('reportTitle').innerText = title;
        
        const thead = document.getElementById('reportTableHead');
        const tbody = document.getElementById('reportTableBody');
        
        thead.innerHTML = `<tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>`;
        tbody.innerHTML = data.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('');
    }

    async function exportToPDF(title, headers, data) {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'pt', 'a4');
        
        // Fetch Firm Settings for Header
        const settings = await window.DB.Settings.getSettings();
        const firmName = settings.firmName || "CA Pro Default Firm";
        
        // Header
        doc.setFontSize(18);
        doc.setTextColor(10, 37, 64); // Primary Blue
        doc.text(firmName, 40, 40);
        
        doc.setFontSize(12);
        doc.setTextColor(100);
        doc.text(`FRN: ${settings.frn || 'N/A'} | Email: ${settings.email || 'N/A'}`, 40, 55);
        
        doc.setFontSize(14);
        doc.setTextColor(0);
        doc.text(title, 40, 85);
        
        // Generate AutoTable
        doc.autoTable({
            startY: 100,
            head: [headers],
            body: data,
            theme: 'grid',
            headStyles: { fillColor: [10, 37, 64], textColor: 255 },
            styles: { fontSize: 9, cellPadding: 4 },
            alternateRowStyles: { fillColor: [245, 245, 245] }
        });

        // Footer
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text(`Generated by CA Pro Tax Suite | Page ${i} of ${pageCount}`, doc.internal.pageSize.width / 2, doc.internal.pageSize.height - 20, { align: 'center' });
        }

        doc.save(`${title.replace(/ /g, '_')}.pdf`);
        window.showToast("PDF Downloaded Successfully", "success");
    }

    function exportToExcel(title, headers, data) {
        // Prepare Array of Arrays (AoA) for SheetJS
        const ws_data = [[title], [], headers, ...data];
        
        const ws = XLSX.utils.aoa_to_sheet(ws_data);
        const wb = XLSX.utils.book_new();
        
        XLSX.utils.book_append_sheet(wb, ws, "Report");
        
        XLSX.writeFile(wb, `${title.replace(/ /g, '_')}.xlsx`);
        window.showToast("Excel Downloaded Successfully", "success");
    }
});

async function getTransactionRegisterData(clientId, fy) {
        try {
            // If a specific client is selected in the dropdown
            if (clientId && clientId !== "") {
                return await window.DB.Transactions.getTransactionsByClientAndFY(clientId, fy);
            } 
            // If "-- All Clients --" is selected
            else {
                return await window.DB.Transactions.getAllTransactionsByFY(fy);
            }
        } catch (error) {
            console.error("Error fetching report data:", error);
            window.showToast("Failed to fetch report data from cloud.", "danger");
            return [];
        }
    }
