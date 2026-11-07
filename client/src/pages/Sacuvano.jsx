import { Link } from 'react-router-dom';
import { useApp } from '../store.jsx';
import { DioKartica, Mrvice, Prazno } from '../components/Zajednicko.jsx';

export default function Sacuvano() {
  const { sacuvano } = useApp();
  return (
    <>
      <div className="traka"><Mrvice stavke={[['Početna', '/'], ['Sačuvano']]} /></div>
      {sacuvano.length ? (
        <div className="mreza-dijelova">{sacuvano.map((d) => <DioKartica key={d.id} d={{ ...d, slika: d.slika }} />)}</div>
      ) : (
        <div className="kartica"><Prazno><p>Nemate sačuvanih dijelova. Dodirnite zastavicu na dijelu da ga sačuvate.</p><Link to="/dijelovi" className="dugme">Pretraži dijelove</Link></Prazno></div>
      )}
    </>
  );
}
