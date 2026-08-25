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

    // ── Enviar datos a Google Sheets (Webhook) ──
    try {
      const webhookUrl = 'https://script.google.com/macros/s/AKfycbyziTz7xRbzQrcjCT7_u0iMQSGE0qojp4EEGO-tLFZr4HIJQ8zESUvzScTcfG4PDwvT/exec';
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const sheetData = {
        fecha_ticket: fecha_ticket,
        sucursal: sucursal,
        turno: turno,
        empleado: `${empleado_nombre} ${empleado_apellido}`.trim(),
        monto: monto,
        foto_url: `${baseUrl}/api/ventas/${nuevaVenta._id}/image`,
        fecha_registro: new Date().toLocaleString('es-MX')
      };
      
      // Enviamos la petición asíncrona sin bloquear al usuario
      fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sheetData)
      }).catch(err => console.error('[ventas/googleSheets] Fetch Error:', err));
    } catch (sheetErr) {
      console.error('[ventas/googleSheets] Setup Error:', sheetErr);
    }

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

// ── GET /api/ventas/trigger-sync (Admin) ───────────────────────────────
router.get('/trigger-sync', requireAuth, checkLeaderAccess, async (req, res) => {
  if (req.session.userRole !== 'admin') {
    return res.status(403).send('No tienes permisos. Solo administrador.');
  }
  
  try {
    const skipCount = parseInt(req.query.skip) || 0;
    // Excluir foto_base64 para no exceder el límite de memoria de 32MB de MongoDB al ordenar
    const ventas = await VentaExtraordinaria.find({}).select('-foto_base64').sort({ createdAt: 1 }).skip(skipCount);
    const webhookUrl = 'https://script.google.com/macros/s/AKfycbyziTz7xRbzQrcjCT7_u0iMQSGE0qojp4EEGO-tLFZr4HIJQ8zESUvzScTcfG4PDwvT/exec';
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    
    // Devolvemos el mensaje rápido para que la pantalla no se quede cargando
    res.send(`<h1>Iniciando sincronización...</h1><p>Saltando los primeros ${skipCount} registros.</p><p>Se enviarán los ${ventas.length} registros restantes a Google Sheets en segundo plano.</p><script>setTimeout(()=>window.close(), 3500)</script>`);

    // Proceso asíncrono en background
    (async () => {
      let successCount = 0;
      for (let i = 0; i < ventas.length; i++) {
        const v = ventas[i];
        const sheetData = {
          fecha_ticket: v.fecha_ticket || '',
          sucursal: v.sucursal || '',
          turno: v.turno || '',
          empleado: `${v.empleado_nombre} ${v.empleado_apellido}`.trim(),
          monto: v.monto || 0,
          foto_url: `${baseUrl}/api/ventas/${v._id}/image`,
          fecha_registro: new Date(v.createdAt).toLocaleString('es-MX')
        };
        try {
          const resp = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sheetData)
          });
          if (resp.ok) successCount++;
        } catch (err) { console.error('Error enviando a sheets:', err); }
        
        await new Promise(r => setTimeout(r, 600)); // 0.6 seg por petición
      }
      console.log(`[Google Sheets] Sincronización completada: ${successCount} registros enviados.`);
    })();
  } catch (err) {
    console.error('Error sincronizacion profunda:', err);
    return res.status(500).send(`<h1>Error al iniciar la sincronización</h1><p>${err.message}</p><p>${err.stack}</p>`);
  }
});

// ── GET /api/ventas/test-sheets (Admin) ──────────────────────────────
router.get('/test-sheets', requireAuth, checkLeaderAccess, async (req, res) => {
  if (req.session.userRole !== 'admin') return res.status(403).send('No tienes permisos.');
  try {
    const webhookUrl = 'https://script.google.com/macros/s/AKfycbyziTz7xRbzQrcjCT7_u0iMQSGE0qojp4EEGO-tLFZr4HIJQ8zESUvzScTcfG4PDwvT/exec';
    const testData = {
      fecha_ticket: "2026-08-24",
      sucursal: "TEST",
      turno: "T1",
      empleado: "Robot Prueba",
      monto: 999,
      foto_url: "https://test.com/foto",
      fecha_registro: new Date().toLocaleString('es-MX')
    };

    const resp = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testData)
    });
    
    const text = await resp.text();
    
    res.send(`
      <h1>Diagnóstico de Google Sheets</h1>
      <p><b>Status de respuesta:</b> ${resp.status} ${resp.statusText}</p>
      <p>Si la respuesta de abajo dice "status: success", significa que ya debería aparecer en tu hoja de Excel.</p>
      <p>Si sale un código enorme de HTML, significa que olvidaste poner que "Cualquier Persona" tenga acceso al Webhook.</p>
      <hr>
      <h3>Respuesta cruda de Google:</h3>
      <pre style="background:#222;color:#0f0;padding:15px;white-space:pre-wrap;">${text.replace(/</g, '&lt;')}</pre>
    `);
  } catch (err) {
    res.status(500).send(`<h1>Error técnico:</h1><p>${err.message}</p>`);
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
