/**
 * routes/tickets.js — Validación de Tickets i24
 * POST /api/tickets          → Guardar o actualizar validación de tickets
 * GET  /api/tickets?date=    → Consultar validaciones por fecha (filtrado por rol)
 */

const router    = require('express').Router();
const TicketI24 = require('../models/TicketI24');
const User      = require('../models/User');
const { requireAuth } = require('../middleware/auth');

// ── POST /api/tickets ─────────────────────────────────────────
// Guardar o actualizar registro de Tickets i24 para sucursal y día
router.post('/', requireAuth, async (req, res) => {
  try {
    const { dateKey, sucursal, tiene_tickets, t1, t2, t3, tiene_nota, nota_texto } = req.body;
    const userId = req.session.userId;
    const userName = req.session.userName;

    if (!dateKey || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
      return res.status(400).json({ error: 'Formato de fecha inválido. Usa YYYY-MM-DD.' });
    }
    if (!sucursal || typeof sucursal !== 'string' || !sucursal.trim()) {
      return res.status(400).json({ error: 'Debes especificar una sucursal.' });
    }

    let t1Data = { reportado: 0, justificado: 0, faltante: 0 };
    let t2Data = { reportado: 0, justificado: 0, faltante: 0 };
    let t3Data = { reportado: 0, justificado: 0, faltante: 0 };

    if (tiene_tickets !== false) {
      const calcTurno = (t = {}) => {
        const rep  = Number(t.reportado) || 0;
        const just = Number(t.justificado) || 0;
        return {
          reportado: rep,
          justificado: just,
          faltante: rep - just,
        };
      };
      t1Data = calcTurno(t1);
      t2Data = calcTurno(t2);
      t3Data = calcTurno(t3);
    }

    const payload = {
      dateKey,
      sucursal: sucursal.trim(),
      leaderId: userId,
      leaderName: userName || 'Líder',
      tiene_tickets: tiene_tickets !== false,
      t1: t1Data,
      t2: t2Data,
      t3: t3Data,
      tiene_nota: Boolean(tiene_nota),
      nota_texto: tiene_nota ? (nota_texto || '').trim() : '',
    };

    const ticket = await TicketI24.findOneAndUpdate(
      { dateKey, sucursal: payload.sucursal },
      payload,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.json({ success: true, ticket });
  } catch (err) {
    console.error('[tickets/create]', err);
    return res.status(500).json({ error: 'Error al guardar la validación de Tickets i24.' });
  }
});

// ── GET /api/tickets?date=YYYY-MM-DD ─────────────────────────
// Consultar validaciones del día (admin ve todas, líder ve sus sucursales asignadas)
router.get('/', requireAuth, async (req, res) => {
  try {
    const { date } = req.query;
    const dateKey = date || new Date().toISOString().slice(0, 10);
    const userId = req.session.userId;
    const userRole = req.session.userRole;

    let filter = { dateKey };

    // Si no es admin, filtramos por las sucursales asignadas al líder
    if (userRole !== 'admin') {
      const user = await User.findById(userId);
      const branches = user?.branches || [];
      if (branches.length === 0) {
        return res.json({ success: true, tickets: [] });
      }
      filter.sucursal = { $in: branches };
    }

    const tickets = await TicketI24.find(filter).sort({ sucursal: 1 });
    return res.json({ success: true, tickets });
  } catch (err) {
    console.error('[tickets/get]', err);
    return res.status(500).json({ error: 'Error al obtener los tickets.' });
  }
});

module.exports = router;
