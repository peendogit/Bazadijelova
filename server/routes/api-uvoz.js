// Automatski uvoz zaliha iz programa otpada (npr. dijelovi.delicauto.com) preko API ključa.
//
// POST /api/uvoz
// Header:  X-Api-Key: <ključ iz panela otpada>
// Body:    { "potpuno": true, "dijelovi": [ { "sifra": "123", "naziv": "Far lijevi", "oem": "1K6941005",
//            "marka": "Volkswagen", "model": "Golf", "godiste": 2007, "kategorija": "svjetla",
//            "stanje": "A", "km": 180000, "cijena": 150, "kolicina": 1, "slike": ["https://..."] } ] }
//
// "potpuno": true → dijelovi kojih nema u listi označe se kao prodani (šalje se cijelo stanje).
import { Router } from 'express';
import { q, transakcija } from '../db/index.js';
import { asyncH } from '../lib/util.js';
import { uveziDijelove } from '../lib/uvoz.js';

const r = Router();

r.post('/', asyncH(async (req, res) => {
  const kljuc = req.get('X-Api-Key');
  if (!kljuc) return res.status(401).json({ greska: 'Nedostaje X-Api-Key.' });
  const { rows: [o] } = await q(`SELECT id FROM otpadi WHERE api_kljuc = $1`, [kljuc]);
  if (!o) return res.status(401).json({ greska: 'Nevažeći API ključ.' });
  const lista = Array.isArray(req.body) ? req.body : req.body?.dijelovi;
  if (!Array.isArray(lista) || !lista.length) return res.status(400).json({ greska: 'Pošaljite listu "dijelovi".' });
  if (lista.length > 50000) return res.status(400).json({ greska: 'Najviše 50.000 dijelova po pozivu.' });
  const rez = await transakcija((db) =>
    uveziDijelove(db, o.id, lista, { izvor: 'api', potpuno: req.body?.potpuno === true }));
  res.json(rez);
}));

export default r;
