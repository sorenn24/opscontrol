/**
 * dateUtils.js — Date & Day-of-Week Helpers
 */

const DAY_NAMES_ES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MONTH_NAMES_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/**
 * Returns the day of the week (0=Sun … 6=Sat) for a given date.
 * @param {Date} [date=new Date()]
 */
export function getDayOfWeek(date = new Date()) {
  return date.getDay();
}

export function isMonday(date = new Date())   { return getDayOfWeek(date) === 1; }
export function isThursday(date = new Date()) { return getDayOfWeek(date) === 4; }

/**
 * Formats a date as "jueves, 24 de julio de 2026"
 */
export function formatDateLong(date = new Date()) {
  const day   = DAY_NAMES_ES[date.getDay()];
  const d     = date.getDate();
  const month = MONTH_NAMES_ES[date.getMonth()];
  const year  = date.getFullYear();
  return `${day}, ${d} de ${month} de ${year}`;
}

/**
 * Formats date as ISO "YYYY-MM-DD" string (used as storage key)
 */
export function formatDateKey(date = new Date()) {
  const y  = date.getFullYear();
  const m  = String(date.getMonth() + 1).padStart(2, '0');
  const d  = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Parses "YYYY-MM-DD" string back to a Date object.
 */
export function parseDateKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Returns today formatted as ISO date key.
 */
export function todayKey() {
  return formatDateKey(new Date());
}
