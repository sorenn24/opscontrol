/**
 * LeaderDashboard.js — Main Leader View Orchestrator
 *
 * Composes all sub-components for the leader's task management view:
 * - HeaderUser
 * - TurnoSelector
 * - SpecialTaskNotifier (banner)
 * - TaskList (with TaskCards)
 * - SubmitButton
 */

import { getState, setState, subscribe, toggleTask, resetTaskProgress } from '../../store/appState.js';
import { getTasksForTurno } from '../../data/tasks.js';
import { apiService } from '../../services/apiService.js';
import { showToast } from '../shared/Toast.js';
import { formatDateLong, todayKey, isMonday, isThursday } from '../../utils/dateUtils.js';
import { clearSession } from '../../utils/storage.js';

// ── Module State ─────────────────────────────────────────────
let container    = null;
let unsubscribers = [];
let submitState  = 'idle'; // idle | loading | success | error | offline
let currentTasks = [];
let hasSubmitted = false;

// ── Mount ────────────────────────────────────────────────────

export function mountLeaderDashboard(el) {
  container = el;
  unsubscribers.forEach(fn => fn());
  unsubscribers = [];
  hasSubmitted  = false;
  submitState   = 'idle';

  // Reset task progress for new session
  resetTaskProgress();

  // Subscribe to state changes that require re-renders
  unsubscribers.push(
    subscribe('currentTurno', () => {
      resetTaskProgress();
      hasSubmitted = false;
      submitState  = 'idle';
      renderAll();
    }),
    subscribe('taskProgress', () => renderTaskList()),
  );

  renderAll();
}

export function unmountLeaderDashboard() {
  unsubscribers.forEach(fn => fn());
  unsubscribers = [];
  container = null;
}

// ── Full Render ───────────────────────────────────────────────

function renderAll() {
  if (!container) return;
  const { currentUser, currentTurno } = getState();
  const today     = new Date();
  const dateStr   = formatDateLong(today);
  currentTasks    = getTasksForTurno(currentTurno, today);
  const specials  = currentTasks.filter(t => t.special);
  const hasSpecial = specials.length > 0;

  container.innerHTML = `
    <div class="leader-page" id="leader-page" role="main">

      <!-- Header -->
      ${renderHeader(currentUser)}

      <!-- Date Info -->
      <div class="date-info-bar">
        <span>📅</span>
        <span>${dateStr}</span>
        ${isMonday(today) ? '<span class="badge badge-warning">Lunes</span>' : ''}
        ${isThursday(today) ? '<span class="badge badge-warning">Jueves</span>' : ''}
      </div>

      <!-- Turno Selector -->
      <div class="turno-section">
        <p class="turno-label">Turno activo</p>
        ${renderTurnoTabs(currentTurno)}
      </div>

      <!-- Special Task Banner -->
      ${hasSpecial ? renderSpecialBanner(specials) : ''}

      <!-- Task List -->
      <div class="task-section" id="task-section">
        ${renderTaskListHTML()}
      </div>

      <!-- Footer / Submit -->
      <div class="leader-footer" id="leader-footer">
        ${renderSubmitFooter()}
      </div>
    </div>
  `;

  attachAllListeners();
}

// ── Sub-Renderers ────────────────────────────────────────────

function renderHeader(user) {
  return `
    <header class="leader-header" role="banner">
      <div class="header-user-info">
        <div class="header-avatar" aria-hidden="true">${user?.avatar || '👤'}</div>
        <div>
          <div class="header-name">${user?.name || 'Líder'}</div>
          <div class="header-role">Líder de turno</div>
        </div>
      </div>
      <button
        id="logout-btn"
        class="header-logout-btn"
        aria-label="Cerrar sesión"
        title="Cerrar sesión"
        type="button"
      >🚪</button>
    </header>
  `;
}

function renderTurnoTabs(currentTurno) {
  return `
    <div class="turno-tabs" role="tablist" aria-label="Selección de turno">
      <button
        class="turno-tab${currentTurno === 'T1' ? ' active' : ''}"
        data-turno="T1"
        role="tab"
        aria-selected="${currentTurno === 'T1'}"
        aria-controls="task-section"
        id="tab-t1"
        type="button"
      >
        <span class="turno-tab-label">☀️  Turno 1</span>
        <span class="turno-tab-sub">Mañana</span>
      </button>
      <button
        class="turno-tab${currentTurno === 'T2' ? ' active' : ''}"
        data-turno="T2"
        role="tab"
        aria-selected="${currentTurno === 'T2'}"
        aria-controls="task-section"
        id="tab-t2"
        type="button"
      >
        <span class="turno-tab-label">🌙  Turno 2</span>
        <span class="turno-tab-sub">Tarde</span>
      </button>
    </div>
  `;
}

function renderSpecialBanner(specials) {
  const labels = specials.map(t => `${t.emoji} ${t.label}`).join(' · ');
  return `
    <div class="special-banner" role="note" aria-label="Tareas especiales de hoy">
      <span class="special-banner-icon" aria-hidden="true">⚡</span>
      <div>
        <div class="special-banner-text">Tareas especiales de hoy</div>
        <div class="special-banner-sub">${labels} — agregadas automáticamente</div>
      </div>
    </div>
  `;
}

