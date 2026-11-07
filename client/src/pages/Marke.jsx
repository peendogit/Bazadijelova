import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { Mrvice, Ucitavanje } from '../components/Zajednicko.jsx';
import * as I from '../components/Ikone.jsx';

export default function Marke() {
  const [marke, setMarke] = useState(null);
  const [filter, setFilter] = useState('');
  useEffect(() => { api('/marke').then(setMarke).catch(() => setMarke([])); }, []);
  if (!marke) return <Ucitavanje />;
  const lista = marke.filter((m) => m.naziv.toLowerCase().includes(filter.toLowerCase()));
  return (
    <>
      <div className="traka"><Mrvice stavke={[['Početna', '/'], ['Marke']]} /></div>
      <div className="kartica kartica-tijelo">
        <h1>Marke vozila</h1>
        <div className="polje-pretrage" style={{ marginBottom: 16 }}>
          <I.Lupa /><input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Traži marku" />
        </div>
        <div className="mreza-marki">
          {lista.map((m) => (
            <Link key={m.id} to={`/marka/${m.slug}`} className="marka-plocica">
              {m.naziv}<span>{m.broj.toLocaleString('bs-BA')} dijelova</span>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
