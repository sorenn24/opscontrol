const router = require('express').Router();
const Empleado = require('../models/Empleado');
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
    return res.status(403).json({ error: 'Acceso denegado. No tienes permisos para gestionar empleados de ORD o CUA.' });
  } catch (err) {
    console.error('[empleados/checkAccess]', err);
    return res.status(500).json({ error: 'Error al verificar permisos.' });
  }
};

// ── GET /api/empleados ─────────────────────────────────────────
router.get('/', requireAuth, checkAccess, async (req, res) => {
  try {
    const { sucursal, all } = req.query;
    let filter = {};

    if (!all || all !== 'true') {
      filter.activo = true;
    }
    
    if (sucursal) {
      filter.sucursal_origen = sucursal;
    }

    const empleados = await Empleado.find(filter).sort({ nombre: 1 });
    return res.json({ success: true, empleados });
  } catch (err) {
    console.error('[empleados/get]', err);
    return res.status(500).json({ error: 'Error al obtener los empleados.' });
  }
});

// ── POST /api/empleados ────────────────────────────────────────
router.post('/', requireAuth, checkAccess, async (req, res) => {
  try {
    const { nombre, sucursal_origen } = req.body;
    
    if (!nombre || !sucursal_origen) {
      return res.status(400).json({ error: 'Faltan campos requeridos (nombre, sucursal_origen).' });
    }

    const nuevoEmpleado = new Empleado({
      nombre,
      sucursal_origen
    });

    await nuevoEmpleado.save();
    return res.json({ success: true, empleado: nuevoEmpleado });
  } catch (err) {
    console.error('[empleados/create]', err);
    return res.status(500).json({ error: 'Error al crear el empleado.' });
  }
});

// ── PUT /api/empleados/:id ─────────────────────────────────────
router.put('/:id', requireAuth, checkAccess, async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, sucursal_origen, activo } = req.body;

    const empleado = await Empleado.findById(id);
    if (!empleado) {
      return res.status(404).json({ error: 'Empleado no encontrado.' });
    }

    if (nombre !== undefined) empleado.nombre = nombre;
    if (sucursal_origen !== undefined) empleado.sucursal_origen = sucursal_origen;
    if (activo !== undefined) empleado.activo = activo;

    await empleado.save();
    return res.json({ success: true, empleado });
  } catch (err) {
    console.error('[empleados/update]', err);
    return res.status(500).json({ error: 'Error al actualizar el empleado.' });
  }
});

// ── DELETE /api/empleados/:id ──────────────────────────────────
router.delete('/:id', requireAuth, checkAccess, async (req, res) => {
  try {
    const { id } = req.params;
    const empleado = await Empleado.findById(id);
    if (!empleado) {
      return res.status(404).json({ error: 'Empleado no encontrado.' });
    }

    empleado.activo = false;
    await empleado.save();

    return res.json({ success: true, mensaje: 'Empleado desactivado correctamente.', empleado });
  } catch (err) {
    console.error('[empleados/delete]', err);
    return res.status(500).json({ error: 'Error al eliminar (desactivar) el empleado.' });
  }
});

module.exports = router;
