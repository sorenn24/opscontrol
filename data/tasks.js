/**
 * tasks.js — Task Catalog
 * Single source of truth for all task definitions.
 * Each task: { id, label, turno, special?, day? }
 */

export const TURNO_1_TASKS = [
  { id: 't1_01', label: 'Entrada con arqueo y foto de fondo T1' },
  { id: 't1_02', label: 'Revisar ventas por hora' },
  { id: 't1_03', label: 'Ventas en el grupo' },
  { id: 't1_04', label: 'Llenado de bitácora T1' },
  { id: 't1_05', label: 'Revisión de faltantes' },
  { id: 't1_06', label: 'Actualizar formato de vacantes' },
  { id: 't1_07', label: 'Ventas Drive' },
  { id: 't1_08', label: 'Actas validadas' },
  { id: 't1_09', label: 'Revisión de snack y novedades' },
  { id: 't1_10', label: 'Revisión de tickets i24h' },
  { id: 't1_11', label: 'Auditoría diaria' },
  { id: 't1_12', label: 'Revisiones de contadores' },
  { id: 't1_13', label: 'Captura de actas del día anterior' },
  { id: 't1_14', label: 'Revisión de limpieza T1' },
  { id: 't1_15', label: 'Corte de sucursal' },
];

export const TURNO_2_TASKS = [
  { id: 't2_01', label: 'Entrada con arqueo y foto de fondo T2' },
  { id: 't2_02', label: 'Auditoría diaria' },
  { id: 't2_03', label: 'Revisar ventas por hora' },
  { id: 't2_04', label: 'Llenado correcto de bitácora T2' },
  { id: 't2_05', label: 'Revisión de snack y novedades' },
  { id: 't2_06', label: 'Revisión de limpieza T2' },
  { id: 't2_07', label: 'Corte de caja' },
];

/**
 * Special tasks injected dynamically based on day-of-week.
 * day: 1 = Monday, 4 = Thursday (JS getDay() values)
 */
export const SPECIAL_TASKS = [
  {
    id: 'sp_inventarios',
    label: 'Inventarios',
    days: [1, 4],   // Monday & Thursday
    emoji: '📦',
  },
  {
    id: 'sp_nominas',
    label: 'Nóminas',
    days: [4],       // Thursday only
    emoji: '💰',
  },
];

/**
 * Returns the base task list for a given turno, plus
 * any special tasks that apply to today's day-of-week.
 *
 * @param {'T1'|'T2'} turno
 * @param {Date} [date=new Date()]
 * @returns {Array<{ id: string, label: string, special?: boolean }>}
 */
export function getTasksForTurno(turno, date = new Date()) {
  const base = turno === 'T1' ? TURNO_1_TASKS : TURNO_2_TASKS;
  const dayOfWeek = date.getDay();

  const specials = SPECIAL_TASKS
    .filter(t => t.days.includes(dayOfWeek))
    .map(t => ({ ...t, special: true }));

  return [...base, ...specials];
}
