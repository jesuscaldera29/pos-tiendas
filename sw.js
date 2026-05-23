const CACHE_NAME = 'pos-tienda-v1';
const ASSETS = [
  '/', '/index.html', '/app.html', '/login.html', '/superadmin.html',
  '/css/styles.css', '/css/landing.css',
  '/js/supabase-config.js', '/js/db.js', '/js/app.js', '/js/pos.js',
  '/js/inventory.js', '/js/customers.js', '/js/cashbox.js',
  '/js/expenses.js', '/js/reports.js', '/js/settings.js',
  '/js/tickets.js', '/js/barcode.js', '/js/sounds.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://cdn.jsdelivr.net/npm/chart.js@4',
  'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  e.respondWith(
    fetch(e.request).then(res => {
      const clone = res.clone();
      caches.open(CACHE_NAME).then(c => c.put(e.request, clone)).catch(() => {});
      return res;
    }).catch(() => caches.match(e.request))
  );
});
