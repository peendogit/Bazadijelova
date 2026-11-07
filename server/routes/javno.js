// Javni API: katalog, pretraga dijelova, otpadi
import { Router } from 'express';
import { q } from '../db/index.js';
import { asyncH, int, normOem, KURS_EUR } from '../lib/util.js';
import { POSTAVKE } from '../lib/paket.js';
import { ukljucen as tgUkljucen } from '../lib/telegram.js';

const r = Router();

const AKTIVAN = `d.status = 'aktivan' AND d.kolicina > 0`;

// ---------- Katalog ----------

r.get('/marke', asyncH(async (_req, res) => {
  const { rows } = await q(`
    SELECT m.id, m.naziv, m.slug,
      (SELECT COUNT(*)::int FROM dijelovi d JOIN otpadi o ON o.id = d.otpad_id AND o.odobren
       WHERE d.marka_id = m.id AND ${AKTIVAN}) AS broj
    FROM marke m ORDER BY m.naziv`);
  res.json(rows);
}));

// Stranica marke: modeli grupisani, svaka generacija sa brojem dijelova (dostupno / nema na stanju)
r.get('/marke/:slug', asyncH(async (req, res) => {
  const { rows: [marka] } = await q(`SELECT id, naziv, slug FROM marke WHERE slug = $1`, [req.params.slug]);
  if (!marka) return res.status(404).json({ greska: 'Marka ne postoji.' });
  const { rows: modeli } = await q(`
    SELECT mo.id, mo.naziv, mo.slug,
      COALESCE(json_agg(json_build_object(
        'id', g.id, 'naziv', g.naziv, 'kod', g.kod, 'od', g.od_god, 'do', g.do_god, 'slug', g.slug,
        'broj', (SELECT COUNT(*)::int FROM dijelovi d JOIN otpadi o ON o.id = d.otpad_id AND o.odobren
                 WHERE d.generacija_id = g.id AND ${AKTIVAN})
      ) ORDER BY g.od_god DESC) FILTER (WHERE g.id IS NOT NULL), '[]') AS generacije
    FROM modeli mo LEFT JOIN generacije g ON g.model_id = mo.id
    WHERE mo.marka_id = $1
    GROUP BY mo.id ORDER BY mo.naziv`, [marka.id]);
  res.json({ ...marka, modeli });
}));

r.get('/kategorije', asyncH(async (_req, res) => {
  const { rows } = await q(`SELECT id, naziv, slug, ikona FROM kategorije ORDER BY redoslijed`);
  res.json(rows);
}));

// Generacija: podaci + kategorije sa brojem dijelova
r.get('/generacije/:id', asyncH(async (req, res) => {
  const { rows: [g] } = await q(`
    SELECT g.id, g.naziv, g.kod, g.od_god, g.do_god, mo.naziv model, mo.slug model_slug,
           m.naziv marka, m.slug marka_slug, m.id marka_id
    FROM generacije g JOIN modeli mo ON mo.id = g.model_id JOIN marke m ON m.id = mo.marka_id
    WHERE g.id = $1`, [int(req.params.id)]);
  if (!g) return res.status(404).json({ greska: 'Generacija ne postoji.' });
  const { rows: kategorije } = await q(`
    SELECT k.id, k.naziv, k.slug, k.ikona,
      (SELECT COUNT(*)::int FROM dijelovi d JOIN otpadi o ON o.id = d.otpad_id AND o.odobren
       WHERE d.generacija_id = $1 AND d.kategorija_id = k.id AND ${AKTIVAN}) broj
    FROM kategorije k ORDER BY k.redoslijed`, [g.id]);
  res.json({ ...g, kategorije, ukupno: kategorije.reduce((s, k) => s + k.broj, 0) });
}));

// ---------- Dijelovi ----------

const POLJA_LISTE = `
  d.id, d.naziv, d.oem, d.stanje, d.km, d.godiste, d.motor, d.gorivo, d.cijena_km, d.kolicina, d.status,
  d.slike[1] AS slika, (d.izdvojen_do > NOW()) AS izdvojen, m.naziv marka, mo.naziv model, g.naziv generacija, g.id generacija_id,
  k.naziv kategorija, o.id otpad_id, o.naziv otpad, o.slug otpad_slug, o.grad, o.dostava_cijena_km`;

