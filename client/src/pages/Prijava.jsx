import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useApp } from '../store.jsx';
import DemoPrijava from '../components/DemoPrijava.jsx';

const pocetnaZa = (k) => (k.uloga === 'admin' ? '/admin' : k.uloga === 'otpad' ? '/panel' : '/moj-nalog');

export function Prijava() {
  const { prijava } = useApp();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const [email, setEmail] = useState('');
  const [lozinka, setLozinka] = useState('');
  const [greska, setGreska] = useState('');

  async function posalji(e) {
    e.preventDefault(); setGreska('');
    try {
      const r = await api('/auth/prijava', { metoda: 'POST', tijelo: { email, lozinka } });
      prijava(r.token, r.korisnik);
      nav(sp.get('nazad') || pocetnaZa(r.korisnik));
    } catch (err) { setGreska(err.message); }
  }

  return (
    <div className="kartica kartica-tijelo" style={{ maxWidth: 440, margin: '20px auto' }}>
      <h1>Prijava</h1>
      <form onSubmit={posalji}>
        <label className="oznaka">Email</label>
        <input className="unos" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        <label className="oznaka">Lozinka</label>
        <input className="unos" type="password" value={lozinka} onChange={(e) => setLozinka(e.target.value)} required autoComplete="current-password" />
        {greska && <div className="greska">{greska}</div>}
        <button className="dugme puno" style={{ marginTop: 16 }}>Prijavi se</button>
      </form>
      <p className="tiho" style={{ textAlign: 'center', marginBottom: 0 }}>
        Nemate nalog? <Link to="/registracija">Registrujte se</Link>
      </p>
      <DemoPrijava />
    </div>
  );
}

export function Registracija() {
  const { prijava } = useApp();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const [tip, setTip] = useState(sp.get('tip') === 'otpad' ? 'otpad' : 'kupac');
  const [f, setF] = useState({ ime: '', email: '', telefon: '', lozinka: '', naziv: '', grad: '', adresa: '' });
  const [greska, setGreska] = useState('');
  const p = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function posalji(e) {
    e.preventDefault(); setGreska('');
    try {
      const r = await api('/auth/registracija', {
        metoda: 'POST',
        tijelo: { ...f, tip, otpad: tip === 'otpad' ? { naziv: f.naziv, grad: f.grad, adresa: f.adresa } : undefined },
      });
      prijava(r.token, r.korisnik);
      nav(pocetnaZa(r.korisnik));
    } catch (err) { setGreska(err.message); }
  }

  return (
    <div className="kartica kartica-tijelo" style={{ maxWidth: 520, margin: '20px auto' }}>
      <h1>Registracija</h1>
      <div className="tabovi">
        <button className={`tab ${tip === 'kupac' ? 'aktivan' : ''}`} onClick={() => setTip('kupac')}>Kupujem dijelove</button>
        <button className={`tab ${tip === 'otpad' ? 'aktivan' : ''}`} onClick={() => setTip('otpad')}>Imam otpad</button>
      </div>
      <form onSubmit={posalji}>
        {tip === 'otpad' && (
          <>
            <label className="oznaka">Naziv otpada</label>
            <input className="unos" value={f.naziv} onChange={p('naziv')} required />
            <div className="red-polja">
              <div><label className="oznaka">Grad</label><input className="unos" value={f.grad} onChange={p('grad')} required /></div>
              <div><label className="oznaka">Adresa</label><input className="unos" value={f.adresa} onChange={p('adresa')} /></div>
            </div>
          </>
        )}
        <label className="oznaka">{tip === 'otpad' ? 'Kontakt osoba' : 'Ime i prezime'}</label>
        <input className="unos" value={f.ime} onChange={p('ime')} required />
        <div className="red-polja">
          <div><label className="oznaka">Email</label><input className="unos" type="email" value={f.email} onChange={p('email')} required /></div>
          <div><label className="oznaka">Telefon</label><input className="unos" type="tel" value={f.telefon} onChange={p('telefon')} required={tip === 'otpad'} /></div>
        </div>
        <label className="oznaka">Lozinka (najmanje 6 znakova)</label>
        <input className="unos" type="password" value={f.lozinka} onChange={p('lozinka')} required minLength={6} autoComplete="new-password" />
        {tip === 'otpad' && <div className="info">Nakon registracije možete odmah unositi dijelove. Javno se prikazuju kad administrator odobri otpad.</div>}
        {greska && <div className="greska">{greska}</div>}
        <button className="dugme puno" style={{ marginTop: 16 }}>Napravi nalog</button>
      </form>
    </div>
  );
}
