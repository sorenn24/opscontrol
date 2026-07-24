/**
 * appState.js — Global State Manager (Pub-Sub Pattern)
 *
 * Lightweight state container. No external dependencies.
 * Components subscribe to state slices and re-render on change.
 *
 * Usage:
 *   import { getState, setState, subscribe } from './store/appState.js';
 *   subscribe('currentUser', (user) => { ... });
 *   setState({ currentUser: { name: 'Alessandro', role: 'leader' } });
 */

/** @type {Map<string, Set<Function>>} */
const subscribers = new Map();

/** @type {AppState} */
let state = {
  /** @type {{ name: string, role: 'leader'|'admin' } | null} */
  currentUser: null,

  /** @type {'T1'|'T2'} */
  currentTurno: 'T1',

  /**
   * Active leader's task progress for current session.
   * Map of taskId → checked (boolean)
   * @type {Record<string, boolean>}
   */
  taskProgress: {},

  /**
   * All submissions stored locally (used by admin view).
   * @type {Array<Submission>}
   */
  submissions: [],

  /**
   * Date being viewed in the Admin Dashboard (YYYY-MM-DD)
   * @type {string}
   */
  adminViewDate: null,
};

// ── Public API ───────────────────────────────────────────────

/**
 * Returns the current full state (immutable snapshot).
 * @returns {AppState}
 */
export function getState() {
  return { ...state };
}

/**
 * Merges a partial state update and notifies relevant subscribers.
 * @param {Partial<AppState>} patch
 */
export function setState(patch) {
  const prev = state;
  state = { ...state, ...patch };

  Object.keys(patch).forEach(key => {
    const handlers = subscribers.get(key);
    if (handlers) {
      handlers.forEach(fn => fn(state[key], prev[key]));
    }
  });

  // Always fire wildcard subscribers
  const wildcards = subscribers.get('*');
  if (wildcards) {
    wildcards.forEach(fn => fn(state, prev));
  }
}

/**
 * Subscribe to state changes for a specific key (or '*' for all).
 * @param {string} key - State key to watch, or '*' for all changes.
 * @param {Function} handler - Called with (newValue, prevValue).
 * @returns {Function} Unsubscribe function.
 */
export function subscribe(key, handler) {
  if (!subscribers.has(key)) subscribers.set(key, new Set());
  subscribers.get(key).add(handler);
  return () => subscribers.get(key)?.delete(handler);
}

/**
 * Resets task progress for a fresh leader session.
 */
export function resetTaskProgress() {
  setState({ taskProgress: {} });
}

/**
 * Toggles a task's checked state.
 * @param {string} taskId
 */
export function toggleTask(taskId) {
  const progress = { ...state.taskProgress };
  progress[taskId] = !progress[taskId];
  setState({ taskProgress: progress });
}
