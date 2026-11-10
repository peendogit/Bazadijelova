import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { primijeniSemu } from './db/index.js';
import javno from './routes/javno.js';
import auth from './routes/auth.js';
import kupac from './routes/kupac.js';
import otpad, { UPLOADS } from './routes/otpad.js';
import admin from './routes/admin.js';
import apiUvoz from './routes/api-uvoz.js';
import { KURS_EUR, asyncH } from './lib/util.js';
import { ubaciMeta, sitemap, robots, sajt } from './lib/seo.js';
import { pokreniPolling } from './lib/telegram.js';
import { pokreniSinhronizaciju } from './lib/izvor.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3004;
const app = express();

app.set('trust proxy', 1);
app.use(cors());
app.use(express.json({ limit: '25mb' }));

app.get('/api/zdravlje', (_req, res) => res.json({ ok: true, kurs_eur: KURS_EUR }));
app.use('/api/auth', auth);
app.use('/api/uvoz', apiUvoz);
app.use('/api/moj-otpad', otpad);
app.use('/api/admin', admin);
app.use('/api', kupac);
app.use('/api', javno);
app.use('/api', (_req, res) => res.status(404).json({ greska: 'Nepoznata ruta.' }));

app.use('/uploads', express.static(UPLOADS, { maxAge: '30d' }));

app.get('/robots.txt', (req, res) => res.type('text/plain').send(robots(req)));
app.get('/sitemap.xml', asyncH(async (req, res) => res.type('application/xml').send(await sitemap(req))));

// Gotov frontend (client/dist); svaka stranica dobije svoj naslov i opis za Google
const DIST = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(DIST)) {
  const sablon = () => fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
  let html = sablon();
  // Aplikacija za telefon: ime po domenu (Srbija = "Baza delova"), service worker bez keširanja
  app.get('/manifest.webmanifest', (req, res) => {
    const m = JSON.parse(fs.readFileSync(path.join(DIST, 'manifest.webmanifest'), 'utf8'));
    if (sajt(req).srbija) Object.assign(m, { name: 'Baza delova', short_name: 'Baza delova', description: 'Polovni auto delovi iz otpada', lang: 'sr-Latn' });
    res.type('application/manifest+json').set('Cache-Control', 'no-cache').send(JSON.stringify(m));
  });
  app.get('/sw.js', (_req, res) => res.set('Cache-Control', 'no-cache').sendFile(path.join(DIST, 'sw.js')));
  app.use(express.static(DIST, { maxAge: '1h', index: false }));
  app.get('*', asyncH(async (req, res) => {
    if (process.env.NODE_ENV !== 'production') html = sablon();
    const r = await ubaciMeta(html, req);
    res.status(r.status).type('html').set('Cache-Control', 'no-cache').send(r.html);
  }));
}

// Greške
app.use((err, _req, res, _next) => {
  const status = err.status || (err.code === 'LIMIT_FILE_SIZE' ? 413 : 500);
  if (status >= 500) console.error(err);
  res.status(status).json({
    greska: status >= 500 ? 'Greška na serveru. Pokušajte ponovo.' : err.message,
    ...(err.nedostupni ? { nedostupni: err.nedostupni } : {}),
  });
});

await primijeniSemu();
app.listen(PORT, () => console.log(`bazadijelova radi na portu ${PORT}`));
pokreniPolling();
pokreniSinhronizaciju();
