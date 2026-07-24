/**
 * AdminDashboard.js — Admin Panel Orchestrator
 *
 * Renders the full admin view:
 * - AdminHeader (title, date picker, refresh, logout)
 * - Stats summary bar
 * - LeaderStatusMatrix (compliance semaphore grid)
 * - TaskDetailModal (on leader card tap)
 */

import { getState, setState } from '../../store/appState.js';
import { apiService } from '../../services/apiService.js';
import { clearSession } from '../../utils/storage.js';
import { formatDateLong, formatDateKey, parseDateKey, todayKey } from '../../utils/dateUtils.js';
import { showToast } from '../shared/Toast.js';
import { getTasksForTurno } from '../../data/tasks.js';

// ── Module State ─────────────────────────────────────────────
let adminContainer = null;
let reports        = [];
let isLoading      = true;
let viewDateKey    = todayKey();
let selectedLeader = null; // for modal

// ── Mount ────────────────────────────────────────────────────

export async function mountAdminDashboard(el) {
  adminContainer = el;
  viewDateKey    = todayKey();
  selectedLeader = null;
  isLoading      = true;

  renderShell();
  await loadReports();
}

export function unmountAdminDashboard() {
  adminContainer = null;
}

// ── Load Data ────────────────────────────────────────────────

async function loadReports(silent = false) {
  if (!silent) isLoading = true;
  if (!silent) renderMatrix();

  reports = await apiService.fetchReports(viewDateKey);
  isLoading = false;
  renderMatrix();
  renderStats();

  if (silent) showToast('Datos actualizados', 'info', 2000);
}

// ── Shell ────────────────────────────────────────────────────

function renderShell() {
  if (!adminContainer) return;
  const { currentUser } = getState();

  adminContainer.innerHTML = `
    <div class="admin-page" id="admin-page" role="main">

      <!-- Header -->
      <header class="admin-header" role="banner">
        <div class="admin-header-top">
          <div class="admin-brand">
            <div class="admin-brand-icon" aria-hidden="true">📊</div>
            <div>
              <h1 class="admin-title">Panel Admin</h1>
              <div class="admin-subtitle">${currentUser?.name || 'Administrador'}</div>
            </div>
          </div>
          <div class="admin-header-actions">
            <button
              id="admin-refresh-btn"
              class="admin-refresh-btn"
              aria-label="Actualizar datos"
              title="Actualizar"
              type="button"
            >🔄</button>
            <button
              id="admin-logout-btn"
              class="admin-logout-btn"
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
              type="button"
            >🚪</button>
          </div>
        </div>
        <div class="admin-date-row">
          <input
            type="date"
            id="admin-date-input"
            class="admin-date-input"
            value="${viewDateKey}"
            max="${todayKey()}"
            aria-label="Seleccionar fecha a consultar"
          />
        </div>
      </header>

      <!-- Stats Bar -->
      <div class="admin-stats-bar" id="admin-stats-bar">
        ${renderSkeletonStats()}
      </div>

      <!-- Leader Matrix -->
      <div class="matrix-section">
        <p class="matrix-section-title">Estado por líder — <span id="matrix-date-label">${formatDateLong(parseDateKey(viewDateKey))}</span></p>
        <div class="leader-grid" id="leader-grid">
          ${renderSkeletonGrid()}
        </div>
      </div>
    </div>

    <!-- Modal container -->
    <div id="modal-container"></div>
  `;

  attachHeaderListeners();
}

// ── Stats Bar ────────────────────────────────────────────────

function renderStats() {
  const statsBar = adminContainer?.querySelector('#admin-stats-bar');
  if (!statsBar) return;

  const total    = reports.length;
  const complete = reports.filter(r => (r.t1?.submitted || r.t2?.submitted)).length;
  const both     = reports.filter(r => r.t1?.submitted && r.t2?.submitted).length;
  const pending  = total - complete;

  statsBar.innerHTML = `
    <div class="stat-card" style="animation-delay: 0ms;">
      <div class="stat-value" style="color: var(--color-success);">${complete}</div>
      <div class="stat-label">Con registro</div>
    </div>
    <div class="stat-card" style="animation-delay: 60ms;">
      <div class="stat-value" style="color: var(--color-primary);">${both}</div>
      <div class="stat-label">Ambos turnos</div>
    </div>
    <div class="stat-card" style="animation-delay: 120ms;">
      <div class="stat-value" style="color: var(--color-danger);">${pending}</div>
      <div class="stat-label">Sin registro</div>
    </div>
  `;
}

