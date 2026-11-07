// Početni katalog: marke → modeli → generacije (sa tvorničkim kodom za VIN) + kategorije dijelova.
// Format generacije: [naziv, kod, od, do]

export const KATALOG = {
  'Volkswagen': {
    'Golf': [['Golf IV', '1J', 1997, 2003], ['Golf V', '1K', 2003, 2008], ['Golf VI', '1K', 2008, 2012], ['Golf VII', 'AU', 2012, 2019], ['Golf VIII', 'CD', 2019, 2026]],
    'Passat': [['Passat B5', '3B', 1996, 2005], ['Passat B6', '3C', 2005, 2010], ['Passat B7', '3C', 2010, 2014], ['Passat B8', '3G', 2014, 2024]],
    'Polo': [['Polo 9N', '9N', 2001, 2009], ['Polo 6R', '6R', 2009, 2017], ['Polo AW', 'AW', 2017, 2026]],
    'Touran': [['Touran 1T', '1T', 2003, 2015], ['Touran 5T', '5T', 2015, 2026]],
    'Caddy': [['Caddy 2K', '2K', 2003, 2020], ['Caddy SB', 'SB', 2020, 2026]],
    'Tiguan': [['Tiguan 5N', '5N', 2007, 2016], ['Tiguan AD', 'AD', 2016, 2024]],
  },
  'Audi': {
    'Audi A3, S3': [['A3/S3 8L', '8L', 1996, 2003], ['A3/S3 8P', '8P', 2003, 2013], ['A3/S3 8V', '8V', 2012, 2020], ['A3/S3 8Y', '8Y', 2020, 2026]],
    'Audi A4, S4': [['A4 B5', '8D', 1994, 2001], ['A4 B6', '8E', 2000, 2004], ['A4 B7', '8E', 2004, 2008], ['A4 B8', '8K', 2007, 2015], ['A4 B9', '8W', 2015, 2026]],
    'Audi A6, S6': [['A6 C5', '4B', 1997, 2004], ['A6 C6', '4F', 2004, 2011], ['A6 C7', '4G', 2011, 2018], ['A6 C8', '4A', 2018, 2026]],
    'Audi A6 Allroad': [['A6 Allroad 4B', '4B', 2001, 2005], ['A6 Allroad 4F', '4F', 2006, 2011], ['A6 Allroad 4G', '4G', 2012, 2018]],
    'Audi Q5': [['Q5 8R', '8R', 2008, 2017], ['Q5 FY', 'FY', 2017, 2026]],
    'Audi Q7': [['Q7 4L', '4L', 2006, 2015], ['Q7 4M', '4M', 2015, 2026]],
  },
  'Škoda': {
    'Octavia': [['Octavia I 1U', '1U', 1996, 2010], ['Octavia II 1Z', '1Z', 2004, 2013], ['Octavia III 5E', '5E', 2012, 2020], ['Octavia IV NX', 'NX', 2020, 2026]],
    'Fabia': [['Fabia I 6Y', '6Y', 1999, 2007], ['Fabia II 5J', '5J', 2007, 2014], ['Fabia III NJ', 'NJ', 2014, 2021]],
    'Superb': [['Superb I 3U', '3U', 2001, 2008], ['Superb II 3T', '3T', 2008, 2015], ['Superb III 3V', '3V', 2015, 2026]],
  },
  'Seat': {
    'Leon': [['Leon 1M', '1M', 1999, 2005], ['Leon 1P', '1P', 2005, 2012], ['Leon 5F', '5F', 2012, 2020]],
    'Ibiza': [['Ibiza 6L', '6L', 2002, 2008], ['Ibiza 6J', '6J', 2008, 2017], ['Ibiza KJ', 'KJ', 2017, 2026]],
  },
  'BMW': {
    'Serija 3': [['E46', 'E46', 1998, 2006], ['E90/E91', 'E90', 2005, 2012], ['F30/F31', 'F30', 2012, 2019], ['G20', 'G20', 2019, 2026]],
    'Serija 5': [['E39', 'E39', 1995, 2004], ['E60/E61', 'E60', 2003, 2010], ['F10/F11', 'F10', 2010, 2017], ['G30', 'G30', 2017, 2024]],
    'X5': [['E53', 'E53', 1999, 2006], ['E70', 'E70', 2006, 2013], ['F15', 'F15', 2013, 2018]],
  },
  'Mercedes-Benz': {
    'C-klasa': [['W203', 'W203', 2000, 2007], ['W204', 'W204', 2007, 2014], ['W205', 'W205', 2014, 2021]],
    'E-klasa': [['W210', 'W210', 1995, 2003], ['W211', 'W211', 2002, 2009], ['W212', 'W212', 2009, 2016], ['W213', 'W213', 2016, 2023]],
    'A-klasa': [['W168', 'W168', 1997, 2004], ['W169', 'W169', 2004, 2012], ['W176', 'W176', 2012, 2018]],
    'Sprinter': [['Sprinter 901-905', '903', 1995, 2006], ['Sprinter 906', '906', 2006, 2018]],
  },
  'Opel': {
    'Astra': [['Astra G', 'G', 1998, 2004], ['Astra H', 'H', 2004, 2010], ['Astra J', 'J', 2009, 2015], ['Astra K', 'K', 2015, 2021]],
    'Corsa': [['Corsa C', 'C', 2000, 2006], ['Corsa D', 'D', 2006, 2014], ['Corsa E', 'E', 2014, 2019]],
    'Insignia': [['Insignia A', 'A', 2008, 2017], ['Insignia B', 'B', 2017, 2022]],
    'Zafira': [['Zafira A', 'A', 1999, 2005], ['Zafira B', 'B', 2005, 2014]],
  },
  'Renault': {
    'Clio': [['Clio II', 'II', 1998, 2005], ['Clio III', 'III', 2005, 2012], ['Clio IV', 'IV', 2012, 2019]],
    'Megane': [['Megane II', 'II', 2002, 2008], ['Megane III', 'III', 2008, 2016], ['Megane IV', 'IV', 2016, 2024]],
    'Scenic': [['Scenic II', 'II', 2003, 2009], ['Scenic III', 'III', 2009, 2016]],
  },
  'Peugeot': {
    '206 / 207 / 208': [['206', '206', 1998, 2012], ['207', '207', 2006, 2014], ['208', '208', 2012, 2019]],
    '307 / 308': [['307', '307', 2001, 2008], ['308 I', 'T7', 2007, 2013], ['308 II', 'T9', 2013, 2021]],
    '407 / 508': [['407', '407', 2004, 2011], ['508', '508', 2010, 2018]],
  },
  'Citroën': {
    'C3': [['C3 I', 'C3I', 2002, 2009], ['C3 II', 'C3II', 2009, 2016]],
    'C4': [['C4 I', 'C4I', 2004, 2010], ['C4 II', 'C4II', 2010, 2018]],
    'Berlingo': [['Berlingo I', 'M', 1996, 2008], ['Berlingo II', 'B9', 2008, 2018]],
  },
  'Fiat': {
    'Punto': [['Punto II', '188', 1999, 2010], ['Grande Punto', '199', 2005, 2018]],
    'Doblo': [['Doblo I', '119', 2000, 2010], ['Doblo II', '263', 2010, 2022]],
    'Stilo / Bravo': [['Stilo', '192', 2001, 2008], ['Bravo II', '198', 2007, 2014]],
  },
  'Ford': {
    'Focus': [['Focus I', 'MK1', 1998, 2004], ['Focus II', 'MK2', 2004, 2011], ['Focus III', 'MK3', 2011, 2018]],
    'Fiesta': [['Fiesta V', 'MK5', 2001, 2008], ['Fiesta VI', 'MK6', 2008, 2017]],
    'Mondeo': [['Mondeo III', 'MK3', 2000, 2007], ['Mondeo IV', 'MK4', 2007, 2014]],
  },
  'Toyota': {
    'Corolla': [['Corolla E12', 'E12', 2002, 2007], ['Corolla E15', 'E15', 2006, 2013]],
    'Yaris': [['Yaris XP10', 'XP10', 1999, 2005], ['Yaris XP90', 'XP90', 2005, 2011]],
    'RAV4': [['RAV4 XA20', 'XA20', 2000, 2005], ['RAV4 XA30', 'XA30', 2005, 2012]],
  },
};

