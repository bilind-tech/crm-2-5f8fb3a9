-- Step 33: Ordner für Dokumente.
-- Hierarchisch (parent_id), Soft-Delete via geloescht_am (konsistent mit Step 27).
-- Root-Ordner = ordner_id IS NULL auf dokumente. Geschwister-Namen sind eindeutig.

CREATE TABLE IF NOT EXISTS dokument_ordner (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  parent_id     TEXT REFERENCES dokument_ordner(id) ON DELETE RESTRICT,
  erstellt_am   TEXT NOT NULL DEFAULT (datetime('now')),
  geloescht_am  TEXT
);

-- Eindeutige Namen pro Eltern (NULL = Root). SQLite behandelt NULL in UNIQUE
-- als „ungleich" — daher zusätzlich partielle Indizes.
CREATE UNIQUE INDEX IF NOT EXISTS ux_ordner_name_parent
  ON dokument_ordner(parent_id, name) WHERE geloescht_am IS NULL AND parent_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_ordner_name_root
  ON dokument_ordner(name) WHERE geloescht_am IS NULL AND parent_id IS NULL;

CREATE INDEX IF NOT EXISTS ix_ordner_parent
  ON dokument_ordner(parent_id) WHERE geloescht_am IS NULL;

ALTER TABLE dokumente ADD COLUMN ordner_id TEXT REFERENCES dokument_ordner(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS ix_dok_ordner ON dokumente(ordner_id) WHERE geloescht_am IS NULL;