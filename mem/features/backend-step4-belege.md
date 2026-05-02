---
name: Backend Step 4 — Belege
description: Angebote, Rechnungen, Positionen, Teilzahlungen mit serverseitiger Status-Ableitung und atomarer Belegnummern-Vergabe
type: feature
---
# Step 4 — Angebote, Rechnungen, Teilzahlungen

## Migrationen
- `007_angebote_rechnungen.sql` — angebot, angebot_position, rechnung, rechnung_position, zahlung. Geld als INTEGER-Cent. Belegnummer UNIQUE. FK kunde→RESTRICT, objekt/ansprechpartner/quell_angebot→SET NULL, Positionen/Zahlung→CASCADE.
- `008_fts_belege.sql` — FTS5-Trigger für angebot/rechnung inkl. Position-Beschreibungen via GROUP_CONCAT.

## Module `backend/src/belege/`
- `mappers.ts` — DB↔API + ct↔Euro Konvertierung.
- `belegnummer.ts` — `vergebeBelegnummer(kundeId, art, datum)` → `{KÜRZEL}{MM}{YY}/{NN}`. Fallback `AN`/`RE` wenn Kunde kein Kürzel hat. Nutzt `nextBelegNummer` aus Step 3 (atomar via INSERT ON CONFLICT RETURNING).
- `positionen.ts` — Replace-All-Strategie pro Beleg, sort-Spalte erhält Reihenfolge.
- `totals.ts` — Brutto-Berechnung in Cent (Position-Rabatt × Beleg-Rabatt × Steuer pro Position).
- `status.ts` — `recomputeRechnungStatus`: bezahlt = sum>=brutto, teilbezahlt = 0<sum<brutto. `bezahlt` und `storniert` terminal. `markOverdueRechnungen` für Tagesjob.
- `angebote-repo.ts` / `rechnungen-repo.ts` — CRUD inkl. Positionen-Replace in einer Transaktion.
- `umwandeln.ts` — idempotent: zweiter Aufruf liefert die existierende Rechnung, kein Doppel.
- `zahlungen.ts` — `addZahlung` ruft danach `recomputeRechnungStatus`.
- `scheduler.ts` — stündlicher Tick markiert überfällige Rechnungen, respektiert `mahn_pausiert_bis`.

## Routes `backend/src/routes/belege.ts`
- `/angebote` (GET, POST), `/angebote/:id` (GET, PATCH, DELETE)
- `/angebote/:id/senden`, `/in-rechnung-umwandeln`, `/duplizieren`
- `/rechnungen` analog + `/zahlungen` (POST, DELETE), `/mahnung-pausieren`, `/inkasso-markieren`
- Alle Routen requireAuth + Audit-Log.

## Frontend
- `src/lib/api/client.ts` PI_PREFIXES erweitert um `/angebote/`, `/rechnungen/` (und Step 3 `/kunden/`, `/objekte/`, `/ansprechpartner/`, `/notizen/`, `/search/`).
- `isPiPath` erkennt jetzt auch `/search?q=...` korrekt.
- Hooks bleiben unverändert — sprechen schon die richtigen Pfade an.

## Garantien
- Belegnummer-Vergabe + INSERT in einer SQLite-Transaktion → keine Lücken, keine Duplikate.
- Rechnungs-Status leitet sich serverseitig aus Zahlungssumme ab; PATCH `status` akzeptiert nur `storniert` (außer wenn schon bezahlt).
- Geld als Cent intern → keine Float-Drift bei Teilzahlungs-Summen.
- Kunde mit Rechnung kann nicht hart gelöscht werden — Step-3-Logik wird durch FK RESTRICT gestützt.
