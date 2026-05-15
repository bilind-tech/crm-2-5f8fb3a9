## Problem

Die neue Fehlermeldung ist sehr wahrscheinlich eine Folge der letzten Änderung:

```text
Failed to execute 'postMessage' on 'Worker': ArrayBuffer at index 0 is already detached.
```

Das heißt: PDF.js bekommt aktuell `Uint8Array`/`ArrayBuffer`-Daten. Der PDF.js-Worker übernimmt diese Daten intern per `postMessage` und kann den Buffer dabei „detachen“. Wenn dieselben Binärdaten danach durch React-Render, Cache, StrictMode, Hidden-Preloader oder erneutes Öffnen nochmal verwendet werden, ist der Buffer bereits unbrauchbar. Deshalb klappt es in der Lovable-Preview zufällig, aber auf dem Pi/Browser-Setup nicht zuverlässig.

Der vorherige Fix gegen `blob:`-URL-Probleme war also in die richtige Richtung gedacht, hat aber eine zweite PDF.js-Falle ausgelöst: wiederverwendete `ArrayBuffer`/`Uint8Array`-Objekte.

## Ziel

PDFs sollen auf dem Pi stabil funktionieren:

- kleine Vorschau auf Rechnungs-Detailseite
- kleine Vorschau auf Angebots-Detailseite
- „PDF ansehen“-Dialog
- „PDF bearbeiten“-Editor-Live-Vorschau für Rechnungen
- „PDF bearbeiten“-Editor-Live-Vorschau für Angebote
- keine Detailseiten-Crashes, auch wenn die PDF-Anzeige intern fehlschlägt
- Fehler sollen verständlicher werden, falls doch etwas kaputt ist

## Sicherer Lösungsansatz

### 1. Keine wiederverwendeten `Uint8Array` direkt an PDF.js geben

In `PdfCanvasViewer` wird aktuell aus dem Blob einmal ein `Uint8Array` gebaut und dann als `file={{ data: pdfData }}` an `react-pdf` gegeben.

Das wird geändert auf:

- Blob bleibt die Hauptquelle im React-State/Cache.
- Direkt vor der Übergabe an PDF.js wird eine frische Kopie erzeugt.
- Der Viewer bekommt nie denselben `ArrayBuffer` zweimal.

Praktisch bedeutet das: nicht `new Uint8Array(buf)` wiederverwenden, sondern pro PDF.js-Ladevorgang eine frische, nicht-detachte Kopie übergeben, z. B. über `slice()`/kopierten Buffer.

### 2. `PdfCanvasViewer` bekommt einen internen „safe file source“-Mechanismus

Der Viewer soll intern entscheiden:

1. Wenn `pdfBlob` vorhanden ist: daraus frische PDF-Daten für PDF.js erzeugen.
2. Wenn das scheitert: nicht crashen, sondern auf `pdfUrl` als Fallback zurückgehen.
3. Wenn auch das scheitert: kurze UI-Meldung mit Diagnose anzeigen.

Wichtig: Download/Öffnen darf weiterhin `pdfUrl` nutzen. Nur das Canvas-Rendering wird abgesichert.

### 3. Automatischer Einmal-Retry bei genau diesem Fehler

Wenn PDF.js meldet:

```text
ArrayBuffer ... already detached
```

soll der Viewer automatisch einmal eine neue Kopie aus dem Blob bauen und erneut laden.

Der User sieht dann im Normalfall gar keinen roten Fehler mehr. Nur wenn der zweite Versuch scheitert, erscheint die Fehlermeldung.

### 4. Live-PDF-Editor umbauen: kein gespeichertes `Uint8Array` als dauerhafte Quelle

`LivePdfPreview.tsx` speichert aktuell `pdfData` und `pendingData` als `Uint8Array`. Genau dort kann derselbe Fehler ebenfalls entstehen, besonders durch den versteckten Preloader.

Das wird geändert auf:

