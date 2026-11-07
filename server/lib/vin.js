// Dekoder broja šasije (VIN, 17 znakova).
// - WMI (prva 3 znaka) → proizvođač
// - 10. znak → godina modela
// - VW/Audi/Škoda/Seat: 7. i 8. znak su tvornički kod modela (1K, 8P, 1Z...) → tačna generacija

const WMI = {
  WVW: 'Volkswagen', WVG: 'Volkswagen', WV1: 'Volkswagen', WV2: 'Volkswagen', '3VW': 'Volkswagen', '9BW': 'Volkswagen',
  WAU: 'Audi', WUA: 'Audi', TRU: 'Audi', WA1: 'Audi',
  TMB: 'Škoda', VSS: 'Seat', VS6: 'Seat',
  WBA: 'BMW', WBS: 'BMW', WBX: 'BMW', WBY: 'BMW', '4US': 'BMW', '5UX': 'BMW',
  WDB: 'Mercedes-Benz', WDD: 'Mercedes-Benz', WDC: 'Mercedes-Benz', WDF: 'Mercedes-Benz', W1K: 'Mercedes-Benz', W1N: 'Mercedes-Benz', W1V: 'Mercedes-Benz', WMX: 'Mercedes-Benz',
  W0L: 'Opel', W0V: 'Opel', VXK: 'Opel',
  VF1: 'Renault', VF6: 'Renault', UU1: 'Renault',
  VF3: 'Peugeot', VR3: 'Peugeot',
  VF7: 'Citroën', VR7: 'Citroën',
  ZFA: 'Fiat', ZFB: 'Fiat', ZFC: 'Fiat',
  WF0: 'Ford', WF1: 'Ford', '1FA': 'Ford', '1FM': 'Ford', '3FA': 'Ford',
  JTD: 'Toyota', JTE: 'Toyota', JTN: 'Toyota', JTM: 'Toyota', SB1: 'Toyota', NMT: 'Toyota', VNK: 'Toyota', 'TMA': 'Toyota',
};

const VAG = new Set(['Volkswagen', 'Audi', 'Škoda', 'Seat']);

// 10. znak VIN-a; ciklus se ponavlja svakih 30 godina
const GOD = 'ABCDEFGHJKLMNPRSTVWXY123456789';

// Vraća moguće godine (npr. "T" = 1996 ili 2026), najnovija zadnja
function godineIzZnaka(z) {
  const i = GOD.indexOf(z);
  if (i < 0) return [];
  const ove = new Date().getFullYear() + 1;
  return [1980 + i, 2010 + i].filter((g) => g <= ove);
}

export function dekodirajVin(ulaz) {
  const vin = String(ulaz || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (vin.length !== 17) return { greska: 'Broj šasije mora imati tačno 17 znakova.' };
  if (/[IOQ]/.test(vin)) return { greska: 'Broj šasije ne može sadržavati slova I, O ni Q. Provjerite unos.' };

  const marka = WMI[vin.slice(0, 3)] || WMI[vin.slice(0, 2) + '1'] || null;
  const godine = godineIzZnaka(vin[9]);
  const kod = marka && VAG.has(marka) ? vin.slice(6, 8) : null;
  return { vin, marka, godine, godina: godine[godine.length - 1] || null, kod };
}
