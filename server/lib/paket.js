// Paketi za otpade: besplatno (ograničen broj dijelova) i Pro (bez ograničenja + izdvojeni oglasi).
// Admin ručno uključuje Pro i datum do kad važi; plaćanje je po dogovoru (uplata na račun).
import { q } from '../db/index.js';

export const POSTAVKE = () => ({
  besplatno_limit: parseInt(process.env.BESPLATNO_LIMIT || '100', 10),
  pro_izdvojeni: parseInt(process.env.PRO_IZDVOJENI || '10', 10),
  izdvojeno_dana: parseInt(process.env.IZDVOJENO_DANA || '7', 10),
  pro_cijena: process.env.PRO_CIJENA || 'po dogovoru',
});

// SQL izraz: otpad ima aktivan Pro
export const JE_PRO = `(o.paket = 'pro' AND (o.paket_do IS NULL OR o.paket_do >= CURRENT_DATE))`;

export async function stanjePaketa(otpadId, db = { query: q }) {
  const { rows: [r] } = await db.query(`
    SELECT o.paket, o.paket_do, ${JE_PRO} AS pro,
      (SELECT COUNT(*)::int FROM dijelovi d WHERE d.otpad_id = o.id AND d.status IN ('aktivan','rezervisan')) aktivnih,
      (SELECT COUNT(*)::int FROM dijelovi d WHERE d.otpad_id = o.id AND d.izdvojen_do > NOW() AND d.status = 'aktivan') izdvojenih
    FROM otpadi o WHERE o.id = $1`, [otpadId]);
  const p = POSTAVKE();
  return {
    ...r,
    limit: r.pro ? null : p.besplatno_limit,
    slobodno: r.pro ? Infinity : Math.max(0, p.besplatno_limit - r.aktivnih),
    izdvojeni_limit: r.pro ? p.pro_izdvojeni : 0,
  };
}
