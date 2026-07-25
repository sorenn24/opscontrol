/**
 * routes/users.js — Gestión de Usuarios
 * GET    /api/users          → Lista pública (sin PIN)
 * POST   /api/users          → Agregar líder (admin)
 * PUT    /api/users/:id      → Editar líder  (admin)
 * DELETE /api/users/:id      → Eliminar líder (admin)
 */

const router = require('express').Router();
const User   = require('../models/User');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// ── GET /api/users ────────────────────────────────────────────
// Devuelve todos los usuarios activos SIN el PIN
router.get('/', async (req, res) => {
  try {
    const users = await User.find({ active: true }).sort({ role: -1, name: 1 });
    return res.json({ users: users.map(u => u.toPublic()) });
  } catch (err) {
    return res.status(500).json({ error: 'Error al obtener usuarios.' });
  }
});

// ── POST /api/users ───────────────────────────────────────────
// Solo admin puede agregar líderes
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { name, pin } = req.body;

    if (!name || !pin) {
      return res.status(400).json({ error: 'Se requiere nombre y PIN.' });
    }
    if (pin.length < 4 || !/^\d+$/.test(pin)) {
      return res.status(400).json({ error: 'El PIN debe ser numérico y tener mínimo 4 dígitos.' });
    }

    const user = await User.create({ name: name.trim(), pin: pin.trim(), role: 'leader' });
    return res.status(201).json({ user: user.toPublic() });

  } catch (err) {
    console.error('[users/create]', err);
    return res.status(500).json({ error: 'Error al crear usuario.' });
  }
});

// ── PUT /api/users/:id ────────────────────────────────────────
// Solo admin puede editar líderes
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { name, pin } = req.body;
    const update = {};

    if (name) update.name = name.trim();
    if (pin) {
      if (pin.length < 4 || !/^\d+$/.test(pin)) {
        return res.status(400).json({ error: 'El PIN debe ser numérico y tener mínimo 4 dígitos.' });
      }
      update.pin = pin.trim();
    }

    const user = await User.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });

    return res.json({ user: user.toPublic() });

  } catch (err) {
    return res.status(500).json({ error: 'Error al actualizar usuario.' });
  }
});

// ── DELETE /api/users/:id ─────────────────────────────────────
// Solo admin puede eliminar líderes (soft delete)
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    // Protección: no se puede eliminar al admin
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });
    if (user.role === 'admin') {
      return res.status(403).json({ error: 'No se puede eliminar al administrador.' });
    }

    // Soft delete: marca como inactivo en vez de borrar el historial
    await User.findByIdAndUpdate(req.params.id, { active: false });
    return res.json({ success: true });

  } catch (err) {
    return res.status(500).json({ error: 'Error al eliminar usuario.' });
  }
});

// ── GET /api/users/:id/pin ────────────────────────────────────
// Admin puede consultar el PIN de un líder
router.get('/:id/pin', requireAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });
    return res.json({ pin: user.pin });
  } catch (err) {
    return res.status(500).json({ error: 'Error al obtener PIN.' });
  }
});

module.exports = router;
