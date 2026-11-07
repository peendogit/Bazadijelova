import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { Ucitavanje } from '../components/Zajednicko.jsx';

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
    </>
  );
}
