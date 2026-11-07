// Upiti i narudžbe od kupaca (gost ili prijavljen)
import { Router } from 'express';
import { q, transakcija } from '../db/index.js';
import { asyncH, int } from '../lib/util.js';
import { opcionalno, prijavljen } from '../lib/auth.js';
import crypto from 'crypto';
import { obavijestiOtpad, obavijestiAdmina, poruke, posalji, BOT_IME, ukljucen as tgUkljucen } from '../lib/telegram.js';

const token = () => crypto.randomBytes(12).toString('base64url');

const r = Router();

// Pitanje otpadu o konkretnom dijelu (ili općenito otpadu)
r.post('/upiti', opcionalno, asyncH(async (req, res) => {
  const { dio_id, otpad_id, ime, telefon, email, poruka } = req.body || {};
  if (!ime || !poruka) return res.status(400).json({ greska: 'Unesite ime i poruku.' });
  if (!telefon && !email) return res.status(400).json({ greska: 'Ostavite telefon ili email da vam otpad može odgovoriti.' });
  let otpadId = int(otpad_id);
  if (dio_id) {
    const { rows: [d] } = await q(`SELECT otpad_id FROM dijelovi WHERE id = $1`, [int(dio_id)]);
    if (!d) return res.status(404).json({ greska: 'Dio ne postoji.' });
    otpadId = d.otpad_id;
  }
  if (!otpadId) return res.status(400).json({ greska: 'Nije izabran otpad.' });
  const { rows: [u] } = await q(
    `INSERT INTO upiti (otpad_id, dio_id, korisnik_id, ime, telefon, email, poruka)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [otpadId, int(dio_id), req.korisnik?.id || null, ime, telefon || null, email || null, String(poruka).slice(0, 2000)]
  );
  let dio = null;
  if (dio_id) ({ rows: [dio] } = await q(`SELECT naziv FROM dijelovi WHERE id = $1`, [int(dio_id)]));
  obavijestiOtpad(otpadId, poruke.upit({ ime, telefon, email, poruka }, dio));
  res.json({ ok: true, id: u.id });
}));

// Narudžba iz korpe: stavke se razdvoje po otpadu, svaki otpad dobije svoju narudžbu.
// Naručeni dijelovi se odmah rezervišu da ih niko drugi ne naruči.
r.post('/narudzbe', opcionalno, asyncH(async (req, res) => {
  const { stavke, ime, telefon, email, adresa, grad, nacin, napomena } = req.body || {};
  const ids = [...new Set((stavke || []).map((s) => int(s)).filter(Boolean))];
  if (!ids.length) return res.status(400).json({ greska: 'Korpa je prazna.' });
  if (!ime || !telefon) return res.status(400).json({ greska: 'Unesite ime i telefon.' });
  const nacinP = nacin === 'licno' ? 'licno' : 'dostava';
  if (nacinP === 'dostava' && (!adresa || !grad)) return res.status(400).json({ greska: 'Unesite adresu i grad za dostavu.' });

  const rezultat = await transakcija(async (db) => {
    const { rows: dijelovi } = await db.query(
      `SELECT d.id, d.naziv, d.oem, d.cijena_km, d.otpad_id, o.naziv otpad, o.dostava_cijena_km
       FROM dijelovi d JOIN otpadi o ON o.id = d.otpad_id AND o.odobren
       WHERE d.id = ANY($1) AND d.status = 'aktivan' AND d.kolicina > 0 AND d.cijena_km > 0 FOR UPDATE OF d`, [ids]);
    if (dijelovi.length !== ids.length) {
      const nema = ids.filter((id) => !dijelovi.some((d) => d.id === id));
      throw Object.assign(new Error('Neki dijelovi više nisu dostupni. Uklonite ih iz korpe.'), { status: 409, nedostupni: nema });
    }
    const poOtpadu = new Map();
    for (const d of dijelovi) {
      if (!poOtpadu.has(d.otpad_id)) poOtpadu.set(d.otpad_id, []);
      poOtpadu.get(d.otpad_id).push(d);
    }
    const narudzbe = [];
    for (const [otpadId, lista] of poOtpadu) {
      const ukupno = lista.reduce((s, d) => s + d.cijena_km, 0);
      const dostava = nacinP === 'dostava' ? lista[0].dostava_cijena_km || 0 : 0;
      const { rows: [n] } = await db.query(
        `INSERT INTO narudzbe (otpad_id, korisnik_id, ime, telefon, email, adresa, grad, nacin, napomena, ukupno_km, dostava_km, token)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
        [otpadId, req.korisnik?.id || null, ime, telefon, email || null, adresa || null, grad || null,
         nacinP, napomena || null, ukupno, dostava, token()]
      );
      for (const d of lista) {
        await db.query(
          `INSERT INTO narudzba_stavke (narudzba_id, dio_id, naziv, oem, cijena_km) VALUES ($1,$2,$3,$4,$5)`,
          [n.id, d.id, d.naziv, d.oem, d.cijena_km]
        );
      }
      await db.query(`UPDATE dijelovi SET status = 'rezervisan', azuriran = NOW() WHERE id = ANY($1)`, [lista.map((d) => d.id)]);
      narudzbe.push({ id: n.id, otpad_id: otpadId, otpad: lista[0].otpad, ukupno_km: ukupno, dostava_km: dostava, token: n.token, _n: n, _stavke: lista });
    }
    return narudzbe;
  });
  for (const n of rezultat) obavijestiOtpad(n.otpad_id, poruke.narudzba(n._n, n._stavke));
  res.json({ ok: true, narudzbe: rezultat.map(({ _n, _stavke, ...n }) => n) });
}));

