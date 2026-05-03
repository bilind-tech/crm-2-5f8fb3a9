# Plan 6 — „Drucken"-Button überall

Ziel: Auf jeder Seite, die ein PDF erzeugt (Angebot, Rechnung, Übergabeprotokoll, Schlüsselübergabe), gibt es genau **einen** Button „Drucken", der **mit einem Klick** den Druck-Dialog öffnet — egal wie viele Seiten das PDF hat. Schnell, kein zusätzlicher Download-Schritt für den Nutzer, kein Tab-Wirrwarr.

## Strategie (technisch)

Browser können **PDF-Blobs nicht direkt drucken** — `window.print()` druckt immer das gerade aktive Dokument. Robuster, browserübergreifender Weg:

1. PDF als **Blob** erzeugen / besorgen (haben wir schon: `useAngebotPdf`, `useRechnungPdf`, `generateUebergabeprotokollPdf`, `generateSchluesseluebergabePdf`).
2. Blob → `URL.createObjectURL(blob)`.
3. **Verstecktes `<iframe>`** in den DOM hängen (`position: fixed; left: -9999px`), `src = blobUrl`, `onload` → `iframe.contentWindow.print()`.
4. Nach `print()` wird der native Druck-Dialog des Browsers geöffnet (Vorschau + alle Seiten).
5. Cleanup: nach `afterprint` (oder Timeout fallback) iframe entfernen + `revokeObjectURL`.

**Fallback**, falls der Browser Drucken aus einem Cross-Origin/blob-iframe verbietet (Safari iOS):
- `window.open(blobUrl, "_blank")` → neuer Tab → User klickt dort einmal auf Drucken.
- Vorher per Feature-Detection erkennen (User-Agent ist Mist; wir versuchen iframe-Print, fangen Fehler ab und fallen automatisch auf neuer Tab zurück).

Das deckt alle Browser ab und respektiert genau deine Vorgabe: erste Wahl gleicher Tab, Fallback neuer Tab — beides funktioniert auch bei mehrseitigen PDFs.

## Zentrale Hilfsfunktion

Eine neue Datei `src/lib/pdf/printBlob.ts`:

- `printPdfBlob(blob: Blob, opts?: { fileName?: string }): Promise<void>`
- Versucht **iframe-Drucken**. Bei Fehler oder Safari-iOS automatisch `window.open` Fallback.
- Räumt URL und iframe in `afterprint` / nach 60s sicher auf, damit der Speicher nicht voll läuft.

## Wo der Button hinkommt

| Stelle | Komponente | Vorgehen |
|---|---|---|
| Angebot-Detail (`/angebote/$id`) | `src/routes/angebote.$id.tsx` | „Drucken"-Button neben dem bestehenden „PDF"-Button. Holt Blob aus `useAngebotPdf(a)` und ruft `printPdfBlob`. |
| Rechnung-Detail (`/rechnungen/$id`) | `src/routes/rechnungen.$id.tsx` | analog mit `useRechnungPdf(r)`. |
| Übergabe-/Abnahmeprotokoll (`/werkzeuge/uebergabeprotokoll`) | `src/routes/werkzeuge.uebergabeprotokoll.tsx` | Neuer dritter Action-Button „Drucken" — erzeugt Blob via `generateUebergabeprotokollPdf` und ruft `printPdfBlob` direkt (kein Download). |
| Schlüsselübergabe (`/werkzeuge/schluesseluebergabe`) | `src/routes/werkzeuge.schluesseluebergabe.tsx` | analog. |
| `PdfViewerDialog` (Vorschau-Dialog für Beleg-PDFs) | `src/components/pdf/PdfViewerDialog.tsx` | Bestehender Dialog bekommt zusätzlich „Drucken" — wer schon im Vorschau-Dialog ist, kann von dort direkt drucken. |
| Listen (`/angebote`, `/rechnungen`) | optional Folge-PR | **Bewusst NICHT in diesem Plan** — Liste hat schon den Eye-Button, mehr Druck-Eintritte erhöhen Klickfehler. Sag Bescheid, wenn du es trotzdem dort willst. |

