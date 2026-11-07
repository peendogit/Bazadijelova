const MAPA = { č: 'c', ć: 'c', đ: 'dj', š: 's', ž: 'z', ë: 'e', é: 'e', ö: 'o', ü: 'u' };

export function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[čćđšžëéöü]/g, (c) => MAPA[c])
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// OEM broj bez razmaka, tačaka i crtica: "1K0 615 301 AA" → "1K0615301AA"
export function normOem(s) {
  return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export const KURS_EUR = 1.95583;

export function asyncH(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

export function int(v, def = null) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : def;
}
