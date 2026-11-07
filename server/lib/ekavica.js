// Prevod ijekavice u ekavicu za srpsko tržište (bazadelova.com).
// Ista lista postoji i u client/src/ekavica.js — kad dodaješ riječ, dodaj je na oba mjesta.

export const RIJECI = [
  // dijelovi
  ['dijelovi', 'delovi'], ['dijelova', 'delova'], ['dijelove', 'delove'], ['dijelovima', 'delovima'], ['dijela', 'dela'],
  ['dijelu', 'delu'], ['dio', 'deo'], ['bazadijelova', 'bazadelova'],
  // cijena
  ['cijena', 'cena'], ['cijene', 'cene'], ['cijenu', 'cenu'], ['cijeni', 'ceni'], ['cijenom', 'cenom'], ['cijenama', 'cenama'],
  // strane
  ['lijevi', 'levi'], ['lijeva', 'leva'], ['lijevo', 'levo'], ['lijevog', 'levog'], ['lijeve', 'leve'],
  // svjetla
  ['svjetla', 'svetla'], ['svjetlo', 'svetlo'], ['svjetlima', 'svetlima'],
  // mjesto, mjesec
  ['mjesto', 'mesto'], ['mjestu', 'mestu'], ['mjesta', 'mesta'], ['mjesec', 'mesec'], ['mjesečno', 'mesečno'], ['mjeseci', 'meseci'],
  ['mjenjač', 'menjač'], ['mjenjača', 'menjača'], ['mjenjaču', 'menjaču'],
  // ocjena
  ['ocjena', 'ocena'], ['ocjene', 'ocene'], ['ocjenu', 'ocenu'], ['ocjenom', 'ocenom'], ['ocijeni', 'oceni'], ['ocijenite', 'ocenite'],
  ['ocijenio', 'ocenio'],
  // ostalo
  ['vrijeme', 'vreme'], ['vremena', 'vremena'], ['prije', 'pre'], ['poslije', 'posle'], ['uvijek', 'uvek'], ['gdje', 'gde'],
  ['vidjeti', 'videti'], ['vidjet', 'videt'], ['sjedište', 'sedište'], ['sjedišta', 'sedišta'], ['sjedišta', 'sedišta'],
  ['riješeno', 'rešeno'], ['rješenje', 'rešenje'], ['bijeli', 'beli'], ['bijela', 'bela'], ['bijelo', 'belo'],
  ['nedjelja', 'nedelja'], ['nedjelju', 'nedelju'], ['djeluje', 'deluje'], ['vjetrobran', 'vetrobran'],
  ['savjet', 'savet'], ['savjeti', 'saveti'], ['primjer', 'primer'], ['primjera', 'primera'], ['primjeru', 'primeru'],
  ['mijenja', 'menja'], ['mijenjati', 'menjati'], ['promijeni', 'promeni'], ['promijenite', 'promenite'], ['izmjena', 'izmena'],
  ['izmijeni', 'izmeni'], ['snimljeno', 'snimljeno'], ['vrijedi', 'vredi'], ['vrijednost', 'vrednost'], ['zahtjev', 'zahtev'],
  ['zahtjevi', 'zahtevi'], ['zahtjeva', 'zahteva'], ['zahtjevu', 'zahtevu'], ['zahtjeve', 'zahteve'], ['uvjeti', 'uslovi'],
  ['pješke', 'peške'], ['sijalica', 'sijalica'], ['rijetko', 'retko'], ['cijelo', 'celo'], ['cijeli', 'celi'], ['cijelu', 'celu'],
  ['cijela', 'cela'], ['bilješka', 'beleška'], ['opisuje', 'opisuje'], ['dvije', 'dve'], ['vjerovatno', 'verovatno'],
  ['tjedan', 'nedelja'], ['mjeri', 'meri'], ['mjera', 'mera'], ['smjer', 'smer'], ['pretvori', 'pretvori'],
  ['označeno', 'označeno'], ['hljeb', 'hleb'], ['Bosne', 'Bosne'], ['sjever', 'sever'], ['zamijeni', 'zameni'],
  ['zamjena', 'zamena'], ['zvjezdica', 'zvezdica'], ['zvjezdice', 'zvezdice'], ['zvjezdicu', 'zvezdicu'],
];

const MAPA = new Map();
for (const [ije, e] of RIJECI) {
  if (ije === e) continue;
  MAPA.set(ije, e);
  MAPA.set(ije[0].toUpperCase() + ije.slice(1), e[0].toUpperCase() + e.slice(1));
  MAPA.set(ije.toUpperCase(), e.toUpperCase());
}
const RE = new RegExp(`(?<![\\p{L}])(${[...MAPA.keys()].sort((a, b) => b.length - a.length).join('|')})(?![\\p{L}])`, 'gu');

export function uEkavicu(tekst) {
  if (!tekst) return tekst;
  return String(tekst).replace(RE, (w) => MAPA.get(w) || w);
}
