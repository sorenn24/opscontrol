/**
 * storage.js — LocalStorage Helpers
 * Provides typed wrappers for reading/writing persistent data.
 * Used as an offline fallback when the API is unreachable.
 */

const KEYS = {
  DRAFTS:      'opscontrol:drafts',
  SUBMISSIONS: 'opscontrol:submissions',
  SESSION:     'opscontrol:session',
};

// ── Generic Helpers ──────────────────────────────────────────

function read(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw !== null ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function remove(key) {
  try { localStorage.removeItem(key); } catch { /* noop */ }
}

// ── Session ─────────────────────────────────────────────────

export function saveSession(user) {
  write(KEYS.SESSION, user);
}

export function loadSession() {
  return read(KEYS.SESSION, null);
}

export function clearSession() {
  remove(KEYS.SESSION);
}

// ── Drafts (Offline Fallback) ────────────────────────────────

/**
 * Save a report draft when the network is unavailable.
 * @param {{ userId, turno, dateKey, tasks: Record<string,boolean> }} report
 */
export function saveDraft(report) {
  const drafts = read(KEYS.DRAFTS, []);
  // Overwrite if same user+turno+date already exists
  const idx = drafts.findIndex(
    d => d.userId === report.userId && d.turno === report.turno && d.dateKey === report.dateKey
  );
  if (idx >= 0) drafts[idx] = report;
  else drafts.push(report);
  write(KEYS.DRAFTS, drafts);
}

export function getDrafts() {
  return read(KEYS.DRAFTS, []);
}

export function clearDraft(userId, turno, dateKey) {
  const drafts = read(KEYS.DRAFTS, []).filter(
    d => !(d.userId === userId && d.turno === turno && d.dateKey === dateKey)
  );
  write(KEYS.DRAFTS, drafts);
}

// ── Local Submissions (Mock Backend Storage) ─────────────────

/**
 * Saves a submitted report locally (used by the mock API service).
 * @param {{ userId, turno, dateKey, tasks, submittedAt }} submission
 */
export function saveSubmission(submission) {
  const subs = read(KEYS.SUBMISSIONS, []);
  const idx  = subs.findIndex(
    s => s.userId === submission.userId && s.turno === submission.turno && s.dateKey === submission.dateKey
  );
  if (idx >= 0) subs[idx] = submission;
  else subs.push(submission);
  write(KEYS.SUBMISSIONS, subs);
}

/**
 * Retrieves all submissions for a specific date key.
 * @param {string} dateKey "YYYY-MM-DD"
 * @returns {Array}
 */
export function getSubmissionsForDate(dateKey) {
  const subs = read(KEYS.SUBMISSIONS, []);
  return subs.filter(s => s.dateKey === dateKey);
}

export function getAllSubmissions() {
  return read(KEYS.SUBMISSIONS, []);
}
