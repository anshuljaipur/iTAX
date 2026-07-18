/**
 * ============================================================================
 * CA Pro Tax Suite - Core Application Logic
 * ============================================================================
 * Purpose: Handles SPA navigation, UI state, login transitions, theming, 
 * and global event listeners.
 * ============================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const loginForm = document.getElementById('loginForm');
    const loginScreen = document.getElementById('login-screen');
    const appWrapper = document.getElementById('app-wrapper');
    const navLinks = document.querySelectorAll('.nav-link[data-view]');
    const viewSections = document.querySelectorAll('.view-section');
    const darkModeToggle = document.getElementById('darkModeToggle');
    const globalFySelector = document.getElementById('global-fy-selector');
    const btnLogout = document.getElementById('btn-logout');

    // --- Application State ---
    const AppState = {
        currentUserRole: null,
        currentFY: globalFySelector.value,
        activeView: 'dashboard'
    };

    /**
     * ========================================================================
     * AUTHENTICATION & INITIALIZATION (Updated with LocalStorage)
     * ========================================================================
     */
    
    // 1. Check for an existing session when the page loads
    const savedSession = localStorage.getItem('ca_pro_session');
    if (savedSession) {
        AppState.currentUserRole = savedSession;
        loginScreen.classList.add('hidden');
        appWrapper.classList.remove('hidden');
        initializeWorkspace();
    }

    // 2. Handle Login Submission
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const role = document.getElementById('loginRole').value;
            const password = document.getElementById('loginPassword').value;
            const rememberMe = document.getElementById('rememberMe').checked;

            if (password.length >= 4) {
                AppState.currentUserRole = role;
                
                // Save session to browser storage
                localStorage.setItem('ca_pro_session', role);
                
                // Transition UI
                loginScreen.classList.add('hidden');
                appWrapper.classList.remove('hidden');
                
                await initializeWorkspace();
                showToast(`Welcome back! Logged in as ${role.toUpperCase()}`, 'success');
            } else {
                showToast('Password must be at least 4 characters.', 'danger');
            }
        });
    }

    // 3. Handle Logout
    if (btnLogout) {
        btnLogout.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Clear the session from browser storage
            localStorage.removeItem('ca_pro_session');
            AppState.currentUserRole = null;
            
            // Reset UI
            appWrapper.classList.add('hidden');
            loginScreen.classList.remove('hidden');
            document.getElementById('loginPassword').value = '';
            
            showToast('Successfully logged out.', 'info');
        });
    }

    // Handle Logout
    if (btnLogout) {
        btnLogout.addEventListener('click', (e) => {
            e.preventDefault();
            appWrapper.classList.add('hidden');
            loginScreen.classList.remove('hidden');
            document.getElementById('loginPassword').value = '';
            showToast('Successfully logged out.', 'info');
        });
    }

    /**
     * ========================================================================
     * SPA ROUTING (Navigation)
     * ========================================================================
     */
    
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetView = e.currentTarget.getAttribute('data-view');
            switchView(targetView);
        });
    });
    
    // Dashboard Quick Actions Routing
    const btnDashNewClient = document.getElementById('btnDashNewClient');
    if (btnDashNewClient) {
        btnDashNewClient.addEventListener('click', () => {
            // 1. Switch to the Client Master view
            switchView('clients');
            
            // 2. Trigger the Bootstrap tab to open the 'Add Client' form
            const addTabEl = document.getElementById('client-add-tab');
            if (addTabEl) {
                const addTab = new bootstrap.Tab(addTabEl);
                addTab.show();
            }
        });
    }

    function switchView(viewId) {
    try {
        // Update application navigation view tracking state
        AppState.activeView = viewId;

        // Reset active style classes across the navigation dashboard components
        navLinks.forEach(link => link.classList.remove('active'));
        const activeLink = document.querySelector(`.nav-link[data-view="${viewId}"]`);
        if (activeLink) activeLink.classList.add('active');

        // Hide layout containers safely
        viewSections.forEach(section => section.classList.add('hidden'));
        
        const targetSection = document.getElementById(`view-${viewId}`);
        if (targetSection) {
            targetSection.classList.remove('hidden');
            
            // Fire view updates decoupled from layout operations
            setTimeout(() => triggerViewRefresh(viewId), 0);
        }
    } catch (routeError) {
        console.error("View router navigation halted:", routeError);
    }
}

    function triggerViewRefresh(viewId) {
        // Dispatch custom events that specific module files (clients.js, etc.) will listen for
        const event = new CustomEvent('viewChanged', { detail: { view: viewId, fy: AppState.currentFY } });
        document.dispatchEvent(event);
    }

    /**
     * ========================================================================
     * GLOBAL CONTROLS (Theme & Financial Year)
     * ========================================================================
     */

    // Dark Mode Toggle
    if (darkModeToggle) {
        darkModeToggle.addEventListener('click', () => {
            const body = document.body;
            const currentTheme = body.getAttribute('data-bs-theme');
            const newTheme = currentTheme === 'light' ? 'dark' : 'light';
            
            body.setAttribute('data-bs-theme', newTheme);
            
            // Toggle Icon
            const icon = darkModeToggle.querySelector('i');
            if (newTheme === 'dark') {
                icon.classList.remove('fa-moon');
                icon.classList.add('fa-sun');
                darkModeToggle.classList.replace('btn-outline-secondary', 'btn-outline-light');
            } else {
                icon.classList.remove('fa-sun');
                icon.classList.add('fa-moon');
                darkModeToggle.classList.replace('btn-outline-light', 'btn-outline-secondary');
            }
        });
    }

    // Global Financial Year Change
    if (globalFySelector) {
        globalFySelector.addEventListener('change', (e) => {
            AppState.currentFY = e.target.value;
            showToast(`Financial Year changed to ${e.target.options[e.target.selectedIndex].text}`, 'info');
            
            // Refresh current view with new FY data
            triggerViewRefresh(AppState.activeView);
        });
    }

    /**
     * ========================================================================
     * WORKSPACE INITIALIZATION
     * ========================================================================
     */
    async function initializeWorkspace() {
        // Fetch dashboard metrics from Dexie DB
        try {
            if (window.DB && window.DB.Clients) {
                const totalClients = await window.DB.core.clients.count();
                document.getElementById('dash-total-clients').innerText = totalClients;
            }
            
            // Initialize Dashboard Charts
            initDashboardCharts();
            
            // Trigger initial data load for dashboard
            triggerViewRefresh('dashboard');
        } catch (error) {
            console.error("Error initializing workspace:", error);
            showToast('Error loading workspace data. Check console.', 'danger');
        }
    }

    /**
     * ========================================================================
     * UTILITY FUNCTIONS (Globally Accessible)
     * ========================================================================
     */

    // Expose showToast globally by attaching it to the window object
    window.showToast = function(message, type = 'success') {
        const toastContainer = document.getElementById('toastContainer');
        if (!toastContainer) return;

        // Map types to Bootstrap background classes
        const bgClasses = {
            success: 'bg-success text-white',
            danger: 'bg-danger text-white',
            warning: 'bg-warning text-dark',
            info: 'bg-info text-white'
        };

        const iconClasses = {
            success: 'fa-check-circle',
            danger: 'fa-triangle-exclamation',
            warning: 'fa-circle-exclamation',
            info: 'fa-circle-info'
        };

        const toastEl = document.createElement('div');
        toastEl.className = `toast align-items-center border-0 ${bgClasses[type]} mb-2`;
        toastEl.setAttribute('role', 'alert');
        toastEl.setAttribute('aria-live', 'assertive');
        toastEl.setAttribute('aria-atomic', 'true');

        toastEl.innerHTML = `
            <div class="d-flex">
                <div class="toast-body fw-bold">
                    <i class="fa-solid ${iconClasses[type]} me-2"></i> ${message}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
        `;

        toastContainer.appendChild(toastEl);
        const bsToast = new bootstrap.Toast(toastEl, { delay: 3000 });
        bsToast.show();

        // Remove element after hiding to keep DOM clean
        toastEl.addEventListener('hidden.bs.toast', () => {
            toastEl.remove();
        });
    };

    /**
     * ========================================================================
     * DASHBOARD CHARTS (Chart.js)
     * ========================================================================
     */
    function initDashboardCharts() {
        // Income Distribution Chart (Doughnut)
        const ctxIncome = document.getElementById('incomeDistributionChart');
        if (ctxIncome && !window.incomeChartInstance) {
            window.incomeChartInstance = new Chart(ctxIncome, {
                type: 'doughnut',
                data: {
                    labels: ['Salary', 'Business/Profession', 'House Property', 'Capital Gains', 'Other Sources'],
                    datasets: [{
                        data: [45, 25, 10, 15, 5],
                        backgroundColor: ['#4e73df', '#1cc88a', '#36b9cc', '#f6c23e', '#e74a3b'],
                        hoverBackgroundColor: ['#2e59d9', '#17a673', '#2c9faf', '#dda20a', '#be2617'],
                        borderWidth: 1
                    }]
                },
                options: {
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'right' } }
                }
            });
        }

        // Tax Regime Pie Chart
        const ctxRegime = document.getElementById('regimePieChart');
        if (ctxRegime && !window.regimeChartInstance) {
            window.regimeChartInstance = new Chart(ctxRegime, {
                type: 'pie',
                data: {
                    labels: ['New Regime (115BAC)', 'Old Regime'],
                    datasets: [{
                        data: [75, 25],
                        backgroundColor: ['#1cc88a', '#4e73df'],
                        borderWidth: 1
                    }]
                },
                options: {
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom' } }
                }
            });
        }
    }
});