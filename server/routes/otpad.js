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
import { stanjePaketa, POSTAVKE } from '../lib/paket.js';
import { BOT_IME, ukljucen as tgUkljucen, noviKod, posalji, poruke } from '../lib/telegram.js';
import { sinhronizujOtpad } from '../lib/izvor.js';
import { cjenovnik, TEZINA } from '../lib/postarina.js';
import { ucitajTipove, nadjiTip } from '../lib/tipovi.js';

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
  const paket = await stanjePaketa(otpadId(req));
  const { izvor_kljuc, telegram_kod, ...ostalo } = o;
  res.json({
    ...ostalo, statistika: s,
    paket: { ...paket, slobodno: paket.slobodno === Infinity ? null : paket.slobodno, ...POSTAVKE() },
    telegram: { ukljucen: tgUkljucen(), povezan: !!o.telegram_chat_id, bot: BOT_IME() },
    izvor: { povezan: !!(o.izvor_url && izvor_kljuc), url: o.izvor_url, zadnje: o.izvor_zadnje, greska: o.izvor_greska },
  });
}));

// ---------- Cjenovnik brze pošte ----------

r.get('/postarina', asyncH(async (req, res) => {
  res.json(await cjenovnik(otpadId(req)));
}));

// Snima cijeli cjenovnik odjednom: [{ naziv, razredi: [{ do_kg, cijena_km }] }]
r.put('/postarina', asyncH(async (req, res) => {
  const lista = Array.isArray(req.body?.sluzbe) ? req.body.sluzbe : null;
  if (!lista) return res.status(400).json({ greska: 'Nedostaje lista pošta.' });
  const broj = (v) => { const n = Number(String(v ?? '').replace(',', '.')); return Number.isFinite(n) && String(v ?? '').trim() !== '' ? n : null; };
  const ciste = [];
  for (const [i, s] of lista.entries()) {
    const naziv = String(s.naziv || '').trim().slice(0, 60);
    const razredi = (s.razredi || []).map((x) => ({ do_kg: broj(x.do_kg), cijena_km: broj(x.cijena_km) }))
      .filter((x) => x.do_kg !== null || x.cijena_km !== null);
    if (!naziv && !razredi.length) continue;
    if (!naziv) return res.status(400).json({ greska: `Upišite naziv ${i + 1}. pošte.` });
    for (const x of razredi) {
      if (x.do_kg === null || x.do_kg <= 0) return res.status(400).json({ greska: `${naziv}: upišite do koliko kg važi svaka cijena.` });
      if (x.cijena_km === null || x.cijena_km < 0) return res.status(400).json({ greska: `${naziv}: upišite cijenu za razred do ${x.do_kg} kg.` });
    }
    razredi.sort((a, b) => a.do_kg - b.do_kg);
    for (let j = 1; j < razredi.length; j++)
      if (razredi[j].do_kg === razredi[j - 1].do_kg) return res.status(400).json({ greska: `${naziv}: razred do ${razredi[j].do_kg} kg je upisan dva puta.` });
    ciste.push({ naziv, razredi });
  }
  await transakcija(async (db) => {
    await db.query(`DELETE FROM kurirske_sluzbe WHERE otpad_id = $1`, [otpadId(req)]);
    for (const [i, s] of ciste.entries()) {
      const { rows: [k] } = await db.query(
        `INSERT INTO kurirske_sluzbe (otpad_id, naziv, redoslijed) VALUES ($1,$2,$3) RETURNING id`, [otpadId(req), s.naziv, i]);
      for (const x of s.razredi)
        await db.query(`INSERT INTO kurir_cijene (sluzba_id, do_kg, cijena_km) VALUES ($1,$2,$3)`, [k.id, x.do_kg, x.cijena_km]);
    }
  });
  res.json(await cjenovnik(otpadId(req)));
}));

// ---------- Težine tipova dijelova (otpad ih mijenja za sebe) ----------

