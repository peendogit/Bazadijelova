import { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation, Link } from 'react-router-dom';
import { useApp } from './store.jsx';
import Zaglavlje from './components/Zaglavlje.jsx';
import Pocetna from './pages/Pocetna.jsx';
import Marke from './pages/Marke.jsx';
import Marka from './pages/Marka.jsx';
import Generacija from './pages/Generacija.jsx';
import Dijelovi from './pages/Dijelovi.jsx';
import Dio from './pages/Dio.jsx';
import { Otpadi, Otpad } from './pages/Otpadi.jsx';
import Korpa from './pages/Korpa.jsx';
import Sacuvano from './pages/Sacuvano.jsx';
import { Prijava, Registracija } from './pages/Prijava.jsx';
import MojNalog from './pages/MojNalog.jsx';
import Panel from './pages/Panel.jsx';
import Admin from './pages/Admin.jsx';
import { Trazim, Zahtjev } from './pages/Trazim.jsx';
import Ocjena from './pages/Ocjena.jsx';
import ZaOtpade from './pages/ZaOtpade.jsx';
import { SRBIJA } from './api.js';

function Zasticeno({ uloge, children }) {
  const { korisnik, ucitan } = useApp();
  const loc = useLocation();
  if (!ucitan) return null;
  if (!korisnik) return <Navigate to={`/prijava?nazad=${encodeURIComponent(loc.pathname)}`} replace />;
  if (uloge && !uloge.includes(korisnik.uloga)) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const { poruka } = useApp();
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);

  return (
    <>
      <Zaglavlje />
      <main className="sadrzaj">
        <Routes>
          <Route path="/" element={<Pocetna />} />
          <Route path="/marke" element={<Marke />} />
          <Route path="/marka/:slug" element={<Marka />} />
          <Route path="/generacija/:id" element={<Generacija />} />
          <Route path="/dijelovi" element={<Dijelovi />} />
          <Route path="/dio/:id" element={<Dio />} />
          <Route path="/otpadi" element={<Otpadi />} />
          <Route path="/otpad/:slug" element={<Otpad />} />
          <Route path="/korpa" element={<Korpa />} />
          <Route path="/sacuvano" element={<Sacuvano />} />
          <Route path="/trazim" element={<Trazim />} />
          <Route path="/zahtjev/:token" element={<Zahtjev />} />
          <Route path="/ocjena/:token" element={<Ocjena />} />
          <Route path="/za-otpade" element={<ZaOtpade />} />
          <Route path="/prijava" element={<Prijava />} />
          <Route path="/registracija" element={<Registracija />} />
          <Route path="/moj-nalog" element={<Zasticeno><MojNalog /></Zasticeno>} />
          <Route path="/panel/*" element={<Zasticeno uloge={['otpad']}><Panel /></Zasticeno>} />
          <Route path="/admin" element={<Zasticeno uloge={['admin']}><Admin /></Zasticeno>} />
          <Route path="*" element={<div className="kartica kartica-tijelo prazno-stanje"><h2>Stranica ne postoji</h2><Link to="/">Na početnu</Link></div>} />
        </Routes>
      </main>
      <footer className="podnozje">
        <div><Link to="/otpadi">Otpadi</Link><Link to="/trazim">Tražim dio</Link><Link to="/za-otpade">Prodajete dijelove?</Link></div>
        <div style={{ marginTop: 6 }}>
          © {new Date().getFullYear()} {SRBIJA ? <>bazadelova.com · <a href="https://bazadijelova.com">BiH</a></> : <>bazadijelova.com · <a href="https://bazadelova.com">Srbija</a></>}
        </div>
      </footer>
      {poruka && <div className="obavijest">{poruka}</div>}
    </>
  );
}
