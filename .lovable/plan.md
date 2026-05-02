## Ziel

Beim Anlegen eines Kunden (und nachträglich) soll der **Startzähler pro Kürzel** für den **aktuellen Monat** einstellbar sein, damit alte, schon vergebene Belegnummern (z. B. „GFU0526/01–07") nicht überschrieben werden und die nächste neue Rechnung/Angebot bei z. B. `08` weitergeht. Die Vorschau folgt immer dem heutigen Monat/Jahr.

## Verhalten (für dich)

**KundeForm (Neuanlage)**
- Unter dem Kürzel-Feld erscheint, sobald ein Kürzel eingegeben ist, ein neues kleines Feld:
  „Nächste Nummer (diesen Monat) startet bei: **[ 1 ]**".
- Vorschau zeigt live: `GFU{MM}{YY}/{NN}` mit dem eingestellten Startwert (z. B. `GFU0526/08`).
- Standard ist `1`. Wenn man `8` einträgt, bekommt der erste neue Beleg die `08`, der zweite `09` usw.
- Monat/Jahr in der Vorschau immer = heute.

**Kunden-Detailseite (`/kunden/$id`)**
- „Bearbeiten"-Button öffnet einen Dialog (neu, schlicht, ohne Gradient/Deko-Icons) mit denselben Stammdaten + dem Block „Belegnummern".
- Block „Belegnummern":
  - Kürzel ändern (3–4 Zeichen, A–Z 0–9).
  - „Nächste Nummer (Monat MM/YY)" – aktueller Stand wird angezeigt, kann überschrieben werden. Z. B. wenn 7 Belege schon manuell außerhalb existieren → Wert auf `8` setzen.
  - Kleiner Hinweis: „Ändert nur den Zähler für **diesen Monat**. Bestehende Belege bleiben unverändert."
- Speichern aktualisiert Kürzel + den Monatszähler atomar.

**Wichtig (Daten-Schutz, gem. Memory)**
- Kürzel-/Zählerwerte werden nie rückwirkend auf bestehende Belege angewandt — bestehende Nummern bleiben.
- Beim Pi-Backend später: Update von Kürzel + Zähler in einer SQLite-Transaktion, kein Touch an Daten-Verzeichnis-Inhalten.

## Technische Umsetzung

**Typen** (`src/lib/api/types.ts`)
- `Kunde` bleibt unverändert (Kürzel existiert schon).
- Neuer optionaler API-Input `startZaehlerAktuellerMonat?: number` für Create und Update — wird nicht persistiert am Kunden, sondern in `db.zaehlerProKunde[kundeId][YYYY-MM]` als `wert - 1` geschrieben (damit `+1` beim nächsten Beleg den gewünschten Startwert ergibt).

**Backend Mock** (`src/lib/mock/backend.ts`)
- `createKunde`: nach Anlage, falls `startZaehlerAktuellerMonat` gesetzt und `kuerzel` vorhanden →
  `d.zaehlerProKunde[k.id][periodeAktuell] = max(0, start - 1)`.
- `updateKunde`: gleicher Mechanismus; zusätzlich `kuerzel` darf geändert werden (bestehende Belege bleiben).
- Helper `getAktuellerZaehler(kundeId): number` → liest `(map[periodeAktuell] ?? 0) + 1` für die UI-Anzeige in der Bearbeiten-Maske.
- Neuer Endpoint im API-Client: `getKundenZaehler(id)` → `{ periode: "YYYY-MM", naechsterStart: number }`.

**API-Client / Hook** (`src/lib/api/client.ts`, `src/hooks/useApi.ts`)
- `useKundenZaehler(id)` (Query).
- `useUpdateKunde(id)` akzeptiert neues Feld `startZaehlerAktuellerMonat`.

**KundeForm** (`src/components/forms/KundeForm.tsx`)
- Neues State-Feld `startNummer: number` (Default `1`).
- Input erscheint nur wenn `kuerzel.length >= 3`.
- Vorschau-String: `${kuerzel}${MM}${YY}/${String(startNummer).padStart(2, "0")}`.
- Beim Submit wird `startZaehlerAktuellerMonat` mitgegeben (nur wenn `>1`).

**Neue Komponente** `src/components/forms/KundeBearbeitenDialog.tsx`
- Dialog (`bg-background`, kein Gradient, keine Sparkles).
- Sektion „Stammdaten" (Pflichtfelder analog KundeForm — Wiederverwendung der Felder via kleinem Refactor: Stammdaten-Felder in eine interne `KundeStammdatenFelder`-Komponente extrahieren, von KundeForm und Bearbeiten-Dialog genutzt).
- Sektion „Belegnummern" mit Kürzel + Startzähler-Override + Live-Vorschau + Hinweistext.
- Buttons: Abbrechen / Speichern. Toast bei Erfolg.

**Anbindung** `src/routes/kunden.$id.tsx`
- „Bearbeiten"-Button öffnet den neuen Dialog mit Initialwerten aus Kunde + `useKundenZaehler`.

## Out of Scope
- Keine Änderung an Nummernformat selbst (`{KÜRZEL}{MM}{YY}/{NN}` bleibt).
- Keine Migration alter Belegnummern.
- Globale Nummernkreise (Kunden ohne Kürzel) bleiben unverändert.
