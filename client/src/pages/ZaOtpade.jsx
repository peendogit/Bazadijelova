import { Link } from 'react-router-dom';
import { useApp } from '../store.jsx';
import { Mrvice } from '../components/Zajednicko.jsx';

export default function ZaOtpade() {
  const { postavke, korisnik } = useApp();
  const p = postavke.paketi || { besplatno_limit: 100, pro_izdvojeni: 10, izdvojeno_dana: 7, pro_cijena: 'po dogovoru' };
  const cilj = korisnik?.uloga === 'otpad' ? '/panel' : '/registracija?tip=otpad';
  return (
    <>
      <div className="traka"><Mrvice stavke={[['Početna', '/'], ['Za otpade']]} /></div>
      <div className="kartica heroj">
        <h1>Prodajte dijelove svog otpada online</h1>
        <p>Kupci iz cijele zemlje traže dijelove na jednom mjestu. Vi primate narudžbe, upite i zahtjeve kupaca direktno na Telegram.</p>
        <Link to={cilj} className="dugme narandzasto">{korisnik?.uloga === 'otpad' ? 'Otvori panel' : 'Registruj otpad besplatno'}</Link>
      </div>

      <div className="mreza-paketa odjeljak">
        <div className="kartica kartica-tijelo paket">
          <h2>Besplatno</h2>
          <div className="paket-cijena">0 KM</div>
          <ul>
            <li>Do <b>{p.besplatno_limit}</b> dijelova u prodaji</li>
            <li>Narudžbe, upiti i zahtjevi kupaca</li>
            <li>Obavještenja na Telegram</li>
            <li>Uvoz iz Excela (CSV)</li>
            <li>Ocjene kupaca</li>
          </ul>
        </div>
        <div className="kartica kartica-tijelo paket istaknut">
          <h2>Pro</h2>
          <div className="paket-cijena">{p.pro_cijena}</div>
          <ul>
            <li><b>Neograničen</b> broj dijelova</li>
            <li>Automatsko povezivanje s vašim programom za dijelove</li>
            <li>Do <b>{p.pro_izdvojeni}</b> izdvojenih oglasa na vrhu pretrage ({p.izdvojeno_dana} dana)</li>
            <li>Sve iz besplatnog paketa</li>
          </ul>
          <div className="tiho malo">Pro se uključuje nakon uplate. Javite se administratoru preko panela ili telefona.</div>
        </div>
      </div>

      <div className="kartica kartica-tijelo odjeljak">
        <h2>Kako počinje</h2>
        <ol className="koraci">
          <li><b>Registrujte otpad.</b> Unesite naziv, grad i kontakt.</li>
          <li><b>Unesite dijelove.</b> Ručno, iz Excela ili automatski iz vašeg programa.</li>
          <li><b>Povežite Telegram.</b> Svaka narudžba i upit stižu vam odmah na telefon.</li>
          <li><b>Odgovarajte na „Tražim dio”.</b> Kupci objavljuju šta traže, a vi šaljete ponudu.</li>
        </ol>
      </div>
    </>
  );
}
