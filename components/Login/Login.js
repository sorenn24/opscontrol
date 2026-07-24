/**
 * Login.js — Authentication Component
 *
 * Renders the login screen with:
 * - User selector grid (Alessandro, César, Sam, Soren, La Jefa)
 * - PIN / Password input with show/hide toggle
 * - Validation and error feedback
 * - Calls apiService.authenticate() and updates global state
 */

import { apiService } from '../../services/apiService.js';
import { setState } from '../../store/appState.js';
import { saveSession } from '../../utils/storage.js';
import { showToast } from '../shared/Toast.js';

// ── State ────────────────────────────────────────────────────
let selectedUserId = null;
let isLoading      = false;
let showPin        = false;
let errorMsg       = '';
let users          = [];

// ── Mount ────────────────────────────────────────────────────

/**
 * Mounts the Login component into the given container.
 * @param {HTMLElement} container
 */
export async function mountLogin(container) {
  container.innerHTML = '';

  // Load user list
  users = await apiService.getUsers();
  selectedUserId = null;
  isLoading      = false;
  showPin        = false;
  errorMsg       = '';

  render(container);
}

// ── Render ───────────────────────────────────────────────────

function render(container) {
  container.innerHTML = `
    <div class="login-page" id="login-page">
      <div class="login-card" id="login-card" role="main">

        <!-- Brand -->
        <div class="login-brand">
          <div class="login-logo" aria-hidden="true">📋</div>
          <h1 class="login-title">OpsControl</h1>
          <p class="login-subtitle">Panel de Control de Sucursal</p>
        </div>

        <!-- User Selector -->
        <div class="pin-section">
          <p class="login-section-label">¿Quién eres?</p>
          <div class="user-grid" id="user-grid" role="group" aria-label="Selección de usuario">
            ${renderUserChips()}
          </div>
        </div>

        <!-- PIN Input -->
        <div class="pin-section">
          <p class="login-section-label">Tu PIN de acceso</p>
          <div class="pin-wrapper">
            <input
              type="${showPin ? 'text' : 'password'}"
              id="pin-input"
              class="pin-input"
              inputmode="numeric"
              maxlength="6"
              placeholder="••••"
              autocomplete="current-password"
              aria-label="Ingresa tu PIN"
              ${!selectedUserId ? 'disabled' : ''}
            />
            <button
              class="pin-toggle"
              id="pin-toggle"
              aria-label="${showPin ? 'Ocultar PIN' : 'Mostrar PIN'}"
              type="button"
            >${showPin ? '🙈' : '👁️'}</button>
          </div>
        </div>

        <!-- Error Message -->
        ${errorMsg ? `
          <div class="login-error" role="alert" aria-live="assertive">
            <span>⚠️</span>
            <span>${errorMsg}</span>
          </div>
        ` : ''}

        <!-- Submit -->
        <button
          id="login-submit"
          class="btn btn-primary btn-full"
          type="button"
          ${isLoading || !selectedUserId ? 'disabled' : ''}
          aria-label="Iniciar sesión"
        >
          ${isLoading
            ? '<div class="spinner" aria-hidden="true"></div><span>Verificando...</span>'
            : '<span>Ingresar</span><span aria-hidden="true">→</span>'
          }
        </button>

        <div class="login-footer">
          OpsControl v1.0 &nbsp;·&nbsp; Uso interno
        </div>
      </div>
    </div>
  `;

  attachListeners(container);
}

function renderUserChips() {
  const leaders = users.filter(u => u.role === 'leader');
  const admin   = users.find(u => u.role === 'admin');

  return [
    ...leaders.map(u => `
      <button
        class="user-chip${selectedUserId === u.id ? ' selected' : ''}"
        data-user-id="${u.id}"
        aria-pressed="${selectedUserId === u.id}"
        aria-label="Seleccionar ${u.name}"
        type="button"
      >
        <span class="user-chip-avatar" aria-hidden="true">${u.avatar}</span>
        <span class="user-chip-name">${u.name}</span>
      </button>
    `),
    admin ? `
      <button
        class="user-chip user-chip-admin${selectedUserId === admin.id ? ' selected' : ''}"
        data-user-id="${admin.id}"
        aria-pressed="${selectedUserId === admin.id}"
        aria-label="Seleccionar ${admin.name}"
        type="button"
      >
        <span class="user-chip-avatar" aria-hidden="true">${admin.avatar}</span>
        <span class="user-chip-name">${admin.name}</span>
      </button>
    ` : '',
  ].join('');
}

// ── Event Listeners ──────────────────────────────────────────

function attachListeners(container) {
  // User chip selection
  container.querySelectorAll('.user-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      selectedUserId = chip.dataset.userId;
      errorMsg = '';
      render(container);
      // Focus the PIN input
      setTimeout(() => container.querySelector('#pin-input')?.focus(), 50);
    });
  });

  // PIN input — submit on Enter
  const pinInput = container.querySelector('#pin-input');
  if (pinInput) {
    pinInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') handleSubmit(container);
    });
    // Clear error on type
    pinInput.addEventListener('input', () => {
      if (errorMsg) {
        errorMsg = '';
        const errEl = container.querySelector('.login-error');
        if (errEl) errEl.remove();
        pinInput.classList.remove('error');
      }
    });
  }

  // Show/hide PIN toggle
  container.querySelector('#pin-toggle')?.addEventListener('click', () => {
    showPin = !showPin;
    const input = container.querySelector('#pin-input');
    const toggle = container.querySelector('#pin-toggle');
    if (input) input.type = showPin ? 'text' : 'password';
    if (toggle) {
      toggle.textContent = showPin ? '🙈' : '👁️';
      toggle.setAttribute('aria-label', showPin ? 'Ocultar PIN' : 'Mostrar PIN');
    }
  });

  // Submit button
  container.querySelector('#login-submit')?.addEventListener('click', () => {
    handleSubmit(container);
  });
}

// ── Submit Handler ───────────────────────────────────────────

async function handleSubmit(container) {
  if (isLoading || !selectedUserId) return;

  const pinInput = container.querySelector('#pin-input');
  const pin = pinInput?.value?.trim();

  if (!pin) {
    showFieldError(container, 'Por favor ingresa tu PIN.');
    return;
  }

  isLoading = true;
  errorMsg  = '';
  render(container);

  const result = await apiService.authenticate(selectedUserId, pin);

  isLoading = false;

  if (result.error) {
    errorMsg = result.error;
    render(container);
    container.querySelector('#pin-input')?.classList.add('error');
    return;
  }

  // Success — update global state & session
  saveSession(result.user);
  setState({ currentUser: result.user, taskProgress: {} });

  showToast(`¡Bienvenido, ${result.user.name}!`, 'success');
}

function showFieldError(container, msg) {
  errorMsg = msg;
  render(container);
  container.querySelector('#pin-input')?.classList.add('error');
}
