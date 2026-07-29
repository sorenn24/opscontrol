const router = require('express').Router();
const Horario = require('../models/Horario');
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');

// Middleware to check if user has access to ORD/CUA or is admin
const checkAccess = async (req, res, next) => {
  try {
    const userRole = req.session.userRole;
    if (userRole === 'admin') {
      return next();
    }
    const userId = req.session.userId;
    const user = await User.findById(userId);
    const branches = user?.branches || [];
    if (branches.includes('ORD') || branches.includes('CUA')) {
      return next();
    }
    return res.status(403).json({ error: 'Acceso denegado. No tienes permisos para gestionar horarios de ORD o CUA.' });
  } catch (err) {
    console.error('[horarios/checkAccess]', err);
    return res.status(500).json({ error: 'Error al verificar permisos.' });
  }
};

// ── GET /api/horarios ─────────────────────────────────────────
router.get('/', requireAuth, checkAccess, async (req, res) => {
  try {
    const { week, sucursal } = req.query;
    
    if (!week || !sucursal) {
      return res.status(400).json({ error: 'Faltan parámetros requeridos (week, sucursal).' });
    }

    const horario = await Horario.findOne({ weekKey: week, sucursal });
    
    if (!horario) {
      // Devolvemos estructura vacía si no existe
      return res.json({ success: true, horario: { weekKey: week, sucursal, asignaciones: [] } });
    }

    return res.json({ success: true, horario });
  } catch (err) {
    console.error('[horarios/get]', err);
    return res.status(500).json({ error: 'Error al obtener el horario.' });
  }
});

// ── POST /api/horarios ────────────────────────────────────────
router.post('/', requireAuth, checkAccess, async (req, res) => {
  try {
    const { weekKey, semana_label, sucursal, asignaciones } = req.body;

    if (!weekKey || !semana_label || !sucursal) {
      return res.status(400).json({ error: 'Faltan campos requeridos (weekKey, semana_label, sucursal).' });
    }

    const payload = {
      weekKey,
      semana_label,
      sucursal,
      asignaciones: asignaciones || []
    };

    const horario = await Horario.findOneAndUpdate(
      { weekKey, sucursal },
      payload,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.json({ success: true, horario });
  } catch (err) {
    console.error('[horarios/create]', err);
    return res.status(500).json({ error: 'Error al guardar el horario.' });
  }
});

module.exports = router;
