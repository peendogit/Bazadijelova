// Dugme i baner "Instaliraj aplikaciju" (Android: pravi prozor za instalaciju; iPhone: uputstvo)
import { useState } from 'react';
import { useApp } from '../store.jsx';
import { Modal } from './Zajednicko.jsx';
import { LogoZnak } from './Ikone.jsx';

function citaj() { try { return localStorage.getItem('bd_instal_sakrij') === '1'; } catch { return false; } }
function sakrij() { try { localStorage.setItem('bd_instal_sakrij', '1'); } catch { /* */ } }

export function useInstalacija() {
  const { instalacija, setInstalacija, instalirana, iphone, obavijest } = useApp();
  const [uputstvo, setUputstvo] = useState(false);
  const moze = !instalirana && (!!instalacija || iphone);
  async function instaliraj() {
    if (instalacija) {
      instalacija.prompt();
      const r = await instalacija.userChoice.catch(() => null);
      if (r?.outcome === 'accepted') obavijest('Aplikacija je instalirana');
      setInstalacija(null);
    } else if (iphone) setUputstvo(true);
  }
  const prozor = uputstvo && (
    <Modal naslov="Instaliraj na iPhone" onZatvori={() => setUputstvo(false)}>
      <ol className="koraci" style={{ marginTop: 10 }}>
        <li>Otvorite sajt u <b>Safariju</b>.</li>
        <li>Dodirnite dugme <b>Dijeli</b> <span aria-hidden="true">(kvadrat sa strelicom ⬆)</span> na dnu ekrana.</li>
        <li>Izaberite <b>Dodaj na početni ekran</b> (Add to Home Screen).</li>
        <li>Dodirnite <b>Dodaj</b>. Ikonica se pojavi među aplikacijama.</li>
      </ol>
      <button className="dugme puno" style={{ marginTop: 14 }} onClick={() => setUputstvo(false)}>Razumijem</button>
    </Modal>
  );
  return { moze, instaliraj, prozor };
}

// Stavka u meniju
export function InstalirajStavka({ onKlik }) {
  const { moze, instaliraj, prozor } = useInstalacija();
  const { instalacija } = useApp();
  const iphoneBez = !instalacija; // na iPhoneu meni ostaje otvoren dok se čita uputstvo
  if (!moze && !prozor) return null;
  return (
    <>
      {moze && (
        <button className="stavka-instal" onClick={() => { instaliraj(); if (!iphoneBez) onKlik?.(); }}>
          <LogoZnak width="20" height="20" />Instaliraj aplikaciju
        </button>
      )}
      {prozor}
    </>
  );
}

// Baner na početnoj (može se sakriti)
export function InstalirajBaner() {
  const { moze, instaliraj, prozor } = useInstalacija();
  const [skriven, setSkriven] = useState(citaj);
  if ((!moze || skriven) && !prozor) return null;
  return (
    <>
      {moze && !skriven && (
        <div className="instal-baner kartica">
          <LogoZnak className="instal-ikona" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <b>Aplikacija na telefonu</b>
            <div className="tiho malo">Brže otvaranje, ikonica na početnom ekranu.</div>
          </div>
          <button className="dugme malo" onClick={instaliraj}>Instaliraj</button>
          <button className="ikona-dugme malo-x" aria-label="Sakrij" onClick={() => { sakrij(); setSkriven(true); }}>×</button>
        </div>
      )}
      {prozor}
    </>
  );
}
