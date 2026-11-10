-- bazadijelova.com — šema baze (PostgreSQL)
-- Pokreće se automatski pri startu servera (sve je IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS otpadi (
  id            SERIAL PRIMARY KEY,
  naziv         TEXT NOT NULL,
  slug          TEXT UNIQUE NOT NULL,
  grad          TEXT,
  adresa        TEXT,
  telefon       TEXT,
  email         TEXT,
  lat           NUMERIC(9,6),
  lng           NUMERIC(9,6),
  opis          TEXT,
  dostava_info  TEXT,
  dostava_cijena_km NUMERIC(10,2) DEFAULT 10,
  licno_preuzimanje BOOLEAN DEFAULT TRUE,
  odobren       BOOLEAN DEFAULT FALSE,
  api_kljuc     TEXT UNIQUE,
  kreiran       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS korisnici (
  id            SERIAL PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  lozinka_hash  TEXT NOT NULL,
  ime           TEXT,
  telefon       TEXT,
  uloga         TEXT NOT NULL DEFAULT 'kupac' CHECK (uloga IN ('kupac','otpad','admin')),
  otpad_id      INTEGER REFERENCES otpadi(id) ON DELETE SET NULL,
  kreiran       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS marke (
  id    SERIAL PRIMARY KEY,
  naziv TEXT NOT NULL,
  slug  TEXT UNIQUE NOT NULL
);

-- Model je grupa (npr. "Audi A3, S3"); generacija je konkretna serija (A3/S3 8P 2005-2013)
CREATE TABLE IF NOT EXISTS modeli (
  id       SERIAL PRIMARY KEY,
  marka_id INTEGER NOT NULL REFERENCES marke(id) ON DELETE CASCADE,
  naziv    TEXT NOT NULL,
  slug     TEXT NOT NULL,
  UNIQUE (marka_id, slug)
);

CREATE TABLE IF NOT EXISTS generacije (
  id        SERIAL PRIMARY KEY,
  model_id  INTEGER NOT NULL REFERENCES modeli(id) ON DELETE CASCADE,
  naziv     TEXT NOT NULL,
  kod       TEXT,            -- tvornička oznaka (8P, 1K, E90...), koristi se i za VIN
  od_god    INTEGER,
  do_god    INTEGER,
  slug      TEXT NOT NULL,
  UNIQUE (model_id, slug)
);

CREATE TABLE IF NOT EXISTS kategorije (
  id        SERIAL PRIMARY KEY,
  naziv     TEXT NOT NULL,
  slug      TEXT UNIQUE NOT NULL,
  ikona     TEXT,
  redoslijed INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS dijelovi (
  id            SERIAL PRIMARY KEY,
  otpad_id      INTEGER NOT NULL REFERENCES otpadi(id) ON DELETE CASCADE,
  vanjska_sifra TEXT,                -- šifra iz programa otpada (za uvoz)
  marka_id      INTEGER REFERENCES marke(id),
  generacija_id INTEGER REFERENCES generacije(id),
  kategorija_id INTEGER REFERENCES kategorije(id),
  naziv         TEXT NOT NULL,
  oem           TEXT,
  oem_norm      TEXT,                -- OEM bez razmaka/crtica, velika slova
  stanje        TEXT DEFAULT 'B' CHECK (stanje IN ('A','B','C','N')),  -- A odlično, B dobro, C oštećeno, N novo
  km            INTEGER,             -- kilometraža vozila donora
  godiste       INTEGER,
  motor         TEXT,
  gorivo        TEXT,
  vin_donora    TEXT,
  cijena_km     NUMERIC(10,2) NOT NULL DEFAULT 0,
  kolicina      INTEGER NOT NULL DEFAULT 1,
  status        TEXT NOT NULL DEFAULT 'aktivan' CHECK (status IN ('aktivan','rezervisan','prodan')),
  slike         TEXT[] DEFAULT '{}',
  opis          TEXT,
  kreiran       TIMESTAMPTZ DEFAULT NOW(),
  azuriran      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (otpad_id, vanjska_sifra)
);

CREATE INDEX IF NOT EXISTS idx_dijelovi_oem ON dijelovi(oem_norm);
CREATE INDEX IF NOT EXISTS idx_dijelovi_gen ON dijelovi(generacija_id, kategorija_id) WHERE status = 'aktivan';
CREATE INDEX IF NOT EXISTS idx_dijelovi_marka ON dijelovi(marka_id) WHERE status = 'aktivan';
CREATE INDEX IF NOT EXISTS idx_dijelovi_otpad ON dijelovi(otpad_id);

-- Pitanje kupca otpadu o dijelu
CREATE TABLE IF NOT EXISTS upiti (
  id          SERIAL PRIMARY KEY,
  otpad_id    INTEGER NOT NULL REFERENCES otpadi(id) ON DELETE CASCADE,
  dio_id      INTEGER REFERENCES dijelovi(id) ON DELETE SET NULL,
  korisnik_id INTEGER REFERENCES korisnici(id) ON DELETE SET NULL,
  ime         TEXT NOT NULL,
  telefon     TEXT,
  email       TEXT,
  poruka      TEXT NOT NULL,
  odgovor     TEXT,
  status      TEXT NOT NULL DEFAULT 'novi' CHECK (status IN ('novi','odgovoren','zatvoren')),
  kreiran     TIMESTAMPTZ DEFAULT NOW()
);

-- Narudžba iz korpe (jedna narudžba po otpadu)
CREATE TABLE IF NOT EXISTS narudzbe (
  id          SERIAL PRIMARY KEY,
  otpad_id    INTEGER NOT NULL REFERENCES otpadi(id) ON DELETE CASCADE,
  korisnik_id INTEGER REFERENCES korisnici(id) ON DELETE SET NULL,
  ime         TEXT NOT NULL,
  telefon     TEXT NOT NULL,
  email       TEXT,
  adresa      TEXT,
  grad        TEXT,
  nacin       TEXT NOT NULL DEFAULT 'dostava' CHECK (nacin IN ('dostava','licno')),
  napomena    TEXT,
  ukupno_km   NUMERIC(10,2) NOT NULL DEFAULT 0,
  dostava_km  NUMERIC(10,2) NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'nova' CHECK (status IN ('nova','potvrdjena','poslana','zavrsena','otkazana')),
  kreiran     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS narudzba_stavke (
  id          SERIAL PRIMARY KEY,
  narudzba_id INTEGER NOT NULL REFERENCES narudzbe(id) ON DELETE CASCADE,
  dio_id      INTEGER REFERENCES dijelovi(id) ON DELETE SET NULL,
  naziv       TEXT NOT NULL,
  oem         TEXT,
  cijena_km   NUMERIC(10,2) NOT NULL
);

-- Dnevnik uvoza zaliha
CREATE TABLE IF NOT EXISTS uvozi (
  id         SERIAL PRIMARY KEY,
  otpad_id   INTEGER NOT NULL REFERENCES otpadi(id) ON DELETE CASCADE,
  izvor      TEXT NOT NULL,        -- 'csv' ili 'api'
  novih      INTEGER DEFAULT 0,
  azuriranih INTEGER DEFAULT 0,
  prodanih   INTEGER DEFAULT 0,
  gresaka    INTEGER DEFAULT 0,
  greske     TEXT[] DEFAULT '{}',
  kreiran    TIMESTAMPTZ DEFAULT NOW()
);

-- ===== v2.1: povezivanje programa, Telegram, paketi, izdvajanje, ocjene, zahtjevi =====

ALTER TABLE otpadi ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT;
ALTER TABLE otpadi ADD COLUMN IF NOT EXISTS telegram_kod TEXT;
ALTER TABLE otpadi ADD COLUMN IF NOT EXISTS paket TEXT NOT NULL DEFAULT 'besplatno';
ALTER TABLE otpadi ADD COLUMN IF NOT EXISTS paket_do DATE;
ALTER TABLE otpadi ADD COLUMN IF NOT EXISTS izvor_url TEXT;        -- adresa programa otpada (shop-api)
ALTER TABLE otpadi ADD COLUMN IF NOT EXISTS izvor_kljuc TEXT;
ALTER TABLE otpadi ADD COLUMN IF NOT EXISTS izvor_zadnje TIMESTAMPTZ;
ALTER TABLE otpadi ADD COLUMN IF NOT EXISTS izvor_greska TEXT;

ALTER TABLE dijelovi ADD COLUMN IF NOT EXISTS izdvojen_do TIMESTAMPTZ;
ALTER TABLE narudzbe ADD COLUMN IF NOT EXISTS token TEXT;
ALTER TABLE korisnici ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT;

CREATE TABLE IF NOT EXISTS ocjene (
  id          SERIAL PRIMARY KEY,
  otpad_id    INTEGER NOT NULL REFERENCES otpadi(id) ON DELETE CASCADE,
  narudzba_id INTEGER UNIQUE REFERENCES narudzbe(id) ON DELETE SET NULL,
  ocjena      INTEGER NOT NULL CHECK (ocjena BETWEEN 1 AND 5),
  komentar    TEXT,
  ime         TEXT,
  kreiran     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ocjene_otpad ON ocjene(otpad_id);

-- "Tražim dio": kupac objavi šta mu treba, otpadi šalju ponude
CREATE TABLE IF NOT EXISTS zahtjevi (
  id            SERIAL PRIMARY KEY,
  token         TEXT UNIQUE NOT NULL,
  korisnik_id   INTEGER REFERENCES korisnici(id) ON DELETE SET NULL,
  ime           TEXT NOT NULL,
  telefon       TEXT,
  email         TEXT,
  naziv         TEXT NOT NULL,
  marka_id      INTEGER REFERENCES marke(id),
  generacija_id INTEGER REFERENCES generacije(id),
  godiste       INTEGER,
  motor         TEXT,
  oem           TEXT,
  opis          TEXT,
  grad          TEXT,
  status        TEXT NOT NULL DEFAULT 'otvoren' CHECK (status IN ('otvoren','zatvoren')),
  kreiran       TIMESTAMPTZ DEFAULT NOW(),
  istice        TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days'
);
CREATE INDEX IF NOT EXISTS idx_zahtjevi_status ON zahtjevi(status, kreiran DESC);

CREATE TABLE IF NOT EXISTS ponude (
  id          SERIAL PRIMARY KEY,
  zahtjev_id  INTEGER NOT NULL REFERENCES zahtjevi(id) ON DELETE CASCADE,
  otpad_id    INTEGER NOT NULL REFERENCES otpadi(id) ON DELETE CASCADE,
  dio_id      INTEGER REFERENCES dijelovi(id) ON DELETE SET NULL,
  cijena_km   NUMERIC(10,2),
  stanje      TEXT CHECK (stanje IN ('A','B','C','N')),
  poruka      TEXT,
  kreiran     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (zahtjev_id, otpad_id)
);

-- ===== v2.2: brza pošta i težine =====

-- Tipovi dijelova s fiksnom težinom (upravlja admin). Ključne riječi služe za automatsko prepoznavanje iz naziva.
CREATE TABLE IF NOT EXISTS tipovi_dijelova (
  id            SERIAL PRIMARY KEY,
  naziv         TEXT UNIQUE NOT NULL,
  kategorija_id INTEGER REFERENCES kategorije(id) ON DELETE SET NULL,
  tezina_kg     NUMERIC(7,2) NOT NULL,
  kljucne       TEXT[] NOT NULL DEFAULT '{}'
);

ALTER TABLE dijelovi ADD COLUMN IF NOT EXISTS tip_id INTEGER REFERENCES tipovi_dijelova(id) ON DELETE SET NULL;
ALTER TABLE dijelovi ADD COLUMN IF NOT EXISTS tezina_kg NUMERIC(7,2);   -- ručna težina, ima prednost nad tipom

-- Cjenovnik brze pošte: svaki otpad ima svoje pošte, svaka pošta svoje razrede težine
CREATE TABLE IF NOT EXISTS kurirske_sluzbe (
  id         SERIAL PRIMARY KEY,
  otpad_id   INTEGER NOT NULL REFERENCES otpadi(id) ON DELETE CASCADE,
  naziv      TEXT NOT NULL,
  redoslijed INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_kurir_otpad ON kurirske_sluzbe(otpad_id);

CREATE TABLE IF NOT EXISTS kurir_cijene (
  id        SERIAL PRIMARY KEY,
  sluzba_id INTEGER NOT NULL REFERENCES kurirske_sluzbe(id) ON DELETE CASCADE,
  do_kg     NUMERIC(7,2) NOT NULL,
  cijena_km NUMERIC(10,2) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_kurir_cijene ON kurir_cijene(sluzba_id, do_kg);

ALTER TABLE narudzbe ADD COLUMN IF NOT EXISTS kurir TEXT;
ALTER TABLE narudzbe ADD COLUMN IF NOT EXISTS tezina_kg NUMERIC(7,2);
ALTER TABLE narudzbe ADD COLUMN IF NOT EXISTS dostava_po_dogovoru BOOLEAN NOT NULL DEFAULT FALSE;
