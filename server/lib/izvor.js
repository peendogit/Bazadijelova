// Automatsko povlačenje stanja iz programa otpada.
// Podržan format: "shop-api" iz Delić programa za dijelove (isti API koji koristi webshop):
//   GET <url>/shop-api/parts?after=&limit=   (header X-Api-Key)
// Svakih 15 minuta povuče sve dijelove na stanju; što je prodano u programu, ovdje se označi kao prodano.
import { q, transakcija } from '../db/index.js';
import { uveziDijelove } from './uvoz.js';

const STRANA = 500;

// Jedan dio iz shop-api u red za uvoz
export function mapirajDio(p, baza) {
  const naziv = [p.type, p.side].filter(Boolean).join(' ').trim() || p.group || 'Dio';
  const motor = [p.displacement ? `${(Number(p.displacement) / 1000).toFixed(1)}` : null, p.power ? `${p.power} kW` : null, p.engineCode]
    .filter(Boolean).join(' ');
  const detalji = [
    p.gearbox && `Mjenjač: ${p.gearbox}${p.gears ? ` ${p.gears} brz.` : ''}${p.gearboxCode ? ` (${p.gearboxCode})` : ''}`,
    p.body && `Karoserija: ${p.body}`,
    p.drive && `Pogon: ${p.drive}`,
    p.internal && `Šifra u otpadu: ${p.internal}`,
  ].filter(Boolean);
  // model iz programa je npr. "GOLF V" ili "A4 B7"; godina iz "(04-08)"
  const god = String(p.vehicle || '').match(/\((\d{2})-(\d{2})?\)/);
  const godiste = god ? (Number(god[1]) > 50 ? 1900 : 2000) + Number(god[1]) : null;
  return {
    sifra: String(p.id),
    naziv,
    oem: p.catalog || null,
    marka: p.make || null,
    model: p.model || null,
    generacija: p.model || null,
    godiste,
    kategorija: p.group || null,
    stanje: 'B',
    cijena: p.price ?? 0,
    kolicina: p.available ? p.qty || 1 : 0,
    motor: motor || null,
    gorivo: p.fuel || null,
    opis: [p.note, ...detalji].filter(Boolean).join('\n') || null,
    slike: (p.images || []).map((img) => `${baza}/img/${img}`),
  };
}

async function povuciSve(url, kljuc) {
  const baza = url.replace(/\/+$/, '');
  const sve = [];
  let after = 0;
  for (let i = 0; i < 400; i++) {
    const res = await fetch(`${baza}/shop-api/parts?after=${after}&limit=${STRANA}`, {
      headers: { 'X-Api-Key': kljuc }, signal: AbortSignal.timeout(60000),
    });
    if (res.status === 401) throw new Error('Program odbija API ključ (provjerite SHOP_API_KEY).');
    if (!res.ok) throw new Error(`Program je vratio grešku ${res.status}.`);
    const d = await res.json();
    for (const p of d.items || []) sve.push(mapirajDio(p, baza));
    if (!d.next) break;
    after = d.next;
  }
  return sve;
}

export async function sinhronizujOtpad(otpadId) {
  const { rows: [o] } = await q(`SELECT id, izvor_url, izvor_kljuc FROM otpadi WHERE id = $1`, [otpadId]);
  if (!o?.izvor_url || !o.izvor_kljuc) throw new Error('Program nije povezan.');
  try {
    const redovi = await povuciSve(o.izvor_url, o.izvor_kljuc);
    if (!redovi.length) throw new Error('Program nije vratio nijedan dio. Stanje nije mijenjano.');
    const rez = await transakcija((db) => uveziDijelove(db, o.id, redovi, { izvor: 'program', potpuno: true }));
    await q(`UPDATE otpadi SET izvor_zadnje = NOW(), izvor_greska = NULL WHERE id = $1`, [o.id]);
    return rez;
  } catch (e) {
    await q(`UPDATE otpadi SET izvor_greska = $2 WHERE id = $1`, [o.id, e.message.slice(0, 300)]);
    throw e;
  }
}

let radi = false;
export function pokreniSinhronizaciju() {
  const minuta = parseInt(process.env.SINHRONIZACIJA_MIN || '15', 10);
  const krug = async () => {
    if (radi) return;
    radi = true;
    try {
      const { rows } = await q(`SELECT id, naziv FROM otpadi WHERE izvor_url IS NOT NULL AND izvor_kljuc IS NOT NULL`);
      for (const o of rows) {
        try {
          const r = await sinhronizujOtpad(o.id);
          if (r.novih || r.prodanih) console.log(`Sinhronizacija ${o.naziv}: +${r.novih} novih, ${r.prodanih} prodano`);
        } catch (e) { console.error(`Sinhronizacija ${o.naziv}:`, e.message); }
      }
    } finally { radi = false; }
  };
  setTimeout(krug, 20000);
  setInterval(krug, minuta * 60000);
}
