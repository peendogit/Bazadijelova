// Brzo prebacivanje između demo naloga (vidi se samo kad je DEMO_PRIJAVA=1 na serveru)
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useApp } from '../store.jsx';

const pocetnaZa = (k) => (k.uloga === 'admin' ? '/admin' : k.uloga === 'otpad' ? '/panel' : '/moj-nalog');
const IKONA = { kupac: '🛒', otpad: '🏭', admin: '🔑' };
let kes = null;

export function useDemoNalozi() {
  const [nalozi, setNalozi] = useState(kes || []);
  useEffect(() => {
    if (kes) return;
    api('/auth/demo').then((r) => { kes = r.nalozi; setNalozi(r.nalozi); }).catch(() => { kes = []; });
  }, []);
  return nalozi;
}

export default function DemoPrijava({ kompaktno, onGotovo }) {
  const nalozi = useDemoNalozi();
  const { korisnik, prijava, obavijest } = useApp();
  const nav = useNavigate();
  if (!nalozi.length) return null;

  async function udji(email) {
    try {
      const r = await api('/auth/demo', { metoda: 'POST', tijelo: { email } });
      prijava(r.token, r.korisnik);
      obavijest(`Prijavljen: ${r.korisnik.ime || r.korisnik.email}`);
      onGotovo?.();
      nav(pocetnaZa(r.korisnik));
    } catch (e) { obavijest(e.message); }
  }

  return (
    <div className={`demo-prijava ${kompaktno ? 'kompaktno' : ''}`}>
      <div className="demo-naslov">Brza demo prijava</div>
      <div className="demo-dugmad">
        {nalozi.map((n) => (
          <button key={n.email} type="button" className={`demo-dugme ${korisnik?.email === n.email ? 'aktivan' : ''}`} onClick={() => udji(n.email)}>
            <span aria-hidden="true">{IKONA[n.uloga]}</span>
            <span><b>{n.uloga === 'otpad' ? n.otpad : n.ime}</b><small>{n.uloga}</small></span>
          </button>
        ))}
      </div>
    </div>
  );
}
