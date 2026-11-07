// Panel otpada: dijelovi, upiti, narudžbe, profil, uvoz zaliha
import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { q, transakcija } from '../db/index.js';
import { asyncH, int, normOem } from '../lib/util.js';
import { uloga } from '../lib/auth.js';
import { parsirajCsv, uveziDijelove } from '../lib/uvoz.js';

const r = Router();
r.use(uloga('otpad', 'admin'));

// Admin može raditi u ime otpada preko ?otpad=ID
const otpadId = (req) => (req.korisnik.uloga === 'admin' ? int(req.query.otpad) : req.korisnik.otpad_id);
r.use((req, res, next) => (otpadId(req) ? next() : res.status(400).json({ greska: 'Nije izabran otpad.' })));

export const UPLOADS = process.env.UPLOADS_DIR || path.resolve('uploads');
fs.mkdirSync(UPLOADS, { recursive: true });

const slikeUpload = multer({
  storage: multer.diskStorage({
    destination: UPLOADS,
    filename: (_req, f, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${path.extname(f.originalname).toLowerCase() || '.jpg'}`),
  }),
  limits: { fileSize: 8 * 1024 * 1024, files: 10 },
  fileFilter: (_req, f, cb) => cb(null, /^image\/(jpeg|png|webp)$/.test(f.mimetype)),
});
const csvUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// ---------- Profil ----------

r.get('/profil', asyncH(async (req, res) => {
  const { rows: [o] } = await q(`SELECT * FROM otpadi WHERE id = $1`, [otpadId(req)]);
  const { rows: [s] } = await q(`
    SELECT COUNT(*) FILTER (WHERE status = 'aktivan')::int aktivnih,
           COUNT(*) FILTER (WHERE status = 'rezervisan')::int rezervisanih,
           COUNT(*) FILTER (WHERE status = 'prodan')::int prodanih,
           (SELECT COUNT(*)::int FROM upiti WHERE otpad_id = $1 AND status = 'novi') novih_upita,
           (SELECT COUNT(*)::int FROM narudzbe WHERE otpad_id = $1 AND status = 'nova') novih_narudzbi
    FROM dijelovi WHERE otpad_id = $1`, [otpadId(req)]);
  res.json({ ...o, statistika: s });
}));

r.put('/profil', asyncH(async (req, res) => {
  const b = req.body || {};
  const { rows: [o] } = await q(
    `UPDATE otpadi SET naziv = COALESCE($2, naziv), grad = $3, adresa = $4, telefon = $5, email = $6,
       lat = $7, lng = $8, opis = $9, dostava_info = $10, dostava_cijena_km = COALESCE($11, dostava_cijena_km),
       licno_preuzimanje = COALESCE($12, licno_preuzimanje)
     WHERE id = $1 RETURNING *`,
    [otpadId(req), b.naziv || null, b.grad || null, b.adresa || null, b.telefon || null, b.email || null,
     b.lat === '' || b.lat == null ? null : Number(b.lat), b.lng === '' || b.lng == null ? null : Number(b.lng),
     b.opis || null, b.dostava_info || null, b.dostava_cijena_km === '' ? null : b.dostava_cijena_km,
     typeof b.licno_preuzimanje === 'boolean' ? b.licno_preuzimanje : null]
  );
  res.json(o);
}));

r.post('/api-kljuc', asyncH(async (req, res) => {
  const kljuc = crypto.randomBytes(24).toString('hex');
  await q(`UPDATE otpadi SET api_kljuc = $2 WHERE id = $1`, [otpadId(req), kljuc]);
  res.json({ api_kljuc: kljuc });
}));

// ---------- Dijelovi ----------

r.get('/dijelovi', asyncH(async (req, res) => {
  const p = [otpadId(req)];
  let gdje = 'd.otpad_id = $1';
  if (req.query.status) { p.push(req.query.status); gdje += ` AND d.status = $${p.length}`; }
  if (req.query.q) {
    p.push(`%${req.query.q}%`); const i = p.length;
    p.push(`%${normOem(req.query.q)}%`);
    gdje += ` AND (d.naziv ILIKE $${i} OR d.oem_norm LIKE $${i + 1} OR d.vanjska_sifra ILIKE $${i})`;
  }
  const strana = Math.max(1, int(req.query.strana, 1));
  const { rows } = await q(`
    SELECT d.*, m.naziv marka, g.naziv generacija, mo.naziv model, k.naziv kategorija
    FROM dijelovi d LEFT JOIN marke m ON m.id = d.marka_id LEFT JOIN generacije g ON g.id = d.generacija_id
    LEFT JOIN modeli mo ON mo.id = g.model_id LEFT JOIN kategorije k ON k.id = d.kategorija_id
    WHERE ${gdje} ORDER BY d.azuriran DESC LIMIT 50 OFFSET ${(strana - 1) * 50}`, p);
  const { rows: [{ ukupno }] } = await q(`SELECT COUNT(*)::int ukupno FROM dijelovi d WHERE ${gdje}`, p);
  res.json({ dijelovi: rows, ukupno, strana });
}));

function poljaDijela(b) {
  return [
    int(b.marka_id), int(b.generacija_id), int(b.kategorija_id), String(b.naziv || '').trim(),
    b.oem || null, normOem(b.oem) || null, ['A', 'B', 'C', 'N'].includes(b.stanje) ? b.stanje : 'B',
    int(b.km), int(b.godiste), b.motor || null, b.gorivo || null, b.vin_donora || null,
    Number(b.cijena_km) || 0, Math.max(0, int(b.kolicina, 1)),
    Array.isArray(b.slike) ? b.slike.filter((s) => typeof s === 'string').slice(0, 10) : [],
    b.opis || null, b.vanjska_sifra || null,
  ];
}

r.post('/dijelovi', asyncH(async (req, res) => {
  const v = poljaDijela(req.body || {});
  if (!v[3]) return res.status(400).json({ greska: 'Unesite naziv dijela.' });
  const { rows: [d] } = await q(
    `INSERT INTO dijelovi (otpad_id, marka_id, generacija_id, kategorija_id, naziv, oem, oem_norm, stanje, km, godiste,
       motor, gorivo, vin_donora, cijena_km, kolicina, slike, opis, vanjska_sifra)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING *`,
    [otpadId(req), ...v]
  );
  res.json(d);
}));

r.put('/dijelovi/:id', asyncH(async (req, res) => {
  const b = req.body || {};
  const v = poljaDijela(b);
  if (!v[3]) return res.status(400).json({ greska: 'Unesite naziv dijela.' });
  const status = ['aktivan', 'rezervisan', 'prodan'].includes(b.status) ? b.status : 'aktivan';
  const { rows: [d] } = await q(
    `UPDATE dijelovi SET marka_id=$3, generacija_id=$4, kategorija_id=$5, naziv=$6, oem=$7, oem_norm=$8, stanje=$9,
       km=$10, godiste=$11, motor=$12, gorivo=$13, vin_donora=$14, cijena_km=$15, kolicina=$16, slike=$17, opis=$18,
       vanjska_sifra=$19, status=$20, azuriran=NOW()
     WHERE id = $1 AND otpad_id = $2 RETURNING *`,
    [int(req.params.id), otpadId(req), ...v, status]
  );
  if (!d) return res.status(404).json({ greska: 'Dio nije pronađen.' });
  res.json(d);
}));

r.delete('/dijelovi/:id', asyncH(async (req, res) => {
  await q(`DELETE FROM dijelovi WHERE id = $1 AND otpad_id = $2`, [int(req.params.id), otpadId(req)]);
  res.json({ ok: true });
}));

r.post('/slike', slikeUpload.array('slike', 10), (req, res) => {
  res.json({ slike: (req.files || []).map((f) => `/uploads/${f.filename}`) });
});

// ---------- Upiti ----------

r.get('/upiti', asyncH(async (req, res) => {
  const { rows } = await q(`
    SELECT u.*, d.naziv dio, d.oem FROM upiti u LEFT JOIN dijelovi d ON d.id = u.dio_id
    WHERE u.otpad_id = $1 ORDER BY (u.status = 'novi') DESC, u.kreiran DESC LIMIT 200`, [otpadId(req)]);
  res.json(rows);
}));

r.put('/upiti/:id', asyncH(async (req, res) => {
  const { odgovor, status } = req.body || {};
  const s = ['novi', 'odgovoren', 'zatvoren'].includes(status) ? status : odgovor ? 'odgovoren' : 'zatvoren';
  const { rows: [u] } = await q(
    `UPDATE upiti SET odgovor = COALESCE($3, odgovor), status = $4 WHERE id = $1 AND otpad_id = $2 RETURNING *`,
    [int(req.params.id), otpadId(req), odgovor || null, s]
  );
  res.json(u || {});
}));

// ---------- Narudžbe ----------

r.get('/narudzbe', asyncH(async (req, res) => {
  const { rows } = await q(`
    SELECT n.*, (SELECT json_agg(s ORDER BY s.id) FROM narudzba_stavke s WHERE s.narudzba_id = n.id) stavke
    FROM narudzbe n WHERE n.otpad_id = $1
    ORDER BY (n.status = 'nova') DESC, n.kreiran DESC LIMIT 200`, [otpadId(req)]);
  res.json(rows);
}));

// Promjena statusa: potvrđena/poslana/završena → dijelovi prodani; otkazana → dijelovi ponovo aktivni
r.put('/narudzbe/:id', asyncH(async (req, res) => {
  const { status } = req.body || {};
  if (!['nova', 'potvrdjena', 'poslana', 'zavrsena', 'otkazana'].includes(status))
    return res.status(400).json({ greska: 'Nepoznat status.' });
  const n = await transakcija(async (db) => {
    const { rows: [n] } = await db.query(
      `UPDATE narudzbe SET status = $3 WHERE id = $1 AND otpad_id = $2 RETURNING *`,
      [int(req.params.id), otpadId(req), status]);
    if (!n) return null;
    const noviStatus = status === 'otkazana' ? 'aktivan' : status === 'nova' ? 'rezervisan' : 'prodan';
    await db.query(
      `UPDATE dijelovi SET status = $2, azuriran = NOW()
       WHERE id IN (SELECT dio_id FROM narudzba_stavke WHERE narudzba_id = $1) AND otpad_id = $3`,
      [n.id, noviStatus, otpadId(req)]);
    return n;
  });
  if (!n) return res.status(404).json({ greska: 'Narudžba nije pronađena.' });
  res.json(n);
}));

// ---------- Uvoz zaliha ----------

r.post('/uvoz', csvUpload.single('fajl'), asyncH(async (req, res) => {
  if (!req.file) return res.status(400).json({ greska: 'Izaberite CSV fajl.' });
  let tekst = req.file.buffer.toString('utf8');
  if (tekst.includes('�')) tekst = req.file.buffer.toString('latin1'); // Excel ponekad snimi u Windows-1250/1252
  const redovi = parsirajCsv(tekst);
  if (!redovi.length) return res.status(400).json({ greska: 'Fajl je prazan ili nema zaglavlje.' });
  if (redovi.length > 50000) return res.status(400).json({ greska: 'Najviše 50.000 redova po uvozu.' });
  const rez = await transakcija((db) =>
    uveziDijelove(db, otpadId(req), redovi, { izvor: 'csv', potpuno: req.body?.potpuno === '1' }));
  res.json(rez);
}));

r.get('/uvozi', asyncH(async (req, res) => {
  const { rows } = await q(`SELECT * FROM uvozi WHERE otpad_id = $1 ORDER BY kreiran DESC LIMIT 20`, [otpadId(req)]);
  res.json(rows);
}));

export default r;
