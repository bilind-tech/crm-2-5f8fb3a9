# Protokolle: Detailseite, PDF-Vorschau, Druck & echte Dokument-Persistenz

## Was ist aktuell kaputt

1. `/protokolle/$id` zeigt nur Meta-Karten + einen Hinweistext — **keine eingebettete PDF**, kein Druck-Button.
2. Beim „Abschließen" wird das PDF nur als **DataURL ins Mock-Backend** geschrieben — auf dem echten Pi-Backend gibt es überhaupt keine `/protokolle`-Routen, also wird in Wahrheit nichts in der SQLite-DB / im Dokumenten-Bereich gespeichert.
3. Folge: nach „Abschließen" taucht das Dokument zwar in der Mock-Liste auf, aber nicht im echten Dokumente-Bereich auf der Pi.

## Ziel

Protokolle verhalten sich wie Angebote/Rechnungen:
- Eigene Detailseite mit Live-PDF-Vorschau (auch im Entwurf) + Drucken/Download/Bearbeiten/Abschließen.
- Beim Abschließen wird das PDF als echtes Dokument in der `dokumente`-Tabelle persistiert (Frontend-Mock und Pi-Backend identisch), inkl. Soft-Delete-Verhalten und Drive-Auto-Upload (über vorhandenen `dokument:erstellt` Event-Hook).
- Auch unabgeschlossene Protokolle sind jederzeit als PDF einsehbar/druckbar (Live-Build aus dem Datensatz).

---

## Frontend

### `src/routes/protokolle.$id.tsx` neu aufbauen

Layout analog `rechnungen.$id.tsx`:

- `PageHeader` mit Aktionen: **PDF herunterladen**, **Drucken** (`PrintButton` mit lokal generierter Blob-URL), **Bearbeiten** (Link in den Editor), **Abschließen** (nur wenn Entwurf), **Löschen**.
- Linke Spalte: Meta-Infos (Status, Nummer, Datum/Uhrzeit, Kunde, Objekt, bei Übergabe: Art/Leistungsumfang-Snippet, bei Schlüssel: Anzahl Schlüssel + Pfand).
- Rechte Spalte: `PdfPreviewCard` mit der live aus dem Datensatz erzeugten PDF (gleiche `generateProtokollPdf`-Funktion). Bei `status === "abgeschlossen"` wird stattdessen die archivierte Datei aus `/dokumente/:id/datei` geladen (Hook `useDokumentBlobUrl`), damit garantiert die finale Version gezeigt wird.
- Hinweis-Banner „im Bereich Dokumente archiviert → Link" bleibt unten erhalten.

PDF-Blob-URL-Verwaltung: kleiner lokaler Hook (oder Inline-`useEffect`), der bei Änderung von Draft/Kunde/Objekt/Firma die PDF generiert, eine `URL.createObjectURL` setzt und beim Unmount/Refresh sauber wieder freigibt — exakt das Muster, das `LivePdfPreview` schon nutzt.

### Editor-Abschluss (`ProtokollEditorLayout`)

- Bleibt wie heute, aber: nach `abschliessen.mutateAsync` zur Detailseite navigieren (passiert schon) — Detailseite zeigt dann automatisch die archivierte Datei.

### Kein neuer eigener Hook für „Protokoll als Dokument anzeigen"

Wir verwenden den bereits existierenden `useDokumentBlobUrl(p.dokumentId)`. Damit gilt automatisch derselbe Auth-/Streaming-Pfad wie für andere Dokumente.

---

## Mock-Backend (`src/lib/mock/backend.ts`)

Bereits vorhanden:
- `POST /protokolle/:id/abschliessen` legt einen `Dokument`-Datensatz an, verlinkt `protokoll.dokumentId`, setzt `status="abgeschlossen"`.

Anpassungen:
- Sicherstellen, dass das angelegte Dokument den Typ `"protokoll"` hat (✓ ist schon so) und auch über `GET /dokumente` und `GET /dokumente/:id/datei` (DataURL) auffindbar ist (✓).
- Beim **erneuten** Abschließen (re-finalize) wird der bestehende Dokument-Datensatz überschrieben — Verhalten passt schon.

Keine weiteren Änderungen am Mock nötig.

---

## Pi-Backend (`backend/src/`) — neu

Aktuell existiert keine Protokoll-Persistenz auf der Pi. Wir spiegeln das Mock-API 1:1.

### Migration `022_protokolle.sql`

