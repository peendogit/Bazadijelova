// Panel otpada: pregled, dijelovi, narudžbe, upiti, uvoz zaliha, profil
import { useEffect, useState, useCallback } from 'react';
import { NavLink, Routes, Route, Link } from 'react-router-dom';
import { api, qs, STANJA } from '../api.js';
import { useApp } from '../store.jsx';
import { Modal, Ucitavanje } from '../components/Zajednicko.jsx';
import * as I from '../components/Ikone.jsx';

const STATUS_NAR = { nova: 'Nova', potvrdjena: 'Potvrđena', poslana: 'Poslana', zavrsena: 'Završena', otkazana: 'Otkazana' };

export default function Panel() {
  const [profil, setProfil] = useState(null);
  const osvjezi = useCallback(() => api('/moj-otpad/profil').then(setProfil).catch(() => {}), []);
  useEffect(() => { osvjezi(); }, [osvjezi]);
  if (!profil) return <Ucitavanje />;
  const s = profil.statistika;

  return (
    <>
      <div className="traka">
        <h1 style={{ margin: 0 }}>{profil.naziv}</h1>
        {profil.odobren && <Link to={`/otpad/${profil.slug}`} className="dugme obrub malo">Javna stranica →</Link>}
      </div>
      {!profil.odobren && <div className="info">Otpad čeka odobrenje. Dijelove već možete unositi, a kupcima će biti vidljivi nakon odobrenja.</div>}
      <nav className="panel-tabovi">
        <NavLink to="/panel" end>Pregled</NavLink>
        <NavLink to="/panel/dijelovi">Dijelovi</NavLink>
        <NavLink to="/panel/narudzbe">Narudžbe{s.novih_narudzbi ? ` (${s.novih_narudzbi})` : ''}</NavLink>
        <NavLink to="/panel/upiti">Upiti{s.novih_upita ? ` (${s.novih_upita})` : ''}</NavLink>
        <NavLink to="/panel/zahtjevi">Tražim dio</NavLink>
        <NavLink to="/panel/uvoz">Uvoz zaliha</NavLink>
        <NavLink to="/panel/profil">Profil i dostava</NavLink>
      </nav>
      <Routes>
        <Route index element={<Pregled s={s} profil={profil} />} />
        <Route path="dijelovi" element={<PanelDijelovi onPromjena={osvjezi} pro={profil.paket.pro} />} />
        <Route path="zahtjevi" element={<PanelZahtjevi />} />
        <Route path="narudzbe" element={<PanelNarudzbe onPromjena={osvjezi} />} />
        <Route path="upiti" element={<PanelUpiti onPromjena={osvjezi} />} />
        <Route path="uvoz" element={<PanelUvoz profil={profil} onPromjena={osvjezi} />} />
        <Route path="profil" element={<PanelProfil profil={profil} onSnimljeno={osvjezi} />} />
      </Routes>
    </>
  );
}

function Pregled({ s, profil }) {
  const p = profil.paket;
  return (
    <>
    {!profil.telegram.povezan && profil.telegram.ukljucen && (
      <div className="info">Povežite Telegram da vam narudžbe i upiti stižu odmah na telefon. <Link to="/panel/profil">Poveži →</Link></div>
    )}
    <div className="kartica kartica-tijelo">
      <div className="traka">
        <span>Paket: <b>{p.pro ? 'Pro' : 'Besplatno'}</b>{p.pro && p.paket_do ? ` do ${new Date(p.paket_do).toLocaleDateString('bs-BA')}` : ''}
          {!p.pro && <span className="tiho"> · {p.aktivnih} / {p.limit} dijelova</span>}
          {p.pro && <span className="tiho"> · izdvojeno {p.izdvojenih} / {p.izdvojeni_limit}</span>}
        </span>
        {!p.pro && <Link to="/za-otpade" className="dugme sekundarno malo">Pređi na Pro</Link>}
      </div>
      <div className="brojke">
        <div className="brojka"><b>{s.aktivnih}</b><span>dijelova u prodaji</span></div>
        <div className="brojka"><b>{s.rezervisanih}</b><span>rezervisano</span></div>
        <div className="brojka"><b>{s.prodanih}</b><span>prodano</span></div>
        <Link to="/panel/narudzbe" className="brojka"><b>{s.novih_narudzbi}</b><span>novih narudžbi</span></Link>
        <Link to="/panel/upiti" className="brojka"><b>{s.novih_upita}</b><span>novih upita</span></Link>
      </div>
      <div className="akcije">
        <Link to="/panel/dijelovi?novi=1" className="dugme"><I.Dio />Dodaj dio</Link>
        <Link to="/panel/uvoz" className="dugme sekundarno"><I.Upload />Uvezi zalihe</Link>
        <Link to="/panel/zahtjevi" className="dugme obrub"><I.Poruka />Kupci traže</Link>
      </div>
    </div>
    </>
  );
}

// ---------- Dijelovi ----------

const PRAZAN = { tip_id: '', tezina_kg: '', naziv: '', oem: '', marka_id: '', generacija_id: '', kategorija_id: '', stanje: 'B', km: '', godiste: '', motor: '', gorivo: '', cijena_km: '', kolicina: 1, opis: '', slike: [], status: 'aktivan', vanjska_sifra: '' };