r.get('/tezine', asyncH(async (req, res) => {
  const { rows } = await q(`
    SELECT t.id, t.naziv, t.kategorija_id, k.naziv kategorija, t.tezina_kg standard_kg, ot.tezina_kg moja_kg,
      (SELECT COUNT(*)::int FROM dijelovi d WHERE d.tip_id = t.id AND d.otpad_id = $1 AND d.status = 'aktivan') dijelova
    FROM tipovi_dijelova t
    LEFT JOIN kategorije k ON k.id = t.kategorija_id
    LEFT JOIN otpad_tezine ot ON ot.tip_id = t.id AND ot.otpad_id = $1
    ORDER BY k.redoslijed NULLS LAST, t.naziv`, [otpadId(req)]);
  const { rows: [{ bez }] } = await q(
    `SELECT COUNT(*)::int bez FROM dijelovi d WHERE d.otpad_id = $1 AND d.status = 'aktivan' AND d.tip_id IS NULL AND d.tezina_kg IS NULL`, [otpadId(req)]);
  res.json({ tipovi: rows, bez_tezine: bez });
}));

// { tezine: { tip_id: kg ili '' (vrati na standardnu) } }
r.put('/tezine', asyncH(async (req, res) => {
  const t = req.body?.tezine;
  if (!t || typeof t !== 'object') return res.status(400).json({ greska: 'Nema izmjena.' });
  const unosi = Object.entries(t).slice(0, 500).map(([id, v]) => [int(id), tezina(v)]).filter(([id]) => id);
  for (const [id, kg] of unosi) if (kg !== null && !(kg > 0)) return res.status(400).json({ greska: 'Težina mora biti veća od 0.' });
  await transakcija(async (db) => {
    for (const [id, kg] of unosi) {
      if (kg === null) await db.query(`DELETE FROM otpad_tezine WHERE otpad_id = $1 AND tip_id = $2`, [otpadId(req), id]);
      else await db.query(
        `INSERT INTO otpad_tezine (otpad_id, tip_id, tezina_kg) VALUES ($1,$2,$3)
         ON CONFLICT (otpad_id, tip_id) DO UPDATE SET tezina_kg = EXCLUDED.tezina_kg`, [otpadId(req), id, kg]);
    }
  });
  res.json({ ok: true, izmijenjeno: unosi.length });
}));

// ---------- Telegram ----------

r.post('/telegram', asyncH(async (req, res) => {
  if (!tgUkljucen()) return res.status(400).json({ greska: 'Telegram bot nije podešen na serveru (TELEGRAM_BOT_TOKEN).' });
  const kod = noviKod();
  await q(`UPDATE otpadi SET telegram_kod = $2 WHERE id = $1`, [otpadId(req), kod]);
  res.json({ link: `https://t.me/${BOT_IME()}?start=${kod}` });
}));

r.post('/telegram/test', asyncH(async (req, res) => {
  const { rows: [o] } = await q(`SELECT telegram_chat_id FROM otpadi WHERE id = $1`, [otpadId(req)]);
  const ok = await posalji(o?.telegram_chat_id, '🔔 Test poruka sa bazadijelova. Obavještenja rade.');
  res.json({ ok });
}));

r.delete('/telegram', asyncH(async (req, res) => {
  await q(`UPDATE otpadi SET telegram_chat_id = NULL WHERE id = $1`, [otpadId(req)]);
  res.json({ ok: true });
}));

// ---------- Povezivanje s programom (shop-api) ----------

