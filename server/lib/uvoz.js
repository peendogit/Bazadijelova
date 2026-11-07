// Uvoz zaliha otpada (iz CSV-a ili preko API-ja).
// Svaki red se upari po "sifra" (šifra dijela u programu otpada): postoji → ažurira, ne postoji → dodaje.
// Sa opcijom "potpuno" svi dijelovi otpada kojih nema u uvozu označe se kao prodani.
import { slugify, normOem } from './util.js';
import { stanjePaketa } from './paket.js';

// Prihvata različite nazive kolona
const ALIASI = {
  sifra: ['sifra', 'šifra', 'id', 'sku', 'artikal', 'external_id'],
  naziv: ['naziv', 'dio', 'naziv_dijela', 'name', 'title'],
  oem: ['oem', 'oem_broj', 'kataloski_broj', 'kataloški_broj', 'part_number'],
  marka: ['marka', 'proizvodjac', 'proizvođač', 'make'],
  model: ['model'],
  generacija: ['generacija', 'serija', 'tip', 'kod'],
  godiste: ['godiste', 'godište', 'godina', 'year'],
  kategorija: ['kategorija', 'grupa', 'category'],
  stanje: ['stanje', 'ocjena', 'condition'],
  km: ['km', 'kilometraza', 'kilometraža', 'mileage'],
  cijena: ['cijena', 'cijena_km', 'cena', 'price'],
  kolicina: ['kolicina', 'količina', 'kom', 'qty'],
  slike: ['slike', 'slika', 'images', 'image'],
  opis: ['opis', 'napomena', 'description'],
  motor: ['motor', 'engine'],
  gorivo: ['gorivo', 'fuel'],
  vin: ['vin', 'sasija', 'šasija', 'broj_sasije'],
};

function normalizujRed(red) {
  const kljucevi = Object.fromEntries(Object.keys(red).map((k) => [slugify(k).replace(/-/g, '_'), k]));
  const izlaz = {};
  for (const [polje, imena] of Object.entries(ALIASI)) {
    for (const ime of imena) {
      const k = kljucevi[slugify(ime).replace(/-/g, '_')];
      if (k !== undefined && red[k] !== undefined && red[k] !== null && String(red[k]).trim() !== '') {
        izlaz[polje] = Array.isArray(red[k]) ? red[k] : String(red[k]).trim();
        break;
      }
    }
  }
  return izlaz;
}

// Jednostavan CSV parser: zarez ili tačka-zarez, navodnici, BOM
export function parsirajCsv(tekst) {
  tekst = tekst.replace(/^﻿/, '');
  const prvaLinija = tekst.split(/\r?\n/, 1)[0] || '';
  const sep = (prvaLinija.match(/;/g) || []).length > (prvaLinija.match(/,/g) || []).length ? ';' : ',';
  const redovi = [];
  let polje = '', red = [], uNavodnicima = false;
  for (let i = 0; i < tekst.length; i++) {
    const c = tekst[i];
    if (uNavodnicima) {
      if (c === '"' && tekst[i + 1] === '"') { polje += '"'; i++; }
      else if (c === '"') uNavodnicima = false;
      else polje += c;
    } else if (c === '"') uNavodnicima = true;
    else if (c === sep) { red.push(polje); polje = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && tekst[i + 1] === '\n') i++;
      red.push(polje); polje = '';
      if (red.some((p) => p.trim() !== '')) redovi.push(red);
      red = [];
    } else polje += c;
  }
  red.push(polje);
  if (red.some((p) => p.trim() !== '')) redovi.push(red);
  if (redovi.length < 2) return [];
  const zaglavlje = redovi[0].map((h) => h.trim());
  return redovi.slice(1).map((r) => Object.fromEntries(zaglavlje.map((h, i) => [h, r[i] ?? ''])));
}

async function ucitajKatalog(db) {
  const [{ rows: marke }, { rows: gens }, { rows: kats }] = await Promise.all([
    db.query('SELECT id, naziv, slug FROM marke'),
    db.query(`SELECT g.id, g.naziv, g.kod, g.od_god, g.do_god, mo.naziv model, mo.marka_id
              FROM generacije g JOIN modeli mo ON mo.id = g.model_id`),
    db.query('SELECT id, naziv, slug FROM kategorije'),
  ]);
  return { marke, gens, kats };
}

function nadjiMarku(kat, ime) {
  if (!ime) return null;
  const s = slugify(ime);
  return kat.marke.find((m) => m.slug === s || s.startsWith(m.slug) || m.slug.startsWith(s)) || null;
}

