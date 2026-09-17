// ============================================================
// SERVICE WORKER — OpsControl PWA
// Cache-first para assets estaticos, network-first para API
// ============================================================
const CACHE_NAME = 'opscontrol-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/assets/mascot.png',
  '/styles/reset.css',
  '/styles/tokens.css',
  '/styles/app.css',
  '/styles/glass.css',
  '/components/Login/Login.css',
  '/components/LeaderDashboard/LeaderDashboard.css',
  '/components/AdminDashboard/AdminDashboard.css',
  '/components/TicketI24/TicketI24.css',
  '/components/Horarios/Horarios.css',
  '/components/Ventas/Ventas.css'
];

// Instalar: guardar assets en cache
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activar: limpiar caches viejos
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: cache-first para estaticos, network-first para /api/*
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Peticiones a la API siempre van a la red (nunca cachear datos live)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Para assets estaticos: cache primero, red como respaldo
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
