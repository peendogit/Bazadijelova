// Stranica marke: modeli u grupama, generacije plave (ima na stanju) ili crvene (nema)
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { Mrvice, Ucitavanje } from '../components/Zajednicko.jsx';
import * as I from '../components/Ikone.jsx';

const inicijali = (n) => n.replace(/[^A-Za-zČĆŠĐŽčćšđž ]/g, '').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

export default function Marka() {
  const { slug } = useParams();
  const [m, setM] = useState(null);
  const [greska, setGreska] = useState('');
  const [filter, setFilter] = useState('');

  useEffect(() => {
    setM(null); setGreska('');
    api(`/marke/${slug}`).then(setM).catch((e) => setGreska(e.message));
  }, [slug]);

  if (greska) return <div className="greska">{greska}</div>;
  if (!m) return <Ucitavanje />;

  const f = filter.trim().toLowerCase();
  const modeli = m.modeli
    .map((mo) => ({
      ...mo,
      generacije: !f || mo.naziv.toLowerCase().includes(f) ? mo.generacije
        : mo.generacije.filter((g) => g.naziv.toLowerCase().includes(f)),
    }))
    .filter((mo) => mo.generacije.length);

  return (
    <>
      <div className="traka">
        <Mrvice stavke={[['Početna', '/'], ['Marke', '/marke'], [m.naziv]]} />
        <Link to={`/dijelovi?marka=${m.slug}`} className="dugme"><I.Lupa />Traži {m.naziv}</Link>
      </div>
      <div className="kartica">
        <div className="kartica-tijelo">
          <div className="marka-zaglavlje">
            <div className="marka-logo">{inicijali(m.naziv)}</div>
            <div>
              <h1>{m.naziv}</h1>
              <div className="legenda">
                <span><i className="tacka plava" />Ima na stanju</span>
                <span className="nema"><i className="tacka crvena" />Nema na stanju</span>
              </div>
            </div>
          </div>
          <div className="polje-pretrage" style={{ marginTop: 22, maxWidth: 560 }}>
            <I.Lupa /><input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Traži model" />
          </div>
        </div>
        <hr className="razdvojnik" />
        <div className="kartica-tijelo" style={{ paddingTop: 0, paddingBottom: 0 }}>
          {modeli.map((mo) => (
            <div key={mo.id} className="grupa-modela">
              <div className="grupa-naslov">{mo.naziv}</div>
              {mo.generacije.map((g) => (
                <Link key={g.id} to={`/generacija/${g.id}`} className={`generacija-link ${g.broj ? '' : 'nema'}`}>
                  {m.naziv} {g.naziv} ({g.od}-{g.do})
                  {g.broj > 0 && <small>{g.broj} kom</small>}
                </Link>
              ))}
            </div>
          ))}
          {!modeli.length && <div className="prazno-stanje">Nema modela za „{filter}”.</div>}
        </div>
      </div>
    </>
  );
}
