import { Router } from 'express';
import { q } from '../db/index.js';
import { asyncH, int } from '../lib/util.js';
import { uloga } from '../lib/auth.js';

const r = Router();
r.use(uloga('admin'));

r.get('/otpadi', asyncH(async (_req, res) => {
  const { rows } = await q(`
    SELECT o.id, o.naziv, o.slug, o.grad, o.telefon, o.email, o.odobren, o.kreiran,
      (SELECT COUNT(*)::int FROM dijelovi d WHERE d.otpad_id = o.id AND d.status = 'aktivan') aktivnih,
      (SELECT MAX(kreiran) FROM uvozi u WHERE u.otpad_id = o.id) zadnji_uvoz
    FROM otpadi o ORDER BY o.odobren, o.kreiran DESC`);
  res.json(rows);
}));

r.put('/otpadi/:id', asyncH(async (req, res) => {
  const { rows: [o] } = await q(`UPDATE otpadi SET odobren = $2 WHERE id = $1 RETURNING id, naziv, odobren`,
    [int(req.params.id), !!req.body?.odobren]);
  res.json(o || {});
}));

r.get('/statistika', asyncH(async (_req, res) => {
  const { rows: [s] } = await q(`
    SELECT (SELECT COUNT(*)::int FROM dijelovi WHERE status = 'aktivan') aktivnih,
           (SELECT COUNT(*)::int FROM otpadi WHERE odobren) otpada,
           (SELECT COUNT(*)::int FROM otpadi WHERE NOT odobren) na_cekanju,
           (SELECT COUNT(*)::int FROM korisnici WHERE uloga = 'kupac') kupaca,
           (SELECT COUNT(*)::int FROM narudzbe WHERE kreiran > NOW() - INTERVAL '30 days') narudzbi_30d,
           (SELECT COUNT(*)::int FROM upiti WHERE kreiran > NOW() - INTERVAL '30 days') upita_30d`);
  res.json(s);
}));

export default r;
