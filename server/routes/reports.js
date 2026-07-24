/**
 * routes/reports.js — Registros de tareas
 * POST /api/reports            → Guardar reporte de turno (líder)
 * GET  /api/reports?date=      → Todos los reportes de un día (admin)
 * GET  /api/reports/me?date=   → Mi reporte del día (líder)
 */

const router  = require('express').Router();
const Report  = require('../models/Report');
const User    = require('../models/User');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// Util: fecha actual en "YYYY-MM-DD" (zona local del servidor)
function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// ── POST /api/reports ─────────────────────────────────────────
// El líder guarda (o actualiza) su reporte de turno
router.post('/', requireAuth, async (req, res) => {
  try {
    const { turno, dateKey, tasks } = req.body;
    const userId = req.session.userId;

    if (!turno || !['T1','T2'].includes(turno)) {
      return res.status(400).json({ error: 'Turno inválido. Usa T1 o T2.' });
    }
    if (!dateKey || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
      return res.status(400).json({ error: 'Formato de fecha inválido. Usa YYYY-MM-DD.' });
    }
    if (!tasks || typeof tasks !== 'object') {
      return res.status(400).json({ error: 'Se requiere el objeto de tareas.' });
    }

    // Upsert: si ya existe un reporte para userId+turno+dateKey, lo actualiza
    const report = await Report.findOneAndUpdate(
      { userId, turno, dateKey },
      {
        userId,
        userName: req.session.userName,
        turno,
        dateKey,
        tasks: new Map(Object.entries(tasks)),
        submittedAt: new Date(),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.json({ success: true, reportId: report._id });

  } catch (err) {
    console.error('[reports/create]', err);
    return res.status(500).json({ error: 'Error al guardar el reporte.' });
  }
});

// ── GET /api/reports?date=YYYY-MM-DD ─────────────────────────
// Admin: resumen de todos los líderes para una fecha dada
router.get('/', requireAdmin, async (req, res) => {
  try {
    const dateKey = req.query.date || todayKey();

    // Obtener todos los líderes activos
    const leaders = await User.find({ role: 'leader', active: true });

    // Obtener todos los reportes de ese día
    const reports = await Report.find({ dateKey });

    // Construir la respuesta por líder
    const result = leaders.map(leader => {
      const t1 = reports.find(r => r.userId.toString() === leader._id.toString() && r.turno === 'T1');
      const t2 = reports.find(r => r.userId.toString() === leader._id.toString() && r.turno === 'T2');

      return {
        userId:  leader._id.toString(),
        name:    leader.name,
        dateKey,
        t1: summarize(t1),
        t2: summarize(t2),
      };
    });

    return res.json({ reports: result });

  } catch (err) {
    console.error('[reports/get-all]', err);
    return res.status(500).json({ error: 'Error al obtener reportes.' });
  }
});

// ── GET /api/reports/me?date=YYYY-MM-DD ──────────────────────
// Líder: sus propios reportes del día
router.get('/me', requireAuth, async (req, res) => {
  try {
    const dateKey = req.query.date || todayKey();
    const userId  = req.session.userId;

    const reports = await Report.find({ userId, dateKey });

    return res.json({
      t1: summarize(reports.find(r => r.turno === 'T1')),
      t2: summarize(reports.find(r => r.turno === 'T2')),
    });

  } catch (err) {
    return res.status(500).json({ error: 'Error al obtener tus reportes.' });
  }
});

// ── Util: resume un reporte en formato consistente ────────────
function summarize(report) {
  if (!report) return { submitted: false, completed: 0, total: 0, tasks: {} };

  const tasksObj = Object.fromEntries(report.tasks);
  const total     = Object.keys(tasksObj).length;
  const completed = Object.values(tasksObj).filter(Boolean).length;

  return {
    submitted:   true,
    completed,
    total,
    tasks:       tasksObj,
    submittedAt: report.submittedAt,
  };
}

module.exports = router;
