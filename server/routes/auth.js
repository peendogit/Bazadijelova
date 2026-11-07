import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { q, transakcija } from '../db/index.js';
import { asyncH, slugify } from '../lib/util.js';
import { potpisi, prijavljen } from '../lib/auth.js';
import { obavijestiAdmina } from '../lib/telegram.js';

const r = Router();

const javniKorisnik = (k) => ({ id: k.id, email: k.email, ime: k.ime, telefon: k.telefon, uloga: k.uloga, otpad_id: k.otpad_id });

// Registracija kupca ili otpada. Otpad čeka odobrenje admina prije nego što se dijelovi vide javno.
r.post('/registracija', asyncH(async (req, res) => {
  const { email, lozinka, ime, telefon, tip, otpad } = req.body || {};
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ greska: 'Unesite ispravan email.' });
  if (!lozinka || lozinka.length < 6) return res.status(400).json({ greska: 'Lozinka mora imati bar 6 znakova.' });
  const { rows: [postoji] } = await q(`SELECT id FROM korisnici WHERE lower(email) = lower($1)`, [email]);
  if (postoji) return res.status(409).json({ greska: 'Nalog sa ovim emailom već postoji.' });
  const hash = await bcrypt.hash(lozinka, 10);

  const korisnik = await transakcija(async (db) => {
    let otpadId = null;
    let ulogaK = 'kupac';
    if (tip === 'otpad') {
      if (!otpad?.naziv || !otpad?.grad) throw Object.assign(new Error('Unesite naziv i grad otpada.'), { status: 400 });
      let slug = slugify(otpad.naziv);
      const { rows: [zauzet] } = await db.query(`SELECT 1 FROM otpadi WHERE slug = $1`, [slug]);
      if (zauzet) slug = `${slug}-${crypto.randomBytes(2).toString('hex')}`;
      const { rows: [o] } = await db.query(
        `INSERT INTO otpadi (naziv, slug, grad, adresa, telefon, email, api_kljuc)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
        [otpad.naziv, slug, otpad.grad, otpad.adresa || null, telefon || null, email,
         crypto.randomBytes(24).toString('hex')]
      );
      otpadId = o.id;
      ulogaK = 'otpad';
    }
    const { rows: [k] } = await db.query(
      `INSERT INTO korisnici (email, lozinka_hash, ime, telefon, uloga, otpad_id)
       VALUES (lower($1),$2,$3,$4,$5,$6) RETURNING *`,
      [email, hash, ime || null, telefon || null, ulogaK, otpadId]
    );
    return k;
  });
  if (korisnik.uloga === 'otpad')
    obavijestiAdmina(`🏭 Novi otpad čeka odobrenje: <b>${String(otpad.naziv).replace(/[<>&]/g, '')}</b>, ${String(otpad.grad).replace(/[<>&]/g, '')}\n📞 ${telefon || '-'}`);
  res.json({ token: potpisi(korisnik), korisnik: javniKorisnik(korisnik) });
}));

r.post('/prijava', asyncH(async (req, res) => {
  const { email, lozinka } = req.body || {};
  const { rows: [k] } = await q(`SELECT * FROM korisnici WHERE lower(email) = lower($1)`, [email || '']);
  if (!k || !(await bcrypt.compare(lozinka || '', k.lozinka_hash)))
    return res.status(401).json({ greska: 'Pogrešan email ili lozinka.' });
  res.json({ token: potpisi(k), korisnik: javniKorisnik(k) });
}));

r.get('/ja', prijavljen, asyncH(async (req, res) => {
  const { rows: [k] } = await q(`SELECT * FROM korisnici WHERE id = $1`, [req.korisnik.id]);
  if (!k) return res.status(401).json({ greska: 'Nalog ne postoji.' });
  res.json(javniKorisnik(k));
}));

export default r;