r.get('/moje-narudzbe', prijavljen, asyncH(async (req, res) => {
  const { rows } = await q(`
    SELECT n.*, o.naziv otpad, o.telefon otpad_telefon,
      (SELECT ocjena FROM ocjene WHERE narudzba_id = n.id) ocjena,
      (SELECT json_agg(s ORDER BY s.id) FROM narudzba_stavke s WHERE s.narudzba_id = n.id) stavke
    FROM narudzbe n JOIN otpadi o ON o.id = n.otpad_id
    WHERE n.korisnik_id = $1 ORDER BY n.kreiran DESC LIMIT 100`, [req.korisnik.id]);
  res.json(rows);
}));

r.get('/moji-upiti', prijavljen, asyncH(async (req, res) => {
  const { rows } = await q(`
    SELECT u.*, o.naziv otpad, d.naziv dio FROM upiti u
    JOIN otpadi o ON o.id = u.otpad_id LEFT JOIN dijelovi d ON d.id = u.dio_id
    WHERE u.korisnik_id = $1 ORDER BY u.kreiran DESC LIMIT 100`, [req.korisnik.id]);
  res.json(rows);
}));

// ---------- Ocjene (link iz narudžbe) ----------

r.get('/ocjena/:token', asyncH(async (req, res) => {
  const { rows: [n] } = await q(`
    SELECT n.id, n.status, n.kreiran, o.naziv otpad, o.slug otpad_slug,
      (SELECT json_agg(s.naziv) FROM narudzba_stavke s WHERE s.narudzba_id = n.id) stavke,
      (SELECT row_to_json(x) FROM (SELECT ocjena, komentar FROM ocjene WHERE narudzba_id = n.id) x) ocjena
    FROM narudzbe n JOIN otpadi o ON o.id = n.otpad_id WHERE n.token = $1`, [req.params.token]);
  if (!n) return res.status(404).json({ greska: 'Narudžba nije pronađena.' });
  res.json(n);
}));

r.post('/ocjena/:token', asyncH(async (req, res) => {
  const ocjena = int(req.body?.ocjena);
  if (!ocjena || ocjena < 1 || ocjena > 5) return res.status(400).json({ greska: 'Izaberite od 1 do 5 zvjezdica.' });
  const { rows: [n] } = await q(`SELECT id, otpad_id, ime, status FROM narudzbe WHERE token = $1`, [req.params.token]);
  if (!n) return res.status(404).json({ greska: 'Narudžba nije pronađena.' });
  if (!['poslana', 'zavrsena'].includes(n.status))
    return res.status(400).json({ greska: 'Ocjenu možete dati kad otpad pošalje ili završi narudžbu.' });
  const komentar = req.body?.komentar ? String(req.body.komentar).slice(0, 1000) : null;
  const { rows: [o] } = await q(
    `INSERT INTO ocjene (otpad_id, narudzba_id, ocjena, komentar, ime) VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (narudzba_id) DO UPDATE SET ocjena = EXCLUDED.ocjena, komentar = EXCLUDED.komentar RETURNING *`,
    [n.otpad_id, n.id, ocjena, komentar, String(n.ime).split(' ')[0]]);
  obavijestiOtpad(n.otpad_id, poruke.ocjena(o));
  res.json({ ok: true });
}));

// ---------- Tražim dio ----------

