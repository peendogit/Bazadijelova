import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { Ucitavanje } from '../components/Zajednicko.jsx';

export default function Ocjena() {
  const { token } = useParams();
  const [n, setN] = useState(null);
  const [ocjena, setOcjena] = useState(0);
  const [komentar, setKomentar] = useState('');
  const [greska, setGreska] = useState('');
  const [gotovo, setGotovo] = useState(false);

  useEffect(() => {
    api(`/ocjena/${token}`).then((r) => {
      setN(r);
      if (r.ocjena) { setOcjena(r.ocjena.ocjena); setKomentar(r.ocjena.komentar || ''); }
    }).catch((e) => setGreska(e.message));
  }, [token]);

  async function posalji(e) {
    e.preventDefault(); setGreska('');
    try { await api(`/ocjena/${token}`, { metoda: 'POST', tijelo: { ocjena, komentar } }); setGotovo(true); }
    catch (err) { setGreska(err.message); }
  }

  if (greska && !n) return <div className="greska">{greska}</div>;
  if (!n) return <Ucitavanje />;
  const moze = ['poslana', 'zavrsena'].includes(n.status);

  return (
    <div className="kartica kartica-tijelo" style={{ maxWidth: 520, margin: '0 auto' }}>
      <h1>Ocijenite otpad</h1>
      <p style={{ marginTop: 0 }}><Link to={`/otpad/${n.otpad_slug}`}><b>{n.otpad}</b></Link> · narudžba #{n.id}</p>
      <div className="tiho malo">{(n.stavke || []).join(', ')}</div>
      {gotovo ? (
        <div className="uspjeh">Hvala! Vaša ocjena pomaže drugim kupcima.</div>
      ) : !moze ? (
        <div className="info">Ocjenu možete dati kad otpad pošalje ili preda dijelove. Sačuvajte ovaj link i vratite se kasnije.</div>
      ) : (
        <form onSubmit={posalji}>
          <div className="birac-zvjezdica" role="radiogroup" aria-label="Ocjena">
            {[1, 2, 3, 4, 5].map((i) => (
              <button type="button" key={i} className={i <= ocjena ? 'puna' : ''} onClick={() => setOcjena(i)} aria-label={`${i} od 5`}>★</button>
            ))}
          </div>
          <label className="oznaka">Komentar (nije obavezno)</label>
          <textarea className="unos" rows="3" value={komentar} onChange={(e) => setKomentar(e.target.value)} placeholder="Kako je prošla kupovina?" />
          {greska && <div className="greska">{greska}</div>}
          <button className="dugme puno" style={{ marginTop: 14 }} disabled={!ocjena}>{n.ocjena ? 'Izmijeni ocjenu' : 'Pošalji ocjenu'}</button>
        </form>
      )}
    </div>
  );
}
