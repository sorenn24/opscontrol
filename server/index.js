/**
 * server/index.js — OpsControl Express Server
 *
 * Sirve:
 *  - La API REST en /api/*
 *  - El frontend estático (index.html + assets) en /
 */

require('dotenv').config();

const express      = require('express');
const session      = require('express-session');
const MongoStore   = require('connect-mongo');
const mongoose     = require('mongoose');
const cors         = require('cors');
const path         = require('path');

// ── Rutas ────────────────────────────────────────────────────
const authRouter    = require('./routes/auth');
const usersRouter   = require('./routes/users');
const reportsRouter = require('./routes/reports');
const ticketsRouter = require('./routes/tickets');
const empleadosRouter = require('./routes/empleados');
const horariosRouter = require('./routes/horarios');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Conexión a MongoDB ────────────────────────────────────────
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB conectado'))
  .catch(err => { console.error('❌ Error MongoDB:', err.message); process.exit(1); });

// ── Middleware global ─────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS — permite requests del frontend
app.use(cors({
  origin:      process.env.CLIENT_ORIGIN || '*',
  credentials: true,
}));

// Sesiones almacenadas en MongoDB
app.set('trust proxy', 1);
app.use(session({
  name:   'opscontrol.sid',
  secret: process.env.SESSION_SECRET || 'dev-secret-insecuro',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl:       process.env.MONGODB_URI,
    collectionName: 'sessions',
    ttl:            60 * 60 * 24 * 7, // 7 días
  }),
  cookie: {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge:   1000 * 60 * 60 * 24 * 7, // 7 días
  },
}));

// ── API Routes ────────────────────────────────────────────────
app.use('/api/auth',    authRouter);
app.use('/api/users',   usersRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/tickets', ticketsRouter);
app.use('/api/empleados', empleadosRouter);
app.use('/api/horarios', horariosRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    db:     mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    time:   new Date().toISOString(),
  });
});

// ── Frontend estático ─────────────────────────────────────────
// El servidor Express sirve los archivos del frontend directamente
const FRONTEND_DIR = path.join(__dirname, '..');  // branch-ops/

app.use(express.static(FRONTEND_DIR));

// Todas las rutas desconocidas → index.html (SPA fallback)
app.get('*', (req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
});

// ── Sincronización de usuarios y mapeo oficial ───────────────
async function syncLeaderBranches() {
  const User = require('./models/User');
  const OFFICIAL_MAPPING = [
    { name: 'César',      role: 'leader', pin: '1234', branches: ['LN2', 'INS', 'SMB', 'PL2', 'EC2', 'AVM'] },
    { name: 'Soren',      role: 'leader', pin: '1234', branches: ['ORD', 'CUA'] },
    { name: 'Alessandro', role: 'leader', pin: '1234', branches: ['ROD', 'LNO'] },
    { name: 'Yessi',      role: 'leader', pin: '1234', branches: ['MTU', 'MTC', 'BTJ', 'RS2'] },
    { name: 'Sam',        role: 'leader', pin: '1234', branches: ['RCS', 'ANT'] },
    { name: 'La Jefa',    role: 'admin',  pin: '9999', branches: [] },
  ];

  console.log('🔄 Sincronizando mapeo oficial de sucursales por líder...');
  for (const u of OFFICIAL_MAPPING) {
    await User.findOneAndUpdate(
      { name: u.name },
      { $set: { branches: u.branches, role: u.role }, $setOnInsert: { pin: u.pin, active: true } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }
  console.log('✅ Sucursales y usuarios oficiales sincronizados correctamente');
}

async function syncInitialEmployees() {
  const Empleado = require('./models/Empleado');
  const employees = [
    { nombre: 'JESY', sucursal_origen: 'ORD' },
    { nombre: 'HUGO', sucursal_origen: 'ORD' },
    { nombre: 'HECTOR', sucursal_origen: 'ORD' },
    { nombre: 'SU', sucursal_origen: 'ORD' },
    { nombre: 'JESUS', sucursal_origen: 'ORD' },
    { nombre: 'IANCO', sucursal_origen: 'ORD' },
    { nombre: 'SOREN', sucursal_origen: 'ORD' },
    { nombre: 'NESTOR', sucursal_origen: 'CUA' },
    { nombre: 'ANDRIK', sucursal_origen: 'CUA' },
    { nombre: 'RAMSES', sucursal_origen: 'CUA' },
    { nombre: 'ALEJANDRO', sucursal_origen: 'CUA' }
  ];

  console.log('🔄 Sincronizando empleados iniciales...');
  for (const emp of employees) {
    await Empleado.findOneAndUpdate(
      { nombre: emp.nombre, sucursal_origen: emp.sucursal_origen },
      { $setOnInsert: { activo: true } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }
  console.log('✅ Empleados iniciales sincronizados correctamente');
}

mongoose.connection.once('open', () => {
  syncLeaderBranches().then(() => syncInitialEmployees()).catch(console.error);
});

// ── Arrancar servidor ─────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 OpsControl corriendo en http://localhost:${PORT}`);
  console.log(`   Ambiente: ${process.env.NODE_ENV || 'development'}`);
});
