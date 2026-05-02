## Ziel
Drittes Backend-Modul: alle Stammdaten-Endpoints für Kunden, Ansprechpartner, Objekte und Notizen produktiv ans Pi-Backend hängen — inklusive Volltextsuche (SQLite FTS5) und atomarer Belegnummern-Vergabe pro Kunde+Monat. Mock wird für diese Endpoints abgeschaltet, Mock-Parität für alles andere bleibt.

## Backend

### 1. Migration `005_kunden_objekte.sql`
- `kunde` — alle Felder aus `Kunde`-Typ (siehe `src/lib/api/types.ts`), inklusive `kuerzel` UNIQUE (case-insensitive via `COLLATE NOCASE`), `tags TEXT` (JSON-Array), `archiviert INTEGER DEFAULT 0`, `erstellt_am`/`geaendert_am`. Trigger `kunde_touch` aktualisiert `geaendert_am` bei jedem UPDATE.
- `ansprechpartner` — FK auf `kunde(id) ON DELETE CASCADE`, `primaer INTEGER`. Partial-Unique-Index, der pro Kunde nur einen primären Kontakt zulässt: `CREATE UNIQUE INDEX … WHERE primaer=1`.
- `objekt` — FK auf `kunde(id) ON DELETE CASCADE`. `reinigungstage TEXT` (JSON-Array). `ansprechpartner_vor_ort_id` als FK auf `ansprechpartner(id) ON DELETE SET NULL`.
- `notiz` — kann an Kunde, Objekt, Angebot oder Rechnung hängen. Spalten: `kunde_id`, `objekt_id`, `angebot_id`, `rechnung_id` (alle nullable, exakt eins muss gesetzt sein → CHECK-Constraint).
- `belegnummer_zaehler` — `(kunde_id TEXT, periode TEXT, naechster_start INTEGER, PRIMARY KEY(kunde_id, periode))`. `periode` = `MMYY`. Wird beim Vergabe-Flow atomar inkrementiert.
- `kunde_nummer_zaehler` — `(jahr INTEGER PRIMARY KEY, naechster INTEGER)` für Kundennummern `K-YYYY-NNN`.
- Indizes: `kunde(kuerzel COLLATE NOCASE)`, `kunde(archiviert)`, `kunde(status)`, `objekt(kunde_id)`, `ansprechpartner(kunde_id)`, `notiz(kunde_id)`, `notiz(objekt_id)`.

### 2. Migration `006_fts.sql` (FTS5)
- Virtuelle Tabelle `suche_idx` (FTS5, contentless, tokenize=`unicode61 remove_diacritics 2`).
- Spalten: `entity_typ` (kunde/objekt/notiz/angebot/rechnung), `entity_id`, `titel`, `untertitel`, `body`.
- Trigger `kunde_ai`/`au`/`ad`, gleich für `objekt`, `notiz` — synchronisieren in `suche_idx`. Angebote/Rechnungen folgen in Step 4/7, Trigger werden dort additiv ergänzt.
- Re-Index-Befehl `INSERT INTO suche_idx(suche_idx) VALUES('rebuild')` als Admin-Wartungspfad (für späteren System-Tab; in Step 3 nicht UI-exponiert).

