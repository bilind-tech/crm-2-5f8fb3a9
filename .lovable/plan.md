## Ziel

Der Protokoll-Editor zeigt ausschließlich die echte PDF (gleicher Renderer wie die finale Datei) — kein HTML-Klon mehr. Änderungen fühlen sich an wie in Word: man tippt / klickt → kurze Stille → PDF aktualisiert sich von selbst, ohne Flackern, ohne Knopfdruck. Die Schlüssel-Tabelle wird inline live im selben Layout bearbeitet.

## Leitprinzipien

1. **Eine Wahrheit**: nur `generateProtokollPdf` rendert. HTML-Preview entfällt.
2. **Kein Flackern**: alte PDF bleibt sichtbar, bis die neue komplett geladen ist → atomarer Swap.
3. **Kein manueller Knopf**: Rebuild passiert automatisch zum richtigen Zeitpunkt — nicht bei jedem Tastendruck.
4. **Fehler verstecken die letzte gute PDF nie**.

## Wann wird neu gebaut? (Trigger-Modell)

Statt „alle paar ms" oder „nur auf Klick" → kontextabhängig:

- **Tippen in Text/Textarea** (Inhalt, Bemerkungen, Klausel, Namen):
  Debounce **600 ms** nach letztem Tastendruck → Build.
- **Sofort-Trigger** (kein Debounce nötig, da diskret):
  Checkbox, Radio (Art/Richtung), Datum, Uhrzeit, Tabellen-Zeile add/del/move, Tab-Wechsel, Popover-Schluss, Blur eines Inputs.
- **Optionen-Tab** (Sektionstitel, Druckfreundlich, Logo/Footer): Debounce 400 ms.
- **Window blur / Tabwechsel im Browser**: sofortiger Build der letzten Änderung.

Das fühlt sich „magisch" an: bei diskreten Aktionen quasi instant, bei Texteingabe genau eine ruhige Pause nach dem Tippen.

## Anti-Flacker-Architektur

```text
draft ─► semKey ─► scheduler (debounce nach Trigger-Typ)
                       │
                       ▼
                 build queue (max 1 in flight)
                       │
                       ▼
        generateProtokollPdf → ArrayBuffer + hotspots
                       │
                       ▼
   atomic swap:  setPdfBuffer(neu)  +  numPages bleibt, bis onLoadSuccess
```

Konkret:
- `<Document file={...}>` wird **nie unmountet**. Wir wechseln nur den `file`-Prop auf einen frischen `Uint8Array.slice(0)`.
- Vor dem Swap wird die neue PDF in einem versteckten zweiten `<Document>` „vorgeladen" (Off-Screen) — erst wenn `onLoadSuccess` feuert, wird `pdfBuffer` getauscht. So gibt es nie einen weißen Frame.
- Hotspots bleiben sichtbar (alte Koordinaten) bis der neue Build durch ist; dann atomar austauschen.
- Page-Render: `key` bleibt stabil pro Seitenzahl, kein Remount.

## Status-UI (subtil)

Nur ein winziger Indikator oben rechts:
- Ruhezustand: nichts.
- Während Build (>300 ms sichtbar, sonst gar nicht): kleiner Spinner + „aktualisiert…".
- Build-Fehler: dezenter roter Punkt + Tooltip „Letzte Änderung konnte nicht gerendert werden — wird neu versucht". Automatischer Retry 1× nach 1 s.

Kein „Vorschau nicht aktuell", kein „Aktualisieren"-Button. Verschwinden komplett.

## Tabellen-Bearbeitung (Schlüssel)

