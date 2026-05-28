# Kürzel & Startzähler — robust machen

Zwei zusammenhängende Fixes. Beide ändern Verhalten, das aktuell schlicht falsch ist.

## Problem

1. **Kürzel max 4 Zeichen.** Frontend kappt hart auf 4 (`slice(0,4)`, `maxLength={4}`). Backend-Format erlaubt bereits beliebig viele Zeichen. Du willst freie Länge.
2. **„Beginne ab NN" wird ignoriert.** Frontend schickt `startZaehlerAktuellerMonat` beim Kunde anlegen UND bearbeiten — aber **das Backend wertet das Feld weder in `POST /kunden` noch in `PATCH /kunden/:id` aus**. Folge:
   - Erste Rechnung beginnt trotzdem bei `01`.
   - Beim erneuten Bearbeiten zeigt das Dialog-Feld wieder „1", weil der Zähler nie auf 26 hochgesetzt wurde.

## Umsetzung

### A) Kürzel-Länge freigeben

- `src/components/forms/KundeForm.tsx`
  - `sanitizeKuerzel`: `.slice(0, 4)` entfernen.
  - Auto-Vorschlag (`vorschlagKuerzel`): die beiden `.slice(0, 4)` auf eine großzügigere Obergrenze (z. B. 6) für den Auto-Vorschlag setzen — manueller Tipp bleibt unbegrenzt.
  - `<Input maxLength={4}>` entfernen (oder auf z. B. 12 erhöhen als reine Schutzgrenze).
  - Hinweistext „3–4 Zeichen" → „mind. 1 Zeichen (A–Z, 0–9)".
  - Validierungs-Toast „Kürzel muss 3–4 Zeichen haben" entfernen (Backend-Format-Check reicht).
- `src/components/forms/KundeBearbeitenDialog.tsx`
  - Gleiche Anpassungen: `sanitizeKuerzel` ohne `slice`, `maxLength` weg, Hinweistext + Validierung anpassen.
- Backend (`backend/src/kunden/kuerzel.ts`): bleibt wie es ist — `^[A-Z0-9]+$` erlaubt jede Länge ≥ 1. **Nichts ändern.**
- Live-Check (`useKuerzelFrei`): aktuell triggert er erst ab `length >= 3`. Auf `>= 1` senken in beiden Dialogen.

### B) Startzähler zuverlässig anwenden

Kern: Backend muss `startZaehlerAktuellerMonat` aus dem Body lesen und in `belegnummer_zaehler` setzen. Helper dafür existiert bereits: `bumpBelegNummerMindestens(kundeId, art, periode, mindestens)` (idempotent, MAX-Logik).

- `backend/src/routes/stammdaten.ts`
  - Imports ergänzen: `bumpBelegNummerMindestens, periodeMMYY` aus `../kunden/nummern.js`.
  - **POST `/kunden`** (nach erfolgreichem `createKunde`, vor `return k`):
    ```ts
    const start = Number(body.startZaehlerAktuellerMonat);
    if (k.kuerzel && Number.isFinite(start) && start > 1) {
      const periode = periodeMMYY();
      bumpBelegNummerMindestens(k.id, "rechnung", periode, start);
      bumpBelegNummerMindestens(k.id, "angebot", periode, start);
    }
    ```
  - **PATCH `/kunden/:id`** (nach erfolgreichem `updateKunde`, vor Audit/Return): gleiche Logik mit `result.kuerzel` und `req.params.id`. Wichtig: vor dem Aufruf `delete body.startZaehlerAktuellerMonat`, damit `updateKunde` das unbekannte Feld nicht verschluckt/ablehnt.
- Belegart-Trennung: Da die Frontend-Vorschau im Dialog/Form sowohl Rechnung als auch Angebot betrifft und die Eingabe „nächste Nummer ab" als gemeinsamer Startpunkt gemeint ist, beide Belegarten (`rechnung`, `angebot`) auf denselben Mindestwert heben. (Bestehende, höhere Zähler werden durch `MAX` nicht heruntergesetzt — sicher.)
- `GET /kunden/:id/zaehler` liest danach den korrekten Wert → der Bearbeiten-Dialog zeigt beim nächsten Öffnen `26` statt `1`.
- Vergabe (`vergebeBelegnummer` → `nextBelegNummer`): nutzt bereits `belegnummer_zaehler.naechster_start` per UPSERT. Sobald der Zähler auf `26` steht, vergibt die nächste Rechnung `26`, danach `27` usw. → erfüllt automatisch deinen 26 → 27 Wunsch ohne weitere Codeänderung.

### C) Tests / Smoke

- Bestehende `backend/test/belege.spec.ts` ergänzen oder neuen Test:
  - Kunde anlegen mit `kuerzel: "XYZ"`, `startZaehlerAktuellerMonat: 26`.
  - `GET /kunden/:id/zaehler?art=rechnung` → `naechsterStart === 26`.
  - Rechnung anlegen → Nummer endet auf `/26`.
  - Zweite Rechnung → `/27`.
  - PATCH mit `startZaehlerAktuellerMonat: 50` → Zähler springt auf 50, niedrigere Werte werden ignoriert (MAX-Verhalten).

## Was NICHT geändert wird

- Format-Regeln (Großschreibung, A–Z/0–9), Eindeutigkeit, 409-Konflikt-Flow.
- Bestehende Belege/Nummern.
- Logik in `belegnummer.ts` / `nummern.ts` — der vorhandene Helper macht genau das Richtige.
- Preview-Modus (`localPreviewData.ts`) — der Fix betrifft den echten Pi-Backend-Pfad, den du laut Beschreibung benutzt. (Falls du explizit den Preview auch fixen willst: separat sagen.)

## Dateien

- `src/components/forms/KundeForm.tsx`
- `src/components/forms/KundeBearbeitenDialog.tsx`
- `backend/src/routes/stammdaten.ts`
- `backend/test/belege.spec.ts` (Test-Ergänzung)
