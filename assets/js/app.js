/**
 * ============================================================================
 * CA Pro Tax Suite - Core Application Logic (Firebase Cloud Version)
 * ============================================================================
 * Purpose: Handles SPA navigation, UI state, login transitions, theming, 
 * and global event listeners.
 * ============================================================================
 */

// 1. Firebase Auth Imports (Must be at the top level of the module)
import { getAuth, onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const auth = getAuth();

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const loginScreen = document.getElementById('login-screen');
    const appWrapper = document.getElementById('app-wrapper');
    const navLinks = document.querySelectorAll('.nav-link[data-view]');
    const viewSections = document.querySelectorAll('.view-section');
    const darkModeToggle = document.getElementById('darkModeToggle');
    const globalFySelector = document.getElementById('global-fy-selector');
    const btnLogout = document.getElementById('btn-logout');
    const btnGoogleLogin = document.getElementById('btnGoogleLogin');

    // --- Application State ---
    const AppState = {
        currentUserRole: null,
        currentFY: globalFySelector ? globalFySelector.value : '2023-24',
        activeView: 'dashboard'
    };

    /**
 * ============================================================================
 * STATE PERSISTENCE (Remember View & FY on Refresh)
 * ============================================================================
 */
document.addEventListener('DOMContentLoaded', () => {
    // --- 1. Persist Financial Year ---
    const fySelector = document.getElementById('global-fy-selector');
    if (fySelector) {
        // Load saved FY on refresh
        const savedFY = localStorage.getItem('activeFY');
        if (savedFY) {
            fySelector.value = savedFY;
        }

        // Save FY to storage whenever the user changes it
        fySelector.addEventListener('change', (e) => {
            localStorage.setItem('activeFY', e.target.value);
        });
    }

    // --- 2. Persist Active View ---
    // Listen to your existing 'viewChanged' event to save the current view
    document.addEventListener('viewChanged', (e) => {
        if (e.detail && e.detail.view) {
            localStorage.setItem('activeView', e.detail.view);
        }
    });

    // Restore view on page load
    setTimeout(() => {
        const savedView = localStorage.getItem('activeView');
        
        if (savedView && savedView !== 'dashboard') {
            // Find the sidebar link that corresponds to the saved view
            // (Adjust the selector depending on whether you use href="#view" or data-view="view")
            const targetLink = document.querySelector(`.nav-link[href="#${savedView}"]`) || 
                               document.querySelector(`[data-target="${savedView}"]`) ||
                               document.querySelector(`a[onclick*="${savedView}"]`);
            
            if (targetLink) {
                // Programmatically click the link to trigger your existing routing logic
                targetLink.click();
            } else {
                // Fallback: If no link is found, manually dispatch your viewChanged event
                // and hide/show the correct HTML sections manually.
                document.querySelectorAll('.app-view').forEach(view => view.classList.add('d-none'));
                const targetViewElement = document.getElementById(`view-${savedView}`);
                if (targetViewElement) {
                    targetViewElement.classList.remove('d-none');
                    document.dispatchEvent(new CustomEvent('viewChanged', { detail: { view: savedView } }));
                }
            }
        }
    }, 100); // 100ms delay ensures your sidebar is fully loaded in the DOM before clicking
});
    
    /**
     * ========================================================================
     * AUTHENTICATION & INITIALIZATION (Firebase Cloud Auth)
     * ========================================================================
     */

    // --- Google Sign-In Trigger ---
    if (btnGoogleLogin) {
        btnGoogleLogin.addEventListener('click', async () => {
            const provider = new GoogleAuthProvider();
            try {
                // Opens the Google login popup
                await signInWithPopup(auth, provider);
            } catch (error) {
                console.error("Google Sign-in Error:", error);
                showToast("Login failed: " + error.message, 'danger');
            }
        });
    }

    // --- Firebase Auth Observer (Handles UI Transitions) ---
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            console.log("User authenticated via Google:", user.uid);
            
            // Set the global UID for database.js to use securely
            window.currentUserUid = user.uid;
            AppState.currentUserRole = "Admin";
            
            // Transition UI: Hide Login Card, Show Workspace
            if (loginScreen) {
                loginScreen.classList.remove('d-flex'); // Strip Bootstrap flex rule
                loginScreen.style.display = 'none';     // Force hide login
            }
            if (appWrapper) {
                appWrapper.classList.remove('hidden');
                appWrapper.style.display = 'flex';     // Force show workspace
            }
            
            await initializeWorkspace();
            showToast(`Welcome back! Securely logged in.`, 'success');
        } else {
            console.log("User logged out");
            window.currentUserUid = null;
            AppState.currentUserRole = null;
            
            // Transition UI: Hide Workspace, Show Login Card
            if (appWrapper) {
                appWrapper.style.display = 'none';      // Force hide workspace
            }
            if (loginScreen) {
                loginScreen.style.display = 'flex';     // Force show login
                loginScreen.classList.add('d-flex');    // Restore centering
            }
        }
    });

    // --- Handle Logout ---
    if (btnLogout) {
        btnLogout.addEventListener('click', (e) => {
            e.preventDefault();
            signOut(auth).then(() => {
                showToast('Successfully logged out.', 'info');
                // Note: The UI hide/show logic is automatically handled by 
                // the onAuthStateChanged observer above when it detects the logout.
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
     * WORKSPACE INITIALIZATION
     * ========================================================================
     */
    async function initializeWorkspace() {
        try {
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

/**
 * ============================================================================
 * MOBILE SIDEBAR TOGGLE LOGIC
 * ============================================================================
 */
document.addEventListener('DOMContentLoaded', () => {
    const mobileBtn = document.getElementById('mobileMenuToggle');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');

    if (mobileBtn && sidebar && overlay) {
        // Toggle Sidebar on button click
        mobileBtn.addEventListener('click', () => {
            sidebar.classList.toggle('show-sidebar');
            overlay.classList.toggle('show');
        });

        // Close Sidebar when clicking the dark overlay background
        overlay.addEventListener('click', () => {
            sidebar.classList.remove('show-sidebar');
            overlay.classList.remove('show');
        });

        // Optional: Close Sidebar when a nav link is clicked (useful for mobile)
        const navLinks = sidebar.querySelectorAll('.nav-link, a');
        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                if (window.innerWidth <= 768) {
                    sidebar.classList.remove('show-sidebar');
                    overlay.classList.remove('show');
                }
            });
        });
    }
});
