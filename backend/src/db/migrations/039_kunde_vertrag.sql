-- 039_kunde_vertrag.sql
-- Verträge pro Kunde (Bezeichnung + Startdatum, optional Enddatum/Notiz).
-- Werden im Rechnungs-Intro referenziert. Soft-Delete-konform.

CREATE TABLE IF NOT EXISTS kunde_vertrag (
  id            TEXT PRIMARY KEY,
  kunde_id      TEXT NOT NULL REFERENCES kunde(id) ON DELETE CASCADE,
  bezeichnung   TEXT NOT NULL DEFAULT '',
  start_datum   TEXT NOT NULL,
  end_datum     TEXT,
  notiz         TEXT,
  erstellt_am   TEXT NOT NULL DEFAULT (datetime('now')),
  geaendert_am  TEXT NOT NULL DEFAULT (datetime('now')),
  geloescht_am  TEXT
);

CREATE INDEX IF NOT EXISTS idx_kunde_vertrag_kunde
  ON kunde_vertrag(kunde_id) WHERE geloescht_am IS NULL;

ALTER TABLE rechnung ADD COLUMN vertrag_id TEXT
  REFERENCES kunde_vertrag(id) ON DELETE SET NULL;