function FormaDijela({ dio, onZatvori, onSnimljeno }) {
  const { obavijest } = useApp();
  const [f, setF] = useState(() => ({ ...PRAZAN, ...Object.fromEntries(Object.entries(dio || {}).map(([k, v]) => [k, v ?? ''])) }));
  const [marke, setMarke] = useState([]);
  const [modeli, setModeli] = useState([]);
  const [kategorije, setKategorije] = useState([]);
  const [tipovi, setTipovi] = useState([]);
  const [greska, setGreska] = useState('');
  const [salje, setSalje] = useState(false);
  const p = (k) => (e) => setF({ ...f, [k]: e.target.value });

  useEffect(() => {
    api('/marke').then(setMarke).catch(() => {});
    api('/kategorije').then(setKategorije).catch(() => {});
    api('/tipovi').then(setTipovi).catch(() => {});
  }, []);
  const tip = tipovi.find((t) => String(t.id) === String(f.tip_id));
  const tipoviPoGrupi = tipovi.reduce((a, t) => { (a[t.kategorija || 'Ostalo'] ||= []).push(t); return a; }, {});
  const izaberiTip = (e) => {
    const t = tipovi.find((x) => String(x.id) === e.target.value);
    setF({ ...f, tip_id: e.target.value, kategorija_id: t?.kategorija_id ?? f.kategorija_id });
  };
  const markaSlug = marke.find((m) => String(m.id) === String(f.marka_id))?.slug;
  useEffect(() => {
    setModeli([]);
    if (markaSlug) api(`/marke/${markaSlug}`).then((m) => setModeli(m.modeli)).catch(() => {});
  }, [markaSlug]);

  async function posaljiSlike(e) {
    const fajlovi = [...e.target.files];
    if (!fajlovi.length) return;
    const forma = new FormData();
    fajlovi.forEach((x) => forma.append('slike', x));
    try {
      const r = await api('/moj-otpad/slike', { metoda: 'POST', forma });
      setF((f) => ({ ...f, slike: [...f.slike, ...r.slike].slice(0, 10) }));
    } catch (err) { setGreska(err.message); }
    e.target.value = '';
  }

  async function snimi(e) {
    e.preventDefault(); setGreska(''); setSalje(true);
    try {
      if (dio?.id) await api(`/moj-otpad/dijelovi/${dio.id}`, { metoda: 'PUT', tijelo: f });
      else await api('/moj-otpad/dijelovi', { metoda: 'POST', tijelo: f });
      obavijest('Snimljeno');
      onSnimljeno();
    } catch (err) { setGreska(err.message); } finally { setSalje(false); }
  }

  return (
    <Modal naslov={dio?.id ? 'Uredi dio' : 'Novi dio'} onZatvori={onZatvori}>
      <form onSubmit={snimi}>
        <label className="oznaka">Naziv dijela</label>
        <input className="unos" value={f.naziv} onChange={p('naziv')} required placeholder="npr. Far lijevi xenon" />
        <div className="red-polja">
          <div><label className="oznaka">Tip dijela (za poštarinu)</label>
            <select className="unos" value={f.tip_id} onChange={izaberiTip}>
              <option value="">Prepoznaj iz naziva</option>
              {Object.entries(tipoviPoGrupi).map(([g, lista]) => (
                <optgroup key={g} label={g}>
                  {lista.map((t) => <option key={t.id} value={t.id}>{t.naziv} ({Number(t.tezina_kg)} kg)</option>)}
                </optgroup>
              ))}
            </select>
          </div>
          <div><label className="oznaka">Težina kg (prazno = po tipu)</label>
            <input className="unos" inputMode="decimal" value={f.tezina_kg} onChange={p('tezina_kg')} placeholder={tip ? `${Number(tip.tezina_kg)} kg` : 'po tipu'} />
          </div>
        </div>
        <div className="red-polja">
          <div><label className="oznaka">OEM broj</label><input className="unos" value={f.oem} onChange={p('oem')} placeholder="1K6 941 005" /></div>
          <div><label className="oznaka">Grupa</label>
            <select className="unos" value={f.kategorija_id} onChange={p('kategorija_id')}>
              <option value="">Izaberi</option>
              {kategorije.map((k) => <option key={k.id} value={k.id}>{k.naziv}</option>)}
            </select>
          </div>
        </div>
        <div className="red-polja">
          <div><label className="oznaka">Marka</label>
            <select className="unos" value={f.marka_id} onChange={(e) => setF({ ...f, marka_id: e.target.value, generacija_id: '' })}>
              <option value="">Izaberi</option>
              {marke.map((m) => <option key={m.id} value={m.id}>{m.naziv}</option>)}
            </select>
          </div>
          <div><label className="oznaka">Model / generacija</label>
            <select className="unos" value={f.generacija_id} onChange={p('generacija_id')} disabled={!modeli.length}>
              <option value="">Izaberi</option>
              {modeli.map((mo) => (
                <optgroup key={mo.id} label={mo.naziv}>
                  {mo.generacije.map((g) => <option key={g.id} value={g.id}>{g.naziv} ({g.od}–{g.do})</option>)}
                </optgroup>
              ))}
            </select>
          </div>
        </div>
        <div className="red-polja">
          <div><label className="oznaka">Stanje</label>
            <select className="unos" value={f.stanje} onChange={p('stanje')}>
              {Object.entries(STANJA).map(([k, v]) => <option key={k} value={k}>{v.naziv}</option>)}
            </select>
          </div>
          <div><label className="oznaka">Kilometraža vozila</label><input className="unos" inputMode="numeric" value={f.km} onChange={p('km')} /></div>
          <div><label className="oznaka">Godište</label><input className="unos" inputMode="numeric" value={f.godiste} onChange={p('godiste')} /></div>
        </div>
        <div className="red-polja">
          <div><label className="oznaka">Motor</label><input className="unos" value={f.motor} onChange={p('motor')} placeholder="1.9 TDI BXE" /></div>
          <div><label className="oznaka">Gorivo</label>
            <select className="unos" value={f.gorivo} onChange={p('gorivo')}>
              <option value="">—</option><option>Dizel</option><option>Benzin</option><option>Plin</option><option>Hibrid</option><option>Struja</option>
            </select>
          </div>
        </div>
        <div className="red-polja">
          <div><label className="oznaka">Cijena (KM, prazno = na upit)</label><input className="unos" inputMode="decimal" value={f.cijena_km} onChange={p('cijena_km')} /></div>
          <div><label className="oznaka">Količina</label><input className="unos" inputMode="numeric" value={f.kolicina} onChange={p('kolicina')} /></div>
          {dio?.id && (
            <div><label className="oznaka">Status</label>
              <select className="unos" value={f.status} onChange={p('status')}>
                <option value="aktivan">U prodaji</option><option value="rezervisan">Rezervisan</option><option value="prodan">Prodan</option>
              </select>
            </div>
          )}
        </div>
        <label className="oznaka">Opis</label>
        <textarea className="unos" rows="3" value={f.opis} onChange={p('opis')} />
        <label className="oznaka">Slike</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {f.slike.map((s) => (
            <div key={s} style={{ position: 'relative' }}>
              <img src={s} alt="" style={{ width: 72, height: 56, objectFit: 'cover', borderRadius: 8 }} />
              <button type="button" onClick={() => setF({ ...f, slike: f.slike.filter((x) => x !== s) })}
                style={{ position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 11, border: 0, background: '#e5486b', color: '#fff', cursor: 'pointer' }}>×</button>
            </div>
          ))}
          <label className="dugme obrub malo" style={{ height: 56 }}>
            <I.Upload />Dodaj<input type="file" accept="image/*" multiple hidden onChange={posaljiSlike} />
          </label>
        </div>
        {greska && <div className="greska">{greska}</div>}
        <button className="dugme puno" style={{ marginTop: 16 }} disabled={salje}>{salje ? 'Snimam…' : 'Snimi'}</button>
      </form>
    </Modal>
  );
}

