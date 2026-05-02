-- Step 3: Stammdaten — Kunden, Ansprechpartner, Objekte, Notizen + Belegnummern-Zähler.
-- Alle Felder spiegeln die TypeScript-Typen in src/lib/api/types.ts.

-- =============================================================================
-- KUNDE
-- =============================================================================
CREATE TABLE IF NOT EXISTS kunde (
  id                    TEXT PRIMARY KEY,
  nummer                TEXT NOT NULL UNIQUE,                   -- "K-2026-001"
  kuerzel               TEXT COLLATE NOCASE,                    -- 3-4 Zeichen, case-insensitive unique
  typ                   TEXT NOT NULL DEFAULT 'firma' CHECK (typ IN ('firma','privat','behoerde','verein')),
  anrede                TEXT,
  firmenname            TEXT,
  vorname               TEXT,
  nachname              TEXT,
  strasse               TEXT,
  plz                   TEXT,
  ort                   TEXT,
  land                  TEXT DEFAULT 'Deutschland',
  telefon               TEXT,
  mobil                 TEXT,
  email                 TEXT,
  webseite              TEXT,
  ust_id                TEXT,
  steuernummer          TEXT,
  zahlungsziel_tage     INTEGER NOT NULL DEFAULT 14,
  standard_steuersatz   REAL NOT NULL DEFAULT 19,
  standard_rabatt       REAL NOT NULL DEFAULT 0,
  notizen               TEXT,
  tags                  TEXT NOT NULL DEFAULT '[]',             -- JSON-Array
  status                TEXT NOT NULL DEFAULT 'aktiv' CHECK (status IN ('aktiv','inaktiv','potenzial')),
  archiviert            INTEGER NOT NULL DEFAULT 0 CHECK (archiviert IN (0,1)),
  erstellt_am           TEXT NOT NULL DEFAULT (datetime('now')),
  geaendert_am          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_kunde_kuerzel
  ON kunde(kuerzel COLLATE NOCASE)
  WHERE kuerzel IS NOT NULL AND kuerzel <> '';

CREATE INDEX IF NOT EXISTS ix_kunde_status      ON kunde(status);
CREATE INDEX IF NOT EXISTS ix_kunde_archiviert  ON kunde(archiviert);

CREATE TRIGGER IF NOT EXISTS kunde_touch
AFTER UPDATE ON kunde
FOR EACH ROW
BEGIN
  UPDATE kunde SET geaendert_am = datetime('now') WHERE id = NEW.id;
END;

-- =============================================================================
-- ANSPRECHPARTNER
-- =============================================================================
CREATE TABLE IF NOT EXISTS ansprechpartner (
  id          TEXT PRIMARY KEY,
  kunde_id    TEXT NOT NULL REFERENCES kunde(id) ON DELETE CASCADE,
  anrede      TEXT,
  vorname     TEXT,
  nachname    TEXT,
  position    TEXT,
  abteilung   TEXT,
  telefon     TEXT,
  mobil       TEXT,
  email       TEXT,
  notiz       TEXT,
  primaer     INTEGER NOT NULL DEFAULT 0 CHECK (primaer IN (0,1)),
  erstellt_am TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS ix_ap_kunde ON ansprechpartner(kunde_id);

-- Pro Kunde maximal ein primärer Ansprechpartner.
CREATE UNIQUE INDEX IF NOT EXISTS uk_ap_primaer_pro_kunde
  ON ansprechpartner(kunde_id)
  WHERE primaer = 1;

-- =============================================================================
-- OBJEKT
-- =============================================================================
CREATE TABLE IF NOT EXISTS objekt (
  id                          TEXT PRIMARY KEY,
  nummer                      TEXT NOT NULL UNIQUE,             -- "O-2026-001"
  kunde_id                    TEXT NOT NULL REFERENCES kunde(id) ON DELETE CASCADE,
  name                        TEXT NOT NULL,
  typ                         TEXT NOT NULL DEFAULT 'sonstiges' CHECK (typ IN ('buero','wohnen','gewerbe','industrie','medizin','bildung','sonstiges')),
  strasse                     TEXT,
  plz                         TEXT,
  ort                         TEXT,
  land                        TEXT DEFAULT 'Deutschland',
  qm_gesamt                   REAL,
  qm_zu_reinigen              REAL,
  stockwerke                  INTEGER,
  raeume                      INTEGER,
  frequenz                    TEXT NOT NULL DEFAULT 'auf_abruf' CHECK (frequenz IN ('taeglich','woechentlich','14taegig','monatlich','quartalsweise','auf_abruf')),
  reinigungstage              TEXT NOT NULL DEFAULT '[]',       -- JSON-Array von Wochentagen
  uhrzeit_von                 TEXT,
  uhrzeit_bis                 TEXT,
  zugangsinfo                 TEXT,
  alarm_info                  TEXT,
  ansprechpartner_vor_ort_id  TEXT REFERENCES ansprechpartner(id) ON DELETE SET NULL,
  notizen                     TEXT,
  status                      TEXT NOT NULL DEFAULT 'aktiv' CHECK (status IN ('aktiv','pausiert','beendet')),
  archiviert                  INTEGER NOT NULL DEFAULT 0 CHECK (archiviert IN (0,1)),
  erstellt_am                 TEXT NOT NULL DEFAULT (datetime('now')),
  geaendert_am                TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS ix_objekt_kunde      ON objekt(kunde_id);
CREATE INDEX IF NOT EXISTS ix_objekt_status     ON objekt(status);
CREATE INDEX IF NOT EXISTS ix_objekt_archiviert ON objekt(archiviert);

CREATE TRIGGER IF NOT EXISTS objekt_touch
AFTER UPDATE ON objekt
FOR EACH ROW
BEGIN
  UPDATE objekt SET geaendert_am = datetime('now') WHERE id = NEW.id;
END;

-- =============================================================================
-- NOTIZ — kann an Kunde, Objekt, Angebot oder Rechnung hängen.
-- Genau eines der vier *_id-Felder muss gesetzt sein.
-- =============================================================================
CREATE TABLE IF NOT EXISTS notiz (
  id           TEXT PRIMARY KEY,
  kunde_id     TEXT REFERENCES kunde(id)   ON DELETE CASCADE,
  objekt_id    TEXT REFERENCES objekt(id)  ON DELETE CASCADE,
  angebot_id   TEXT,                                            -- FK kommt in Step 7
  rechnung_id  TEXT,                                            -- FK kommt in Step 4
  text         TEXT NOT NULL,
  autor_id     TEXT,
  erstellt_am  TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (
    (CASE WHEN kunde_id    IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN objekt_id   IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN angebot_id  IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN rechnung_id IS NOT NULL THEN 1 ELSE 0 END) = 1
  )
);

CREATE INDEX IF NOT EXISTS ix_notiz_kunde    ON notiz(kunde_id);
CREATE INDEX IF NOT EXISTS ix_notiz_objekt   ON notiz(objekt_id);
CREATE INDEX IF NOT EXISTS ix_notiz_angebot  ON notiz(angebot_id);
CREATE INDEX IF NOT EXISTS ix_notiz_rechnung ON notiz(rechnung_id);

-- =============================================================================
-- ZÄHLER — atomar via INSERT...ON CONFLICT...DO UPDATE...RETURNING
-- =============================================================================

-- Belegnummer pro Kunde+Periode (MMYY) → laufende Nummer ##.
-- Format Belegnummer: {KUERZEL}{MM}{YY}/{NN} z.B. GFU0526/01
CREATE TABLE IF NOT EXISTS belegnummer_zaehler (
  kunde_id        TEXT NOT NULL,
  periode         TEXT NOT NULL,                                -- "MMYY"
  naechster_start INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (kunde_id, periode)
);

-- Kundennummer "K-YYYY-NNN" — Zähler pro Jahr.
CREATE TABLE IF NOT EXISTS kunde_nummer_zaehler (
  jahr      INTEGER PRIMARY KEY,
  naechster INTEGER NOT NULL DEFAULT 1
);

-- Objektnummer "O-YYYY-NNN" — Zähler pro Jahr.
CREATE TABLE IF NOT EXISTS objekt_nummer_zaehler (
  jahr      INTEGER PRIMARY KEY,
  naechster INTEGER NOT NULL DEFAULT 1
);
