import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useApp } from '../store.jsx';
import { Mrvice, Ucitavanje } from '../components/Zajednicko.jsx';

const STATUSI = { nova: 'Nova', potvrdjena: 'Potvrđena', poslana: 'Poslana', zavrsena: 'Završena', otkazana: 'Otkazana', novi: 'Čeka odgovor', odgovoren: 'Odgovoreno', zatvoren: 'Zatvoreno' };

export default function MojNalog() {
  const { cijena, korisnik } = useApp();
  const [narudzbe, setNarudzbe] = useState(null);
  const [upiti, setUpiti] = useState([]);
  useEffect(() => {
    api('/moje-narudzbe').then(setNarudzbe).catch(() => setNarudzbe([]));
    api('/moji-upiti').then(setUpiti).catch(() => {});
  }, []);
  if (!narudzbe) return <Ucitavanje />;
  return (
    <>
      <div className="traka"><Mrvice stavke={[['Početna', '/'], ['Moj nalog']]} /></div>
      <div className="kartica kartica-tijelo">
        <h1>{korisnik.ime || korisnik.email}</h1>
        <h2 style={{ marginTop: 16 }}>Narudžbe</h2>
        {!narudzbe.length && <p className="tiho">Još nemate narudžbi.</p>}
        <div className="lista-stavki">
          {narudzbe.map((n) => (
            <div key={n.id}>
              <div className="traka" style={{ marginBottom: 4 }}>
                <b>#{n.id} · {n.otpad}</b>
                <span className={`status status-${n.status}`}>{STATUSI[n.status]}</span>
              </div>
              {(n.stavke || []).map((s) => <div key={s.id} className="malo">{s.naziv} · {cijena(s.cijena_km)}</div>)}
              <div className="tiho malo">{new Date(n.kreiran).toLocaleDateString('bs-BA')} · ukupno {cijena(n.ukupno_km + n.dostava_km)}{n.otpad_telefon ? ` · otpad: ${n.otpad_telefon}` : ''}</div>
            </div>
          ))}
        </div>
        <h2 style={{ marginTop: 22 }}>Upiti</h2>
        {!upiti.length && <p className="tiho">Još niste slali upite.</p>}
        <div className="lista-stavki">
          {upiti.map((u) => (
            <div key={u.id}>
              <div className="traka" style={{ marginBottom: 4 }}>
                <b>{u.otpad}{u.dio ? ` · ${u.dio}` : ''}</b>
                <span className={`status status-${u.status}`}>{STATUSI[u.status]}</span>
              </div>
              <div className="malo">{u.poruka}</div>
              {u.odgovor && <div className="info"><b>Odgovor:</b> {u.odgovor}</div>}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
