// Puni katalog (marke, modele, generacije, kategorije) i pravi admin nalog.
// Sa SEED_DEMO=1 dodaje i demo otpade sa nasumičnim dijelovima.
// Bezbjedno je pokrenuti više puta.
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { pool, q, primijeniSemu } from './index.js';
import { KATALOG, KATEGORIJE, DEMO_DIJELOVI } from './katalog-podaci.js';
import { slugify, normOem } from '../lib/util.js';

async function katalog() {
  for (const [i, [naziv, slug, ikona]] of KATEGORIJE.entries()) {
    await q(
      `INSERT INTO kategorije (naziv, slug, ikona, redoslijed) VALUES ($1,$2,$3,$4)
       ON CONFLICT (slug) DO UPDATE SET naziv = EXCLUDED.naziv, ikona = EXCLUDED.ikona, redoslijed = EXCLUDED.redoslijed`,
      [naziv, slug, ikona, i]
    );
  }
  for (const [marka, modeli] of Object.entries(KATALOG)) {
    const { rows: [m] } = await q(
      `INSERT INTO marke (naziv, slug) VALUES ($1,$2)
       ON CONFLICT (slug) DO UPDATE SET naziv = EXCLUDED.naziv RETURNING id`,
      [marka, slugify(marka)]
    );
    for (const [model, gens] of Object.entries(modeli)) {
      const { rows: [mo] } = await q(
        `INSERT INTO modeli (marka_id, naziv, slug) VALUES ($1,$2,$3)
         ON CONFLICT (marka_id, slug) DO UPDATE SET naziv = EXCLUDED.naziv RETURNING id`,
        [m.id, model, slugify(model)]
      );
      for (const [naziv, kod, od, doG] of gens) {
        await q(
          `INSERT INTO generacije (model_id, naziv, kod, od_god, do_god, slug) VALUES ($1,$2,$3,$4,$5,$6)
           ON CONFLICT (model_id, slug) DO UPDATE SET naziv = EXCLUDED.naziv, kod = EXCLUDED.kod,
             od_god = EXCLUDED.od_god, do_god = EXCLUDED.do_god`,
          [mo.id, naziv, kod, od, doG, slugify(`${naziv}-${od}-${doG}`)]
        );
      }
    }
  }
  console.log('✓ Katalog upisan');
}

async function admin() {
  const email = process.env.ADMIN_EMAIL || 'admin@bazadijelova.com';
  const lozinka = process.env.ADMIN_LOZINKA || 'promijeni-me';
  const hash = await bcrypt.hash(lozinka, 10);
  const { rowCount } = await q(
    `INSERT INTO korisnici (email, lozinka_hash, ime, uloga) VALUES ($1,$2,'Administrator','admin')
     ON CONFLICT (email) DO NOTHING`,
    [email, hash]
  );
  console.log(rowCount ? `✓ Admin napravljen: ${email}` : `• Admin već postoji: ${email}`);
}

const DEMO_OTPADI = [
  { naziv: 'Auto Otpad Delić', grad: 'Bijeljina', lat: 44.7587, lng: 19.2144, dostava: 10 },
  { naziv: 'Demo otpad Sarajevo', grad: 'Sarajevo', lat: 43.8563, lng: 18.4131, dostava: 12 },
  { naziv: 'Demo otpad Banja Luka', grad: 'Banja Luka', lat: 44.7722, lng: 17.191, dostava: 12 },
];

const rnd = (a) => a[Math.floor(Math.random() * a.length)];
const izmedju = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

async function demo() {
  const { rows: gens } = await q(
    `SELECT g.id, g.od_god, g.do_god, mo.marka_id FROM generacije g JOIN modeli mo ON mo.id = g.model_id`
  );
  const { rows: kats } = await q(`SELECT id, slug FROM kategorije`);
  const lozinka = await bcrypt.hash('demo1234', 10);

  for (const o of DEMO_OTPADI) {
    const slug = slugify(o.naziv);
    const { rows: [otpad] } = await q(
      `INSERT INTO otpadi (naziv, slug, grad, lat, lng, dostava_cijena_km, dostava_info, odobren, api_kljuc, opis)
       VALUES ($1,$2,$3,$4,$5,$6,'Slanje brzom poštom širom BiH, 1-2 radna dana.',TRUE,$7,$8)
       ON CONFLICT (slug) DO UPDATE SET naziv = EXCLUDED.naziv RETURNING id`,
      [o.naziv, slug, o.grad, o.lat, o.lng, o.dostava, crypto.randomBytes(24).toString('hex'),
       'Polovni originalni dijelovi, provjereni i spremni za slanje.']
    );
    await q(
      `INSERT INTO korisnici (email, lozinka_hash, ime, uloga, otpad_id) VALUES ($1,$2,$3,'otpad',$4)
       ON CONFLICT (email) DO NOTHING`,
      [`${slug}@demo.ba`, lozinka, o.naziv, otpad.id]
    );
    const { rows: [{ n }] } = await q(`SELECT COUNT(*)::int n FROM dijelovi WHERE otpad_id = $1`, [otpad.id]);
    if (n > 0) continue;

    for (let i = 0; i < 250; i++) {
      const g = rnd(gens);
      const k = rnd(kats);
      const naziv = rnd(DEMO_DIJELOVI[k.slug] || DEMO_DIJELOVI.ostalo);
      const oem = `${izmedju(1, 9)}${rnd(['K', 'J', 'Z', 'P', 'E'])}${izmedju(0, 9)} ${izmedju(100, 999)} ${izmedju(100, 999)}${rnd(['', ' A', ' B', ' AC'])}`;
      await q(
        `INSERT INTO dijelovi (otpad_id, vanjska_sifra, marka_id, generacija_id, kategorija_id, naziv, oem, oem_norm,
           stanje, km, godiste, gorivo, cijena_km, kolicina)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,1)`,
        [otpad.id, `DEMO-${i}`, g.marka_id, g.id, k.id, naziv, oem, normOem(oem),
         rnd(['A', 'A', 'B', 'B', 'B', 'C']), izmedju(60, 320) * 1000,
         izmedju(g.od_god, Math.min(g.do_god, 2025)), rnd(['Dizel', 'Benzin']), izmedju(2, 120) * 10]
      );
    }
  }
  console.log('✓ Demo otpadi i dijelovi (lozinka za demo naloge: demo1234)');
}

try {
  await primijeniSemu();
  await katalog();
  await admin();
  if (process.env.SEED_DEMO === '1') await demo();
} catch (e) {
  console.error('Greška:', e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
