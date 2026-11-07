import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useApp } from '../store.jsx';
import { DioKartica } from '../components/Zajednicko.jsx';
import * as I from '../components/Ikone.jsx';

const normTablica = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9ČĆŠĐŽ]/g, '');

// Rezultat dekodiranja VIN-a: izbor generacije + čuvanje vozila uz tablicu
function VinRezultat({ rez, tablica, onIzaberi }) {
  if (rez.greska) return <div className="greska">{rez.greska}</div>;
  if (!rez.marka) return <div className="info">{rez.poruka} <Link to="/marke">Izaberi marku ručno →</Link></div>;
  return (
    <div style={{ marginTop: 14 }}>
      <div className="info">
        Prepoznato: <b>{rez.marka}</b>{rez.godina ? `, godište ${rez.godina}` : ''}{rez.kod ? `, tvornički kod ${rez.kod}` : ''}.
        {rez.poruka ? ` ${rez.poruka}` : rez.generacije.length > 1 ? ' Izaberite tačan model:' : ''}
      </div>
      {rez.generacije.length === 0 && rez.marka_slug && (
        <Link className="dugme sekundarno" to={`/marka/${rez.marka_slug}`}>Izaberi model marke {rez.marka}</Link>
      )}
      <div className="lista-stavki">
        {rez.generacije.map((g) => (
          <div key={g.id} className="traka" style={{ marginBottom: 0 }}>
            <div>
              <b>{g.model} · {g.naziv}</b>
              <div className="tiho malo">{g.od_god}–{g.do_god} · {g.broj} dijelova</div>
            </div>
            <button className="dugme malo" onClick={() => onIzaberi(g, tablica)}>Prikaži dijelove</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function Pretraga() {
  const nav = useNavigate();
  const { garaza, sacuvajVozilo, obrisiVozilo } = useApp();
  const [tab, setTab] = useState('vin');
  const [vin, setVin] = useState('');
  const [tablica, setTablica] = useState('');
  const [tekst, setTekst] = useState('');
  const [rez, setRez] = useState(null);
  const [radi, setRadi] = useState(false);
  const [tablicaNepoznata, setTablicaNepoznata] = useState(false);

  async function dekodiraj(v, tab) {
    setRadi(true); setRez(null);
    try {
      const r = await api(`/vin/${encodeURIComponent(v)}`);
      setRez(r);
      if (r.tacno && r.generacije.length === 1) izaberi(r.generacije[0], tab, r);
    } catch (e) { setRez(e.data || { greska: e.message }); }
    finally { setRadi(false); }
  }

  function izaberi(g, tab, r = rez) {
    sacuvajVozilo({
      vin: r.vin, tablica: normTablica(tab) || null,
      opis: `${r.marka} ${g.model} ${g.naziv}${r.godina ? ` (${r.godina})` : ''}`, generacija_id: g.id,
    });
    nav(`/generacija/${g.id}`);
  }

  function traziTablicu(e) {
    e.preventDefault();
    const t = normTablica(tablica);
    if (t.length < 5) return;
    const vozilo = garaza.find((v) => v.tablica === t);
    if (vozilo) return nav(`/generacija/${vozilo.generacija_id}`);
    setTablicaNepoznata(true); setRez(null);
  }

  return (
    <div className="kartica heroj">
      <h1>Polovni originalni dijelovi iz otpada</h1>
      <p>Pretražite ponudu svih otpada na jednom mjestu, po broju šasije, tablici, modelu ili OEM broju.</p>

      <div className="tabovi" role="tablist">
        {[['vin', 'Broj šasije'], ['tablica', 'Tablice'], ['tekst', 'OEM / naziv']].map(([k, n]) => (
          <button key={k} className={`tab ${tab === k ? 'aktivan' : ''}`} onClick={() => { setTab(k); setRez(null); setTablicaNepoznata(false); }}>{n}</button>
        ))}
      </div>

      {tab === 'vin' && (
        <form className="pretraga-red" onSubmit={(e) => { e.preventDefault(); dekodiraj(vin); }}>
          <div className="polje-pretrage tablica-unos">
            <I.Auto />
            <input value={vin} onChange={(e) => setVin(e.target.value.toUpperCase())} maxLength={17}
              placeholder="npr. WVWZZZ1KZ7W123456" aria-label="Broj šasije" autoComplete="off" />
          </div>
          <button className="dugme" disabled={radi || vin.replace(/\s/g, '').length < 17}><I.Lupa />Pronađi vozilo</button>
        </form>
      )}

      {tab === 'tablica' && (
        <>
          <form className="pretraga-red" onSubmit={traziTablicu}>
            <div className="polje-pretrage tablica-unos">
              <I.Auto />
              <input value={tablica} onChange={(e) => { setTablica(e.target.value.toUpperCase()); setTablicaNepoznata(false); }}
                placeholder="npr. A12-K-345" aria-label="Registarske tablice" autoComplete="off" />
            </div>
            <button className="dugme" disabled={normTablica(tablica).length < 5}><I.Lupa />Traži</button>
          </form>
          {tablicaNepoznata && (
            <div style={{ marginTop: 14 }}>
              <div className="info">
                Ova tablica još nije povezana s vozilom. Unesite jednom broj šasije (piše u saobraćajnoj dozvoli, polje E),
                a sljedeći put je dovoljna samo tablica.
              </div>
              <form className="pretraga-red" onSubmit={(e) => { e.preventDefault(); dekodiraj(vin, tablica); }}>
                <div className="polje-pretrage tablica-unos">
                  <input value={vin} onChange={(e) => setVin(e.target.value.toUpperCase())} maxLength={17} placeholder="Broj šasije (17 znakova)" />
                </div>
                <button className="dugme" disabled={radi || vin.replace(/\s/g, '').length < 17}>Poveži</button>
              </form>
            </div>
          )}
        </>
      )}

      {tab === 'tekst' && (
        <form className="pretraga-red" onSubmit={(e) => { e.preventDefault(); tekst.trim() && nav(`/dijelovi?q=${encodeURIComponent(tekst.trim())}`); }}>
          <div className="polje-pretrage">
            <I.Lupa />
            <input value={tekst} onChange={(e) => setTekst(e.target.value)} placeholder="npr. 1K0615301 ili far golf 5" aria-label="Pretraga" />
          </div>
          <button className="dugme"><I.Lupa />Traži</button>
        </form>
      )}

      {rez && <VinRezultat rez={rez} tablica={tab === 'tablica' ? tablica : ''} onIzaberi={(g, t) => izaberi(g, t)} />}

      {garaza.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <div className="tiho malo" style={{ marginBottom: 6 }}>Moja vozila</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {garaza.map((v) => (
              <span key={v.vin} className="dugme sekundarno malo" style={{ paddingRight: 6 }}>
                <Link to={`/generacija/${v.generacija_id}`} style={{ color: 'inherit' }}>
                  {v.tablica ? `${v.tablica} · ` : ''}{v.opis}
                </Link>
                <button onClick={() => obrisiVozilo(v.vin)} aria-label="Ukloni" style={{ border: 0, background: 'none', cursor: 'pointer', color: 'inherit', display: 'grid' }}>
                  <I.Zatvori width="16" height="16" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Ručni izbor: marka → model → generacija
function IzborVozila({ marke }) {
  const nav = useNavigate();
  const [marka, setMarka] = useState('');
  const [modeli, setModeli] = useState([]);
  const [model, setModel] = useState('');
  const [gen, setGen] = useState('');

  useEffect(() => {
    setModel(''); setGen(''); setModeli([]);
    if (marka) api(`/marke/${marka}`).then((m) => setModeli(m.modeli)).catch(() => {});
  }, [marka]);

  const generacije = modeli.find((m) => String(m.id) === model)?.generacije || [];

  return (
    <div className="kartica odjeljak">
      <div className="kartica-tijelo">
        <h2>Izaberite vozilo</h2>
        <div className="izbor-vozila">
          <select className="unos" value={marka} onChange={(e) => setMarka(e.target.value)} aria-label="Marka">
            <option value="">Marka</option>
            {marke.map((m) => <option key={m.id} value={m.slug}>{m.naziv}</option>)}
          </select>
          <select className="unos" value={model} onChange={(e) => { setModel(e.target.value); setGen(''); }} disabled={!modeli.length} aria-label="Model">
            <option value="">Model</option>
            {modeli.map((m) => <option key={m.id} value={m.id}>{m.naziv}</option>)}
          </select>
          <select className="unos" value={gen} onChange={(e) => setGen(e.target.value)} disabled={!generacije.length} aria-label="Generacija">
            <option value="">Generacija / godište</option>
            {generacije.map((g) => <option key={g.id} value={g.id}>{g.naziv} ({g.od}–{g.do}){g.broj ? '' : ' · nema'}</option>)}
          </select>
          <button className="dugme" disabled={!gen} onClick={() => nav(`/generacija/${gen}`)}>Prikaži dijelove</button>
        </div>
      </div>
    </div>
  );
}

export default function Pocetna() {
  const [marke, setMarke] = useState([]);
  const [novi, setNovi] = useState([]);
  const [stat, setStat] = useState(null);

  useEffect(() => {
    api('/marke').then(setMarke).catch(() => {});
    api('/dijelovi?sort=novo').then((r) => setNovi(r.dijelovi.slice(0, 8))).catch(() => {});
    api('/statistika').then(setStat).catch(() => {});
  }, []);

  return (
    <>
      <Pretraga />
      {stat && (
        <div className="statistika" style={{ padding: '0 6px' }}>
          <span><b>{stat.dijelova.toLocaleString('bs-BA')}</b> dijelova na stanju</span>
          <span><b>{stat.otpada}</b> otpada</span>
        </div>
      )}
      <IzborVozila marke={marke} />

      <div className="kartica odjeljak">
        <div className="kartica-tijelo">
          <div className="traka"><h2 style={{ margin: 0 }}>Marke</h2><Link to="/marke">Sve marke →</Link></div>
          <div className="mreza-marki">
            {marke.map((m) => (
              <Link key={m.id} to={`/marka/${m.slug}`} className="marka-plocica">
                {m.naziv}<span>{m.broj.toLocaleString('bs-BA')} dijelova</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {novi.length > 0 && (
        <div className="odjeljak">
          <div className="traka" style={{ padding: '0 4px' }}><h2 style={{ margin: 0 }}>Novo u ponudi</h2><Link to="/dijelovi">Svi dijelovi →</Link></div>
          <div className="mreza-dijelova">{novi.map((d) => <DioKartica key={d.id} d={d} />)}</div>
        </div>
      )}
    </>
  );
}