export const KATEGORIJE = [
  ['Motor i dijelovi motora', 'motor', '⚙️'],
  ['Mjenjač i prenos', 'mjenjac', '🔩'],
  ['Karoserija', 'karoserija', '🚗'],
  ['Svjetla', 'svjetla', '💡'],
  ['Unutrašnjost', 'unutrasnjost', '💺'],
  ['Elektrika i elektronika', 'elektrika', '🔌'],
  ['Ovjes i upravljanje', 'ovjes', '🛞'],
  ['Kočnice', 'kocnice', '🛑'],
  ['Hlađenje i klima', 'hladjenje', '❄️'],
  ['Izduvni sistem', 'izduv', '💨'],
  ['Gorivo i ubrizgavanje', 'gorivo', '⛽'],
  ['Felge i gume', 'felge', '⭕'],
  ['Stakla i retrovizori', 'stakla', '🪟'],
  ['Ostalo', 'ostalo', '📦'],
];

// Primjeri naziva dijelova po kategoriji (za demo podatke)
export const DEMO_DIJELOVI = {
  motor: ['Motor komplet', 'Glava motora', 'Turbina', 'Alternator', 'Elektropokretač', 'Usisna grana'],
  mjenjac: ['Mjenjač manuelni', 'Mjenjač automatski', 'Poluosovina lijeva', 'Poluosovina desna', 'Kvačilo komplet'],
  karoserija: ['Hauba', 'Prednji branik', 'Zadnji branik', 'Vrata prednja lijeva', 'Vrata prednja desna', 'Blatobran lijevi', 'Gepek vrata'],
  svjetla: ['Far lijevi', 'Far desni', 'Štop svjetlo lijevo', 'Štop svjetlo desno', 'Magljenka'],
  unutrasnjost: ['Instrument tabla', 'Volan', 'Sjedište vozača', 'Komande klime', 'Tepisi set'],
  elektrika: ['Kompjuter motora (ECU)', 'Komfor modul', 'Radio / navigacija', 'Prekidač žmigavaca', 'Instrumenti (kilometar sat)'],
  ovjes: ['Amortizer prednji', 'Vilica donja', 'Letva volana', 'Glavčina sa ležajem'],
  kocnice: ['Kliješta kočiona', 'ABS pumpa', 'Servo kočnica', 'Disk prednji'],
  hladjenje: ['Hladnjak vode', 'Hladnjak klime', 'Kompresor klime', 'Ventilator hladnjaka'],
  izduv: ['DPF filter', 'Katalizator', 'Lonac zadnji', 'EGR ventil'],
  gorivo: ['Pumpa visokog pritiska', 'Brizgaljka', 'Rezervoar goriva', 'Pumpa goriva'],
  felge: ['Alu felge 16" set', 'Alu felge 17" set', 'Rezervni točak'],
  stakla: ['Retrovizor lijevi', 'Retrovizor desni', 'Šoferšajbna', 'Podizač stakla'],
  ostalo: ['Kuka za vuču', 'Krovni nosači'],
};
