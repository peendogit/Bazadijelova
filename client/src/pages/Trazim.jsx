// "Tražim dio": kupac objavi šta mu treba, otpadi šalju ponude
import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api, STANJA } from '../api.js';
import { useApp } from '../store.jsx';
import { Mrvice, Ucitavanje, Zvjezdice } from '../components/Zajednicko.jsx';
import * as I from '../components/Ikone.jsx';

export function Trazim() {
  const { korisnik } = useApp();
  const [sp] = useSearchParams();
  const [marke, setMarke] = useState([]);
  const [modeli, setModeli] = useState([]);
  const [otvoreni, setOtvoreni] = useState([]);
  const [f, setF] = useState({
    naziv: sp.get('dio') || '', marka: '', generacija_id: '', godiste: '', motor: '', oem: '', opis: '',
    ime: korisnik?.ime || '', telefon: korisnik?.telefon || '', email: korisnik?.email || '', grad: '',
  });
  const [greska, setGreska] = useState('');
  const [salje, setSalje] = useState(false);
  const [gotovo, setGotovo] = useState(null);
  const p = (k) => (e) => setF({ ...f, [k]: e.target.value });

  useEffect(() => {
    api('/marke').then(setMarke).catch(() => {});
    api('/zahtjevi').then(setOtvoreni).catch(() => {});
  }, []);
  useEffect(() => {
    setModeli([]);
    if (f.marka) api(`/marke/${f.marka}`).then((m) => setModeli(m.modeli)).catch(() => {});
  }, [f.marka]);

  async function posalji(e) {
    e.preventDefault(); setGreska(''); setSalje(true);
    try {
      const marka = marke.find((m) => m.slug === f.marka);
      const r = await api('/zahtjevi', { metoda: 'POST', tijelo: { ...f, marka_id: marka?.id } });
      setGotovo(r);
    } catch (err) { setGreska(err.message); } finally { setSalje(false); }
  }

  if (gotovo) {
    const link = `${location.origin}/zahtjev/${gotovo.token}`;
    return (
      <div className="kartica kartica-tijelo" style={{ maxWidth: 620, margin: '0 auto' }}>
        <h1>Zahtjev je objavljen</h1>
        <div className="uspjeh">Otpadi su obaviješteni. Ponude ćete vidjeti na svom linku, a otpadi vas mogu i nazvati.</div>
        <label className="oznaka">Vaš link za ponude (sačuvajte ga)</label>
        <input className="unos" readOnly value={link} onFocus={(e) => e.target.select()} />
        <div className="akcije">
          <Link to={`/zahtjev/${gotovo.token}`} className="dugme">Otvori ponude</Link>
          {navigator.share && <button className="dugme sekundarno" onClick={() => navigator.share({ url: link, title: 'Moj zahtjev za dio' })}>Podijeli / sačuvaj</button>}
          {gotovo.telegram && <a className="dugme obrub" href={gotovo.telegram} target="_blank" rel="noreferrer">Ponude na Telegram</a>}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="traka"><Mrvice stavke={[['Početna', '/'], ['Tražim dio']]} /></div>
      <div className="detalj">
        <form className="kartica kartica-tijelo" onSubmit={posalji}>
          <h1>Tražim dio</h1>
          <p className="tiho" style={{ marginTop: 0 }}>Ne možete naći dio? Napišite šta vam treba, a otpadi koji ga imaju šalju vam ponudu sa cijenom.</p>
          <label className="oznaka">Koji dio tražite</label>
          <input className="unos" value={f.naziv} onChange={p('naziv')} required placeholder="npr. Far lijevi, xenon" />
          <div className="red-polja">
            <div><label className="oznaka">Marka</label>
              <select className="unos" value={f.marka} onChange={(e) => setF({ ...f, marka: e.target.value, generacija_id: '' })}>
                <option value="">Izaberi</option>
                {marke.map((m) => <option key={m.id} value={m.slug}>{m.naziv}</option>)}
              </select>
            </div>
            <div><label className="oznaka">Model</label>
              <select className="unos" value={f.generacija_id} onChange={p('generacija_id')} disabled={!modeli.length}>
                <option value="">Izaberi</option>
                {modeli.map((mo) => (
                  <optgroup key={mo.id} label={mo.naziv}>
                    {mo.generacije.map((g) => <option key={g.id} value={g.id}>{g.naziv} ({g.od}–{g.do})</option>)}
                  </optgroup>
                ))}
              </select>
            </div>
          </div>
          <div className="red-polja">
            <div><label className="oznaka">Godište</label><input className="unos" inputMode="numeric" value={f.godiste} onChange={p('godiste')} /></div>
            <div><label className="oznaka">Motor</label><input className="unos" value={f.motor} onChange={p('motor')} placeholder="1.9 TDI" /></div>
            <div><label className="oznaka">OEM broj (ako znate)</label><input className="unos" value={f.oem} onChange={p('oem')} /></div>
          </div>
          <label className="oznaka">Napomena</label>
          <textarea className="unos" rows="2" value={f.opis} onChange={p('opis')} placeholder="npr. treba mi sa nosačima, može i oštećeno staklo" />
          <h3 style={{ marginTop: 18 }}>Vaš kontakt</h3>
          <div className="red-polja">
            <div><label className="oznaka">Ime</label><input className="unos" value={f.ime} onChange={p('ime')} required /></div>
            <div><label className="oznaka">Grad</label><input className="unos" value={f.grad} onChange={p('grad')} /></div>
          </div>
          <div className="red-polja">
            <div><label className="oznaka">Telefon</label><input className="unos" type="tel" value={f.telefon} onChange={p('telefon')} /></div>
            <div><label className="oznaka">Email</label><input className="unos" type="email" value={f.email} onChange={p('email')} /></div>
          </div>
          <div className="tiho malo" style={{ marginTop: 6 }}>Kontakt vide samo otpadi koji vam pošalju ponudu.</div>
          {greska && <div className="greska">{greska}</div>}
          <button className="dugme narandzasto puno" style={{ marginTop: 14 }} disabled={salje}>{salje ? 'Objavljujem…' : 'Objavi zahtjev'}</button>
        </form>

        <div className="kartica kartica-tijelo">
          <h2>Šta drugi traže</h2>
          {!otvoreni.length && <p className="tiho">Trenutno nema otvorenih zahtjeva.</p>}
          <div className="lista-stavki">
            {otvoreni.map((z) => (
              <div key={z.id}>
                <b>{z.naziv}</b>
                <div className="tiho malo">
                  {[z.marka, z.generacija].filter(Boolean).join(' ')}{z.godiste ? `, ${z.godiste}` : ''}{z.grad ? ` · ${z.grad}` : ''} · {z.broj_ponuda} ponuda
                </div>
              </div>
            ))}
          </div>
          <div className="info" style={{ marginTop: 14 }}>Imate otpad? <Link to="/za-otpade">Odgovarajte na zahtjeve i prodajte više.</Link></div>
        </div>
      </div>
    </>
  );
}

export function Zahtjev() {
  const { token } = useParams();
  const { cijena } = useApp();
  const [z, setZ] = useState(null);
  const [greska, setGreska] = useState('');
  const ucitaj = () => api(`/zahtjevi/${token}`).then(setZ).catch((e) => setGreska(e.message));
  useEffect(() => { ucitaj(); const t = setInterval(ucitaj, 60000); return () => clearInterval(t); }, [token]);

  async function status(s) {
    await api(`/zahtjevi/${token}`, { metoda: 'PUT', tijelo: { status: s } });
    ucitaj();
  }

  if (greska) return <div className="greska">{greska}</div>;
  if (!z) return <Ucitavanje />;
  return (
    <>
      <div className="traka"><Mrvice stavke={[['Početna', '/'], ['Tražim dio', '/trazim'], ['Moj zahtjev']]} /></div>
      <div className="kartica kartica-tijelo">
        <div className="traka">
          <div>
            <h1 style={{ marginBottom: 2 }}>{z.naziv}</h1>
            <div className="tiho">{[z.marka, z.generacija].filter(Boolean).join(' ')}{z.godiste ? `, ${z.godiste}` : ''}{z.oem ? ` · OEM ${z.oem}` : ''}</div>
          </div>
          <span className={`status status-${z.status === 'otvoren' ? 'aktivan' : 'zatvoren'}`}>{z.status === 'otvoren' ? 'Otvoren' : 'Zatvoren'}</span>
        </div>
        <h2>Ponude ({z.ponude.length})</h2>
        {!z.ponude.length && <div className="info">Još nema ponuda. Otpadi su obaviješteni; ova stranica se sama osvježava.</div>}
        <div className="lista-stavki">
          {z.ponude.map((p) => (
            <div key={p.id}>
              <div className="traka" style={{ marginBottom: 4 }}>
                <span><Link to={`/otpad/${p.otpad_slug}`}><b>{p.otpad}</b></Link> <span className="tiho malo">{p.grad}</span> {p.ocjena && <span className="zvjezdice malo"><span className="zv">★</span> {Number(p.ocjena).toFixed(1)}</span>}</span>
                <b className="cijena">{p.cijena_km ? cijena(p.cijena_km) : 'Cijena po dogovoru'}</b>
              </div>
              {p.stanje && <div className="malo">Stanje: {STANJA[p.stanje]?.naziv}</div>}
              {p.poruka && <p style={{ margin: '4px 0' }}>{p.poruka}</p>}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                {p.telefon && <a className="dugme malo" href={`tel:${p.telefon}`}><I.Telefon />Nazovi</a>}
                {p.dio_id && <Link className="dugme sekundarno malo" to={`/dio/${p.dio_id}`}>Pogledaj dio</Link>}
                <span className="tiho malo" style={{ alignSelf: 'center' }}>Dostava {cijena(p.dostava_cijena_km)}</span>
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 16 }}>
          {z.status === 'otvoren'
            ? <button className="dugme obrub malo" onClick={() => status('zatvoren')}>Našao sam dio, zatvori zahtjev</button>
            : <button className="dugme obrub malo" onClick={() => status('otvoren')}>Ponovo otvori</button>}
        </div>
      </div>
    </>
  );
}
