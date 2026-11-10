import { Router } from 'express';
import { q } from '../db/index.js';
import { asyncH, int } from '../lib/util.js';
import { uloga } from '../lib/auth.js';
import { prepoznajTipove } from '../lib/tipovi.js';

const r = Router();
r.use(uloga('admin'));

r.get('/otpadi', asyncH(async (_req, res) => {
  const { rows } = await q(`
    SELECT o.id, o.naziv, o.slug, o.grad, o.telefon, o.email, o.odobren, o.kreiran, o.paket, o.paket_do,
      (o.telegram_chat_id IS NOT NULL) telegram, (o.izvor_url IS NOT NULL) povezan_program,
      (SELECT COUNT(*)::int FROM dijelovi d WHERE d.otpad_id = o.id AND d.status = 'aktivan') aktivnih,
      (SELECT MAX(kreiran) FROM uvozi u WHERE u.otpad_id = o.id) zadnji_uvoz
    FROM otpadi o ORDER BY o.odobren, o.kreiran DESC`);
  res.json(rows);
}));

r.put('/otpadi/:id', asyncH(async (req, res) => {
  const b = req.body || {};
  const { rows: [o] } = await q(
    `UPDATE otpadi SET odobren = COALESCE($2, odobren), paket = COALESCE($3, paket),
       paket_do = CASE WHEN $4::boolean THEN $5::date ELSE paket_do END
     WHERE id = $1 RETURNING id, naziv, odobren, paket, paket_do`,
    [int(req.params.id), typeof b.odobren === 'boolean' ? b.odobren : null,
     ['besplatno', 'pro'].includes(b.paket) ? b.paket : null, 'paket_do' in b, b.paket_do || null]);
  res.json(o || {});
}));

r.get('/statistika', asyncH(async (_req, res) => {
  const { rows: [s] } = await q(`
    SELECT (SELECT COUNT(*)::int FROM dijelovi WHERE status = 'aktivan') aktivnih,
           (SELECT COUNT(*)::int FROM otpadi WHERE odobren) otpada,
           (SELECT COUNT(*)::int FROM otpadi WHERE NOT odobren) na_cekanju,
           (SELECT COUNT(*)::int FROM korisnici WHERE uloga = 'kupac') kupaca,
           (SELECT COUNT(*)::int FROM narudzbe WHERE kreiran > NOW() - INTERVAL '30 days') narudzbi_30d,
           (SELECT COUNT(*)::int FROM upiti WHERE kreiran > NOW() - INTERVAL '30 days') upita_30d,
           (SELECT COUNT(*)::int FROM zahtjevi WHERE kreiran > NOW() - INTERVAL '30 days') zahtjeva_30d,
           (SELECT COUNT(*)::int FROM otpadi WHERE paket = 'pro' AND (paket_do IS NULL OR paket_do >= CURRENT_DATE)) pro_otpada`);
  res.json(s);
}));

// ---------- Tipovi dijelova (težine za poštarinu) ----------

r.get('/tipovi', asyncH(async (_req, res) => {
  const { rows } = await q(`
    SELECT t.*, k.naziv kategorija, (SELECT COUNT(*)::int FROM dijelovi d WHERE d.tip_id = t.id AND d.status = 'aktivan') dijelova
    FROM tipovi_dijelova t LEFT JOIN kategorije k ON k.id = t.kategorija_id ORDER BY k.redoslijed NULLS LAST, t.naziv`);
  const { rows: [{ bez }] } = await q(`SELECT COUNT(*)::int bez FROM dijelovi WHERE tip_id IS NULL AND status = 'aktivan'`);
  res.json({ tipovi: rows, bez_tipa: bez });
}));

function poljaTipa(b) {
  const naziv = String(b.naziv || '').trim().slice(0, 80);
  const kg = Number(String(b.tezina_kg ?? '').replace(',', '.'));
  const kljucne = (Array.isArray(b.kljucne) ? b.kljucne : String(b.kljucne || '').split(','))
    .map((x) => String(x).trim().toLowerCase()).filter(Boolean).slice(0, 20);
  return { naziv, kg, kljucne, kat: int(b.kategorija_id) };
}

r.post('/tipovi', asyncH(async (req, res) => {
  const t = poljaTipa(req.body || {});
  if (!t.naziv || !(t.kg > 0)) return res.status(400).json({ greska: 'Upišite naziv i težinu veću od 0.' });
  const { rows: [x] } = await q(
    `INSERT INTO tipovi_dijelova (naziv, kategorija_id, tezina_kg, kljucne) VALUES ($1,$2,$3,$4)
     ON CONFLICT (naziv) DO NOTHING RETURNING *`, [t.naziv, t.kat, t.kg, t.kljucne]);
  if (!x) return res.status(409).json({ greska: 'Tip s tim nazivom već postoji.' });
  const prepoznato = await prepoznajTipove();
  res.json({ ...x, prepoznato });
}));

r.put('/tipovi/:id', asyncH(async (req, res) => {
  const t = poljaTipa(req.body || {});
  if (!t.naziv || !(t.kg > 0)) return res.status(400).json({ greska: 'Upišite naziv i težinu veću od 0.' });
  const { rows: [x] } = await q(
    `UPDATE tipovi_dijelova SET naziv = $2, kategorija_id = $3, tezina_kg = $4, kljucne = $5 WHERE id = $1 RETURNING *`,
    [int(req.params.id), t.naziv, t.kat, t.kg, t.kljucne]);
  const prepoznato = await prepoznajTipove();
  res.json({ ...x, prepoznato });
}));

r.delete('/tipovi/:id', asyncH(async (req, res) => {
  await q(`DELETE FROM tipovi_dijelova WHERE id = $1`, [int(req.params.id)]);
  res.json({ ok: true });
}));

// Ponovo prepoznaj tip za sve dijelove (npr. nakon izmjene ključnih riječi)
r.post('/tipovi/prepoznaj', asyncH(async (_req, res) => {
  res.json({ prepoznato: await prepoznajTipove({ sve: true }) });
}));

export default r;
