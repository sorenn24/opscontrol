/**
 * apiService.js — Capa de API Real (MongoDB backend)
 *
 * Cambia API_BASE a tu URL de producción cuando despliegues:
 *   const API_BASE = 'https://opscontrol.onrender.com/api';
 *
 * En desarrollo local (node server/index.js):
 *   const API_BASE = '/api';   ← relativo, funciona porque Express sirve el frontend
 */

const API_BASE = '/api';

// ── Helper fetch con manejo de errores ───────────────────────
async function apiFetch(endpoint, options = {}) {
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      headers:     { 'Content-Type': 'application/json', ...options.headers },
      credentials: 'include',  // Envía la cookie de sesión siempre
      ...options,
    });

    const data = await res.json();

    if (!res.ok) {
      return { error: data.error || `Error ${res.status}` };
    }

    return data;
  } catch (err) {
    // Sin conexión a red
    return { error: 'Sin conexión. Verifica tu internet.' };
  }
}

// ── Auth ─────────────────────────────────────────────────────

export async function apiAuthenticate(userId, pin) {
  return apiFetch('/auth/login', {
    method: 'POST',
    body:   JSON.stringify({ userId, pin }),
  });
}

export async function apiGetMe() {
  return apiFetch('/auth/me');
}

export async function apiLogout() {
  return apiFetch('/auth/logout', { method: 'POST' });
}

// ── Users ────────────────────────────────────────────────────

export async function apiGetUsers() {
  const data = await apiFetch('/users');
  return data.users || [];
}

export async function apiAddLeader(name, pin) {
  return apiFetch('/users', {
    method: 'POST',
    body:   JSON.stringify({ name, pin }),
  });
}

export async function apiUpdateLeader(id, name, pin) {
  return apiFetch(`/users/${id}`, {
    method: 'PUT',
    body:   JSON.stringify({ name, pin }),
  });
}

export async function apiDeleteLeader(id) {
  return apiFetch(`/users/${id}`, { method: 'DELETE' });
}

export async function apiGetLeaderPin(id) {
  const data = await apiFetch(`/users/${id}/pin`);
  return data.pin || null;
}

// ── Reports ──────────────────────────────────────────────────

/**
 * Guardar reporte de turno. Incluye fallback offline a localStorage.
 */
export async function apiSubmitReport(report) {
  if (!navigator.onLine) {
    _saveDraftOffline(report);
    return { success: false, offline: true };
  }

  const result = await apiFetch('/reports', {
    method: 'POST',
    body:   JSON.stringify(report),
  });

  if (result.success) {
    _clearDraftOffline(report.turno, report.dateKey);
    _syncPendingDrafts();  // Intenta sincronizar drafts anteriores
  } else if (result.error) {
    _saveDraftOffline(report);
    return { success: false, error: result.error };
  }

  return result;
}

/**
 * Reportes de todos los líderes para una fecha (solo admin).
 */
export async function apiFetchReports(dateKey) {
  const data = await apiFetch(`/reports${dateKey ? `?date=${dateKey}` : ''}`);
  return data.reports || [];
}

// ── Offline Fallback ─────────────────────────────────────────

const DRAFT_KEY = 'opscontrol:drafts';

function _saveDraftOffline(report) {
  try {
    const drafts = JSON.parse(localStorage.getItem(DRAFT_KEY) || '[]');
    const idx = drafts.findIndex(d => d.turno === report.turno && d.dateKey === report.dateKey);
    if (idx >= 0) drafts[idx] = report; else drafts.push(report);
    localStorage.setItem(DRAFT_KEY, JSON.stringify(drafts));
  } catch { /* noop */ }
}

function _clearDraftOffline(turno, dateKey) {
  try {
    const drafts = JSON.parse(localStorage.getItem(DRAFT_KEY) || '[]')
      .filter(d => !(d.turno === turno && d.dateKey === dateKey));
    localStorage.setItem(DRAFT_KEY, JSON.stringify(drafts));
  } catch { /* noop */ }
}

async function _syncPendingDrafts() {
  try {
    const drafts = JSON.parse(localStorage.getItem(DRAFT_KEY) || '[]');
    for (const draft of drafts) {
      const result = await apiFetch('/reports', {
        method: 'POST',
        body:   JSON.stringify(draft),
      });
      if (result.success) {
        _clearDraftOffline(draft.turno, draft.dateKey);
      }
    }
  } catch { /* silent */ }
}

// ── Export object (compatibilidad con versión anterior) ──────
export const apiService = {
  authenticate: apiAuthenticate,
  getUsers:     apiGetUsers,
  submitReport: apiSubmitReport,
  fetchReports: apiFetchReports,
};

export default apiService;