r.post('/zahtjevi', opcionalno, asyncH(async (req, res) => {
  const b = req.body || {};
  if (!b.naziv || !b.ime) return res.status(400).json({ greska: 'Unesite koji dio tražite i vaše ime.' });
  if (!b.telefon && !b.email) return res.status(400).json({ greska: 'Ostavite telefon ili email da vas otpadi mogu kontaktirati.' });
  const { rows: [z] } = await q(
    `INSERT INTO zahtjevi (token, korisnik_id, ime, telefon, email, naziv, marka_id, generacija_id, godiste, motor, oem, opis, grad)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
    [token(), req.korisnik?.id || null, String(b.ime).slice(0, 100), b.telefon || null, b.email || null, String(b.naziv).slice(0, 200),
     int(b.marka_id), int(b.generacija_id), int(b.godiste), b.motor || null, b.oem || null,
     b.opis ? String(b.opis).slice(0, 1000) : null, b.grad || null]);
  // obavijesti otpade (samo odobrene, sa Telegramom)
  const { rows: [v] } = await q(`
    SELECT concat_ws(' ', m.naziv, g.naziv) vozilo FROM (SELECT 1) x
    LEFT JOIN marke m ON m.id = $1 LEFT JOIN generacije g ON g.id = $2`, [z.marka_id, z.generacija_id]);
  const { rows: otpadi } = await q(`SELECT telegram_chat_id FROM otpadi WHERE odobren AND telegram_chat_id IS NOT NULL`);
  for (const o of otpadi) posalji(o.telegram_chat_id, poruke.zahtjev(z, v.vozilo));
  obavijestiAdmina(poruke.zahtjev(z, v.vozilo));
  res.json({ ok: true, token: z.token, telegram: tgUkljucen() && req.korisnik ? `https://t.me/${BOT_IME()}?start=${z.token}` : null });
}));

// Javna lista otvorenih zahtjeva (bez kontakt podataka kupca)
r.get('/zahtjevi', asyncH(async (_req, res) => {
  const { rows } = await q(`
    SELECT z.id, z.naziv, z.godiste, z.grad, z.kreiran, m.naziv marka, g.naziv generacija,
      (SELECT COUNT(*)::int FROM ponude p WHERE p.zahtjev_id = z.id) broj_ponuda
    FROM zahtjevi z LEFT JOIN marke m ON m.id = z.marka_id LEFT JOIN generacije g ON g.id = z.generacija_id
    WHERE z.status = 'otvoren' AND z.istice > NOW() ORDER BY z.kreiran DESC LIMIT 50`);
  res.json(rows);
}));

// Kupac gleda svoj zahtjev i ponude (preko tajnog linka)
r.get('/zahtjevi/:token', asyncH(async (req, res) => {
  const { rows: [z] } = await q(`
    SELECT z.*, m.naziv marka, g.naziv generacija FROM zahtjevi z
    LEFT JOIN marke m ON m.id = z.marka_id LEFT JOIN generacije g ON g.id = z.generacija_id
    WHERE z.token = $1`, [req.params.token]);
  if (!z) return res.status(404).json({ greska: 'Zahtjev nije pronađen.' });
  const { rows: ponude } = await q(`
    SELECT p.id, p.cijena_km, p.stanje, p.poruka, p.kreiran, p.dio_id,
      o.naziv otpad, o.slug otpad_slug, o.grad, o.telefon, o.dostava_cijena_km,
      (SELECT ROUND(AVG(ocjena)::numeric, 1) FROM ocjene WHERE otpad_id = o.id) ocjena
    FROM ponude p JOIN otpadi o ON o.id = p.otpad_id WHERE p.zahtjev_id = $1 ORDER BY p.cijena_km NULLS LAST`, [z.id]);
  res.json({ ...z, ponude });
}));

r.put('/zahtjevi/:token', asyncH(async (req, res) => {
  const status = req.body?.status === 'otvoren' ? 'otvoren' : 'zatvoren';
  const { rows: [z] } = await q(`UPDATE zahtjevi SET status = $2 WHERE token = $1 RETURNING id, status`, [req.params.token, status]);
  res.json(z || {});
}));

r.get('/moji-zahtjevi', prijavljen, asyncH(async (req, res) => {
  const { rows } = await q(`
    SELECT z.token, z.naziv, z.status, z.kreiran, (SELECT COUNT(*)::int FROM ponude p WHERE p.zahtjev_id = z.id) broj_ponuda
    FROM zahtjevi z WHERE z.korisnik_id = $1 ORDER BY z.kreiran DESC LIMIT 50`, [req.korisnik.id]);
  res.json(rows);
}));

export default r;