function PanelDijelovi({ onPromjena, pro }) {
  const { cijena, obavijest } = useApp();
  const [podaci, setPodaci] = useState(null);
  const [status, setStatus] = useState('aktivan');
  const [q, setQ] = useState('');
  const [trazi, setTrazi] = useState('');
  const [strana, setStrana] = useState(1);
  const [uredi, setUredi] = useState(() => (new URLSearchParams(window.location.search).get('novi') ? {} : null));

  const ucitaj = useCallback(() => {
    api(`/moj-otpad/dijelovi${qs({ status, q: trazi, strana })}`).then(setPodaci).catch(() => {});
  }, [status, trazi, strana]);
  useEffect(() => { ucitaj(); }, [ucitaj]);

  async function izdvoji(d) {
    try {
      await api(`/moj-otpad/dijelovi/${d.id}/izdvoji`, { metoda: 'POST', tijelo: { ukloni: !!(d.izdvojen_do && new Date(d.izdvojen_do) > new Date()) } });
      ucitaj(); onPromjena();
    } catch (e) { obavijest(e.message); }
  }

  async function obrisi(d) {
    if (!confirm(`Obrisati "${d.naziv}"?`)) return;
    await api(`/moj-otpad/dijelovi/${d.id}`, { metoda: 'DELETE' });
    ucitaj(); onPromjena();
  }

  return (
    <div className="kartica kartica-tijelo">
      <div className="traka">
        <form style={{ display: 'flex', gap: 8, flex: 1, minWidth: 220 }} onSubmit={(e) => { e.preventDefault(); setStrana(1); setTrazi(q); }}>
          <input className="unos" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Naziv, OEM ili šifra" />
          <select className="unos" style={{ width: 'auto' }} value={status} onChange={(e) => { setStatus(e.target.value); setStrana(1); }}>
            <option value="aktivan">U prodaji</option><option value="rezervisan">Rezervisani</option><option value="prodan">Prodani</option><option value="">Svi</option>
          </select>
        </form>
        <button className="dugme" onClick={() => setUredi({})}><I.Dio />Dodaj dio</button>
      </div>
      {!podaci ? <Ucitavanje /> : (
        <>
          <div className="tiho malo" style={{ marginBottom: 6 }}>{podaci.ukupno} dijelova</div>
          <div className="tabela-omot">
            <table className="tabela">
              <thead><tr><th>Dio</th><th>Vozilo</th><th>Stanje</th><th>Cijena</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {podaci.dijelovi.map((d) => (
                  <tr key={d.id}>
                    <td><b>{d.naziv}</b>{d.izdvojen_do && new Date(d.izdvojen_do) > new Date() && <span className="oznaka-stanja izdvojeno" style={{ marginLeft: 6 }}>★</span>}<div className="tiho malo">{d.oem}{d.vanjska_sifra ? ` · šifra ${d.vanjska_sifra}` : ''}{(d.tezina_kg ?? d.tip_tezina_kg) != null ? ` · ${Number(d.tezina_kg ?? d.tip_tezina_kg)} kg` : ' · težina nepoznata'}</div></td>
                    <td className="malo">{[d.marka, d.generacija].filter(Boolean).join(' ') || <span className="tiho">nije povezano</span>}</td>
                    <td>{STANJA[d.stanje]?.naziv}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{d.cijena_km > 0 ? cijena(d.cijena_km) : <span className="tiho">na upit</span>}</td>
                    <td><span className={`status status-${d.status}`}>{d.status}</span></td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {pro && d.status === 'aktivan' && <><button className="dugme obrub malo" onClick={() => izdvoji(d)} title="Izdvoji na vrh pretrage">{d.izdvojen_do && new Date(d.izdvojen_do) > new Date() ? '☆' : '★'}</button>{' '}</>}
                      <button className="dugme obrub malo" onClick={() => setUredi(d)}>Uredi</button>{' '}
                      <button className="dugme opasno malo" onClick={() => obrisi(d)}>Obriši</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {podaci.ukupno > 50 && (
            <div className="stranice">
              <button className="dugme obrub malo" disabled={strana <= 1} onClick={() => setStrana(strana - 1)}>←</button>
              <span className="tiho">{strana} / {Math.ceil(podaci.ukupno / 50)}</span>
              <button className="dugme obrub malo" disabled={strana >= Math.ceil(podaci.ukupno / 50)} onClick={() => setStrana(strana + 1)}>→</button>
            </div>
          )}
        </>
      )}
      {uredi && <FormaDijela dio={uredi} onZatvori={() => setUredi(null)} onSnimljeno={() => { setUredi(null); ucitaj(); onPromjena(); }} />}
    </div>
  );
}

// ---------- Narudžbe ----------

function PanelNarudzbe({ onPromjena }) {
  const { cijena } = useApp();
  const [lista, setLista] = useState(null);
  const ucitaj = () => api('/moj-otpad/narudzbe').then(setLista).catch(() => setLista([]));
  useEffect(() => { ucitaj(); }, []);
  async function status(n, s) {
    await api(`/moj-otpad/narudzbe/${n.id}`, { metoda: 'PUT', tijelo: { status: s } });
    ucitaj(); onPromjena();
  }
  if (!lista) return <Ucitavanje />;
  return (
    <div className="kartica kartica-tijelo">
      {!lista.length && <p className="tiho">Još nema narudžbi.</p>}
      <div className="lista-stavki">
        {lista.map((n) => (
          <div key={n.id}>
            <div className="traka" style={{ marginBottom: 4 }}>
              <b>#{n.id} · {n.ime}</b>
              <span className={`status status-${n.status}`}>{STATUS_NAR[n.status]}</span>
            </div>
            <div className="malo">
              <a href={`tel:${n.telefon}`}>{n.telefon}</a>{n.email ? ` · ${n.email}` : ''} · {n.nacin === 'licno' ? 'lično preuzimanje' : `dostava: ${n.adresa}, ${n.grad}`}
            </div>
            {(n.stavke || []).map((s) => <div key={s.id} className="malo">• {s.naziv}{s.oem ? ` (${s.oem})` : ''} · {cijena(s.cijena_km)}</div>)}
            {n.napomena && <div className="malo tiho">Napomena: {n.napomena}</div>}
            <div className="malo"><b>Ukupno {cijena(n.ukupno_km + n.dostava_km)}</b> <span className="tiho">· {new Date(n.kreiran).toLocaleString('bs-BA')}</span></div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
              {n.status === 'nova' && <button className="dugme malo" onClick={() => status(n, 'potvrdjena')}>Potvrdi</button>}
              {n.status === 'potvrdjena' && n.nacin === 'dostava' && <button className="dugme malo" onClick={() => status(n, 'poslana')}>Poslano</button>}
              {['potvrdjena', 'poslana'].includes(n.status) && <button className="dugme sekundarno malo" onClick={() => status(n, 'zavrsena')}>Završeno</button>}
              {!['zavrsena', 'otkazana'].includes(n.status) && <button className="dugme opasno malo" onClick={() => confirm('Otkazati narudžbu? Dijelovi se vraćaju u prodaju.') && status(n, 'otkazana')}>Otkaži</button>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Upiti ----------

function PanelUpiti({ onPromjena }) {
  const [lista, setLista] = useState(null);
  const [odgovori, setOdgovori] = useState({});
  const ucitaj = () => api('/moj-otpad/upiti').then(setLista).catch(() => setLista([]));
  useEffect(() => { ucitaj(); }, []);
  async function snimi(u, status) {
    await api(`/moj-otpad/upiti/${u.id}`, { metoda: 'PUT', tijelo: { odgovor: odgovori[u.id] || null, status } });
    ucitaj(); onPromjena();
  }
  if (!lista) return <Ucitavanje />;
  return (
    <div className="kartica kartica-tijelo">
      {!lista.length && <p className="tiho">Još nema upita.</p>}
      <div className="lista-stavki">
        {lista.map((u) => (
          <div key={u.id}>
            <div className="traka" style={{ marginBottom: 4 }}>
              <b>{u.ime}{u.dio ? ` · ${u.dio}` : ''}</b>
              <span className={`status status-${u.status}`}>{u.status}</span>
            </div>
            <div className="malo">
              {u.telefon && <a href={`tel:${u.telefon}`}>{u.telefon}</a>}{u.telefon && u.email ? ' · ' : ''}
              {u.email && <a href={`mailto:${u.email}`}>{u.email}</a>}
              <span className="tiho"> · {new Date(u.kreiran).toLocaleString('bs-BA')}</span>
            </div>
            <p style={{ margin: '6px 0' }}>{u.poruka}</p>
            {u.odgovor && <div className="info"><b>Vaš odgovor:</b> {u.odgovor}</div>}
            {u.status === 'novi' && (
              <>
                <textarea className="unos" rows="2" placeholder="Odgovor (kupac ga vidi u svom nalogu; ili ga nazovite)"
                  value={odgovori[u.id] || ''} onChange={(e) => setOdgovori({ ...odgovori, [u.id]: e.target.value })} />
                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  <button className="dugme malo" disabled={!odgovori[u.id]} onClick={() => snimi(u, 'odgovoren')}>Odgovori</button>
                  <button className="dugme obrub malo" onClick={() => snimi(u, 'zatvoren')}>Riješeno telefonom</button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Uvoz zaliha ----------

const PRIMJER_CSV = `sifra;naziv;oem;marka;model;godiste;kategorija;stanje;km;cijena;kolicina;slike
1001;Far lijevi xenon;1K6941005;Volkswagen;Golf;2007;svjetla;A;185000;150;1;https://primjer.ba/slika1.jpg
1002;Alternator;06F903023F;Audi;A3;2006;motor;B;210000;120;1;`;

function PanelUvoz({ profil, onPromjena }) {
  const [fajl, setFajl] = useState(null);
  const [potpuno, setPotpuno] = useState(false);
  const [rez, setRez] = useState(null);
  const [greska, setGreska] = useState('');
  const [radi, setRadi] = useState(false);
  const [uvozi, setUvozi] = useState([]);
  const [kljuc, setKljuc] = useState(profil.api_kljuc);
  const ucitajUvoze = () => api('/moj-otpad/uvozi').then(setUvozi).catch(() => {});
  useEffect(() => { ucitajUvoze(); }, []);

  async function uvezi(e) {
    e.preventDefault();
    if (!fajl) return;
    if (potpuno && !confirm('Svi dijelovi kojih nema u ovom fajlu biće označeni kao prodani. Nastaviti?')) return;
    setRadi(true); setGreska(''); setRez(null);
    const forma = new FormData();
    forma.append('fajl', fajl);
    if (potpuno) forma.append('potpuno', '1');
    try {
      setRez(await api('/moj-otpad/uvoz', { metoda: 'POST', forma }));
      ucitajUvoze(); onPromjena();
    } catch (err) { setGreska(err.message); } finally { setRadi(false); }
  }

  async function noviKljuc() {
    if (!confirm('Stari ključ prestaje raditi. Napraviti novi?')) return;
    const r = await api('/moj-otpad/api-kljuc', { metoda: 'POST' });
    setKljuc(r.api_kljuc);
  }

  const primjer = () => {
    const url = URL.createObjectURL(new Blob(['﻿' + PRIMJER_CSV], { type: 'text/csv' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: 'primjer-uvoza.csv' });
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <>
      <PoveziProgram izvor={profil.izvor} onPromjena={() => { ucitajUvoze(); onPromjena(); }} />
      <div className="kartica kartica-tijelo" style={{ marginTop: 12 }}>
        <h2>Uvoz iz CSV / Excel fajla</h2>
        <p className="tiho malo" style={{ marginTop: 0 }}>
          Iz Excela snimite kao „CSV UTF-8”. Dijelovi se uparuju po koloni <code>sifra</code>: postojeći se ažuriraju, novi dodaju.
          Kolone: <code>sifra, naziv, oem, marka, model, godiste, kategorija, stanje (A/B/C/N), km, cijena, kolicina, slike, opis, motor, gorivo</code>.
          Obavezan je samo <code>naziv</code>; bez cijene dio ide kao „cijena na upit”.
        </p>
        <button className="dugme obrub malo" onClick={primjer}>Preuzmi primjer fajla</button>
        <form onSubmit={uvezi} style={{ marginTop: 14 }}>
          <input type="file" accept=".csv,text/csv" onChange={(e) => setFajl(e.target.files[0])} />
          <label className="cekiranje" style={{ marginTop: 10 }}>
            <input type="checkbox" checked={potpuno} onChange={(e) => setPotpuno(e.target.checked)} />
            Fajl sadrži cijelo stanje (sve čega nema označi kao prodano)
          </label>
          <button className="dugme" style={{ marginTop: 10 }} disabled={!fajl || radi}><I.Upload />{radi ? 'Uvozim…' : 'Uvezi'}</button>
        </form>
        {greska && <div className="greska">{greska}</div>}
        {rez && (
          <div className="uspjeh">
            Novih: <b>{rez.novih}</b> · ažuriranih: <b>{rez.azuriranih}</b> · označeno prodanih: <b>{rez.prodanih}</b>{rez.gresaka ? ` · grešaka: ${rez.gresaka}` : ''}{rez.preko_limita ? ` · preko limita: ${rez.preko_limita}` : ''}
            {rez.greske?.length > 0 && <ul className="malo" style={{ margin: '6px 0 0', paddingLeft: 18 }}>{rez.greske.map((g) => <li key={g}>{g}</li>)}</ul>}
          </div>
        )}
      </div>

      <div className="kartica kartica-tijelo" style={{ marginTop: 12 }}>
        <h2>Automatska sinhronizacija (API)</h2>
        <p className="tiho malo" style={{ marginTop: 0 }}>
          Program otpada (npr. vaš sistem za dijelove) može sam slati stanje, recimo svakih sat vremena, na ovu adresu.
        </p>
        <label className="oznaka">API ključ</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="unos" readOnly value={kljuc || ''} onFocus={(e) => e.target.select()} style={{ fontFamily: 'ui-monospace, monospace', fontSize: '.8rem' }} />
          <button className="dugme obrub malo" style={{ height: 'auto' }} onClick={noviKljuc}>Novi</button>
        </div>
        <pre className="kod" style={{ marginTop: 12 }}>{`POST ${window.location.origin}/api/uvoz
X-Api-Key: ${kljuc || '<ključ>'}
Content-Type: application/json

{
  "potpuno": true,
  "dijelovi": [
    { "sifra": "1001", "naziv": "Far lijevi", "oem": "1K6941005",
      "marka": "Volkswagen", "model": "Golf", "godiste": 2007,
      "kategorija": "svjetla", "stanje": "A", "km": 185000,
      "cijena": 150, "kolicina": 1,
      "slike": ["https://.../slika.jpg"] }
  ]
}`}</pre>
      </div>

      {uvozi.length > 0 && (
        <div className="kartica kartica-tijelo" style={{ marginTop: 12 }}>
          <h3>Zadnji uvozi</h3>
          <div className="tabela-omot">
            <table className="tabela">
              <thead><tr><th>Vrijeme</th><th>Izvor</th><th>Novih</th><th>Ažurir.</th><th>Prodanih</th><th>Grešaka</th></tr></thead>
              <tbody>{uvozi.map((u) => (
                <tr key={u.id}><td>{new Date(u.kreiran).toLocaleString('bs-BA')}</td><td>{u.izvor.toUpperCase()}</td><td>{u.novih}</td><td>{u.azuriranih}</td><td>{u.prodanih}</td><td>{u.gresaka}</td></tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

function PoveziProgram({ izvor, onPromjena }) {
  const [url, setUrl] = useState(izvor.url || '');
  const [kljuc, setKljuc] = useState('');
  const [radi, setRadi] = useState(false);
  const [poruka, setPoruka] = useState(null);
  const [stanje, setStanje] = useState(izvor);

  async function sacuvaj(e) {
    e.preventDefault(); setRadi(true); setPoruka(null);
    try {
      const r = await api('/moj-otpad/izvor', { metoda: 'PUT', tijelo: { url, kljuc } });
      setStanje({ povezan: !!url, url, zadnje: new Date().toISOString() });
      setPoruka({ ok: true, t: url ? `Povezano. Novih: ${r.novih}, ažuriranih: ${r.azuriranih}, prodanih: ${r.prodanih}${r.preko_limita ? `, preko limita: ${r.preko_limita}` : ''}.` : 'Veza uklonjena.' });
      setKljuc(''); onPromjena();
    } catch (err) { setPoruka({ ok: false, t: err.message }); } finally { setRadi(false); }
  }
  async function prekini() {
    if (!confirm('Prekinuti vezu s programom? Već uvezeni dijelovi ostaju.')) return;
    await api('/moj-otpad/izvor', { metoda: 'PUT', tijelo: { url: '' } });
    setUrl(''); setStanje({ povezan: false }); setPoruka({ ok: true, t: 'Veza uklonjena.' });
  }
  async function sada() {
    setRadi(true); setPoruka(null);
    try {
      const r = await api('/moj-otpad/izvor/sada', { metoda: 'POST' });
      setPoruka({ ok: true, t: `Sinhronizovano. Novih: ${r.novih}, ažuriranih: ${r.azuriranih}, prodanih: ${r.prodanih}.` });
      onPromjena();
    } catch (err) { setPoruka({ ok: false, t: err.message }); } finally { setRadi(false); }
  }

  return (
    <div className="kartica kartica-tijelo">
      <h2>Poveži svoj program za dijelove</h2>
      <p className="tiho malo" style={{ marginTop: 0 }}>
        Ako koristite Delić program za dijelove (isti koji puni webshop), unesite njegovu adresu i <code>SHOP_API_KEY</code> iz njegovog <code>.env</code>.
        Stanje se povlači svakih 15 minuta: novi dio se pojavi, prodan nestane.
      </p>
      {stanje.povezan && (
        <div className={stanje.greska ? 'greska' : 'uspjeh'}>
          {stanje.greska ? `Zadnji pokušaj: ${stanje.greska}` : `Povezano${stanje.zadnje ? `, zadnja sinhronizacija ${new Date(stanje.zadnje).toLocaleString('bs-BA')}` : ''}.`}
        </div>
      )}
      <form onSubmit={sacuvaj}>
        <label className="oznaka">Adresa programa</label>
        <input className="unos" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://delicdijelovi.duckdns.org" />
        <label className="oznaka">API ključ {stanje.povezan && <span className="tiho">(prazno = ostaje stari)</span>}</label>
        <input className="unos" value={kljuc} onChange={(e) => setKljuc(e.target.value)} autoComplete="off" />
        <div className="akcije">
          <button className="dugme" disabled={radi}>{radi ? 'Radim…' : stanje.povezan ? 'Sačuvaj' : 'Poveži'}</button>
          {stanje.povezan && <button type="button" className="dugme sekundarno" disabled={radi} onClick={sada}>Sinhronizuj sad</button>}
          {stanje.povezan && <button type="button" className="dugme opasno" disabled={radi} onClick={prekini}>Prekini vezu</button>}
        </div>
      </form>
      {poruka && <div className={poruka.ok ? 'uspjeh' : 'greska'}>{poruka.t}</div>}
    </div>
  );
}

// ---------- Zahtjevi kupaca ----------

function PanelZahtjevi() {
  const { cijena, obavijest } = useApp();
  const [lista, setLista] = useState(null);
  const [forme, setForme] = useState({});
  const ucitaj = () => api('/moj-otpad/zahtjevi').then(setLista).catch(() => setLista([]));
  useEffect(() => { ucitaj(); }, []);
  const f = (id) => forme[id] || {};
  const set = (id, k, v) => setForme({ ...forme, [id]: { ...f(id), [k]: v } });

  async function posalji(z) {
    try {
      await api(`/moj-otpad/zahtjevi/${z.id}/ponuda`, { metoda: 'POST', tijelo: f(z.id) });
      obavijest('Ponuda poslana'); ucitaj();
    } catch (e) { obavijest(e.message); }
  }

  if (!lista) return <Ucitavanje />;
  return (
    <div className="kartica kartica-tijelo">
      <p className="tiho" style={{ marginTop: 0 }}>Kupci objavljuju dijelove koje ne mogu naći. Pošaljite ponudu, a kupac vas vidi s telefonom i može nazvati.</p>
      {!lista.length && <p className="tiho">Trenutno nema otvorenih zahtjeva.</p>}
      <div className="lista-stavki">
        {lista.map((z) => (
          <div key={z.id}>
            <div className="traka" style={{ marginBottom: 2 }}>
              <b>{z.naziv}</b>
              <span className="tiho malo">{new Date(z.kreiran).toLocaleDateString('bs-BA')} · {z.broj_ponuda} ponuda</span>
            </div>
            <div className="malo">
              {[z.marka, z.generacija].filter(Boolean).join(' ')}{z.godiste ? `, ${z.godiste}` : ''}{z.motor ? `, ${z.motor}` : ''}{z.oem ? ` · OEM ${z.oem}` : ''}{z.grad ? ` · ${z.grad}` : ''}
            </div>
            {z.opis && <div className="malo tiho">{z.opis}</div>}
            {z.ponuda_id ? (
              <div className="uspjeh">Poslali ste ponudu{z.ponuda_cijena ? `: ${cijena(z.ponuda_cijena)}` : ''}. {z.ponuda_poruka}</div>
            ) : (
              <div style={{ marginTop: 8 }}>
                {z.moguci?.length > 0 && (
                  <select className="unos" style={{ marginBottom: 6 }} value={f(z.id).dio_id || ''}
                    onChange={(e) => { const d = z.moguci.find((x) => String(x.id) === e.target.value); setForme({ ...forme, [z.id]: { ...f(z.id), dio_id: e.target.value, cijena_km: d?.cijena_km || f(z.id).cijena_km } }); }}>
                    <option value="">Imate odgovarajući dio u ponudi? Izaberite ga</option>
                    {z.moguci.map((d) => <option key={d.id} value={d.id}>{d.naziv}{d.oem ? ` (${d.oem})` : ''} · {d.cijena_km} KM</option>)}
                  </select>
                )}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <input className="unos" style={{ width: 120 }} inputMode="decimal" placeholder="Cijena KM" value={f(z.id).cijena_km || ''} onChange={(e) => set(z.id, 'cijena_km', e.target.value)} />
                  <select className="unos" style={{ width: 'auto' }} value={f(z.id).stanje || ''} onChange={(e) => set(z.id, 'stanje', e.target.value)}>
                    <option value="">Stanje</option>
                    {Object.entries(STANJA).map(([k, v]) => <option key={k} value={k}>{v.naziv}</option>)}
                  </select>
                  <input className="unos" style={{ flex: 1, minWidth: 160 }} placeholder="Poruka kupcu" value={f(z.id).poruka || ''} onChange={(e) => set(z.id, 'poruka', e.target.value)} />
                  <button className="dugme malo" style={{ height: 'auto' }} onClick={() => posalji(z)}>Pošalji ponudu</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Profil ----------

// Cjenovnik brze pošte: pošta → razredi "do X kg = Y KM"
const noviRazred = () => ({ do_kg: '', cijena_km: '' });
const novaPosta = () => ({ naziv: '', razredi: [noviRazred()] });

function CjenovnikPoste() {
  const { obavijest } = useApp();
  const [sluzbe, setSluzbe] = useState(null);
  const [greska, setGreska] = useState('');
  const [izmjena, setIzmjena] = useState(false);

  useEffect(() => {
    api('/moj-otpad/postarina').then((s) => setSluzbe(s.length ? s.map((x) => ({ naziv: x.naziv, razredi: x.razredi.map((r) => ({ do_kg: String(r.do_kg), cijena_km: String(r.cijena_km) })) })) : [novaPosta()]))
      .catch(() => setSluzbe([novaPosta()]));
  }, []);
  if (!sluzbe) return null;

  const mijenjaj = (fn) => { setSluzbe((s) => fn(structuredClone(s))); setIzmjena(true); };
  const setPolje = (i, j, k, v) => mijenjaj((s) => { s[i].razredi[j][k] = v; return s; });

  async function snimi() {
    setGreska('');
    try {
      const r = await api('/moj-otpad/postarina', { metoda: 'PUT', tijelo: { sluzbe } });
      setSluzbe(r.length ? r.map((x) => ({ naziv: x.naziv, razredi: x.razredi.map((y) => ({ do_kg: String(y.do_kg), cijena_km: String(y.cijena_km) })) })) : [novaPosta()]);
      setIzmjena(false);
      obavijest('Cjenovnik snimljen');
    } catch (e) { setGreska(e.message); }
  }

  return (
    <div className="kartica kartica-tijelo" style={{ marginBottom: 12 }}>
      <h2>Brza pošta</h2>
      <p className="tiho malo" style={{ marginTop: 0 }}>
        Upišite pošte s kojima šaljete i cijenu za svaki razred težine. Sajt sabere težinu dijelova u paketu i kupcu pokaže tačnu poštarinu.
      </p>
      {sluzbe.map((s, i) => (
        <div key={i} className="posta-blok">
          <div className="posta-zaglavlje">
            <input className="unos" value={s.naziv} placeholder="Naziv pošte, npr. Euro Express"
              onChange={(e) => mijenjaj((x) => { x[i].naziv = e.target.value; return x; })} />
            <button type="button" className="ikona-dugme" aria-label="Obriši poštu" title="Obriši poštu"
              onClick={() => mijenjaj((x) => { x.splice(i, 1); return x.length ? x : [novaPosta()]; })}><I.Zatvori /></button>
          </div>
          {s.razredi.map((r, j) => (
            <div key={j} className="razred">
              <span className="tiho">do</span>
              <input className="unos" inputMode="decimal" value={r.do_kg} onChange={(e) => setPolje(i, j, 'do_kg', e.target.value)} aria-label="do kg" />
              <span className="tiho">kg</span>
              <input className="unos" inputMode="decimal" value={r.cijena_km} onChange={(e) => setPolje(i, j, 'cijena_km', e.target.value)} aria-label="cijena KM" />
              <span className="tiho">KM</span>
              <button type="button" className="ikona-dugme malo-x" aria-label="Obriši red"
                onClick={() => mijenjaj((x) => { x[i].razredi.splice(j, 1); if (!x[i].razredi.length) x[i].razredi.push(noviRazred()); return x; })}><I.Zatvori /></button>
            </div>
          ))}
          <button type="button" className="dugme obrub malo" onClick={() => mijenjaj((x) => { x[i].razredi.push(noviRazred()); return x; })}>+ Dodaj težinu</button>
        </div>
      ))}
      <div className="akcije">
        <button type="button" className="dugme sekundarno" onClick={() => mijenjaj((x) => [...x, novaPosta()])}>+ Dodaj poštu</button>
        <button type="button" className="dugme" onClick={snimi} disabled={!izmjena}>Snimi cjenovnik</button>
      </div>
      {greska && <div className="greska">{greska}</div>}
    </div>
  );
}

function TelegramVeza({ telegram, onPromjena }) {
  const { obavijest } = useApp();
  const [link, setLink] = useState(null);
  if (!telegram.ukljucen) return (
    <div className="kartica kartica-tijelo" style={{ marginBottom: 12 }}>
      <h2>Obavještenja na Telegram</h2>
      <p className="tiho" style={{ margin: 0 }}>Administrator još nije podesio Telegram bota na serveru.</p>
    </div>
  );
  async function povezi() {
    try { const r = await api('/moj-otpad/telegram', { metoda: 'POST' }); setLink(r.link); window.open(r.link, '_blank'); }
    catch (e) { obavijest(e.message); }
  }
  return (
    <div className="kartica kartica-tijelo" style={{ marginBottom: 12 }}>
      <h2>Obavještenja na Telegram</h2>
      {telegram.povezan ? (
        <>
          <div className="uspjeh">Povezano. Narudžbe, upiti i zahtjevi kupaca stižu vam na Telegram.</div>
          <div className="akcije">
            <button className="dugme sekundarno" onClick={async () => { const r = await api('/moj-otpad/telegram/test', { metoda: 'POST' }); obavijest(r.ok ? 'Poslano, provjerite Telegram' : 'Slanje nije uspjelo'); }}>Pošalji test poruku</button>
            <button className="dugme opasno" onClick={async () => { await api('/moj-otpad/telegram', { metoda: 'DELETE' }); onPromjena(); }}>Isključi</button>
          </div>
        </>
      ) : (
        <>
          <p className="tiho" style={{ marginTop: 0 }}>Kliknite dugme, u Telegramu pritisnite <b>Start</b> i gotovo. Svaka nova narudžba i upit stižu vam odmah na telefon.</p>
          <button className="dugme" onClick={povezi}>Poveži Telegram</button>
          {link && <p className="malo">Ako se Telegram nije otvorio: <a href={link} target="_blank" rel="noreferrer">{link}</a>. Nakon klika na Start <button className="dugme obrub malo" onClick={onPromjena}>osvježi</button></p>}
        </>
      )}
    </div>
  );
}

function PanelProfil({ profil, onSnimljeno }) {
  const { obavijest } = useApp();
  const [f, setF] = useState(() => Object.fromEntries(
    ['naziv', 'grad', 'adresa', 'telefon', 'email', 'lat', 'lng', 'opis', 'dostava_info', 'dostava_cijena_km'].map((k) => [k, profil[k] ?? ''])
  ));
  const [licno, setLicno] = useState(profil.licno_preuzimanje);
  const [greska, setGreska] = useState('');
  const p = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function snimi(e) {
    e.preventDefault(); setGreska('');
    try {
      await api('/moj-otpad/profil', { metoda: 'PUT', tijelo: { ...f, licno_preuzimanje: licno } });
      obavijest('Profil snimljen'); onSnimljeno();
    } catch (err) { setGreska(err.message); }
  }

  function mojaLokacija() {
    navigator.geolocation?.getCurrentPosition(
      (pos) => setF((f) => ({ ...f, lat: pos.coords.latitude.toFixed(6), lng: pos.coords.longitude.toFixed(6) })),
      () => setGreska('Lokacija nije dostupna. Unesite koordinate ručno (Google Maps → dugi pritisak na mapu).')
    );
  }

  return (
    <>
    <TelegramVeza telegram={profil.telegram} onPromjena={onSnimljeno} />
    <CjenovnikPoste />
    <form className="kartica kartica-tijelo" onSubmit={snimi}>
      <label className="oznaka">Naziv otpada</label>
      <input className="unos" value={f.naziv} onChange={p('naziv')} required />
      <div className="red-polja">
        <div><label className="oznaka">Grad</label><input className="unos" value={f.grad} onChange={p('grad')} /></div>
        <div><label className="oznaka">Adresa</label><input className="unos" value={f.adresa} onChange={p('adresa')} /></div>
      </div>
      <div className="red-polja">
        <div><label className="oznaka">Telefon</label><input className="unos" value={f.telefon} onChange={p('telefon')} /></div>
        <div><label className="oznaka">Email</label><input className="unos" value={f.email} onChange={p('email')} /></div>
      </div>
      <label className="oznaka">Lokacija na mapi</label>
      <div style={{ display: 'flex', gap: 8 }}>
        <input className="unos" placeholder="Geografska širina" value={f.lat} onChange={p('lat')} />
        <input className="unos" placeholder="Geografska dužina" value={f.lng} onChange={p('lng')} />
        <button type="button" className="dugme obrub malo" style={{ height: 'auto' }} onClick={mojaLokacija}><I.Lokacija /></button>
      </div>
      <label className="oznaka">O otpadu</label>
      <textarea className="unos" rows="3" value={f.opis} onChange={p('opis')} />
      <h3 style={{ marginTop: 20 }}>Dostava</h3>
      <div className="red-polja">
        <div><label className="oznaka">Poštarina kad težina nije poznata (KM)</label><input className="unos" inputMode="decimal" value={f.dostava_cijena_km} onChange={p('dostava_cijena_km')} /></div>
      </div>
      <label className="oznaka">Informacije o dostavi</label>
      <textarea className="unos" rows="2" value={f.dostava_info} onChange={p('dostava_info')} placeholder="npr. Šaljemo brzom poštom, isporuka 1-2 dana. Krupni dijelovi po dogovoru." />
      <label className="cekiranje" style={{ marginTop: 10 }}>
        <input type="checkbox" checked={!!licno} onChange={(e) => setLicno(e.target.checked)} />Moguće lično preuzimanje
      </label>
      {greska && <div className="greska">{greska}</div>}
      <button className="dugme" style={{ marginTop: 14 }}>Snimi</button>
    </form>
    </>
  );
}
