import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { api, qs, STANJA } from '../api.js';
import { useApp } from '../store.jsx';
import { DioKartica, Mrvice, Ucitavanje, Prazno } from '../components/Zajednicko.jsx';
import * as I from '../components/Ikone.jsx';

export function ListaDijelova({ fiksno = {} }) {
  const [sp, setSp] = useSearchParams();
  const { valuta } = useApp();
  const [kategorije, setKategorije] = useState([]);
  const [podaci, setPodaci] = useState(null);
  const [kontekst, setKontekst] = useState(null);
  const [otvoreno, setOtvoreno] = useState(false);
  const [tekst, setTekst] = useState(sp.get('q') || '');

  const filteri = {
    q: sp.get('q') || '', marka: sp.get('marka') || '', generacija: sp.get('generacija') || '',
    kategorija: sp.get('kategorija') || '', stanje: sp.get('stanje') || '', min: sp.get('min') || '',
    max: sp.get('max') || '', sort: sp.get('sort') || 'novo', strana: sp.get('strana') || '1', ...fiksno,
  };
  const kljuc = JSON.stringify(filteri);

  useEffect(() => { api('/kategorije').then(setKategorije).catch(() => {}); }, []);
  useEffect(() => { setTekst(sp.get('q') || ''); }, [sp]);
  useEffect(() => {
    setPodaci(null);
    api(`/dijelovi${qs(filteri)}`).then(setPodaci).catch(() => setPodaci({ dijelovi: [], ukupno: 0, strana: 1, strana_ukupno: 1 }));
  }, [kljuc]);
  useEffect(() => {
    if (filteri.generacija) api(`/generacije/${filteri.generacija}`).then(setKontekst).catch(() => setKontekst(null));
    else setKontekst(null);
  }, [filteri.generacija]);

  const postavi = (izmjene) => {
    const n = new URLSearchParams(sp);
    for (const [k, v] of Object.entries(izmjene)) v ? n.set(k, v) : n.delete(k);
    if (!('strana' in izmjene)) n.delete('strana');
    setSp(n);
  };
  const stanja = filteri.stanje ? filteri.stanje.split(',') : [];
  const prebaciStanje = (s) => {
    const nova = stanja.includes(s) ? stanja.filter((x) => x !== s) : [...stanja, s];
    postavi({ stanje: nova.join(',') });
  };
  // Cijene u filteru unose se u izabranoj valuti, a šalju u KM
  const faktor = valuta === 'EUR' ? 1.95583 : 1;
  const prikazCijene = (v) => (v ? String(Math.round(Number(v) / faktor)) : '');

  return (
    <div className="raspored-liste">
      <aside className={`kartica filteri ${otvoreno ? '' : 'zatvoreno'}`}>
        <div className="kartica-tijelo">
          <div className="traka" style={{ marginBottom: 0 }}>
            <h3 style={{ margin: 0 }}>Filteri</h3>
            <button className="dugme obrub malo filteri-dugme" onClick={() => setOtvoreno(!otvoreno)}><I.Filter />{otvoreno ? 'Sakrij' : 'Prikaži'}</button>
          </div>
          <div className="filteri-tijelo">
            {kontekst && (
              <div className="info" style={{ marginTop: 12 }}>
                <b>{kontekst.marka} {kontekst.naziv}</b><br />
                <button className="dugme obrub malo" style={{ marginTop: 6 }} onClick={() => postavi({ generacija: '' })}>Ukloni vozilo</button>
              </div>
            )}
            <label className="oznaka">Grupa dijelova</label>
            <select className="unos" value={filteri.kategorija} onChange={(e) => postavi({ kategorija: e.target.value })}>
              <option value="">Sve grupe</option>
              {kategorije.map((k) => <option key={k.id} value={k.slug}>{k.naziv}</option>)}
            </select>
            <label className="oznaka">Stanje</label>
            {Object.entries(STANJA).map(([s, { naziv }]) => (
              <label key={s} className="cekiranje">
                <input type="checkbox" checked={stanja.includes(s)} onChange={() => prebaciStanje(s)} />{naziv}
              </label>
            ))}
            <label className="oznaka">Cijena ({valuta})</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="unos" inputMode="numeric" placeholder="od" defaultValue={prikazCijene(filteri.min)} key={`min${valuta}${filteri.min}`}
                onBlur={(e) => postavi({ min: e.target.value ? Math.round(Number(e.target.value) * faktor) : '' })} />
              <input className="unos" inputMode="numeric" placeholder="do" defaultValue={prikazCijene(filteri.max)} key={`max${valuta}${filteri.max}`}
                onBlur={(e) => postavi({ max: e.target.value ? Math.round(Number(e.target.value) * faktor) : '' })} />
            </div>
          </div>
        </div>
      </aside>

      <section>
        <form className="polje-pretrage kartica" style={{ marginBottom: 12, background: '#fff' }}
          onSubmit={(e) => { e.preventDefault(); postavi({ q: tekst.trim() }); }}>
          <I.Lupa />
          <input value={tekst} onChange={(e) => setTekst(e.target.value)} placeholder="Naziv dijela ili OEM broj" />
          <button className="dugme malo">Traži</button>
        </form>
        <div className="traka">
          <span className="tiho">{podaci ? `${podaci.ukupno.toLocaleString('bs-BA')} rezultata` : ' '}</span>
          <select className="unos" style={{ width: 'auto' }} value={filteri.sort} onChange={(e) => postavi({ sort: e.target.value })}>
            <option value="novo">Najnovije</option>
            <option value="jeftino">Najniža cijena</option>
            <option value="skupo">Najviša cijena</option>
            <option value="km">Najmanje kilometara</option>
          </select>
        </div>
        {!podaci ? <Ucitavanje /> : podaci.dijelovi.length === 0 ? (
          <div className="kartica"><Prazno>
            <p>Nema dijelova za ovu pretragu.</p>
            <p className="malo">Pokušajte bez nekog filtera ili pretražite po OEM broju.</p>
          </Prazno></div>
        ) : (
          <>
            <div className="mreza-dijelova">{podaci.dijelovi.map((d) => <DioKartica key={d.id} d={d} />)}</div>
            {podaci.strana_ukupno > 1 && (
              <div className="stranice">
                <button className="dugme obrub malo" disabled={podaci.strana <= 1} onClick={() => postavi({ strana: podaci.strana - 1 })}>← Nazad</button>
                <span className="tiho">{podaci.strana} / {podaci.strana_ukupno}</span>
                <button className="dugme obrub malo" disabled={podaci.strana >= podaci.strana_ukupno} onClick={() => postavi({ strana: podaci.strana + 1 })}>Dalje →</button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}

export default function Dijelovi() {
  return (
    <>
      <div className="traka"><Mrvice stavke={[['Početna', '/'], ['Dijelovi']]} /><Link to="/marke" className="dugme sekundarno malo"><I.Auto />Izaberi vozilo</Link></div>
      <ListaDijelova />
    </>
  );
}
