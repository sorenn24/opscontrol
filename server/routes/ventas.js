const router = require('express').Router();
const VentaExtraordinaria = require('../models/VentaExtraordinaria');
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');

// ── Middleware: check leader access for GET/PUT ──────────────────
const checkLeaderAccess = async (req, res, next) => {
  try {
    const userRole = req.session.userRole;
    if (userRole === 'admin') return next();

    const userId = req.session.userId;
    const user = await User.findById(userId);
    req.userBranches = user?.branches || [];
    return next();
  } catch (err) {
    console.error('[ventas/checkAccess]', err);
    return res.status(500).json({ error: 'Error al verificar permisos.' });
  }
};

// ── POST /api/ventas (Empleados) ──────────────────────────────────
// Public route (no requireAuth) because employees use a simple UI without full login.
router.post('/', async (req, res) => {
  try {
    const { fecha_ticket, sucursal, turno, empleado_nombre, empleado_apellido, monto, foto_base64 } = req.body;

    if (!fecha_ticket || !sucursal || !turno || !empleado_nombre || !empleado_apellido || !monto || !foto_base64) {
      return res.status(400).json({ error: 'Faltan campos requeridos.' });
    }

    if (monto < 300) {
      return res.status(400).json({ error: 'El monto debe ser de al menos $300.' });
    }

    // Check payload size, base64 strings can be large. Express json body parser limit applies (usually 100kb, up to 50mb if configured).
    // The frontend should compress the image.

    const nuevaVenta = new VentaExtraordinaria({
      fecha_ticket,
      sucursal,
      turno,
      empleado_nombre,
      empleado_apellido,
      monto,
      foto_base64
    });

    await nuevaVenta.save();
    return res.json({ success: true, venta: nuevaVenta });
  } catch (err) {
    console.error('[ventas/create]', err);
    return res.status(500).json({ error: 'Error al registrar la venta extraordinaria.' });
  }
});

// ── GET /api/ventas (Líderes/Admin) ───────────────────────────────
router.get('/', requireAuth, checkLeaderAccess, async (req, res) => {
  try {
    const { date, sucursal, turno, nombre } = req.query;
    
    let filter = {};
    if (date) filter.fecha_ticket = new RegExp('^' + date);
    if (turno) filter.turno = turno;
    if (nombre) filter.empleado_nombre = new RegExp(nombre, 'i');

    // Admin can see all, leaders only their branches
    if (req.session.userRole !== 'admin') {
      filter.sucursal = { $in: req.userBranches };
    }
    
    // If a specific sucursal is filtered by the user, and they have access to it:
    if (sucursal) {
      if (req.session.userRole === 'admin' || req.userBranches.includes(sucursal)) {
        filter.sucursal = sucursal;
      } else {
        return res.json({ success: true, ventas: [] }); // No access
      }
    }

    const ventas = await VentaExtraordinaria.find(filter).select('-foto_base64').sort({ createdAt: -1 });
    return res.json({ success: true, ventas });
  } catch (err) {
    console.error('[ventas/get]', err);
    return res.status(500).json({ error: 'Error al obtener las ventas extraordinarias.' });
  }
});

// ── GET /api/ventas/:id/image ──────────────────────────────────────
router.get('/:id/image', requireAuth, checkLeaderAccess, async (req, res) => {
  try {
    const { id } = req.params;
    const { full } = req.query;
    const venta = await VentaExtraordinaria.findById(id).select('foto_base64 sucursal');
    if (!venta || !venta.foto_base64) {
      return res.status(404).send('Imagen no encontrada.');
    }

    if (req.session.userRole !== 'admin' && !req.userBranches.includes(venta.sucursal)) {
      return res.status(403).send('No tienes permiso para ver esta imagen.');
    }

    const matches = venta.foto_base64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).send('Datos de imagen inválidos.');
    }

    const data = Buffer.from(matches[2], 'base64');

    if (full === 'true') {
      res.set('Content-Type', matches[1]);
      res.set('Cache-Control', 'public, max-age=604800'); // Cache de 7 días
      return res.send(data);
    } else {
      const sharp = require('sharp');
      const optimizedImage = await sharp(data)
        .resize({ width: 400, withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();

      res.set('Content-Type', 'image/webp');
      res.set('Cache-Control', 'public, max-age=604800'); // Cache de 7 días
      return res.send(optimizedImage);
    }
  } catch (err) {
    console.error('[ventas/image]', err);
    return res.status(500).send('Error al obtener la imagen.');
  }
});

// ── PUT /api/ventas/:id/validar ────────────────────────────────────
router.put('/:id/validar', requireAuth, checkLeaderAccess, async (req, res) => {
  try {
    const { id } = req.params;
    const { estado_validacion } = req.body; // 'VALIDADO' o 'RECHAZADO'

    if (!['VALIDADO', 'RECHAZADO'].includes(estado_validacion)) {
      return res.status(400).json({ error: 'Estado de validación incorrecto.' });
    }

    const venta = await VentaExtraordinaria.findById(id);
    if (!venta) {
      return res.status(404).json({ error: 'Venta no encontrada.' });
    }

    if (req.session.userRole !== 'admin' && !req.userBranches.includes(venta.sucursal)) {
      return res.status(403).json({ error: 'No tienes permiso para validar esta venta.' });
    }

    venta.estado_validacion = estado_validacion;
    await venta.save();

    return res.json({ success: true, venta });
  } catch (err) {
    console.error('[ventas/validar]', err);
    return res.status(500).json({ error: 'Error al validar la venta.' });
  }
});

// ── DELETE /api/ventas/:id ────────────────────────────────────────
router.delete('/:id', requireAuth, checkLeaderAccess, async (req, res) => {
  try {
    const { id } = req.params;
    const venta = await VentaExtraordinaria.findById(id);
    if (!venta) return res.status(404).json({ error: 'Venta no encontrada.' });

    if (req.session.userRole !== 'admin' && !req.userBranches.includes(venta.sucursal)) {
      return res.status(403).json({ error: 'No tienes permiso para eliminar esta venta.' });
    }

    await VentaExtraordinaria.findByIdAndDelete(id);
    return res.json({ success: true });
  } catch (err) {
    console.error('[ventas/delete]', err);
    return res.status(500).json({ error: 'Error al eliminar la venta.' });
  }
});

module.exports = router;
