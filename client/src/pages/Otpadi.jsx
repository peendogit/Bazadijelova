import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useApp } from '../store.jsx';
import { Mrvice, Modal, UpitForma, Ucitavanje } from '../components/Zajednicko.jsx';
import { ListaDijelova } from './Dijelovi.jsx';
import * as I from '../components/Ikone.jsx';

export function Otpadi() {
  const { cijena } = useApp();
  const [lista, setLista] = useState(null);
  useEffect(() => { api('/otpadi').then(setLista).catch(() => setLista([])); }, []);
  if (!lista) return <Ucitavanje />;
  return (
    <>
      <div className="traka"><Mrvice stavke={[['Početna', '/'], ['Otpadi']]} /></div>
      <div className="kartica kartica-tijelo">
        <h1>Otpadi</h1>
        <div className="lista-stavki">
          {lista.map((o) => (
            <Link key={o.id} to={`/otpad/${o.slug}`} className="otpad-kartica" style={{ color: 'inherit' }}>
              <div className="otpad-ikona">{o.naziv[0]}</div>
              <div style={{ flex: 1 }}>
                <b>{o.naziv}</b>
                <div className="tiho malo">{o.grad} · {o.broj.toLocaleString('bs-BA')} dijelova · dostava {cijena(o.dostava_cijena_km)}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}

export function Otpad() {
  const { slug } = useParams();
  const { cijena } = useApp();
  const [o, setO] = useState(null);
  const [greska, setGreska] = useState('');
  const [upit, setUpit] = useState(false);
  useEffect(() => { api(`/otpadi/${slug}`).then(setO).catch((e) => setGreska(e.message)); }, [slug]);
  if (greska) return <div className="greska">{greska}</div>;
  if (!o) return <Ucitavanje />;
  return (
    <>
      <div className="traka"><Mrvice stavke={[['Početna', '/'], ['Otpadi', '/otpadi'], [o.naziv]]} /></div>
      <div className="kartica kartica-tijelo" style={{ marginBottom: 14 }}>
        <div className="otpad-kartica">
          <div className="otpad-ikona">{o.naziv[0]}</div>
          <div style={{ flex: 1 }}>
            <h1 style={{ marginBottom: 4 }}>{o.naziv}</h1>
            <div className="red-info"><I.Lokacija />{[o.adresa, o.grad].filter(Boolean).join(', ')}</div>
            {o.telefon && <div className="red-info"><I.Telefon /><a href={`tel:${o.telefon}`}>{o.telefon}</a></div>}
            <div className="red-info"><I.Kamion />Dostava {cijena(o.dostava_cijena_km)}{o.licno_preuzimanje ? ' · lično preuzimanje' : ''}</div>
            {o.opis && <p className="tiho" style={{ marginBottom: 0 }}>{o.opis}</p>}
          </div>
          <button className="dugme sekundarno malo" onClick={() => setUpit(true)}><I.Poruka />Pošalji upit</button>
        </div>
      </div>
      <ListaDijelova fiksno={{ otpad: o.slug }} />
      {upit && <Modal naslov={`Upit: ${o.naziv}`} onZatvori={() => setUpit(false)}><UpitForma otpadId={o.id} onGotovo={() => setUpit(false)} /></Modal>}
    </>
  );
}