r.put('/izvor', asyncH(async (req, res) => {
  const url = String(req.body?.url || '').trim().replace(/\/+$/, '');
  const kljuc = String(req.body?.kljuc || '').trim();
  if (!url) {
    await q(`UPDATE otpadi SET izvor_url = NULL, izvor_kljuc = NULL, izvor_greska = NULL WHERE id = $1`, [otpadId(req)]);
    return res.json({ ok: true });
  }
  if (!/^https?:\/\//.test(url)) return res.status(400).json({ greska: 'Adresa mora počinjati sa http:// ili https://' });
  await q(`UPDATE otpadi SET izvor_url = $2, izvor_kljuc = COALESCE(NULLIF($3, ''), izvor_kljuc) WHERE id = $1`, [otpadId(req), url, kljuc]);
  try {
    const rez = await sinhronizujOtpad(otpadId(req));
    res.json({ ok: true, ...rez });
  } catch (e) { res.status(400).json({ greska: e.message }); }
}));

r.post('/izvor/sada', asyncH(async (req, res) => {
  try { res.json(await sinhronizujOtpad(otpadId(req))); }
  catch (e) { res.status(400).json({ greska: e.message }); }
}));

// ---------- Izdvajanje (Pro) ----------

r.post('/dijelovi/:id/izdvoji', asyncH(async (req, res) => {
  const p = await stanjePaketa(otpadId(req));
  const ukloni = req.body?.ukloni === true;
  if (!ukloni) {
    if (!p.pro) return res.status(403).json({ greska: 'Izdvajanje je dio Pro paketa.' });
    if (p.izdvojenih >= p.izdvojeni_limit) return res.status(400).json({ greska: `Već imate ${p.izdvojenih} izdvojenih dijelova (najviše ${p.izdvojeni_limit}).` });
  }
  const { rows: [d] } = await q(
    `UPDATE dijelovi SET izdvojen_do = ${ukloni ? 'NULL' : `NOW() + ($3 || ' days')::interval`}
     WHERE id = $1 AND otpad_id = $2 RETURNING id, izdvojen_do`,
    ukloni ? [int(req.params.id), otpadId(req)] : [int(req.params.id), otpadId(req), String(POSTAVKE().izdvojeno_dana)]);
  if (!d) return res.status(404).json({ greska: 'Dio nije pronađen.' });
  res.json(d);
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
    SELECT d.*, m.naziv marka, g.naziv generacija, mo.naziv model, k.naziv kategorija, t.naziv tip, ${TEZINA} AS tezina
    FROM dijelovi d LEFT JOIN marke m ON m.id = d.marka_id LEFT JOIN generacije g ON g.id = d.generacija_id
    LEFT JOIN modeli mo ON mo.id = g.model_id LEFT JOIN kategorije k ON k.id = d.kategorija_id
    LEFT JOIN tipovi_dijelova t ON t.id = d.tip_id
    WHERE ${gdje} ORDER BY d.azuriran DESC LIMIT 50 OFFSET ${(strana - 1) * 50}`, p);
  const { rows: [{ ukupno }] } = await q(`SELECT COUNT(*)::int ukupno FROM dijelovi d WHERE ${gdje}`, p);
  res.json({ dijelovi: rows, ukupno, strana });
}));

// Tip dijela: izabran u formi ili prepoznat iz naziva
async function tipZa(b) {
  if (b.tip_id === '' || b.tip_id === null || b.tip_id === undefined) {
    const t = nadjiTip(await ucitajTipove(), b.naziv);
    return t ? t.id : null;
  }
  return int(b.tip_id);
}
const tezina = (v) => (v === '' || v == null || !Number.isFinite(Number(String(v).replace(',', '.'))) ? null : Number(String(v).replace(',', '.')));

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
  const paket = await stanjePaketa(otpadId(req));
  if (paket.slobodno <= 0)
    return res.status(403).json({ greska: `Besplatni paket dozvoljava ${paket.limit} dijelova u prodaji. Za više pređite na Pro paket.` });
  const { rows: [d] } = await q(
    `INSERT INTO dijelovi (otpad_id, tip_id, tezina_kg, marka_id, generacija_id, kategorija_id, naziv, oem, oem_norm, stanje, km, godiste,
       motor, gorivo, vin_donora, cijena_km, kolicina, slike, opis, vanjska_sifra)
     VALUES ($1,$19,$20,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING *`,
    [otpadId(req), ...v, await tipZa(req.body || {}), tezina(req.body?.tezina_kg)]
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
       vanjska_sifra=$19, status=$20, tip_id=$21, tezina_kg=$22, azuriran=NOW()
     WHERE id = $1 AND otpad_id = $2 RETURNING *`,
    [int(req.params.id), otpadId(req), ...v, status, await tipZa(b), tezina(b.tezina_kg)]
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

// ---------- Zahtjevi kupaca ("Tražim dio") ----------

r.get('/zahtjevi', asyncH(async (req, res) => {
  const { rows } = await q(`
    SELECT z.id, z.naziv, z.godiste, z.motor, z.oem, z.opis, z.grad, z.kreiran, m.naziv marka, g.naziv generacija, mo.naziv model,
      p.id ponuda_id, p.cijena_km ponuda_cijena, p.poruka ponuda_poruka,
      (SELECT COUNT(*)::int FROM ponude x WHERE x.zahtjev_id = z.id) broj_ponuda,
      (SELECT json_agg(json_build_object('id', d.id, 'naziv', d.naziv, 'cijena_km', d.cijena_km, 'oem', d.oem))
       FROM (SELECT d.id, d.naziv, d.cijena_km, d.oem FROM dijelovi d
             WHERE d.otpad_id = $1 AND d.status = 'aktivan'
               AND ((z.generacija_id IS NOT NULL AND d.generacija_id = z.generacija_id) OR (z.oem IS NOT NULL AND d.oem_norm = upper(regexp_replace(z.oem, '[^A-Za-z0-9]', '', 'g'))))
             LIMIT 5) d) moguci
    FROM zahtjevi z
    LEFT JOIN marke m ON m.id = z.marka_id LEFT JOIN generacije g ON g.id = z.generacija_id LEFT JOIN modeli mo ON mo.id = g.model_id
    LEFT JOIN ponude p ON p.zahtjev_id = z.id AND p.otpad_id = $1
    WHERE z.status = 'otvoren' AND z.istice > NOW()
    ORDER BY (p.id IS NULL) DESC, z.kreiran DESC LIMIT 100`, [otpadId(req)]);
  res.json(rows);
}));

r.post('/zahtjevi/:id/ponuda', asyncH(async (req, res) => {
  const { cijena_km, poruka, dio_id, stanje } = req.body || {};
  if (!cijena_km && !poruka) return res.status(400).json({ greska: 'Unesite cijenu ili poruku.' });
  const { rows: [z] } = await q(`SELECT * FROM zahtjevi WHERE id = $1 AND status = 'otvoren'`, [int(req.params.id)]);
  if (!z) return res.status(404).json({ greska: 'Zahtjev više nije otvoren.' });
  const { rows: [p] } = await q(
    `INSERT INTO ponude (zahtjev_id, otpad_id, dio_id, cijena_km, stanje, poruka) VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (zahtjev_id, otpad_id) DO UPDATE SET dio_id = EXCLUDED.dio_id, cijena_km = EXCLUDED.cijena_km,
       stanje = EXCLUDED.stanje, poruka = EXCLUDED.poruka, kreiran = NOW()
     RETURNING *`,
    [z.id, otpadId(req), int(dio_id), cijena_km ? Number(cijena_km) : null,
     ['A', 'B', 'C', 'N'].includes(stanje) ? stanje : null, poruka ? String(poruka).slice(0, 1000) : null]);
  if (z.korisnik_id) {
    const { rows: [k] } = await q(`SELECT telegram_chat_id FROM korisnici WHERE id = $1`, [z.korisnik_id]);
    const { rows: [o] } = await q(`SELECT naziv FROM otpadi WHERE id = $1`, [otpadId(req)]);
    posalji(k?.telegram_chat_id, poruke.ponuda(p, o.naziv, z));
  }
  res.json(p);
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
