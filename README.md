# bazadijelova.com

Tržište polovnih auto dijelova iz više otpada (BiH i region). Raspored po uzoru na velike evropske platforme: marka → model → generacija, sa oznakom šta ima na stanju.

**Stack:** Node.js + Express + PostgreSQL (backend), React + Vite (frontend), JWT prijava, PM2, Nginx. Port **3004**.

## Funkcije

- **Pretraga po broju šasije (VIN):** prepoznaje marku i godište, a za VW, Audi, Škodu i Seat i tačnu generaciju (iz 7. i 8. znaka).
- **Pretraga po tablicama:** tablica se jednom poveže s brojem šasije i pamti se u telefonu kupca. U BiH nema javne baze tablica, pa je ovo jedini pouzdan način.
- **Marka → model → generacija → grupa dijelova**, plavo „ima na stanju”, crveno „nema”.
- **Pretraga po OEM broju** (radi s razmacima i bez njih) i nazivu, filteri po stanju, cijeni i grupi. Na stranici dijela prikazuje se isti OEM kod drugih otpada.
- **Ocjena stanja** (Novo / Odlično / Dobro / Oštećeno) i kilometraža vozila donora.
- **Otpad uz svaki dio:** grad, adresa, telefon, mapa, cijena dostave, lično preuzimanje.
- **Upit otpadu** i **narudžba iz korpe**. Korpa se dijeli po otpadu, naručeni dio se odmah rezerviše, a otpad potvrđuje, šalje ili otkazuje.
- **Uvoz zaliha:** CSV iz Excela u panelu otpada, ili automatski preko API-ja (`POST /api/uvoz` sa `X-Api-Key`).
- Cijene u **KM / EUR** (kurs 1,95583), uloge **kupac / otpad / admin**, admin odobrava nove otpade.

## Instalacija na serveru (Termius)

Vidi komande u razgovoru s Claudeom ili:

```bash
cd /var/www && git clone https://github.com/peendogit/bazadijelova.git && cd bazadijelova
cp server/.env.example server/.env && nano server/.env
cd server && npm install --omit=dev && npm run seed && cd ..
bash deploy.sh --force
```

### Automatski deploy

```bash
crontab -e
# dodaj red:
*/5 * * * * cd /var/www/bazadijelova && bash deploy.sh >> /var/log/bazadijelova-deploy.log 2>&1
```

Svakih 5 minuta provjerava GitHub i, ako ima novog koda, gradi i restartuje aplikaciju.

## Nalozi

- **Admin:** email i lozinka iz `server/.env` (`ADMIN_EMAIL`, `ADMIN_LOZINKA`).
- **Otpadi** se registruju sami na `/registracija?tip=otpad`, a admin ih odobrava u `/admin`.
- Demo nalozi (samo uz `seed:demo`): `auto-otpad-delic@demo.ba`, lozinka `demo1234`.

## Uvoz iz drugog programa (API)

```
POST https://bazadijelova.com/api/uvoz
X-Api-Key: <ključ iz Panel → Uvoz zaliha>
Content-Type: application/json

{ "potpuno": true,
  "dijelovi": [ { "sifra": "1001", "naziv": "Far lijevi", "oem": "1K6941005",
                  "marka": "Volkswagen", "model": "Golf", "godiste": 2007,
                  "kategorija": "svjetla", "stanje": "A", "km": 185000,
                  "cijena": 150, "kolicina": 1, "slike": ["https://..."] } ] }
```

Dijelovi se uparuju po `sifra`. Uz `"potpuno": true`, sve čega nema u listi označava se kao prodano.

## Struktura

```
server/   index.js, routes/ (javno, auth, kupac, otpad, admin, api-uvoz), lib/ (vin, uvoz, auth), db/ (schema.sql, seed.js, katalog)
client/   src/pages (Pocetna, Marka, Generacija, Dijelovi, Dio, Korpa, Panel, Admin...), src/components
```