function nadjiGeneraciju(kat, markaId, r) {
  if (!markaId) return null;
  const godina = parseInt(r.godiste, 10);
  let kandidati = kat.gens.filter((g) => g.marka_id === markaId);
  const tekst = slugify(`${r.model || ''} ${r.generacija || ''}`);
  if (r.generacija) {
    const kod = String(r.generacija).toUpperCase();
    const poKodu = kandidati.filter((g) => g.kod === kod || slugify(g.naziv) === slugify(r.generacija));
    if (poKodu.length === 1) return poKodu[0].id;
    if (poKodu.length > 1) kandidati = poKodu;
  }
  if (r.model) {
    const m = slugify(r.model);
    const poModelu = kandidati.filter((g) => {
      const sm = slugify(g.model);
      return sm === m || sm.includes(m) || m.includes(sm) || slugify(g.naziv).includes(m);
    });
    if (poModelu.length) kandidati = poModelu;
    else if (!r.generacija) return null;
  }
  if (Number.isFinite(godina)) {
    const poGodini = kandidati.filter((g) => godina >= g.od_god && godina <= g.do_god);
    if (poGodini.length) kandidati = poGodini;
  }
  if (kandidati.length === 1) return kandidati[0].id;
  // više kandidata: uzmi onaj čiji naziv sadrži tekst iz uvoza, inače ne pogađaj
  const tacan = kandidati.find((g) => tekst && tekst.includes(slugify(g.naziv)));
  return tacan ? tacan.id : null;
}

function nadjiKategoriju(kat, ime, naziv) {
  const ostalo = kat.kats.find((k) => k.slug === 'ostalo');
  const s = slugify(ime || '');
  if (s) {
    const k = kat.kats.find((k) => k.slug === s || slugify(k.naziv) === s || slugify(k.naziv).startsWith(s));
    if (k) return k.id;
  }
  // pogodi po nazivu dijela
  const n = slugify(naziv || '');
  const pravila = [
    ['motor', /motor|glava|turbin|alternator|anlaser|elektropokret|zamajac|kartera|usisn/],
    ['mjenjac', /mjenjac|menjac|kvacil|poluosovin|diferencijal/],
    ['svjetla', /far|stop-svjet|stop-lamp|svjetl|magljenk|migavac/],
    ['karoserija', /hauba|branik|vrata|blatobran|gepek|krov|prag|maska/],
    ['unutrasnjost', /sjedist|volan|tabla|tapacir|tepih|naslon/],
    ['elektrika', /ecu|kompjuter|modul|radio|navigacij|prekidac|instrument|senzor|kabl/],
    ['ovjes', /amortizer|vilica|letva|glavcin|opruga|stabilizator|ramenjac/],
    ['kocnice', /kocn|abs|klijest|disk|servo/],
    ['hladjenje', /hladnjak|klim|ventilator|termostat|pumpa-vode/],
    ['izduv', /dpf|katalizator|auspuh|lonac|egr|izduv/],
    ['gorivo', /brizgalj|pumpa-vis|rezervoar|pumpa-gor|injektor/],
    ['felge', /felg|guma|tocak/],
    ['stakla', /retrovizor|staklo|sofersajbn|podizac/],
  ];
  for (const [slug, re] of pravila) {
    if (re.test(n)) {
      const k = kat.kats.find((k) => k.slug === slug);
      if (k) return k.id;
    }
  }
  return ostalo ? ostalo.id : null;
}

