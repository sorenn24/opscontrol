/**
 * app.js — Application Bootstrap & Router
 *
 * Responsibilities:
 * 1. Restore session from localStorage on load
 * 2. Subscribe to global state changes
 * 3. Mount/unmount the correct view based on authentication state
 * 4. Provide a clean single-page-app routing without any library
 */

import { getState, setState, subscribe } from './store/appState.js';
import { loadSession }                  from './utils/storage.js';
import { mountLogin }                   from './components/Login/Login.js';
import { mountLeaderDashboard, unmountLeaderDashboard } from './components/LeaderDashboard/LeaderDashboard.js';
import { mountAdminDashboard,  unmountAdminDashboard }  from './components/AdminDashboard/AdminDashboard.js';

// ── Entry Point ───────────────────────────────────────────────

(async function init() {
  const root = document.getElementById('root');
  if (!root) { console.error('[OpsControl] #root element not found'); return; }

  // Restore session from localStorage
  const savedSession = loadSession();
  if (savedSession) {
    setState({ currentUser: savedSession });
  }

  // Subscribe to user state changes → trigger view transitions
  subscribe('currentUser', (user, prevUser) => {
    // Unmount previous view
    if (!prevUser && user)   { /* mounting fresh — handled below */ }
    if (prevUser && !user)   { unmountAll(); }
    if (prevUser?.role !== user?.role && user) { unmountAll(); }

    mountCurrentView(root);
  });

  // Initial render
  mountCurrentView(root);
})();

// ── View Router ───────────────────────────────────────────────

function mountCurrentView(root) {
  const { currentUser } = getState();

  if (!currentUser) {
    mountLogin(root);
    return;
  }

  if (currentUser.role === 'admin') {
    mountAdminDashboard(root);
    return;
  }

  if (currentUser.role === 'leader') {
    mountLeaderDashboard(root);
    return;
  }

  // Fallback: show login
  mountLogin(root);
}

function unmountAll() {
  try { unmountLeaderDashboard(); } catch { /* noop */ }
  try { unmountAdminDashboard();  } catch { /* noop */ }
}
