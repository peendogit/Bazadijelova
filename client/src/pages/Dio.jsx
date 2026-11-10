import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, km, STANJA } from '../api.js';
import { useApp } from '../store.jsx';
import { DioKartica, Mrvice, Modal, Stanje, UpitForma, Ucitavanje, Zvjezdice } from '../components/Zajednicko.jsx';
import * as I from '../components/Ikone.jsx';

function mapaUrl(lat, lng) {
  const d = 0.01;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${lng - d},${lat - d},${lng + d},${lat + d}&layer=mapnik&marker=${lat},${lng}`;
}

export default function Dio() {
  const { id } = useParams();
  const { cijena, cijenaDijela, uKorpi, dodajUKorpu, jeSacuvan, prebaciSacuvano } = useApp();
  const [d, setD] = useState(null);
  const [greska, setGreska] = useState('');
  const [slika, setSlika] = useState(0);
  const [upit, setUpit] = useState(false);

  useEffect(() => {
    setD(null); setSlika(0);
    api(`/dijelovi/${id}`).then(setD).catch((e) => setGreska(e.message));
  }, [id]);

  if (greska) return <div className="greska">{greska}</div>;
  if (!d) return <Ucitavanje />;
  const o = d.otpad_info;
  const dostupan = d.status === 'aktivan' && d.kolicina > 0;
  const vozilo = [d.marka, d.generacija].filter(Boolean).join(' ');

  return (
    <>
      <div className="traka">
        <Mrvice stavke={[
          ['Početna', '/'],
          ...(d.marka ? [[d.marka, `/marka/${d.marka_slug}`]] : []),
          ...(d.generacija_id ? [[d.generacija, `/generacija/${d.generacija_id}`]] : []),
          [d.naziv],
        ]} />
      </div>

      <div className="detalj">
        <div className="kartica kartica-tijelo">
          <div className="galerija-glavna">
            {d.slike?.length ? <img src={d.slike[slika]} alt={d.naziv} /> : <I.Dio />}
          </div>
          {d.slike?.length > 1 && (
            <div className="galerija-slicice">
              {d.slike.map((s, i) => (
                <button key={s} className={i === slika ? 'aktivna' : ''} onClick={() => setSlika(i)}><img src={s} alt="" /></button>
              ))}
            </div>
          )}
          {d.opis && <><h3 style={{ marginTop: 18 }}>Opis</h3><p style={{ whiteSpace: 'pre-line', margin: 0 }}>{d.opis}</p></>}
        </div>

        <div>
          <div className="kartica kartica-tijelo">
            <Stanje s={d.stanje} />
            <h1 style={{ marginTop: 8, marginBottom: 2 }}>{d.naziv}</h1>
            <div className="tiho">{vozilo}{d.godiste ? ` · ${d.godiste}` : ''}</div>
            <div className={`velika-cijena ${d.cijena_km > 0 ? '' : 'na-upit'}`} style={{ marginTop: 12 }}>{cijenaDijela(d.cijena_km)}</div>
            {!dostupan && <div className="greska">{d.status === 'rezervisan' ? 'Dio je rezervisan.' : 'Dio je prodan.'}</div>}
            <div className="akcije">
              {d.cijena_km > 0 ? (
                <button className="dugme" disabled={!dostupan || uKorpi(d.id)} onClick={() => dodajUKorpu(d)}>
                  <I.Korpa />{uKorpi(d.id) ? 'U korpi' : 'Dodaj u korpu'}
                </button>
              ) : (
                <button className="dugme" disabled={!dostupan} onClick={() => setUpit(true)}><I.Poruka />Pitaj za cijenu</button>
              )}
              <button className="dugme sekundarno" onClick={() => setUpit(true)}><I.Poruka />Pitaj otpad</button>
              <button className="dugme obrub ikona-samo" onClick={() => prebaciSacuvano(d)} aria-label="Sačuvaj">
                {jeSacuvan(d.id) ? <I.ZastavicaPuna style={{ color: 'var(--narandzasta)' }} /> : <I.Zastavica />}
              </button>
            </div>
            <table className="tabela-podataka">
              <tbody>
                {d.oem && <tr><td>OEM broj</td><td><b style={{ fontFamily: 'ui-monospace, monospace' }}>{d.oem}</b></td></tr>}
                <tr><td>Stanje</td><td>{STANJA[d.stanje]?.naziv}, {STANJA[d.stanje]?.opis.toLowerCase()}</td></tr>
                {d.km ? <tr><td>Kilometraža vozila</td><td>{km(d.km)}</td></tr> : null}
                {vozilo && <tr><td>Vozilo</td><td>{vozilo}{d.od_god ? ` (${d.od_god}–${d.do_god})` : ''}</td></tr>}
                {d.godiste && <tr><td>Godište vozila</td><td>{d.godiste}</td></tr>}
                {d.motor && <tr><td>Motor</td><td>{d.motor}</td></tr>}
                {d.gorivo && <tr><td>Gorivo</td><td>{d.gorivo}</td></tr>}
                {d.kategorija && <tr><td>Grupa</td><td>{d.kategorija}</td></tr>}
                {d.tezina != null && <tr><td>Težina za slanje</td><td>{Number(d.tezina)} kg</td></tr>}
                <tr><td>Šifra oglasa</td><td>#{d.id}</td></tr>
              </tbody>
            </table>
          </div>

          <div className="kartica kartica-tijelo" style={{ marginTop: 12 }}>
            <div className="otpad-kartica">
              <div className="otpad-ikona"><I.Lokacija /></div>
              <div style={{ flex: 1 }}>
                <Link to={`/otpad/${o.slug}`}><h3 style={{ margin: 0 }}>{o.naziv}</h3></Link>
                <Zvjezdice ocjene={o.ocjene} malo />
                <div className="red-info"><I.Lokacija />{[o.adresa, o.grad].filter(Boolean).join(', ')}</div>
                {o.telefon && <div className="red-info"><I.Telefon /><a href={`tel:${o.telefon}`}>{o.telefon}</a></div>}
                {d.postarina?.length > 0 ? (
                  <div className="red-info" style={{ alignItems: 'flex-start' }}><I.Kamion />
                    <div style={{ flex: 1 }}>
                      <div>Poštarina za {Number(d.tezina)} kg{o.licno_preuzimanje ? ' · moguće lično preuzimanje' : ''}</div>
                      {d.postarina.map((pp) => (
                        <div key={pp.id} className="traka malo" style={{ margin: 0 }}>
                          <span>{pp.naziv}</span><b>{pp.cijena_km === null ? 'po dogovoru' : cijena(pp.cijena_km)}</b>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="red-info"><I.Kamion />
                    <span>Dostava {cijena(o.dostava_cijena_km)}{o.licno_preuzimanje ? ' · moguće lično preuzimanje' : ''}</span>
                  </div>
                )}
                {o.dostava_info && <div className="tiho malo">{o.dostava_info}</div>}
              </div>
            </div>
            {o.lat && o.lng && (
              <>
                <iframe className="mapa" title={`Lokacija: ${o.naziv}`} src={mapaUrl(Number(o.lat), Number(o.lng))} loading="lazy" />
                <a className="malo" href={`https://www.google.com/maps/dir/?api=1&destination=${o.lat},${o.lng}`} target="_blank" rel="noreferrer">Upute do otpada →</a>
              </>
            )}
          </div>
        </div>
      </div>

      {d.isti_oem?.length > 0 && (
        <div className="odjeljak">
          <h2 style={{ padding: '0 4px' }}>Isti OEM broj kod drugih otpada</h2>
          <div className="mreza-dijelova">{d.isti_oem.map((x) => <DioKartica key={x.id} d={x} />)}</div>
        </div>
      )}

      {upit && (
        <Modal naslov={`Upit: ${o.naziv}`} onZatvori={() => setUpit(false)}>
          <UpitForma dio={d} onGotovo={() => setUpit(false)} />
        </Modal>
      )}
    </>
  );
}