// ── Leader Grid ───────────────────────────────────────────────

function renderMatrix() {
  const grid = adminContainer?.querySelector('#leader-grid');
  if (!grid) return;

  if (isLoading) {
    grid.innerHTML = renderSkeletonGrid();
    return;
  }

  grid.innerHTML = reports.map((r, i) => renderLeaderCard(r, i)).join('');
  attachLeaderCardListeners();
}

function renderLeaderCard(report, index) {
  const t1Done = report.t1?.submitted;
  const t2Done = report.t2?.submitted;

  let statusClass  = 'status-pending';
  let semaphore    = '🔴';

  if (t1Done && t2Done) { statusClass = 'status-complete'; semaphore = '🟢'; }
  else if (t1Done || t2Done) { statusClass = 'status-partial';  semaphore = '🟡'; }

  const t1Pct = t1Done ? `${report.t1.completed}/${report.t1.total}` : '—';
  const t2Pct = t2Done ? `${report.t2.completed}/${report.t2.total}` : '—';

  return `
    <div
      class="leader-card ${statusClass}"
      data-leader-id="${report.userId}"
      role="button"
      tabindex="0"
      aria-label="Ver detalles de ${report.name}"
      style="animation-delay: ${index * 80}ms;"
    >
      <div class="leader-card-avatar" aria-hidden="true">${report.avatar}</div>
      <div class="leader-card-name">${report.name}</div>
      <div class="leader-card-status-row">
        <div class="turno-pills">
          <span class="turno-pill turno-pill-t1${t1Done ? ' done' : ' none'}">T1 ${t1Pct}</span>
          <span class="turno-pill turno-pill-t2${t2Done ? ' done' : ' none'}">T2 ${t2Pct}</span>
        </div>
      </div>
      <div class="leader-card-semaphore" aria-label="${semaphore === '🟢' ? 'Completo' : semaphore === '🟡' ? 'Parcial' : 'Pendiente'}" aria-hidden="true">${semaphore}</div>
      <div class="leader-card-tap-hint">Toca para ver detalle</div>
    </div>
  `;
}

// ── Skeleton Loaders ─────────────────────────────────────────

function renderSkeletonStats() {
  return Array(3).fill('').map(() => `
    <div class="stat-card">
      <div class="skeleton" style="width:48px; height:30px; margin:0 auto var(--space-2);"></div>
      <div class="skeleton" style="width:80px; height:12px; margin:0 auto;"></div>
    </div>
  `).join('');
}

function renderSkeletonGrid() {
  return Array(4).fill('').map(() => `
    <div class="leader-card" style="gap: var(--space-4); pointer-events:none;">
      <div class="skeleton" style="width:52px; height:52px; border-radius:50%;"></div>
      <div class="skeleton" style="width:80px; height:14px;"></div>
      <div class="skeleton" style="width:110px; height:22px; border-radius:999px;"></div>
      <div class="skeleton" style="width:28px; height:28px; border-radius:50%;"></div>
    </div>
  `).join('');
}

// ── Task Detail Modal ─────────────────────────────────────────

function openModal(report) {
  const modalContainer = adminContainer?.querySelector('#modal-container');
  if (!modalContainer) return;

  const dateLabel = formatDateLong(parseDateKey(viewDateKey));

  modalContainer.innerHTML = `
    <div class="modal-overlay" id="modal-overlay" role="dialog" aria-modal="true" aria-label="Detalle de ${report.name}">
      <div class="modal-sheet" role="document">
        <div class="modal-handle" aria-hidden="true"></div>

        <div class="modal-header">
          <div style="display:flex; align-items:center; justify-content:space-between;">
            <div class="modal-leader-info">
              <div class="modal-leader-avatar" aria-hidden="true">${report.avatar}</div>
              <div>
                <div class="modal-leader-name">${report.name}</div>
                <div class="modal-leader-date">${dateLabel}</div>
              </div>
            </div>
            <button class="modal-close-btn" id="modal-close-btn" aria-label="Cerrar modal" type="button">✕</button>
          </div>
        </div>

        <div class="modal-body">
          ${renderModalTurno(report, 'T1')}
          ${renderModalTurno(report, 'T2')}
        </div>
      </div>
    </div>
  `;

  // Close listeners
  modalContainer.querySelector('#modal-close-btn')?.addEventListener('click', closeModal);
  modalContainer.querySelector('#modal-overlay')?.addEventListener('click', e => {
    if (e.target.id === 'modal-overlay') closeModal();
  });

  // Keyboard close
  const closeOnEsc = e => {
    if (e.key === 'Escape') { closeModal(); document.removeEventListener('keydown', closeOnEsc); }
  };
  document.addEventListener('keydown', closeOnEsc);
}