const SPOJEVI = `
  FROM dijelovi d
  JOIN otpadi o ON o.id = d.otpad_id AND o.odobren
  LEFT JOIN marke m ON m.id = d.marka_id
  LEFT JOIN generacije g ON g.id = d.generacija_id
  LEFT JOIN modeli mo ON mo.id = g.model_id
  LEFT JOIN kategorije k ON k.id = d.kategorija_id`;

r.get('/dijelovi', asyncH(async (req, res) => {
  const uslovi = [AKTIVAN];
  const p = [];
  const dodaj = (sql, v) => { p.push(v); uslovi.push(sql.replace('?', `$${p.length}`)); };

  const tekst = String(req.query.q || '').trim();
  if (tekst) {
    const oem = normOem(tekst);
    // Pojmovi pretrage moraju se svi pojaviti (naziv, OEM, marka, model, generacija)
    const rijeci = tekst.split(/\s+/).filter(Boolean).slice(0, 6);
    const dijelovi = rijeci.map((w) => {
      p.push(`%${w}%`);
      const i = `$${p.length}`;
      return `(d.naziv ILIKE ${i} OR d.oem ILIKE ${i} OR m.naziv ILIKE ${i} OR mo.naziv ILIKE ${i} OR g.naziv ILIKE ${i} OR d.motor ILIKE ${i})`;
    });
    let sql = `(${dijelovi.join(' AND ')})`;
    if (oem.length >= 5 && /\d/.test(oem)) { p.push(`%${oem}%`); sql = `(${sql} OR d.oem_norm LIKE $${p.length})`; }
    uslovi.push(sql);
  }
  if (req.query.oem) dodaj('d.oem_norm LIKE ?', `%${normOem(req.query.oem)}%`);
  if (req.query.marka) dodaj('m.slug = ?', String(req.query.marka));
  if (req.query.generacija) dodaj('d.generacija_id = ?', int(req.query.generacija));
  if (req.query.kategorija) dodaj('k.slug = ?', String(req.query.kategorija));
  if (req.query.otpad) dodaj('o.slug = ?', String(req.query.otpad));
  if (req.query.grad) dodaj('o.grad ILIKE ?', String(req.query.grad));
  if (req.query.stanje) dodaj('d.stanje = ANY(?)', String(req.query.stanje).split(','));
  if (req.query.min) dodaj('d.cijena_km >= ?', Number(req.query.min));
  if (req.query.max) dodaj('d.cijena_km <= ?', Number(req.query.max));

  const sortovi = {
    novo: 'd.kreiran DESC',
    jeftino: 'd.cijena_km ASC',
    skupo: 'd.cijena_km DESC',
    km: 'd.km ASC NULLS LAST',
  };
  const sort = sortovi[req.query.sort] || sortovi.novo;
  const poStrani = 24;
  const strana = Math.max(1, int(req.query.strana, 1));
  const gdje = uslovi.join(' AND ');

  const [{ rows }, { rows: [{ ukupno }] }] = await Promise.all([
    q(`SELECT ${POLJA_LISTE} ${SPOJEVI} WHERE ${gdje} ORDER BY (d.izdvojen_do > NOW()) IS TRUE DESC, ${sort}, d.id DESC
       LIMIT ${poStrani} OFFSET ${(strana - 1) * poStrani}`, p),
    q(`SELECT COUNT(*)::int ukupno ${SPOJEVI} WHERE ${gdje}`, p),
  ]);
  res.json({ dijelovi: rows, ukupno, strana, strana_ukupno: Math.max(1, Math.ceil(ukupno / poStrani)) });
}));

