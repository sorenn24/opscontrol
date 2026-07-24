/**
 * middleware/auth.js
 * Middleware de autenticación para rutas protegidas.
 */

// Verifica que el usuario tenga sesión activa
function requireAuth(req, res, next) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: 'No autenticado. Por favor inicia sesión.' });
  }
  next();
}

// Verifica que el usuario autenticado sea admin (La Jefa)
function requireAdmin(req, res, next) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: 'No autenticado.' });
  }
  if (req.session.userRole !== 'admin') {
    return res.status(403).json({ error: 'Acceso denegado. Se requiere rol de administrador.' });
  }
  next();
}

module.exports = { requireAuth, requireAdmin };
