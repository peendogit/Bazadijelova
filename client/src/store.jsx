import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, KURS_EUR, SRBIJA } from './api.js';

const Ctx = createContext(null);

function citaj(kljuc, def) {
  try { const v = localStorage.getItem(kljuc); return v ? JSON.parse(v) : def; } catch { return def; }
}
function pisi(kljuc, v) {
  try { localStorage.setItem(kljuc, JSON.stringify(v)); } catch { /* privatni režim */ }
}

export function Provider({ children }) {
  const [korisnik, setKorisnik] = useState(null);
  const [ucitan, setUcitan] = useState(false);
  // BiH: KM / EUR; Srbija (bazadelova.com): RSD / EUR
  const VALUTE = SRBIJA ? ['RSD', 'EUR'] : ['KM', 'EUR'];
  const [valuta, setValutaS] = useState(() => { const v = citaj('bd_valuta', VALUTE[0]); return VALUTE.includes(v) ? v : VALUTE[0]; });
  const setValuta = (v) => setValutaS(VALUTE.includes(v) ? v : VALUTE[0]);
  const sljedecaValuta = () => setValutaS((v) => VALUTE[(VALUTE.indexOf(v) + 1) % VALUTE.length]);
  const [postavke, setPostavke] = useState({ kurs_rsd_eur: 117.2, paketi: null, telegram: false });
  const [korpa, setKorpa] = useState(() => citaj('bd_korpa', []));       // [{id, naziv, cijena_km, otpad_id, otpad, slika}]
  const [sacuvano, setSacuvano] = useState(() => citaj('bd_sacuvano', [])); // isti oblik
  const [poruka, setPoruka] = useState(null);

  useEffect(() => pisi('bd_valuta', valuta), [valuta]);
  useEffect(() => pisi('bd_korpa', korpa), [korpa]);
  useEffect(() => pisi('bd_sacuvano', sacuvano), [sacuvano]);

  useEffect(() => { api('/postavke').then(setPostavke).catch(() => {}); }, []);

  useEffect(() => {
    let t = null;
    try { t = localStorage.getItem('bd_token'); } catch { /* */ }
    if (!t) { setUcitan(true); return; }
    api('/auth/ja').then(setKorisnik).catch(() => odjava()).finally(() => setUcitan(true));
  }, []);

  const prijava = (token, k) => {
    try { localStorage.setItem('bd_token', token); } catch { /* */ }
    setKorisnik(k);
  };
  const odjava = () => {
    try { localStorage.removeItem('bd_token'); } catch { /* */ }
    setKorisnik(null);
  };

  const obavijest = useCallback((tekst) => {
    setPoruka(tekst);
    setTimeout(() => setPoruka((p) => (p === tekst ? null : p)), 2600);
  }, []);

  const snimak = (d) => ({
    id: d.id, naziv: d.naziv, oem: d.oem, cijena_km: d.cijena_km, slika: d.slika || d.slike?.[0] || null,
    otpad_id: d.otpad_id ?? d.otpad_info?.id, otpad: d.otpad ?? d.otpad_info?.naziv, grad: d.grad ?? d.otpad_info?.grad,
    dostava_cijena_km: d.dostava_cijena_km ?? d.otpad_info?.dostava_cijena_km,
    vozilo: [d.marka, d.generacija].filter(Boolean).join(' '),
  });

  const uKorpi = (id) => korpa.some((k) => k.id === id);
  const dodajUKorpu = (d) => {
    if (uKorpi(d.id)) return;
    setKorpa((k) => [...k, snimak(d)]);
    obavijest('Dodano u korpu');
  };
  const izbaciIzKorpe = (id) => setKorpa((k) => k.filter((x) => x.id !== id));

  const jeSacuvan = (id) => sacuvano.some((k) => k.id === id);
  const prebaciSacuvano = (d) => {
    if (jeSacuvan(d.id)) setSacuvano((s) => s.filter((x) => x.id !== d.id));
    else { setSacuvano((s) => [snimak(d), ...s]); obavijest('Sačuvano'); }
  };

  // Koliko jedinica izabrane valute vrijedi 1 KM
  const faktor = valuta === 'EUR' ? 1 / KURS_EUR : valuta === 'RSD' ? postavke.kurs_rsd_eur / KURS_EUR : 1;
  const cijena = (iznosKm) => {
    if (iznosKm === null || iznosKm === undefined) return '';
    const n = iznosKm * faktor;
    const znak = { EUR: '€', RSD: 'din', KM: 'KM' }[valuta];
    return `${n.toLocaleString(SRBIJA ? 'sr-Latn-RS' : 'bs-BA', { minimumFractionDigits: 0, maximumFractionDigits: valuta === 'EUR' ? 2 : 0 })} ${znak}`;
  };
  // Cijena dijela: 0 znači "na upit"
  const cijenaDijela = (iznosKm) => (iznosKm > 0 ? cijena(iznosKm) : 'Cijena na upit');

  return (
    <Ctx.Provider value={{
      korisnik, ucitan, prijava, odjava,
      valuta, setValuta, sljedecaValuta, cijena, cijenaDijela, faktor, postavke,
      korpa, setKorpa, uKorpi, dodajUKorpu, izbaciIzKorpe,
      sacuvano, jeSacuvan, prebaciSacuvano,
      poruka, obavijest,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export const useApp = () => useContext(Ctx);