Beim Klick auf den `schluessel.tabelle`-Hotspot:
- Großer Popover mit **derselben Tabellen-Optik wie in der PDF** (gleiche Spaltenbreiten, gleiche Reihenfolge, gleiche Schrift-Hierarchie via Tailwind-Tokens) — fühlt sich an wie direktes Bearbeiten der PDF.
- Pro Zeile: Bezeichnung, Anzahl, Schlüssel-Nr., Bemerkung. Buttons: + Zeile, ↑ ↓, Duplizieren, Löschen (mit „Sicher?"-Confirm wie bei Belegen).
- Live: jede Änderung in der Tabelle triggert sofort den Sofort-Trigger (kein Debounce für add/del/move; 600 ms Debounce für Text in den Feldern).
- Beim Schließen des Popovers (Klick außerhalb / „Fertig"): sofortiger finaler Build, damit die PDF garantiert synchron ist.
- Hover über eine PDF-Zeile zeigt zusätzlich Inline-Mini-Toolbar (↑ ↓ Duplizieren Löschen) — Pattern aus dem Beleg-Editor übernehmen.

## Umzusetzende Änderungen

### Komponenten

1. **`src/components/protokoll-editor/ProtokollLivePreview.tsx`** (umschreiben)
   - „Vorschau nicht aktuell" + Aktualisieren-Button entfernen.
   - Trigger-API hinzufügen: `useImperativeHandle` oder Context, der von außen `scheduleRebuild(reason: "type" | "discrete" | "blur")` annimmt.
   - Off-Screen-Preload + atomarer Swap (kein Document-Unmount).
   - Auto-Retry 1× bei Build-Fehler.
   - Loader-Indikator nur sichtbar nach 300 ms.

2. **`src/components/protokoll-editor/ProtokollEditorLayout.tsx`**
   - `ProtokollHtmlPreview` entfernen, `ProtokollLivePreview` einsetzen.
   - Neuen `useProtokollRebuildScheduler`-Hook anschließen → leitet jeden `set(...)` weiter und entscheidet Trigger-Typ pro Feld.

3. **`src/components/protokoll-editor/ProtokollHtmlPreview.tsx`** → **löschen**.

4. **`src/components/protokoll-editor/SchluesselTabellePopover.tsx`** (neu)
   - Inline-Tabellen-Editor im PDF-Look, ersetzt den aktuellen Mini-Editor in `ProtokollHotspotEditor` für `schluessel.tabelle`.
   - Sofort-Triggers für strukturelle Änderungen.

5. **`src/components/protokoll-editor/ProtokollHotspotEditor.tsx`**
   - `schluessel.tabelle`-Zweig delegiert an neue Popover-Komponente.
   - Bei Popover-Close: `scheduleRebuild("discrete")`.

### Hooks

6. **`src/hooks/useProtokollEditor.ts`**
   - `set(key, value, opts?: { trigger?: "type" | "discrete" })` erweitern.
   - Standard: textbasierte Felder → `type`, andere → `discrete`.
   - Letzten Trigger-Typ in Ref ablegen, damit Preview-Scheduler ihn lesen kann.

7. **`src/hooks/useProtokollRebuildScheduler.ts`** (neu)
   - Verwaltet Debounce-Timer (600/400/0 ms).
   - Reagiert auf `window.blur`, `visibilitychange` → sofort flush.
   - Reagiert auf `beforeunload` → finaler synchroner Build überspringen (nur Save).

### Hotspot-Map

8. **`src/lib/pdf/fieldMap.ts`** — keine Änderung nötig, falls Hotspots bereits korrekt sind. Sicherstellen, dass `schluessel.tabelle` als „Tabelle" mit `tableActions` markiert ist (analog Beleg-Editor).

### PdfFieldOverlay

9. **`src/components/pdf-editor/PdfFieldOverlay.tsx`** — keine strukturellen Änderungen, nur sicherstellen dass `tableActions` für Protokolle (`onAddRow`) korrekt durchgereicht wird (Protokoll braucht nur `onAddRow`, nicht Stunden/Pauschal — Pattern leicht entkoppeln: optionale Buttons).

## Technische Detail-Notizen

- **Build-Queue**: `inFlightRef` + `queuedKeyRef`. Wenn ein Build läuft und ein neuer Trigger kommt, wird nur der zuletzt angeforderte Key am Ende gebaut. Verhindert Build-Stürme.
- **ArrayBuffer-Detach**: jede `<Document>`-Instanz bekommt `new Uint8Array(buf.slice(0))`. Quelle bleibt für nächsten Swap intakt.
- **Atomarer Swap via Preload**: `pdfjs.getDocument(...)` direkt aufrufen, auf `numPages` warten, dann erst State-Swap. Alternativer simpler Weg: zwei `<Document>`-Elemente übereinander, neues mit `opacity:0` rendern bis `onLoadSuccess`, dann tauschen.
- **Build-Dauer messen**: in Dev als `console.debug("[protokoll-build] Xms")` loggen, um Trigger-Debounces empirisch zu prüfen.
- **Mobile**: identisches Verhalten, gleiche Trigger; Popover-Tabelle wird auf Mobile als Sheet (Drawer) gerendert (nicht Popover).

## Was bewusst NICHT geändert wird

- Backend, `generateProtokollPdf`, Hotspot-Tracker, Autosave-Logik (1.5 s).
- Beleg-Editor (Angebote/Rechnungen) — bleibt vorerst beim alten Knopf-Modell, kann später nach demselben Muster migriert werden.

## Test-Reihenfolge nach Implementierung

1. Schlüsselprotokoll öffnen, in jedem Textfeld tippen → exakt eine Aktualisierung ~600 ms nach Tippstopp, kein Flackern.
2. Checkbox „Empfang bestätigt" toggeln → sofortige Aktualisierung.
3. Tabelle: Zeile hinzufügen / löschen / verschieben → sofort.
4. In Tabellen-Feld tippen → 600 ms Debounce.
5. Popover schließen → finaler Build, garantiert synchron.
6. Während Build erneut tippen → kein Doppel-Build, letzter Zustand gewinnt.
7. Build-Fehler simulieren (z. B. leeren Logo-Cache) → alte PDF bleibt, dezenter Fehler-Punkt, Auto-Retry erfolgreich.

## Rollback-Plan

Falls Probleme auftreten: `ProtokollHtmlPreview` wieder einsetzen ist trivial (eine Zeile in `ProtokollEditorLayout`). Datei daher erst nach 1–2 Tagen Praxis-Test endgültig löschen.