function renderModalTurno(report, turno) {
  const data = turno === 'T1' ? report.t1 : report.t2;
  const turnoLabel = turno === 'T1' ? '☀️ Turno 1 — Mañana' : '🌙 Turno 2 — Tarde';

  if (!data?.submitted) {
    return `
      <div class="modal-turno-section">
        <div class="modal-turno-header">
          <span class="modal-turno-title">${turnoLabel}</span>
          <span class="badge badge-danger">Sin registro</span>
        </div>
        <div class="modal-no-data">
          <span class="modal-no-data-icon">📋</span>
          <span class="modal-no-data-text">No se registró actividad en este turno</span>
        </div>
      </div>
    `;
  }

  const taskIds = Object.keys(data.tasks);
  const submittedDate = data.submittedAt
    ? new Date(data.submittedAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
    : '';

  const completedCount = Object.values(data.tasks).filter(Boolean).length;
  const total          = taskIds.length;
  const pct            = Math.round((completedCount / total) * 100);

  // Get task labels from catalog
  const dayTasks = getTasksForTurno(turno, parseDateKey(viewDateKey));
  const taskMap  = Object.fromEntries(dayTasks.map(t => [t.id, t]));

  return `
    <div class="modal-turno-section">
      <div class="modal-turno-header">
        <span class="modal-turno-title">${turnoLabel}</span>
        <div style="display:flex; align-items:center; gap:var(--space-2);">
          ${pct === 100
            ? '<span class="badge badge-success">Completo</span>'
            : `<span class="badge badge-warning">${pct}%</span>`
          }
          ${submittedDate ? `<span class="modal-turno-meta">✓ ${submittedDate}</span>` : ''}
        </div>
      </div>

      <div class="task-progress-bar-wrap" style="margin-bottom: var(--space-4);" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100">
        <div class="task-progress-bar-fill" style="width: ${pct}%;"></div>
      </div>

      <div role="list" aria-label="Tareas de ${turnoLabel}">
        ${taskIds.map(id => {
          const done  = data.tasks[id];
          const label = taskMap[id]?.label || id;
          return `
            <div class="modal-task-row" role="listitem">
              <div class="modal-task-dot ${done ? 'done' : 'pending'}" aria-hidden="true">
                ${done ? '✓' : '✕'}
              </div>
              <span class="modal-task-label${done ? '' : ' pending-text'}">${label}</span>
              ${done
                ? '<span style="font-size:12px; color: var(--color-success);">Hecho</span>'
                : '<span style="font-size:12px; color: var(--color-danger);">Pendiente</span>'
              }
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function closeModal() {
  const overlay = adminContainer?.querySelector('#modal-overlay');
  if (overlay) {
    overlay.style.animation = 'fadeIn 200ms ease reverse both';
    const sheet = overlay.querySelector('.modal-sheet');
    if (sheet) sheet.style.animation = 'slideUp 250ms ease reverse both';
    setTimeout(() => {
      const mc = adminContainer?.querySelector('#modal-container');
      if (mc) mc.innerHTML = '';
    }, 250);
  }
}

// ── Event Listeners ───────────────────────────────────────────

function attachHeaderListeners() {
  adminContainer?.querySelector('#admin-logout-btn')?.addEventListener('click', () => {
    clearSession();
    setState({ currentUser: null });
  });

  adminContainer?.querySelector('#admin-refresh-btn')?.addEventListener('click', async () => {
    const btn = adminContainer?.querySelector('#admin-refresh-btn');
    if (btn) btn.classList.add('spinning');
    await loadReports(true);
    if (btn) btn.classList.remove('spinning');
  });

  adminContainer?.querySelector('#admin-date-input')?.addEventListener('change', async e => {
    viewDateKey = e.target.value || todayKey();
    const label = adminContainer?.querySelector('#matrix-date-label');
    if (label) label.textContent = formatDateLong(parseDateKey(viewDateKey));
    await loadReports();
  });
}

function attachLeaderCardListeners() {
  adminContainer?.querySelectorAll('.leader-card').forEach(card => {
    const handler = () => {
      const leaderId = card.dataset.leaderId;
      const report   = reports.find(r => r.userId === leaderId);
      if (report) openModal(report);
    };
    card.addEventListener('click', handler);
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handler(); }
    });
  });
}
