// Tipovi dijelova: prepoznavanje tipa iz naziva dijela (za težinu i poštarinu).
import { q } from '../db/index.js';
import { slugify } from './util.js';

export async function ucitajTipove(db = { query: q }) {
  const { rows } = await db.query(`SELECT id, naziv, kategorija_id, tezina_kg, kljucne FROM tipovi_dijelova`);
  return rows.map((t) => ({ ...t, slug: slugify(t.naziv), kljucne: (t.kljucne || []).map(slugify).filter(Boolean) }));
}

// Vraća tip koji najbolje odgovara nazivu (tačan naziv > najduža ključna riječ na početku riječi)
export function nadjiTip(tipovi, naziv) {
  const s = slugify(naziv);
  if (!s) return null;
  const tacan = tipovi.find((t) => t.slug === s);
  if (tacan) return tacan;
  const tekst = `-${s}-`;
  let najbolji = null, duzina = 0;
  for (const t of tipovi) {
    for (const k of [t.slug, ...t.kljucne]) {
      if (k.length > duzina && tekst.includes(`-${k}`)) { najbolji = t; duzina = k.length; }
    }
  }
  return najbolji;
}

// Dodijeli tip svim dijelovima koji ga nemaju (npr. nakon dodavanja novog tipa)
export async function prepoznajTipove({ sve = false } = {}) {
  const tipovi = await ucitajTipove();
  const { rows } = await q(`SELECT id, naziv FROM dijelovi WHERE ${sve ? 'TRUE' : 'tip_id IS NULL'}`);
  let n = 0;
  const poTipu = new Map();
  for (const d of rows) {
    const t = nadjiTip(tipovi, d.naziv);
    if (!t) continue;
    if (!poTipu.has(t.id)) poTipu.set(t.id, []);
    poTipu.get(t.id).push(d.id);
  }
  for (const [tipId, ids] of poTipu) {
    await q(`UPDATE dijelovi SET tip_id = $1 WHERE id = ANY($2)`, [tipId, ids]);
    n += ids.length;
  }
  return n;
}