r.get('/dijelovi/:id', asyncH(async (req, res) => {
  const { rows: [dio] } = await q(`
    SELECT d.*, m.naziv marka, m.slug marka_slug, mo.naziv model, g.naziv generacija, g.od_god, g.do_god,
           k.naziv kategorija, k.slug kategorija_slug,
           json_build_object('id', o.id, 'naziv', o.naziv, 'slug', o.slug, 'grad', o.grad, 'adresa', o.adresa,
             'telefon', o.telefon, 'email', o.email, 'lat', o.lat, 'lng', o.lng, 'opis', o.opis,
             'dostava_info', o.dostava_info, 'dostava_cijena_km', o.dostava_cijena_km,
             'licno_preuzimanje', o.licno_preuzimanje, 'ocjene', (SELECT json_build_object('prosjek', ROUND(AVG(oc.ocjena)::numeric, 1), 'broj', COUNT(*)) FROM ocjene oc WHERE oc.otpad_id = o.id)) otpad_info
    ${SPOJEVI} WHERE d.id = $1`, [int(req.params.id)]);
  if (!dio) return res.status(404).json({ greska: 'Dio nije pronađen.' });
  delete dio.vanjska_sifra;

  // Isti OEM broj kod drugih otpada
  let isti = [];
  if (dio.oem_norm) {
    ({ rows: isti } = await q(
      `SELECT ${POLJA_LISTE} ${SPOJEVI} WHERE ${AKTIVAN} AND d.oem_norm = $1 AND d.id <> $2
       ORDER BY d.cijena_km LIMIT 8`, [dio.oem_norm, dio.id]));
  }
  res.json({ ...dio, isti_oem: isti });
}));

// ---------- Otpadi ----------

r.get('/otpadi', asyncH(async (_req, res) => {
  const { rows } = await q(`
    SELECT o.id, o.naziv, o.slug, o.grad, o.lat, o.lng, o.dostava_cijena_km, (SELECT json_build_object('prosjek', ROUND(AVG(oc.ocjena)::numeric, 1), 'broj', COUNT(*)) FROM ocjene oc WHERE oc.otpad_id = o.id) ocjene,
      (SELECT COUNT(*)::int FROM dijelovi d WHERE d.otpad_id = o.id AND ${AKTIVAN}) broj
    FROM otpadi o WHERE o.odobren ORDER BY o.naziv`);
  res.json(rows);
}));

r.get('/otpadi/:slug', asyncH(async (req, res) => {
  const { rows: [o] } = await q(`
    SELECT o.id, o.naziv, o.slug, o.grad, o.adresa, o.telefon, o.email, o.lat, o.lng, o.opis,
           o.dostava_info, o.dostava_cijena_km, o.licno_preuzimanje, (SELECT json_build_object('prosjek', ROUND(AVG(oc.ocjena)::numeric, 1), 'broj', COUNT(*)) FROM ocjene oc WHERE oc.otpad_id = o.id) ocjene,
      (SELECT COUNT(*)::int FROM dijelovi d WHERE d.otpad_id = o.id AND ${AKTIVAN}) broj
    FROM otpadi o WHERE o.slug = $1 AND o.odobren`, [req.params.slug]);
  if (!o) return res.status(404).json({ greska: 'Otpad nije pronađen.' });
  const { rows: recenzije } = await q(
    `SELECT ocjena, komentar, ime, kreiran FROM ocjene WHERE otpad_id = $1 ORDER BY kreiran DESC LIMIT 20`, [o.id]);
  res.json({ ...o, recenzije });
}));

r.get('/statistika', asyncH(async (_req, res) => {
  const { rows: [s] } = await q(`
    SELECT (SELECT COUNT(*)::int FROM dijelovi d JOIN otpadi o ON o.id = d.otpad_id AND o.odobren WHERE ${AKTIVAN}) dijelova,
           (SELECT COUNT(*)::int FROM otpadi WHERE odobren) otpada`);
  res.json(s);
}));

// Postavke za frontend: kursevi i paketi
r.get('/postavke', (_req, res) => {
  res.json({
    kurs_eur: KURS_EUR,
    kurs_rsd_eur: parseFloat(process.env.KURS_RSD_EUR || '117.2'),
    paketi: POSTAVKE(),
    telegram: tgUkljucen(),
  });
});

export default r;
