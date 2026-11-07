import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../store.jsx';
import { api, STANJA, km } from '../api.js';
import * as I from './Ikone.jsx';

export function Mrvice({ stavke }) {
  return (
    <nav className="mrvice" aria-label="Putanja">
      {stavke.map(([tekst, link], i) => (
        <span key={i} style={{ display: 'contents' }}>
          {i > 0 && <span className="sep" />}
          {link ? <Link to={link}>{tekst}</Link> : <span className="trenutno">{tekst}</span>}
        </span>
      ))}
    </nav>
  );
}

export function Stanje({ s }) {
  if (!s) return null;
  return <span className={`oznaka-stanja stanje-${s}`} title={STANJA[s]?.opis}>{STANJA[s]?.naziv || s}</span>;
}

export function DioKartica({ d }) {
  const { cijena, jeSacuvan, prebaciSacuvano } = useApp();
  const sac = jeSacuvan(d.id);
  return (
    <div className="kartica dio-kartica">
      <Link to={`/dio/${d.id}`} style={{ color: 'inherit', display: 'contents' }}>
        <div className="dio-slika">{d.slika ? <img src={d.slika} alt={d.naziv} loading="lazy" /> : <I.Dio />}</div>
        <div className="dio-tijelo">
          <Stanje s={d.stanje} />
          <div className="dio-naziv">{d.naziv}</div>
          <div className="dio-vozilo">{[d.marka, d.generacija].filter(Boolean).join(' ')}{d.godiste ? ` · ${d.godiste}` : ''}</div>
          {d.oem && <div className="dio-oem">{d.oem}</div>}
          {d.km ? <div className="dio-vozilo">{km(d.km)}</div> : null}
          <div className="dio-dno">
            <span className="cijena">{cijena(d.cijena_km)}</span>
            <span className="grad">{d.otpad}<br />{d.grad}</span>
          </div>
        </div>
      </Link>
      <button className={`sacuvaj-dugme ${sac ? 'da' : ''}`} onClick={() => prebaciSacuvano(d)} aria-label={sac ? 'Ukloni iz sačuvanih' : 'Sačuvaj'}>
        {sac ? <I.ZastavicaPuna /> : <I.Zastavica />}
      </button>
    </div>
  );
}

export function Modal({ naslov, onZatvori, children }) {
  return (
    <div className="modal-pozadina" onMouseDown={(e) => e.target === e.currentTarget && onZatvori()}>
      <div className="modal" role="dialog" aria-modal="true">
        <div className="modal-zaglavlje">
          <h2>{naslov}</h2>
          <button className="ikona-dugme" onClick={onZatvori} aria-label="Zatvori"><I.Zatvori /></button>
        </div>
        <div className="modal-tijelo">{children}</div>
      </div>
    </div>
  );
}

// Forma za pitanje otpadu (feature: upit direktno otpadu)
export function UpitForma({ dio, otpadId, onGotovo }) {
  const { korisnik } = useApp();
  const [f, setF] = useState({
    ime: korisnik?.ime || '', telefon: korisnik?.telefon || '', email: korisnik?.email || '',
    poruka: dio ? `Zdravo, da li je dio "${dio.naziv}"${dio.oem ? ` (OEM ${dio.oem})` : ''} još dostupan? ` : '',
  });
  const [greska, setGreska] = useState('');
  const [salje, setSalje] = useState(false);
  const [poslano, setPoslano] = useState(false);
  const p = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function posalji(e) {
    e.preventDefault();
    setGreska(''); setSalje(true);
    try {
      await api('/upiti', { metoda: 'POST', tijelo: { ...f, dio_id: dio?.id, otpad_id: otpadId } });
      setPoslano(true);
    } catch (err) { setGreska(err.message); } finally { setSalje(false); }
  }

  if (poslano) return (
    <div>
      <div className="uspjeh">Upit je poslan. Otpad će vas kontaktirati na telefon ili email koji ste ostavili.</div>
      {onGotovo && <button className="dugme puno" onClick={onGotovo}>U redu</button>}
    </div>
  );
  return (
    <form onSubmit={posalji}>
      <label className="oznaka">Ime i prezime</label>
      <input className="unos" value={f.ime} onChange={p('ime')} required />
      <div className="red-polja">
        <div><label className="oznaka">Telefon</label><input className="unos" type="tel" value={f.telefon} onChange={p('telefon')} /></div>
        <div><label className="oznaka">Email</label><input className="unos" type="email" value={f.email} onChange={p('email')} /></div>
      </div>
      <label className="oznaka">Poruka</label>
      <textarea className="unos" rows="4" value={f.poruka} onChange={p('poruka')} required />
      {greska && <div className="greska">{greska}</div>}
      <button className="dugme puno" style={{ marginTop: 14 }} disabled={salje}>{salje ? 'Šaljem…' : 'Pošalji upit'}</button>
    </form>
  );
}

export function Ucitavanje() {
  return <div className="ucitavanje">Učitavam…</div>;
}

export function Prazno({ children }) {
  return <div className="prazno-stanje"><I.Dio />{children}</div>;
}
