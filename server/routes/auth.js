/**
 * routes/auth.js — Autenticación
 * POST /api/auth/login
 * POST /api/auth/logout
 * GET  /api/auth/me
 */

const router = require('express').Router();
const User   = require('../models/User');
const { requireAuth } = require('../middleware/auth');

// ── POST /api/auth/login ─────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { userId, pin } = req.body;

    if (!userId || !pin) {
      return res.status(400).json({ error: 'Se requiere userId y pin.' });
    }

    const user = await User.findById(userId);

    if (!user || !user.active) {
      return res.status(401).json({ error: 'Usuario no encontrado.' });
    }

    if (user.pin !== pin) {
      return res.status(401).json({ error: 'PIN incorrecto. Intenta de nuevo.' });
    }

    // Guardar sesión
    req.session.userId   = user._id.toString();
    req.session.userName = user.name;
    req.session.userRole = user.role;

    return res.json({ user: user.toPublic() });

  } catch (err) {
    console.error('[auth/login]', err);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// ── POST /api/auth/logout ────────────────────────────────────
router.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ error: 'Error al cerrar sesión.' });
    res.clearCookie('opscontrol.sid');
    return res.json({ success: true });
  });
});

// ── GET /api/auth/me ─────────────────────────────────────────
router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });
    return res.json({ user: user.toPublic() });
  } catch (err) {
    return res.status(500).json({ error: 'Error interno.' });
  }
});

module.exports = router;