```sql
CREATE TABLE protokolle (
  id              TEXT PRIMARY KEY,
  kind            TEXT NOT NULL CHECK (kind IN ('uebergabe','schluessel')),
  nummer          TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'entwurf'
                  CHECK (status IN ('entwurf','abgeschlossen')),
  kunde_id        TEXT REFERENCES kunde(id) ON DELETE SET NULL,
  objekt_id       TEXT REFERENCES objekt(id) ON DELETE SET NULL,
  datum           TEXT NOT NULL,
  uhrzeit         TEXT NOT NULL DEFAULT '12:00',
  daten_json      TEXT NOT NULL,  -- alle kind-spezifischen Felder als JSON
  dokument_id     TEXT REFERENCES dokumente(id) ON DELETE SET NULL,
  erstellt_am     TEXT NOT NULL DEFAULT (datetime('now')),
  aktualisiert_am TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX ix_protokolle_kunde  ON protokolle(kunde_id);
CREATE INDEX ix_protokolle_status ON protokolle(status);
CREATE UNIQUE INDEX ux_protokolle_nummer ON protokolle(nummer);
```

Belegnummern (Format `PR{MM}{YY}/{NN}` bzw. `SU{MM}{YY}/{NN}`) werden serverseitig erzeugt — neue Helper `backend/src/protokolle/nummer.ts`, Zähler pro `(kuerzel, yymm)` aus DB (`MAX(... )+1`), unter Lock.

### Neue Module

- `backend/src/protokolle/types.ts` — Zod-Schemas für beide Kinds.
- `backend/src/protokolle/repo.ts` — `list/get/create/update/delete/abschliessen`.
  - `abschliessen` empfängt **PDF-Bytes** (Multipart oder base64) + `dateiname`, ruft den vorhandenen `dokumente`-Storage-Layer (`dokumente/storage.ts` + `repo.ts`) auf, persistiert die Datei auf der USB-SSD inkl. SHA-256-Dedup und verknüpft die ID zurück ins Protokoll. Setzt Status auf `abgeschlossen`. Beim erneuten Abschließen wird das alte Dokument soft-gelöscht und ein neues angelegt (einfacher als in-place-Update, hält SHA-Dedup sauber).
  - Emit `dokument:erstellt` Event → bestehender `wireDokumenteDriveAutoEnqueue`-Hook lädt die Datei automatisch nach Google Drive hoch (Ordner `Protokolle/{YYYY}/{MM}/`, optional Naming-Erweiterung in `backend/src/drive/naming.ts`).
- `backend/src/routes/protokolle.ts` — Fastify-Plugin, registriert in `server.ts`:
  - `GET /protokolle?kind=&kundeId=`
  - `POST /protokolle` (legt Entwurf an, vergibt `nummer`)
  - `GET /protokolle/:id`
  - `PATCH /protokolle/:id` (autosave, nur im Entwurf bearbeitbar)
  - `DELETE /protokolle/:id` (löscht nur die Protokoll-Zeile, nicht das verknüpfte Dokument)
  - `POST /protokolle/:id/abschliessen` (Multipart: `file` PDF + `meta` JSON mit `dateiname`)

Alle Routen hinter `requireAuth`, keine Rollen.

### PDF auf der Pi

Frontend rendert die PDF (pdfmake im Browser) und sendet sie per Multipart an `abschliessen` — analog zu Mock-Verhalten, vermeidet Server-PDF-Generierung. (Server-PDF gibt es nur für Belege.)

### Tests (`backend/test/protokolle.spec.ts`)

- Create → vergibt eindeutige Nummer im Format `PR0526/01`.
- Patch im Entwurf erlaubt, nach Abschluss 409.
- Abschliessen legt Dokument an, verlinkt zurück, Datei liegt unter `$DATA_DIR/uploads/dokumente/...`.
- Re-abschliessen ersetzt das Dokument, altes ist soft-gelöscht.

---

## Frontend-API-Bridge

`src/lib/api/piClient.ts` bzw. `useApi.ts`:
- `useAbschliessenProtokoll` schickt im Pi-Modus Multipart (FormData mit `file`-Blob + `meta` JSON) statt JSON-Body. Im Mock-Modus bleibt der bisherige JSON-Pfad aktiv (Branch wie bei Dokument-Upload, vgl. `src/lib/dokument/upload.ts` Schwester-TODO in `mem://features/dokumente`).

---

## Akzeptanzkriterien

- Auf `/protokolle/$id` ist die PDF immer sichtbar (Entwurf: live; abgeschlossen: archivierte Datei) und kann per Button gedruckt/heruntergeladen werden.
- „Abschließen" erzeugt einen Eintrag in `/dokumente` (Mock + Pi) mit Typ `protokoll`, Verknüpfung zu Kunde/Objekt, korrektem Dateinamen.
- Auf der Pi liegt die Datei real auf der USB-SSD und wird vom bestehenden Drive-Worker hochgeladen.
- Löschen eines Protokolls entfernt nur den Protokoll-Datensatz; das archivierte Dokument bleibt erhalten.
