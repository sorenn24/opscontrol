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

// ── Seed de datos iniciales ───────────────────────────────────
// Si no hay usuarios en la BD, crea los predeterminados
async function seedDefaultUsers() {
  const User = require('./models/User');
  const count = await User.countDocuments();
  if (count > 0) return;

  console.log('🌱 Creando usuarios iniciales...');
  await User.insertMany([
    { name: 'Alessandro', role: 'leader', pin: '1234' },
    { name: 'César',      role: 'leader', pin: '1234' },
    { name: 'Sam',        role: 'leader', pin: '1234' },
    { name: 'Soren',      role: 'leader', pin: '1234' },
    { name: 'La Jefa',    role: 'admin',  pin: '9999' },
  ]);
  console.log('✅ Usuarios iniciales creados');
}

mongoose.connection.once('open', () => {
  seedDefaultUsers().catch(console.error);
});

// ── Arrancar servidor ─────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 OpsControl corriendo en http://localhost:${PORT}`);
  console.log(`   Ambiente: ${process.env.NODE_ENV || 'development'}`);
});
