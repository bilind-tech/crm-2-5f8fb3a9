-- Step 22: Protokolle (Übergabe-/Abnahme + Schlüsselübergabe).
-- Persistente Entwurf→Abgeschlossen-Pipeline. Beim Abschließen wird die
-- generierte PDF als Dokument abgelegt und über dokument_id verknüpft.

CREATE TABLE IF NOT EXISTS protokolle (
  id              TEXT PRIMARY KEY,
  kind            TEXT NOT NULL CHECK (kind IN ('uebergabe','schluessel')),
  nummer          TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'entwurf'
                  CHECK (status IN ('entwurf','abgeschlossen')),
  kunde_id        TEXT REFERENCES kunde(id) ON DELETE SET NULL,
  objekt_id       TEXT REFERENCES objekt(id) ON DELETE SET NULL,
  datum           TEXT NOT NULL,
  uhrzeit         TEXT NOT NULL DEFAULT '12:00',
  vertreter_ag    TEXT NOT NULL DEFAULT '',
  vertreter_an    TEXT NOT NULL DEFAULT '',
  daten_json      TEXT NOT NULL,
  dokument_id     TEXT REFERENCES dokumente(id) ON DELETE SET NULL,
  erstellt_am     TEXT NOT NULL DEFAULT (datetime('now')),
  aktualisiert_am TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS ix_protokolle_kunde  ON protokolle(kunde_id);
CREATE INDEX IF NOT EXISTS ix_protokolle_status ON protokolle(status);
CREATE UNIQUE INDEX IF NOT EXISTS ux_protokolle_nummer ON protokolle(nummer);
