// Korpa: dijelovi grupisani po otpadu. Narudžba se šalje svakom otpadu posebno.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useApp } from '../store.jsx';
import { Mrvice, Prazno } from '../components/Zajednicko.jsx';
import * as I from '../components/Ikone.jsx';

export default function Korpa() {
  const { korpa, setKorpa, izbaciIzKorpe, cijena, korisnik } = useApp();
  const [nacin, setNacin] = useState('dostava');
  const [f, setF] = useState({ ime: korisnik?.ime || '', telefon: korisnik?.telefon || '', email: korisnik?.email || '', adresa: '', grad: '', napomena: '' });
  const [greska, setGreska] = useState('');
  const [salje, setSalje] = useState(false);
  const [gotovo, setGotovo] = useState(null);
  const p = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const [postarina, setPostarina] = useState([]);   // po otpadu: težina i cijene pošta
  const [kuriri, setKuriri] = useState({});         // otpad_id → izabrana pošta

  const kljuc = korpa.map((d) => d.id).join(',');
  useEffect(() => {
    if (!korpa.length) return setPostarina([]);
    api('/postarina', { metoda: 'POST', tijelo: { stavke: korpa.map((d) => d.id) } }).then(setPostarina).catch(() => setPostarina([]));
  }, [kljuc]);

  const poOtpadu = Object.values(korpa.reduce((acc, d) => {
    (acc[d.otpad_id] ||= { otpad_id: d.otpad_id, otpad: d.otpad, grad: d.grad, pausal: d.dostava_cijena_km || 0, stavke: [] }).stavke.push(d);
    return acc;
  }, {})).map((g) => {
    const p = postarina.find((x) => x.otpad_id === g.otpad_id);
    const opcije = p?.opcije || [];
    const izbor = opcije.find((o) => o.id === kuriri[g.otpad_id]) || opcije[0] || null;
    const dostava = izbor ? izbor.cijena_km : g.pausal;   // null = po dogovoru
    return { ...g, tezina: p && !p.nepoznato ? p.tezina_kg : null, opcije, izbor, dostava };
  });
  const dijelovi = korpa.reduce((s, d) => s + d.cijena_km, 0);
  const dostava = nacin === 'dostava' ? poOtpadu.reduce((s, g) => s + (g.dostava || 0), 0) : 0;
  const poDogovoru = nacin === 'dostava' && poOtpadu.some((g) => g.dostava === null);

  async function naruci(e) {
    e.preventDefault();
    setGreska(''); setSalje(true);
    try {
      const izabrani = Object.fromEntries(poOtpadu.filter((g) => g.izbor).map((g) => [g.otpad_id, g.izbor.id]));
      const r = await api('/narudzbe', { metoda: 'POST', tijelo: { ...f, nacin, kuriri: izabrani, stavke: korpa.map((d) => d.id) } });
      setGotovo(r.narudzbe);
      setKorpa([]);
    } catch (err) {
      setGreska(err.message);
      if (err.data?.nedostupni?.length) setKorpa((k) => k.filter((d) => !err.data.nedostupni.includes(d.id)));
    } finally { setSalje(false); }
  }

  if (gotovo) return (
    <div className="kartica kartica-tijelo">
      <h1>Narudžba je poslana</h1>
      <div className="uspjeh">Otpadi su dobili vašu narudžbu i javiće vam se na telefon {f.telefon} radi potvrde.</div>
      <div className="info">Kad dobijete dijelove, ocijenite otpad preko linka ispod svake narudžbe. Sačuvajte ovu stranicu ili linkove.</div>
      <div className="lista-stavki">
        {gotovo.map((n) => (
          <div key={n.id} className="traka" style={{ marginBottom: 0 }}>
            <span><b>{n.otpad}</b><br /><span className="tiho malo">Narudžba #{n.id} · <Link to={`/ocjena/${n.token}`}>link za ocjenu</Link></span></span>
            <b>{cijena(n.ukupno_km + n.dostava_km)}{n.dostava_po_dogovoru ? ' + poštarina' : ''}</b>
          </div>
        ))}
      </div>
      <Link to="/" className="dugme" style={{ marginTop: 14 }}>Nazad na početnu</Link>
    </div>
  );

  return (
    <>
      <div className="traka"><Mrvice stavke={[['Početna', '/'], ['Korpa']]} /></div>
      {!korpa.length ? (
        <div className="kartica"><Prazno><p>Korpa je prazna.</p><Link to="/dijelovi" className="dugme">Pretraži dijelove</Link></Prazno></div>
      ) : (
        <div className="detalj">
          <div>
            {poOtpadu.map((g) => (
              <div key={g.otpad} className="kartica kartica-tijelo" style={{ marginBottom: 12 }}>
                <div className="traka" style={{ marginBottom: 4 }}>
                  <h3 style={{ margin: 0 }}>{g.otpad}</h3>
                  <span className="tiho malo">{g.grad}</span>
                </div>
                {g.stavke.map((d) => (
                  <div key={d.id} className="stavka-korpe">
                    <div className="stavka-slika">{d.slika ? <img src={d.slika} alt="" /> : <I.Dio />}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Link to={`/dio/${d.id}`} style={{ color: 'inherit', fontWeight: 500 }}>{d.naziv}</Link>
                      <div className="tiho malo">{d.vozilo}{d.oem ? ` · ${d.oem}` : ''}</div>
                    </div>
                    <b style={{ whiteSpace: 'nowrap' }}>{cijena(d.cijena_km)}</b>
                    <button className="ikona-dugme" onClick={() => izbaciIzKorpe(d.id)} aria-label="Ukloni"><I.Zatvori /></button>
                  </div>
                ))}
                {nacin === 'dostava' && (
                  <div className="dostava-otpada">
                    {g.opcije.length > 0 ? (
                      <>
                        <div className="tiho malo">Paket {g.tezina} kg · izaberite brzu poštu:</div>
                        {g.opcije.map((o) => (
                          <label key={o.id} className={`opcija-poste ${g.izbor?.id === o.id ? 'izabrano' : ''}`}>
                            <input type="radio" name={`posta-${g.otpad_id}`} checked={g.izbor?.id === o.id} onChange={() => setKuriri({ ...kuriri, [g.otpad_id]: o.id })} />
                            <span>{o.naziv}</span>
                            <b>{o.cijena_km === null ? 'po dogovoru' : cijena(o.cijena_km)}</b>
                          </label>
                        ))}
                      </>
                    ) : (
                      <div className="tiho malo">Dostava od ovog otpada: {cijena(g.pausal)}</div>
                    )}
                  </div>
                )}
              </div>
            ))}
            {poOtpadu.length > 1 && <div className="info">Dijelovi su iz {poOtpadu.length} otpada, pa svaki otpad šalje svoj paket i naplaćuje svoju dostavu.</div>}
          </div>

          <form className="kartica kartica-tijelo" onSubmit={naruci}>
            <h2>Podaci za narudžbu</h2>
            <div className="izbor-nacina">
              {[['dostava', 'Dostava', 'Brza pošta na adresu'], ['licno', 'Lično preuzimanje', 'U otpadu, bez troška']].map(([k, n, o]) => (
                <label key={k} className={nacin === k ? 'izabrano' : ''}>
                  <input type="radio" name="nacin" checked={nacin === k} onChange={() => setNacin(k)} />
                  <span><b>{n}</b><br /><span className="tiho malo">{o}</span></span>
                </label>
              ))}
            </div>
            <label className="oznaka">Ime i prezime</label>
            <input className="unos" value={f.ime} onChange={p('ime')} required />
            <div className="red-polja">
              <div><label className="oznaka">Telefon</label><input className="unos" type="tel" value={f.telefon} onChange={p('telefon')} required /></div>
              <div><label className="oznaka">Email (nije obavezno)</label><input className="unos" type="email" value={f.email} onChange={p('email')} /></div>
            </div>
            {nacin === 'dostava' && (
              <div className="red-polja">
                <div><label className="oznaka">Adresa</label><input className="unos" value={f.adresa} onChange={p('adresa')} required /></div>
                <div><label className="oznaka">Grad i poštanski broj</label><input className="unos" value={f.grad} onChange={p('grad')} required /></div>
              </div>
            )}
            <label className="oznaka">Napomena</label>
            <textarea className="unos" rows="2" value={f.napomena} onChange={p('napomena')} />
            <div style={{ marginTop: 16 }}>
              <div className="ukupno"><span>Dijelovi ({korpa.length})</span><span>{cijena(dijelovi)}</span></div>
              <div className="ukupno"><span>Poštarina</span><span>{cijena(dostava)}{poDogovoru ? ' + po dogovoru' : ''}</span></div>
              <div className="ukupno glavno"><span>Ukupno</span><span>{cijena(dijelovi + dostava)}</span></div>
              {poDogovoru && <div className="tiho malo">Paket je teži od cjenovnika pošte, otpad će vam javiti cijenu poštarine.</div>}
              <div className="tiho malo">Plaćanje pouzećem ili po dogovoru s otpadom.</div>
            </div>
            {greska && <div className="greska">{greska}</div>}
            <button className="dugme narandzasto puno" style={{ marginTop: 14 }} disabled={salje}>{salje ? 'Šaljem…' : 'Pošalji narudžbu'}</button>
          </form>
        </div>
      )}
    </>
  );
}
