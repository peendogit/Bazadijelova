import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, KURS_EUR } from './api.js';

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
  const [valuta, setValuta] = useState(() => citaj('bd_valuta', 'KM'));
  const [korpa, setKorpa] = useState(() => citaj('bd_korpa', []));       // [{id, naziv, cijena_km, otpad_id, otpad, slika}]
  const [sacuvano, setSacuvano] = useState(() => citaj('bd_sacuvano', [])); // isti oblik
  const [garaza, setGaraza] = useState(() => citaj('bd_garaza', []));     // [{tablica, vin, opis, generacija_id}]
  const [poruka, setPoruka] = useState(null);

  useEffect(() => pisi('bd_valuta', valuta), [valuta]);
  useEffect(() => pisi('bd_korpa', korpa), [korpa]);
  useEffect(() => pisi('bd_sacuvano', sacuvano), [sacuvano]);
  useEffect(() => pisi('bd_garaza', garaza), [garaza]);

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

  const cijena = (iznosKm) => {
    if (iznosKm === null || iznosKm === undefined) return '';
    const n = valuta === 'EUR' ? iznosKm / KURS_EUR : iznosKm;
    return `${n.toLocaleString('bs-BA', { minimumFractionDigits: 0, maximumFractionDigits: valuta === 'EUR' ? 2 : 0 })} ${valuta === 'EUR' ? '€' : 'KM'}`;
  };

  const sacuvajVozilo = (v) =>
    setGaraza((g) => [v, ...g.filter((x) => x.tablica !== v.tablica && x.vin !== v.vin)].slice(0, 10));
  const obrisiVozilo = (vin) => setGaraza((g) => g.filter((x) => x.vin !== vin));

  return (
    <Ctx.Provider value={{
      korisnik, ucitan, prijava, odjava,
      valuta, setValuta, cijena,
      korpa, setKorpa, uKorpi, dodajUKorpu, izbaciIzKorpe,
      sacuvano, jeSacuvan, prebaciSacuvano,
      garaza, sacuvajVozilo, obrisiVozilo,
      poruka, obavijest,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export const useApp = () => useContext(Ctx);
