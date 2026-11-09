# bazadijelova.com

Tržište polovnih auto dijelova iz više otpada (BiH i region). Raspored po uzoru na velike evropske platforme: marka → model → generacija, sa oznakom šta ima na stanju.

**Stack:** Node.js + Express + PostgreSQL (backend), React + Vite (frontend), JWT prijava, PM2, Nginx. Port **3004**.

## Funkcije

- **Marka → model → generacija → grupa dijelova**, plavo „ima na stanju”, crveno „nema”.
- **Pretraga po OEM broju** (s razmacima i bez njih) i nazivu, filteri po stanju, cijeni i grupi. Na dijelu piše „isti OEM kod drugih otpada”.
- **Ocjena stanja** (Novo / Odlično / Dobro / Oštećeno), kilometraža vozila, dio bez cijene = „cijena na upit”.
- **Otpad uz svaki dio:** grad, adresa, telefon, mapa, cijena dostave, lično preuzimanje, **ocjene kupaca**.
- **Upit otpadu** i **narudžba iz korpe** (dijeli se po otpadu, dio se odmah rezerviše).
- **Tražim dio:** kupac objavi šta traži, otpadi šalju ponude, kupac ih vidi na svom linku.
- **Telegram obavještenja** otpadima za narudžbe, upite i zahtjeve; adminu za nove otpade.
- **Uvoz zaliha:** CSV iz Excela, API (`POST /api/uvoz`), ili **automatsko povezivanje s Delić programom** (`/shop-api`, svakih 15 min).
- **Paketi:** besplatno do 100 dijelova, Pro bez ograničenja + izdvojeni oglasi na vrhu pretrage. Admin uključuje Pro ručno.
- **Srbija:** na bazadelova.com sav tekst ide u ekavicu, cijene u dinarima (kurs `KURS_RSD_EUR`).
- **SEO:** svaka stranica ima svoj naslov, opis i Google podatke o proizvodu; `sitemap.xml` i `robots.txt` za oba domena.

## Telegram bot

1. U Telegramu otvori **@BotFather**, pošalji `/newbot`, daj ime (npr. „Baza dijelova”) i korisničko ime (npr. `bazadijelova_bot`).
2. Token i korisničko ime upiši u `server/.env`: `TELEGRAM_BOT_TOKEN=...` i `TELEGRAM_BOT_IME=bazadijelova_bot`.
3. `pm2 restart bazadijelova`, pa botu pošalji `/id` i dobijeni broj upiši u `TELEGRAM_ADMIN_CHAT_ID`.
4. Otpadi se povezuju sami: Panel → Profil i dostava → „Poveži Telegram”.

Napravi **novi** bot, ne koristi onaj od webshopa: jedan bot može slušati samo jedan program.

## Povezivanje Delić programa

Panel otpada → Uvoz zaliha → „Poveži svoj program”. Adresa: ako je program na istom serveru, `http://localhost:3020`. Ključ: `SHOP_API_KEY` iz `.env` Delić programa.

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
- Demo nalozi (samo uz `seed:demo`): `kupac@demo.ba`, `admin@demo.ba`, `auto-otpad-delic@demo.ba`… lozinka `demo1234`.
- **Brza demo prijava:** u `server/.env` stavi `DEMO_PRIJAVA=1` pa `pm2 restart bazadijelova`. Na stranici za prijavu i u meniju pojave se dugmad za prebacivanje između demo naloga bez lozinke. **Prije puštanja kupcima stavi `DEMO_PRIJAVA=0`**, inače svako može ući kao demo admin.

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
server/   index.js, routes/ (javno, auth, kupac, otpad, admin, api-uvoz), lib/ (uvoz, auth), db/ (schema.sql, seed.js, katalog)
client/   src/pages (Pocetna, Marka, Generacija, Dijelovi, Dio, Korpa, Panel, Admin...), src/components
```