- `pdfBlob` und `pendingBlob` im State speichern
- für jedes `<Document>` eine frische Datenkopie erzeugen
- der atomare Swap bleibt erhalten: alte Vorschau bleibt sichtbar, bis neue Vorschau erfolgreich geladen wurde
- falls die versteckte Pending-Vorschau scheitert, bleibt die alte Vorschau sichtbar

### 5. PDF.js-Worker auf Pi prüfen und robust halten

`pdfjsWorker.ts` ist grundsätzlich richtig konfiguriert. Ich würde aber sicherstellen, dass im SPA-/Pi-Build der Worker immer aus den gebauten Assets kommt und nicht zufällig auf einen falschen Pfad oder CDN-Fallback fällt.

Falls nötig:

- Worker-URL weiter über Vite `new URL(...)` bündeln
- im Fehlerfall sauber diagnostizieren
- keine Änderung am Backend oder Datenverzeichnis

### 6. Bessere Diagnoseanzeige, aber ohne die Seite kaputt zu machen

In der PDF-Fehlerfläche soll ein kleiner technischer Bereich stehen/kopierbar sein mit:

- Bereich: Detail-Vorschau, Dialog oder Editor
- Quelle: Blob oder URL
- Blob-Größe
- Fehlertext
- Retry-Anzahl

Damit kannst du mir beim nächsten Mal einen konkreten Output schicken, ohne dass die ganze Rechnungs-/Angebotsseite unbrauchbar wird.

### 7. Begrenzte Dateiänderungen

Ich würde nur diese Dateien anfassen:

- `src/components/pdf/PdfCanvasViewer.tsx`
- `src/components/pdf-editor/LivePdfPreview.tsx`
- optional `src/lib/pdf/pdfjsWorker.ts`, nur falls für Pi-Build nötig

Die Detailseiten `rechnungen.$id.tsx` und `angebote.$id.tsx` würde ich diesmal nicht anfassen, weil sie inzwischen wieder öffnen und das Risiko dort unnötig wäre.

## Technische Details

Der Kernfehler entsteht, weil PDF.js Daten an einen Worker übergibt. Dabei können `ArrayBuffer` aus Performance-Gründen transferiert werden. Transferiert heißt: der ursprüngliche Buffer ist danach „detached“. Wenn React oder `react-pdf` denselben Buffer später nochmal sieht, kommt genau diese Meldung.

Deshalb darf PDF.js nie ein wiederverwendetes Buffer-Objekt aus React-State oder React-Query-Cache bekommen. Der stabile Weg ist:

```text
Blob im Cache behalten
→ pro Document-Load frischen ArrayBuffer aus Blob erstellen
→ frische Kopie an PDF.js geben
→ bei detached-Fehler einmal neu kopieren und retry
```

## Validierung nach Umsetzung

Nach der Umsetzung sollte gezielt geprüft werden:

1. Rechnung-Detailseite öffnet.
2. Angebots-Detailseite öffnet.
3. Inline-PDF-Vorschau rendert.
4. „PDF ansehen“ rendert.
5. „PDF bearbeiten“ öffnet und zeigt Live-Vorschau.
6. Dasselbe für Angebot und Rechnung.
7. Im gebauten Pi-SPA-Bundle darf kein alter `PdfCanvasViewer` mehr vorhanden sein, der direkt `file={pdfUrl}` oder wiederverwendetes `Uint8Array` nutzt.

## Warum dieser Plan sicherer ist

- Er ändert nicht erneut die Rechnungs-/Angebotslogik.
- Er greift genau die neue Fehlermeldung an.
- Er berücksichtigt den Unterschied Lovable-Preview vs. Pi.
- Er verhindert, dass ein PDF-Viewer-Fehler wieder die ganze Detailseite kaputt macht.

<presentation-actions>
<presentation-link url="https://docs.lovable.dev/tips-tricks/troubleshooting">Troubleshooting docs</presentation-link>
</presentation-actions>