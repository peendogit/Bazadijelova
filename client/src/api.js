export const KURS_EUR = 1.95583;
export const SRBIJA = typeof location !== 'undefined' && location.hostname.includes('bazadelova');
export const IME_SAJTA = SRBIJA ? 'bazadelova' : 'bazadijelova';

function token() {
  try { return localStorage.getItem('bd_token'); } catch { return null; }
}

export async function api(putanja, { metoda = 'GET', tijelo, forma } = {}) {
  const headers = {};
  const t = token();
  if (t) headers.Authorization = `Bearer ${t}`;
  let body;
  if (forma) body = forma;
  else if (tijelo !== undefined) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(tijelo); }
  const res = await fetch(`/api${putanja}`, { method: metoda, headers, body });
  let data = null;
  try { data = await res.json(); } catch { /* prazan odgovor */ }
  if (!res.ok) {
    const e = new Error(data?.greska || `Greška (${res.status})`);
    e.status = res.status;
    e.data = data;
    throw e;
  }
  return data;
}

export function qs(obj) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) if (v !== undefined && v !== null && v !== '') p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : '';
}

export const STANJA = {
  N: { naziv: 'Novo', opis: 'Nov, nekorišten dio' },
  A: { naziv: 'Odlično', opis: 'Bez oštećenja, potpuno ispravno' },
  B: { naziv: 'Dobro', opis: 'Ispravno, sitni tragovi korištenja' },
  C: { naziv: 'Oštećeno', opis: 'Ima oštećenja, opisano u oglasu' },
};

export const slug = (s) => String(s || '').toLowerCase()
  .replace(/[čć]/g, 'c').replace(/đ/g, 'dj').replace(/š/g, 's').replace(/ž/g, 'z')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
export const dioUrl = (d) => `/dio/${d.id}-${slug([d.naziv, d.marka, d.generacija].filter(Boolean).join(' '))}`;

export function km(n) {
  if (n === null || n === undefined) return null;
  return `${Number(n).toLocaleString('bs-BA')} km`;
}
