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
import { KURS_EUR } from './lib/util.js';

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

// Gotov frontend (client/dist)
const DIST = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(DIST)) {
  app.use(express.static(DIST, { maxAge: '1h', index: false }));
  app.get('*', (_req, res) => res.sendFile(path.join(DIST, 'index.html')));
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