Ein gemeinsamer kleiner Wrapper `src/components/pdf/PrintButton.tsx`:
- Props: `getBlob: () => Promise<Blob>`, optional `label`, `variant`, `size`.
- Zeigt einen Button mit Drucker-Icon (`Printer` aus lucide-react).
- Klick → Loader-Spinner anzeigen, `getBlob()` awaiten, `printPdfBlob` rufen.
- Toast bei Fehler („Drucken fehlgeschlagen").
- Disabled solange Blob nicht bereit.

Damit hat jede der oben genannten Seiten **eine Zeile**, die den Button einsetzt — keine doppelte Logik, kein doppelter Cleanup.

## UX-Details

- Beleg-Detailseiten: Beim ersten Aufruf von `useAngebotPdf` wird der Blob ohnehin gebaut/geladen. Der Print-Button kann den **bereits gecachten Blob** wiederverwenden — Druck ist quasi instantan, sobald die Seite geladen hat.
- Werkzeuge: Bisher erzeugt der „PDF erstellen"-Button den Blob, lädt ihn herunter und ist fertig. Der neue „Drucken"-Button erzeugt den Blob **und ruft direkt Druck**, ohne Download-Datei im Downloads-Ordner abzulegen. Der Download bleibt als separater Button erhalten.
- Visuell: Drucker-Icon + Text „Drucken". Variant `outline` wie die anderen Sekundär-Aktionen in der Header-Action-Bar, damit es sich konsistent einreiht. Keine Sparkles, keine Gradients (wie in Memory festgehalten).
- Loading: kleiner Spinner im Button, solange Blob baut (max ~1–2 s im Mock, instant aus Cache).

## Geänderte / neue Dateien

| Datei | Änderung |
|---|---|
| `src/lib/pdf/printBlob.ts` | **neu** — `printPdfBlob` mit iframe-Strategie + Fallback |
| `src/components/pdf/PrintButton.tsx` | **neu** — wiederverwendbarer Button-Wrapper |
| `src/components/pdf/PdfViewerDialog.tsx` | „Drucken"-Action ergänzen |
| `src/routes/angebote.$id.tsx` | PrintButton in Header-Actions |
| `src/routes/rechnungen.$id.tsx` | PrintButton in Header-Actions |
| `src/routes/werkzeuge.uebergabeprotokoll.tsx` | PrintButton in Sticky-Bar |
| `src/routes/werkzeuge.schluesseluebergabe.tsx` | PrintButton in Sticky-Bar |

Keine neuen Backend-Routen, keine Migrations, keine neuen Dependencies — `lucide-react` hat `Printer` schon.

## Akzeptanzkriterien

1. Auf `/angebote/:id` und `/rechnungen/:id` erscheint ein **„Drucken"**-Button neben „PDF". Ein Klick öffnet ohne Tab-Wechsel den nativen Druck-Dialog mit allen Seiten des PDFs.
2. Auf `/werkzeuge/uebergabeprotokoll` und `/werkzeuge/schluesseluebergabe` ist der Button in der Sticky-Action-Bar verfügbar — ein Klick erzeugt das PDF und öffnet sofort den Druck-Dialog (kein Download nötig).
3. Funktioniert in Chrome, Edge, Firefox **im selben Tab** über das versteckte iframe.
4. In Safari (insbesondere iOS), wo iframe-Druck eingeschränkt ist, fällt es automatisch auf einen **neuen Tab** zurück, der den nativen Druck-Dialog des Geräts öffnet.
5. Mehrseitige PDFs werden vollständig gedruckt (kein Abschneiden).
6. Nach dem Druck: keine zurückbleibenden iframes/Object-URLs (Speicher sauber).

## Risiko

Niedrig. Reine Frontend-Erweiterung. Bestehende Download-/Mail-/Bearbeiten-Buttons bleiben unverändert. Maximaler Schaden bei Bugs: Druck öffnet sich nicht — der Nutzer hat noch immer den vorhandenen „PDF"-Download-Button als Alternative.

Sag „Go", dann setze ich Plan 6 um.
