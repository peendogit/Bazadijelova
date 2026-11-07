import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../store.jsx';
import * as I from './Ikone.jsx';

export default function Zaglavlje() {
  const { korisnik, odjava, korpa, sacuvano, valuta, setValuta } = useApp();
  const [meni, setMeni] = useState(false);
  const nav = useNavigate();
  const zatvori = () => setMeni(false);

  return (
    <>
      <header className="zaglavlje">
        <div className="zaglavlje-unutra">
          <button className="ikona-dugme" onClick={() => setMeni(true)} aria-label="Meni"><I.Meni /></button>
          <Link to="/" className="logo"><I.LogoZnak className="logo-znak" /><span>baza<b>dijelova</b></span></Link>
          <div className="razmak" />
          <Link to="/sacuvano" className="ikona-dugme sakrij-mob" aria-label="Sačuvano">
            <I.Zastavica />{sacuvano.length > 0 && <span className="znacka">{sacuvano.length}</span>}
          </Link>
          <Link to="/korpa" className="ikona-dugme" aria-label="Korpa">
            <I.Korpa />{korpa.length > 0 && <span className="znacka">{korpa.length}</span>}
          </Link>
          <button className="valuta" onClick={() => setValuta(valuta === 'KM' ? 'EUR' : 'KM')} title="Promijeni valutu">
            {valuta}
          </button>
          <button
            className={`avatar ${korisnik ? 'prijavljen' : ''}`}
            onClick={() => nav(korisnik ? (korisnik.uloga === 'kupac' ? '/moj-nalog' : korisnik.uloga === 'admin' ? '/admin' : '/panel') : '/prijava')}
            aria-label="Nalog"
          >
            {korisnik ? (korisnik.ime || korisnik.email)[0].toUpperCase() : <I.Korisnik style={{ width: 26, height: 26 }} />}
          </button>
        </div>
      </header>

      {meni && (
        <>
          <div className="zavjesa" onClick={zatvori} />
          <nav className="meni" onClick={(e) => e.target.closest('a,button.stavka') && zatvori()}>
            <div className="traka" style={{ padding: '0 6px' }}>
              <span className="logo"><I.LogoZnak className="logo-znak" /><span>baza<b>dijelova</b></span></span>
              <button className="ikona-dugme" onClick={zatvori} aria-label="Zatvori"><I.Zatvori /></button>
            </div>
            <Link to="/"><I.Kuca width="20" />Početna</Link>
            <Link to="/dijelovi"><I.Lupa width="20" />Svi dijelovi</Link>
            <Link to="/marke"><I.Auto width="20" />Marke vozila</Link>
            <Link to="/otpadi"><I.Lokacija width="20" />Otpadi</Link>
            <Link to="/sacuvano"><I.Zastavica width="20" />Sačuvano ({sacuvano.length})</Link>
            <Link to="/korpa"><I.Korpa width="20" />Korpa ({korpa.length})</Link>
            <hr />
            {korisnik ? (
              <>
                <div className="meni-naslov">{korisnik.ime || korisnik.email}</div>
                {korisnik.uloga === 'kupac' && <Link to="/moj-nalog"><I.Lista width="20" />Moje narudžbe i upiti</Link>}
                {korisnik.uloga === 'otpad' && <Link to="/panel"><I.Postavke width="20" />Panel otpada</Link>}
                {korisnik.uloga === 'admin' && <Link to="/admin"><I.Postavke width="20" />Administracija</Link>}
                <button className="stavka" onClick={() => { odjava(); nav('/'); }}><I.Izlaz width="20" />Odjava</button>
              </>
            ) : (
              <>
                <Link to="/prijava"><I.Korisnik width="20" />Prijava</Link>
                <Link to="/registracija?tip=otpad"><I.Upload width="20" />Registruj otpad</Link>
              </>
            )}
          </nav>
        </>
      )}
    </>
  );
}
