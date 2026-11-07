import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { Mrvice, Ucitavanje } from '../components/Zajednicko.jsx';
import * as I from '../components/Ikone.jsx';

export default function Generacija() {
  const { id } = useParams();
  const [g, setG] = useState(null);
  const [greska, setGreska] = useState('');

  useEffect(() => {
    setG(null);
    api(`/generacije/${id}`).then(setG).catch((e) => setGreska(e.message));
  }, [id]);

  if (greska) return <div className="greska">{greska}</div>;
  if (!g) return <Ucitavanje />;
  const naziv = `${g.marka} ${g.naziv}`;

  return (
    <>
      <div className="traka">
        <Mrvice stavke={[['Početna', '/'], [g.marka, `/marka/${g.marka_slug}`], [`${g.naziv} (${g.od_god}-${g.do_god})`]]} />
      </div>
      <div className="kartica kartica-tijelo">
        <div className="traka">
          <div>
            <h1 style={{ marginBottom: 2 }}>{naziv}</h1>
            <div className="tiho">{g.model} · {g.od_god}–{g.do_god}{g.kod ? ` · kod ${g.kod}` : ''}</div>
          </div>
          <Link to={`/dijelovi?generacija=${g.id}`} className="dugme"><I.Lupa />Svi dijelovi ({g.ukupno})</Link>
        </div>
        <h2 style={{ marginTop: 10 }}>Grupe dijelova</h2>
        <div className="mreza-kategorija">
          {g.kategorije.map((k) => (
            <Link key={k.id} to={`/dijelovi?generacija=${g.id}&kategorija=${k.slug}`} className={`kategorija-plocica ${k.broj ? '' : 'prazno'}`}>
              <span className="em" aria-hidden="true">{k.ikona}</span>
              <span><b>{k.naziv}</b><span>{k.broj} kom</span></span>
            </Link>
          ))}
        </div>
        {g.ukupno === 0 && (
          <div className="info" style={{ marginTop: 16 }}>
            Za ovo vozilo trenutno nema dijelova na stanju. Pokušajte pretragu po OEM broju, jer isti dio često odgovara i drugim modelima.
          </div>
        )}
      </div>
    </>
  );
}
