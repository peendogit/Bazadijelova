import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { DioKartica } from '../components/Zajednicko.jsx';
import * as I from '../components/Ikone.jsx';
import { InstalirajBaner } from '../components/Instaliraj.jsx';

function Pretraga() {
  const nav = useNavigate();
  const [tekst, setTekst] = useState('');
  return (
    <div className="kartica heroj">
      <h1>Polovni originalni dijelovi iz otpada</h1>
      <p>Pretražite ponudu svih otpada na jednom mjestu, po OEM broju, nazivu dijela ili vozilu.</p>
      <form className="pretraga-red" onSubmit={(e) => { e.preventDefault(); tekst.trim() && nav(`/dijelovi?q=${encodeURIComponent(tekst.trim())}`); }}>
        <div className="polje-pretrage">
          <I.Lupa />
          <input value={tekst} onChange={(e) => setTekst(e.target.value)} placeholder="npr. 1K0615301 ili far golf 5" aria-label="Pretraga" />
        </div>
        <button className="dugme"><I.Lupa />Traži</button>
      </form>
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
      <InstalirajBaner />
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
