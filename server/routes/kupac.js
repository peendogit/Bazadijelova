// Upiti i narudžbe od kupaca (gost ili prijavljen)
import { Router } from 'express';
import { q, transakcija } from '../db/index.js';
import { asyncH, int } from '../lib/util.js';
import { opcionalno, prijavljen } from '../lib/auth.js';

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
       WHERE d.id = ANY($1) AND d.status = 'aktivan' AND d.kolicina > 0 FOR UPDATE OF d`, [ids]);
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
        `INSERT INTO narudzbe (otpad_id, korisnik_id, ime, telefon, email, adresa, grad, nacin, napomena, ukupno_km, dostava_km)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
        [otpadId, req.korisnik?.id || null, ime, telefon, email || null, adresa || null, grad || null,
         nacinP, napomena || null, ukupno, dostava]
      );
      for (const d of lista) {
        await db.query(
          `INSERT INTO narudzba_stavke (narudzba_id, dio_id, naziv, oem, cijena_km) VALUES ($1,$2,$3,$4,$5)`,
          [n.id, d.id, d.naziv, d.oem, d.cijena_km]
        );
      }
      await db.query(`UPDATE dijelovi SET status = 'rezervisan', azuriran = NOW() WHERE id = ANY($1)`, [lista.map((d) => d.id)]);
      narudzbe.push({ id: n.id, otpad: lista[0].otpad, ukupno_km: ukupno, dostava_km: dostava });
    }
    return narudzbe;
  });
  res.json({ ok: true, narudzbe: rezultat });
}));

r.get('/moje-narudzbe', prijavljen, asyncH(async (req, res) => {
  const { rows } = await q(`
    SELECT n.*, o.naziv otpad, o.telefon otpad_telefon,
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

export default r;
