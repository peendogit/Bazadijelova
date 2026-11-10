// Service worker: omogućava instalaciju na telefon i brže otvaranje.
// API (/api) se nikad ne kešira, tako da su cijene i stanje uvijek svježi.
const VERZIJA = 'bd-v1';
const OSNOVA = ['/', '/manifest.webmanifest', '/favicon.svg', '/ikona-192.png', '/ikona-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERZIJA).then((c) => c.addAll(OSNOVA)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((x) => x !== VERZIJA).map((x) => caches.delete(x)))));
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin || url.pathname.startsWith('/api/')) return;

  // Stranice: uvijek s mreže; bez interneta pokaži zadnju sačuvanu
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then((r) => {
        const kopija = r.clone();
        caches.open(VERZIJA).then((c) => c.put('/', kopija));
        return r;
      }).catch(() => caches.match('/'))
    );
    return;
  }

  // JS/CSS (imaju hash u imenu), ikone i slike: iz keša, pa s mreže
  if (url.pathname.startsWith('/assets/') || /\.(png|svg|jpg|jpeg|webp|woff2?)$/.test(url.pathname)) {
    e.respondWith(
      caches.match(req).then((c) => c || fetch(req).then((r) => {
        if (r.ok) { const kopija = r.clone(); caches.open(VERZIJA).then((x) => x.put(req, kopija)); }
        return r;
      }))
    );
  }
});
