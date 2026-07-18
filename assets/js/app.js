/**
 * ============================================================================
 * CA Pro Tax Suite - Core Application Logic (Firebase Cloud Version)
 * ============================================================================
 * Purpose: Handles SPA navigation, UI state, login transitions, theming, 
 * and global event listeners.
 * ============================================================================
 */

// 1. Firebase Auth Imports (Must be at the top level of the module)
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const auth = getAuth();

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
        currentFY: globalFySelector ? globalFySelector.value : '2023-24',
        activeView: 'dashboard'
    };

    /**
     * ========================================================================
     * AUTHENTICATION & INITIALIZATION (Firebase Cloud Auth)
     * ========================================================================
     */
    
    // Disable the old manual login form submit
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            showToast('Please use the Google Sign-in button to access the secure workspace.', 'warning');
        });
    }

    // Firebase Auth Observer (Replaces old LocalStorage session logic)
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            console.log("User authenticated via Google:", user.uid);
            
            // Set the global UID for database.js to use securely
            window.currentUserUid = user.uid;
            AppState.currentUserRole = "Admin";
            
            // Transition UI
            if (loginScreen) loginScreen.classList.add('hidden');
            if (appWrapper) appWrapper.classList.remove('hidden');
            
            await initializeWorkspace();
            showToast(`Welcome back! Securely logged in.`, 'success');
        } else {
            console.log("User logged out");
            window.currentUserUid = null;
            AppState.currentUserRole = null;
            
            // Reset UI
            if (appWrapper) appWrapper.classList.add('hidden');
            if (loginScreen) loginScreen.classList.remove('hidden');
        }
    });

    // Handle Logout
    if (btnLogout) {
        btnLogout.addEventListener('click', (e) => {
            e.preventDefault();
            signOut(auth).then(() => {
                showToast('Successfully logged out.', 'info');
            }).catch((error) => {
                console.error("Logout error:", error);
                showToast('Error logging out.', 'danger');
            });
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
            switchView('clients');
            const addTabEl = document.getElementById('client-add-tab');
            if (addTabEl) {
                const addTab = new bootstrap.Tab(addTabEl);
                addTab.show();
            }
        });
    }

    function switchView(viewId) {
        try {
            AppState.activeView = viewId;
            navLinks.forEach(link => link.classList.remove('active'));
            const activeLink = document.querySelector(`.nav-link[data-view="${viewId}"]`);
            if (activeLink) activeLink.classList.add('active');

            viewSections.forEach(section => section.classList.add('hidden'));
            
            const targetSection = document.getElementById(`view-${viewId}`);
            if (targetSection) {
                targetSection.classList.remove('hidden');
                setTimeout(() => triggerViewRefresh(viewId), 0);
            }
        } catch (routeError) {
            console.error("View router navigation halted:", routeError);
        }
    }

    function triggerViewRefresh(viewId) {
        const event = new CustomEvent('viewChanged', { detail: { view: viewId, fy: AppState.currentFY } });
        document.dispatchEvent(event);
    }

    /**
     * ========================================================================
     * GLOBAL CONTROLS (Theme & Financial Year)
     * ========================================================================
     */

    if (darkModeToggle) {
        darkModeToggle.addEventListener('click', () => {
            const body = document.body;
            const currentTheme = body.getAttribute('data-bs-theme');
            const newTheme = currentTheme === 'light' ? 'dark' : 'light';
            
            body.setAttribute('data-bs-theme', newTheme);
            
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

    if (globalFySelector) {
        globalFySelector.addEventListener('change', (e) => {
            AppState.currentFY = e.target.value;
            showToast(`Financial Year changed to ${e.target.options[e.target.selectedIndex].text}`, 'info');
            triggerViewRefresh(AppState.activeView);
        });
    }

    /**
     * ========================================================================
     * WORKSPACE INITIALIZATION (Updated for Firebase)
     * ========================================================================
     */
    async function initializeWorkspace() {
        try {
            // FIXED: Removed old window.DB.core.clients.count() Dexie syntax
            // Now correctly queries Firestore using the updated module
            if (window.DB && window.DB.Clients) {
                const clients = await window.DB.Clients.getAllClients();
                const totalClients = clients.length;
                
                const dashTotalClients = document.getElementById('dash-total-clients');
                if (dashTotalClients) {
                    dashTotalClients.innerText = totalClients;
                }
            }
            
            initDashboardCharts();
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

    window.showToast = function(message, type = 'success') {
        const toastContainer = document.getElementById('toastContainer');
        if (!toastContainer) return;

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
