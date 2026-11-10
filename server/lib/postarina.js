// Obračun poštarine: težina paketa (zbir težina dijelova) → razred u cjenovniku svake pošte otpada.
import { q } from '../db/index.js';

// SQL izraz za težinu dijela: ručna težina, inače težina tipa
export const TEZINA = `COALESCE(d.tezina_kg, (SELECT t.tezina_kg FROM tipovi_dijelova t WHERE t.id = d.tip_id))`;

export async function cjenovnik(otpadId, db = { query: q }) {
  const { rows } = await db.query(`
    SELECT s.id, s.naziv,
      COALESCE(json_agg(json_build_object('do_kg', c.do_kg, 'cijena_km', c.cijena_km) ORDER BY c.do_kg)
        FILTER (WHERE c.id IS NOT NULL), '[]') razredi
    FROM kurirske_sluzbe s LEFT JOIN kurir_cijene c ON c.sluzba_id = s.id
    WHERE s.otpad_id = $1 GROUP BY s.id ORDER BY s.redoslijed, s.id`, [otpadId]);
  return rows.map((r) => ({ ...r, razredi: r.razredi.map((x) => ({ do_kg: Number(x.do_kg), cijena_km: Number(x.cijena_km) })) }));
}

// Za datu težinu: cijena svake pošte (null = teže od najvećeg razreda → po dogovoru)
export function opcije(sluzbe, tezina) {
  return sluzbe
    .filter((s) => s.razredi.length)
    .map((s) => {
      const r = s.razredi.find((x) => tezina <= x.do_kg);
      return { id: s.id, naziv: s.naziv, cijena_km: r ? r.cijena_km : null, do_kg: r ? r.do_kg : null };
    })
    .sort((a, b) => (a.cijena_km ?? Infinity) - (b.cijena_km ?? Infinity));
}

// Poštarina za listu dijelova, grupisano po otpadu
export async function izracunaj(ids, db = { query: q }) {
  const { rows } = await db.query(`
    SELECT d.id, d.otpad_id, ${TEZINA} tezina, o.dostava_cijena_km
    FROM dijelovi d JOIN otpadi o ON o.id = d.otpad_id WHERE d.id = ANY($1)`, [ids]);
  const grupe = new Map();
  for (const d of rows) {
    if (!grupe.has(d.otpad_id)) grupe.set(d.otpad_id, { otpad_id: d.otpad_id, tezina_kg: 0, nepoznato: 0, pausal_km: Number(d.dostava_cijena_km) || 0 });
    const g = grupe.get(d.otpad_id);
    if (d.tezina == null) g.nepoznato++;
    else g.tezina_kg += Number(d.tezina);
  }
  const rez = [];
  for (const g of grupe.values()) {
    g.tezina_kg = Math.round(g.tezina_kg * 100) / 100;
    const sluzbe = await cjenovnik(g.otpad_id, db);
    // Bez cjenovnika ili s dijelom nepoznate težine: paušal otpada
    g.opcije = g.nepoznato || !sluzbe.length ? [] : opcije(sluzbe, g.tezina_kg);
    rez.push(g);
  }
  return rez;
}
