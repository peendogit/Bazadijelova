import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { Ucitavanje, Modal } from '../components/Zajednicko.jsx';

export default function Admin() {
  const [otpadi, setOtpadi] = useState(null);
  const [stat, setStat] = useState(null);
  const ucitaj = () => {
    api('/admin/otpadi').then(setOtpadi).catch(() => setOtpadi([]));
    api('/admin/statistika').then(setStat).catch(() => {});
  };
  useEffect(() => { ucitaj(); }, []);

  async function paket(o, p) {
    let paket_do = null;
    if (p === 'pro') {
      const d = prompt('Pro važi do (GGGG-MM-DD), prazno = bez isteka', new Date(Date.now() + 31 * 864e5).toISOString().slice(0, 10));
      if (d === null) return;
      paket_do = d || null;
    }
    await api(`/admin/otpadi/${o.id}`, { metoda: 'PUT', tijelo: { paket: p, paket_do } });
    ucitaj();
  }

  async function odobri(o, da) {
    await api(`/admin/otpadi/${o.id}`, { metoda: 'PUT', tijelo: { odobren: da } });
    ucitaj();
  }

  if (!otpadi) return <Ucitavanje />;
  const tipoviKartica = <TipoviDijelova />;
  return (
    <>
      <h1>Administracija</h1>
      {stat && (
        <div className="kartica kartica-tijelo" style={{ marginBottom: 12 }}>
          <div className="brojke">
            <div className="brojka"><b>{stat.aktivnih}</b><span>dijelova u prodaji</span></div>
            <div className="brojka"><b>{stat.otpada}</b><span>odobrenih otpada</span></div>
            <div className="brojka"><b>{stat.na_cekanju}</b><span>čeka odobrenje</span></div>
            <div className="brojka"><b>{stat.kupaca}</b><span>kupaca</span></div>
            <div className="brojka"><b>{stat.narudzbi_30d}</b><span>narudžbi (30 dana)</span></div>
            <div className="brojka"><b>{stat.upita_30d}</b><span>upita (30 dana)</span></div>
            <div className="brojka"><b>{stat.zahtjeva_30d}</b><span>„tražim dio” (30 dana)</span></div>
            <div className="brojka"><b>{stat.pro_otpada}</b><span>Pro otpada</span></div>
          </div>
        </div>
      )}
      <div className="kartica kartica-tijelo">
        <h2>Otpadi</h2>
        <div className="tabela-omot">
          <table className="tabela">
            <thead><tr><th>Otpad</th><th>Kontakt</th><th>Dijelova</th><th>Paket</th><th>Zadnji uvoz</th><th></th></tr></thead>
            <tbody>
              {otpadi.map((o) => (
                <tr key={o.id}>
                  <td><b>{o.odobren ? <Link to={`/otpad/${o.slug}`}>{o.naziv}</Link> : o.naziv}</b><div className="tiho malo">{o.grad}</div></td>
                  <td className="malo">{o.telefon}<br />{o.email}</td>
                  <td>{o.aktivnih}<div className="tiho malo">{o.telegram ? 'Telegram ✓' : ''}{o.povezan_program ? ' · program ✓' : ''}</div></td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {o.paket === 'pro' ? <b>Pro</b> : 'Besplatno'}
                    {o.paket === 'pro' && o.paket_do && <div className="tiho malo">do {new Date(o.paket_do).toLocaleDateString('bs-BA')}</div>}
                    <div><button className="dugme obrub malo" style={{ marginTop: 4 }} onClick={() => paket(o, o.paket === 'pro' ? 'besplatno' : 'pro')}>{o.paket === 'pro' ? 'Ukini Pro' : 'Daj Pro'}</button></div>
                  </td>
                  <td className="malo">{o.zadnji_uvoz ? new Date(o.zadnji_uvoz).toLocaleString('bs-BA') : '—'}</td>
                  <td>
                    {o.odobren
                      ? <button className="dugme opasno malo" onClick={() => confirm(`Sakriti otpad ${o.naziv}?`) && odobri(o, false)}>Sakrij</button>
                      : <button className="dugme malo" onClick={() => odobri(o, true)}>Odobri</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {tipoviKartica}
    </>
  );
}

// Tipovi dijelova i njihove težine (za obračun poštarine)
function TipoviDijelova() {
  const [podaci, setPodaci] = useState(null);
  const [kategorije, setKategorije] = useState([]);
  const [filter, setFilter] = useState('');
  const [uredi, setUredi] = useState(null);   // {id?, naziv, tezina_kg, kategorija_id, kljucne}
  const [poruka, setPoruka] = useState(null);
  const ucitaj = () => api('/admin/tipovi').then(setPodaci).catch(() => {});
  useEffect(() => { ucitaj(); api('/kategorije').then(setKategorije).catch(() => {}); }, []);
  if (!podaci) return null;

  async function snimi(e) {
    e.preventDefault(); setPoruka(null);
    try {
      const r = uredi.id
        ? await api(`/admin/tipovi/${uredi.id}`, { metoda: 'PUT', tijelo: uredi })
        : await api('/admin/tipovi', { metoda: 'POST', tijelo: uredi });
      setPoruka({ ok: true, t: `Snimljeno.${r.prepoznato ? ` Dijelova kojima je dodijeljen tip: ${r.prepoznato}.` : ''}` });
      setUredi(null); ucitaj();
    } catch (err) { setPoruka({ ok: false, t: err.message }); }
  }
  async function obrisi(t) {
    if (!confirm(`Obrisati tip "${t.naziv}"? Dijelovi ostaju, samo bez težine.`)) return;
    await api(`/admin/tipovi/${t.id}`, { metoda: 'DELETE' }); ucitaj();
  }
  async function prepoznaj() {
    const r = await api('/admin/tipovi/prepoznaj', { metoda: 'POST' });
    setPoruka({ ok: true, t: `Ponovo prepoznato: ${r.prepoznato} dijelova.` }); ucitaj();
  }

  const f = filter.toLowerCase();
  const lista = podaci.tipovi.filter((t) => !f || t.naziv.toLowerCase().includes(f) || (t.kategorija || '').toLowerCase().includes(f));
  return (
    <div className="kartica kartica-tijelo odjeljak">
      <div className="traka">
        <h2 style={{ margin: 0 }}>Tipovi dijelova i težine</h2>
        <button className="dugme malo" onClick={() => setUredi({ naziv: '', tezina_kg: '', kategorija_id: '', kljucne: '' })}>+ Novi tip</button>
      </div>
      <p className="tiho malo" style={{ marginTop: 0 }}>
        Težina tipa određuje poštarinu. Dio dobije tip sam, po nazivu i ključnim riječima.
        {podaci.bez_tipa > 0 && <> Dijelova u prodaji bez tipa: <b>{podaci.bez_tipa}</b> (za njih važi paušal otpada).</>}
      </p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <input className="unos" style={{ flex: 1, minWidth: 180 }} placeholder="Traži tip" value={filter} onChange={(e) => setFilter(e.target.value)} />
        <button className="dugme obrub malo" style={{ height: 'auto' }} onClick={prepoznaj}>Ponovo prepoznaj sve dijelove</button>
      </div>
      {poruka && <div className={poruka.ok ? 'uspjeh' : 'greska'}>{poruka.t}</div>}
      <div className="tabela-omot">
        <table className="tabela">
          <thead><tr><th>Tip</th><th className="sakrij-mob">Grupa</th><th>Težina</th><th>Dijelova</th><th></th></tr></thead>
          <tbody>
            {lista.map((t) => (
              <tr key={t.id}>
                <td><b>{t.naziv}</b><div className="tiho malo">{(t.kljucne || []).join(', ')}</div></td>
                <td className="malo sakrij-mob">{t.kategorija || "—"}</td>
                <td style={{ whiteSpace: 'nowrap' }}><b>{Number(t.tezina_kg)} kg</b></td>
                <td>{t.dijelova}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="dugme obrub malo" onClick={() => setUredi({ ...t, kategorija_id: t.kategorija_id || '', kljucne: (t.kljucne || []).join(', ') })}>Uredi</button>{' '}
                  <button className="dugme opasno malo" onClick={() => obrisi(t)}>×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {uredi && (
        <Modal naslov={uredi.id ? 'Uredi tip' : 'Novi tip dijela'} onZatvori={() => setUredi(null)}>
          <form onSubmit={snimi}>
            <label className="oznaka">Naziv tipa</label>
            <input className="unos" value={uredi.naziv} onChange={(e) => setUredi({ ...uredi, naziv: e.target.value })} required placeholder="npr. Letva volana" />
            <div className="red-polja">
              <div><label className="oznaka">Težina (kg)</label>
                <input className="unos" inputMode="decimal" value={uredi.tezina_kg} onChange={(e) => setUredi({ ...uredi, tezina_kg: e.target.value })} required /></div>
              <div><label className="oznaka">Grupa</label>
                <select className="unos" value={uredi.kategorija_id} onChange={(e) => setUredi({ ...uredi, kategorija_id: e.target.value })}>
                  <option value="">—</option>
                  {kategorije.map((k) => <option key={k.id} value={k.id}>{k.naziv}</option>)}
                </select></div>
            </div>
            <label className="oznaka">Ključne riječi, odvojene zarezom (bez kvačica)</label>
            <input className="unos" value={uredi.kljucne} onChange={(e) => setUredi({ ...uredi, kljucne: e.target.value })} placeholder="npr. letva, volanska letva" />
            <div className="tiho malo">Dio dobije ovaj tip ako mu naziv sadrži riječ koja počinje ovako. Duža riječ ima prednost.</div>
            <button className="dugme puno" style={{ marginTop: 14 }}>Snimi</button>
          </form>
        </Modal>
      )}
    </div>
  );
}