### 3. Module unter `backend/src/kunden/`
- `repo.ts` — Prepared Statements für Kunde/Ansprechpartner/Objekt/Notiz (CRUD), Filter (suche, status, archiviert), Pagination (`limit`, `offset`).
- `belegnummer.ts` — `nextNummer(kundeId, periodeMMYY)` in `db.transaction(...)`: SELECT FOR UPDATE-Ersatz via `INSERT … ON CONFLICT … DO UPDATE SET naechster_start = naechster_start + 1 RETURNING naechster_start`. Garantiert lückenlos und atomar auch bei Parallelaufrufen. Format-String aus Firmendaten (Kürzel-Logik aus `mem://features/belegnummern`).
- `kuerzel.ts` — Validierung (3–4 Zeichen, A–Z, 0–9), Eindeutigkeitsprüfung; Liefert `{ frei: boolean, kunde?: { id, nummer, name } }` für `/kunden/kuerzel-frei`.
- `kunde-nummer.ts` — `nextKundeNummer(jahr)` analog atomar, Format `K-YYYY-NNN`.
- `notizen.ts` — Validierung der Exklusiv-Bindung (genau eines von kundeId/objektId/angebotId/rechnungId).
- `search.ts` — Wrapper um FTS5 mit Prefix-Match (`kunde* OR kunde`), Result-Mapping in `SuchTreffer`-Form, Limit 25.

### 4. Routes unter `backend/src/routes/`
- `kunden.ts`
  - `GET /kunden?suche&status&archiviert&limit&offset` — Liste mit serverseitigem Filter.
  - `GET /kunden/:id` — gibt zusätzlich `ansprechpartner[]`, `objekte[]`, `notizen[]` (kompatibel mit `useKunde`).
  - `POST /kunden` — vergibt `nummer` über `nextKundeNummer(currentYear)`. Bei `kuerzel`-Konflikt → 409.
  - `PATCH /kunden/:id` — Partial-Update; bei `kuerzel`-Wechsel Eindeutigkeit erneut prüfen.
  - `DELETE /kunden/:id` — soft via `archiviert=1` wenn Beziehungen existieren, sonst hart. Antwort enthält angewandten Modus.
  - `GET /kunden/:id/zaehler` — `{ periode: "MMYY", naechsterStart }`.
  - `GET /kunden/kuerzel-frei?kuerzel=&exceptId=` — wie Frontend erwartet.
- `ansprechpartner.ts`
  - `POST /ansprechpartner` — wenn `primaer=true`, alle anderen desselben Kunden in Transaktion auf `primaer=0` setzen.
  - `PATCH /ansprechpartner/:id` — analog.
  - `DELETE /ansprechpartner/:id` — wenn das einzige primäre weg ist und noch andere existieren, das chronologisch erste auf primär setzen.
- `objekte.ts`
  - `GET /objekte?kundeId` — Liste, Filter optional.
  - `GET /objekte/:id` — Detail.
  - `POST /objekte` — vergibt `nummer` (`O-YYYY-NNN`, Zähler analog).
  - `PATCH /objekte/:id`, `DELETE /objekte/:id` (soft via `archiviert`/`status='beendet'` bei Beziehungen, hart sonst).
- `notizen.ts`
  - `POST /notizen` — Body validiert via Zod (`kundeId | objektId | angebotId | rechnungId`).
  - `DELETE /notizen/:id`.
- `suche.ts`
  - `GET /search?q=` — Output `SuchTreffer[]` mit Linkstruktur, die zu existierenden Frontend-Routen passt (`/kunden/:id`, `/objekte/:id`, später `/angebote/:id`, `/rechnungen/:id`).

### 5. Auth + Audit
- Alle Routen (außer `/search` für eingeloggte User auch) hängen am bestehenden `requireAuth`-Hook. Mutationen schreiben einen Audit-Eintrag (`kunde.create`, `kunde.update`, `kunde.delete`, …) inklusive `userId` und `ip`.

### 6. Tests `backend/test/kunden.spec.ts`
- Kunde anlegen → Nummer = `K-{YYYY}-001`, zweiter Kunde 002.
- Kürzel `GFU` anlegen, zweites Anlegen mit gleichem Kürzel → 409.
- Belegnummer: 100 parallele `nextNummer("kundeId","0526")` → liefert `1..100` lückenlos und einzigartig.
- Ansprechpartner: zwei mit `primaer=true` → der zweite überschreibt den ersten, Index-Constraint hält.
- Objekt + Notiz an Kunde hängen, Kunde löschen → CASCADE entfernt beides.
- Notiz mit zwei gesetzten FKs → 422.
- FTS5: Kunde „Gärtner Süd GmbH" + Notiz „Schließanlage Süd" → `q=schliess` findet die Notiz, `q=gartner` (ohne Diakritik) den Kunden.

