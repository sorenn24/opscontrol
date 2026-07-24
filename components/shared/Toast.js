/**
 * Toast.js — Toast Notification Component
 * Displays non-blocking feedback messages at bottom of screen.
 *
 * Usage:
 *   import { showToast } from './components/shared/Toast.js';
 *   showToast('Guardado con éxito', 'success');
 *   showToast('Sin conexión', 'warning');
 */

const ICONS = {
  success: '✓',
  danger:  '✕',
  warning: '⚠',
  info:    'ℹ',
};

/**
 * Shows a toast notification.
 * @param {string} message
 * @param {'success'|'danger'|'warning'|'info'} [type='info']
 * @param {number} [duration=3500] ms before auto-dismiss
 */
export function showToast(message, type = 'info', duration = 3500) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', 'alert');
  toast.innerHTML = `
    <span class="toast-icon" style="font-size:16px; font-weight:700; flex-shrink:0;">${ICONS[type] || 'ℹ'}</span>
    <span class="toast-message" style="flex:1; line-height:1.4;">${message}</span>
  `;

  container.appendChild(toast);

  // Auto-dismiss
  const timer = setTimeout(() => dismissToast(toast), duration);

  // Tap to dismiss
  toast.addEventListener('click', () => {
    clearTimeout(timer);
    dismissToast(toast);
  }, { once: true });
}

function dismissToast(toast) {
  toast.classList.add('toast-exit');
  toast.addEventListener('animationend', () => toast.remove(), { once: true });
}