function renderTaskListHTML() {
  const { taskProgress } = getState();
  const checked   = Object.values(taskProgress).filter(Boolean).length;
  const total     = currentTasks.length;
  const pct       = total > 0 ? Math.round((checked / total) * 100) : 0;

  return `
    <div class="task-section-header">
      <h2 class="task-section-title">Lista de actividades</h2>
      <div class="task-progress-pill" aria-label="Progreso: ${checked} de ${total} tareas">
        <span>${checked}/${total}</span>
      </div>
    </div>

    <div class="task-progress-bar-wrap" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="${pct}% completado">
      <div class="task-progress-bar-fill" style="width: ${pct}%"></div>
    </div>

    <div class="task-list" id="task-list" role="list">
      ${currentTasks.map((task, i) => renderTaskCard(task, taskProgress[task.id] || false, i)).join('')}
    </div>
  `;
}

function renderTaskCard(task, checked, index) {
  return `
    <div
      class="task-card${checked ? ' checked' : ''}${task.special ? ' special-task' : ''}"
      data-task-id="${task.id}"
      role="listitem"
      tabindex="0"
      aria-label="${task.label}${checked ? ' — completada' : ''}"
      style="animation: fadeInUp ${200 + index * 35}ms ease both;"
    >
      <div class="task-checkbox" aria-hidden="true">
        <span class="task-checkbox-icon">✓</span>
      </div>
      <span class="task-label">${task.special ? `${task.emoji || '⭐'} ` : ''}${task.label}</span>
      ${task.special ? `<span class="task-special-badge" aria-hidden="true">⭐</span>` : ''}
    </div>
  `;
}

function renderSubmitFooter() {
  const { taskProgress } = getState();
  const checked = Object.values(taskProgress).filter(Boolean).length;
  const total   = currentTasks.length;
  const allDone = checked === total && total > 0;

  const btnClass = `btn btn-full submit-btn${
    submitState === 'success' ? ' state-success'
    : submitState === 'error'   ? ' state-error'
    : submitState === 'offline' ? ' state-offline'
    : ' btn-primary'
  }`;

  const btnContent =
    submitState === 'loading' ? `<div class="spinner"></div><span>Guardando...</span>`
    : submitState === 'success' ? `<span>✓ Guardado correctamente</span>`
    : submitState === 'offline' ? `<span>⚠️ Guardado sin conexión</span>`
    : submitState === 'error'   ? `<span>Error — Toca para reintentar</span>`
    : allDone                   ? `<span>Guardar registro ✓</span>`
    : `<span>Guardar avance (${checked}/${total})</span>`;

  return `
    <div class="submit-summary">
      <span class="submit-summary-text">
        Completadas: <strong class="submit-summary-count">${checked}</strong> de <strong class="submit-summary-count">${total}</strong>
      </span>
      ${allDone ? '<span class="badge badge-success">¡Todo listo!</span>' : ''}
    </div>
    <button
      id="submit-btn"
      class="${btnClass}"
      type="button"
      ${submitState === 'loading' ? 'disabled' : ''}
      aria-label="Guardar registro de tareas"
    >${btnContent}</button>
    ${hasSubmitted && submitState === 'success'
      ? `<p style="text-align:center; font-size:var(--font-size-xs); color:var(--text-muted); margin-top:var(--space-2);">Puedes seguir marcando tareas</p>`
      : ''}
  `;
}

// ── Task-Only Re-render (optimized) ─────────────────────────

function renderTaskList() {
  if (!container) return;
  const taskSection = container.querySelector('#task-section');
  const footer      = container.querySelector('#leader-footer');
  if (taskSection) taskSection.innerHTML = renderTaskListHTML();
  if (footer)      footer.innerHTML      = renderSubmitFooter();
  attachTaskListeners();
  attachFooterListeners();
}

// ── Event Listeners ──────────────────────────────────────────

function attachAllListeners() {
  // Logout
  container.querySelector('#logout-btn')?.addEventListener('click', handleLogout);

  // Turno tabs
  container.querySelectorAll('.turno-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const turno = tab.dataset.turno;
      if (turno !== getState().currentTurno) {
        setState({ currentTurno: turno });
      }
    });
  });

  attachTaskListeners();
  attachFooterListeners();
}

function attachTaskListeners() {
  container?.querySelectorAll('.task-card').forEach(card => {
    const handler = () => {
      if (hasSubmitted && submitState === 'success') return; // lock after success
      const taskId = card.dataset.taskId;
      toggleTask(taskId);
    };
    card.addEventListener('click', handler);
    card.addEventListener('keydown', e => {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); handler(); }
    });
  });
}

function attachFooterListeners() {
  container?.querySelector('#submit-btn')?.addEventListener('click', handleSubmit);
}

// ── Handlers ─────────────────────────────────────────────────

function handleLogout() {
  clearSession();
  setState({ currentUser: null, taskProgress: {}, currentTurno: 'T1' });
}

async function handleSubmit() {
  if (submitState === 'loading') return;

  const { currentUser, currentTurno, taskProgress } = getState();
  submitState = 'loading';
  renderTaskList();

  // Build task snapshot (include all tasks — checked or not)
  const taskSnapshot = {};
  currentTasks.forEach(t => { taskSnapshot[t.id] = taskProgress[t.id] || false; });

  const report = {
    userId:  currentUser.id,
    turno:   currentTurno,
    dateKey: todayKey(),
    tasks:   taskSnapshot,
  };

  const result = await apiService.submitTaskReport(report);

  if (result.success) {
    submitState  = 'success';
    hasSubmitted = true;
    showToast('¡Registro guardado correctamente! ✓', 'success', 4000);
  } else if (result.offline) {
    submitState  = 'offline';
    hasSubmitted = true;
    showToast('Sin conexión. Registro guardado localmente y se sincronizará pronto.', 'warning', 5000);
  } else {
    submitState = 'error';
    showToast('Error al guardar. Toca "Guardar" para reintentar.', 'danger');
  }

  renderTaskList();
}