## Frontend

### `src/lib/api/client.ts`
- `PI_PREFIXES` um `/kunden`, `/ansprechpartner`, `/objekte`, `/notizen`, `/search` erweitern.
- Mock-Override-Liste anpassen: alles oben Genannte aus `MOCK_OVERRIDE_PREFIXES` rausnehmen (war eh nicht drin), aber Mock-Code für diese Pfade lassen — Demo-Modus ohne Backend nutzt weiterhin Mock.

### `src/hooks/useApi.ts`
- Keine API-Form-Änderungen — die existierenden Hooks (`useKunden`, `useKunde`, `useCreateKunde`, `useKuerzelFrei`, `useObjekte`, `useCreateObjekt`, `useNotizen`, `useGlobaleSuche` …) zeigen schon auf die richtigen Pfade.
- 409 bei Kürzel-Konflikt: bestehender `useCreateKunde`-Onerror-Pfad bleibt; nur `ApiError.body` durchreichen für Toast-Detail.

### `src/lib/mock/backend.ts`
- Marker-Kommentar `// STEP 3 ÜBERNOMMEN` über die Kunden-/Objekte-/Notizen-/Suche-Handler. Mock bleibt funktional als Demo-Fallback wenn keine Backend-URL gesetzt ist (Verhalten konsistent mit Step 1 + 2).

### Keine UI-Änderungen
- Keine Komponente muss umgebaut werden — alle Listen, Detailseiten und Dialoge sprechen schon gegen diese URLs. Lediglich `KuerzelFrei`-Live-Check arbeitet jetzt gegen echte DB statt Mock.

## Sicherheits- und Datenintegritäts-Garantien
- Kürzel ist case-insensitive eindeutig; das Frontend normalisiert bereits zu uppercase, das Backend zusätzlich beim INSERT.
- Belegnummern-Zähler ist die einzige autoritative Quelle. `INSERT … ON CONFLICT DO UPDATE … RETURNING` läuft in einer einzigen SQLite-Anweisung — keine Race-Condition.
- `ON DELETE CASCADE` von Kunde → Ansprechpartner/Objekte/Notizen ist gewollt; Angebote/Rechnungen folgen in Step 4/7 mit `ON DELETE RESTRICT`, damit keine Belege verschwinden.
- Soft-Delete: ein Kunde mit Angeboten oder Rechnungen kann nie hart gelöscht werden — Backend antwortet stattdessen mit `archiviert=true`. (Step 4 setzt die RESTRICT-FKs, Step 3 prüft das vorab schon über `EXISTS`-Subqueries gegen `angebot`/`rechnung`, falls deren Tabellen schon existieren — sonst nur gegen interne Beziehungen.)

## Reihenfolge der Umsetzung
1. Migrationen 005 + 006 + Module unter `backend/src/kunden/`.
2. Routen registrieren in `backend/src/server.ts`.
3. Vitest-Suite (7 Tests) grün.
4. Frontend-Routing in `client.ts`.
5. Manuell im Preview testen: neuen Kunden anlegen, Kürzel-Live-Check, Notiz an Kunde + Objekt, Globale Suche.
6. Memory-Eintrag `mem://features/backend-step3-stammdaten` + Eintrag in `mem/index.md`.

## Nicht-Ziele für Step 3
- Keine Angebote/Rechnungen — kommen in Step 4 / 7.
- Kein PDF-Generator — Step 5.
- Kein Drive/Mail-Versand — Step 6.
- Keine Aktivitäten/SSE — Step 8 (Audit-Logs werden aber bereits geschrieben).

Sag „approved" wenn der Plan passt — dann starte ich Step 3.