function broj(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = parseFloat(String(v).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

export async function uveziDijelove(db, otpadId, redovi, { izvor = 'csv', potpuno = false } = {}) {
  const kat = await ucitajKatalog(db);
  const rez = { novih: 0, azuriranih: 0, prodanih: 0, gresaka: 0, preko_limita: 0, greske: [] };
  // Besplatni paket: ograničen broj aktivnih dijelova
  const paket = await stanjePaketa(otpadId, db);
  let slobodno = paket.slobodno;
  const { rows: aktivne } = await db.query(
    `SELECT vanjska_sifra FROM dijelovi WHERE otpad_id = $1 AND status IN ('aktivan','rezervisan') AND vanjska_sifra IS NOT NULL`, [otpadId]);
  const aktivneSifre = new Set(aktivne.map((a) => a.vanjska_sifra));
  if (potpuno && !paket.pro) {
    // Cijelo stanje stiže u uvozu: limit se računa samo na dijelove iz uvoza + ručno unesene (bez šifre)
    const { rows: [{ n }] } = await db.query(
      `SELECT COUNT(*)::int n FROM dijelovi WHERE otpad_id = $1 AND status IN ('aktivan','rezervisan') AND vanjska_sifra IS NULL`, [otpadId]);
    slobodno = Math.max(0, paket.limit - n);
    aktivneSifre.clear();
  }
  const videneSifre = [];

  for (const [i, sirovo] of redovi.entries()) {
    const r = normalizujRed(sirovo);
    const brojReda = i + 2; // +1 zaglavlje, +1 jer redovi počinju od 1
    if (!r.naziv) { rez.gresaka++; rez.greske.push(`Red ${brojReda}: nema naziva dijela`); continue; }
    const cijena = broj(r.cijena) ?? 0; // bez cijene = "cijena na upit"

    const sifra = r.sifra || `${normOem(r.oem)}-${slugify(r.naziv)}`.slice(0, 120);
    const marka = nadjiMarku(kat, r.marka);
    const genId = nadjiGeneraciju(kat, marka?.id, r);
    const katId = nadjiKategoriju(kat, r.kategorija, r.naziv);
    const stanjeSirovo = String(r.stanje || 'B').toUpperCase();
    const stanje = ['A', 'B', 'C', 'N'].includes(stanjeSirovo[0]) ? stanjeSirovo[0] : 'B';
    const kolicina = Math.max(0, Math.round(broj(r.kolicina) ?? 1));
    if (kolicina > 0 && !aktivneSifre.has(sifra)) {
      if (slobodno <= 0) { rez.preko_limita++; continue; }
      slobodno--;
      aktivneSifre.add(sifra);
    }
    videneSifre.push(sifra);
    const slike = Array.isArray(r.slike)
      ? r.slike
      : String(r.slike || '').split(/[|\s,]+/).filter((u) => /^https?:\/\//.test(u));

    const { rows: [red] } = await db.query(
      `INSERT INTO dijelovi (otpad_id, vanjska_sifra, marka_id, generacija_id, kategorija_id, naziv, oem, oem_norm,
         stanje, km, godiste, motor, gorivo, vin_donora, cijena_km, kolicina, slike, opis, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
       ON CONFLICT (otpad_id, vanjska_sifra) DO UPDATE SET
         marka_id = EXCLUDED.marka_id, generacija_id = EXCLUDED.generacija_id, kategorija_id = EXCLUDED.kategorija_id,
         naziv = EXCLUDED.naziv, oem = EXCLUDED.oem, oem_norm = EXCLUDED.oem_norm, stanje = EXCLUDED.stanje,
         km = EXCLUDED.km, godiste = EXCLUDED.godiste, motor = EXCLUDED.motor, gorivo = EXCLUDED.gorivo,
         vin_donora = EXCLUDED.vin_donora, cijena_km = EXCLUDED.cijena_km, kolicina = EXCLUDED.kolicina,
         slike = CASE WHEN array_length(EXCLUDED.slike, 1) > 0 THEN EXCLUDED.slike ELSE dijelovi.slike END,
         opis = EXCLUDED.opis,
         status = CASE WHEN dijelovi.status = 'rezervisan' AND EXCLUDED.status = 'aktivan' THEN 'rezervisan' ELSE EXCLUDED.status END,
         azuriran = NOW()
       RETURNING (xmax = 0) AS nov`,
      [otpadId, sifra, marka?.id || null, genId, katId, r.naziv, r.oem || null, normOem(r.oem) || null,
       stanje, broj(r.km), broj(r.godiste), r.motor || null, r.gorivo || null, r.vin || null,
       cijena, kolicina, slike, r.opis || null, kolicina > 0 ? 'aktivan' : 'prodan']
    );
    red.nov ? rez.novih++ : rez.azuriranih++;
  }

  if (potpuno && videneSifre.length) {
    const { rowCount } = await db.query(
      `UPDATE dijelovi SET status = 'prodan', azuriran = NOW()
       WHERE otpad_id = $1 AND status = 'aktivan' AND vanjska_sifra IS NOT NULL AND NOT (vanjska_sifra = ANY($2))`,
      [otpadId, videneSifre]
    );
    rez.prodanih = rowCount;
  }

  if (rez.preko_limita) rez.greske.unshift(`${rez.preko_limita} dijelova nije dodano: dostignut limit besplatnog paketa (${paket.limit}).`);
  rez.greske = rez.greske.slice(0, 50);
  await db.query(
    `INSERT INTO uvozi (otpad_id, izvor, novih, azuriranih, prodanih, gresaka, greske) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [otpadId, izvor, rez.novih, rez.azuriranih, rez.prodanih, rez.gresaka, rez.greske]
  );
  return rez;
}
