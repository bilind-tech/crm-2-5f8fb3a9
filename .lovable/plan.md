Ich behebe den Button im geöffneten PDF-Fenster so, dass „PDF bearbeiten“ direkt sichtbar ist und zuverlässig zur richtigen Editor-Seite öffnet.

Geplante Umsetzung:

1. PDF-Dialog um Bearbeiten-Aktion erweitern
- In `PdfViewerDialog` kommt oben rechts neben „Download“ ein eigener Button „PDF bearbeiten“.
- Der Button navigiert je nach Beleg korrekt zu:
  - Rechnung: `/rechnungen/:id/bearbeiten`
  - Angebot: `/angebote/:id/bearbeiten`
- Vor der Navigation wird der PDF-Dialog geschlossen, damit nicht der Eindruck entsteht, dass „nichts passiert“.

2. PDF-Viewer-Button gibt Editor-Ziel weiter
- `PdfViewButton` übergibt dem Dialog die Beleg-ID und den Typ.
- Dadurch funktioniert der Button sowohl aus Rechnungslisten, Angebotslisten als auch Detailseiten.

3. Falls das PDF in einem separaten Browser-/PDF-Tab geöffnet wurde
- Der reine Download/Blob-PDF-Tab kann keine App-Navigation ausführen, weil dort nur die PDF-Datei angezeigt wird.
- Deshalb bleibt die App-interne Vollbild-PDF-Ansicht der richtige Ort für „PDF bearbeiten“.
- Ich mache den Bearbeiten-Button dort klar sichtbar oben rechts, damit du sofort etwas siehst und in den Editor kommst.

4. Konsistenz für Angebote und Rechnungen
- Gleiche Lösung für Angebote und Rechnungen.
- Die bestehenden Detailseiten-Buttons „PDF bearbeiten“ bleiben zusätzlich erhalten.

Technische Änderungen:
- `src/components/pdf/PdfViewerDialog.tsx`: neue optionale `editTarget`-Props, Button „PDF bearbeiten“, Navigation per TanStack Router.
- `src/components/pdf/PdfViewButton.tsx`: Übergabe des passenden Editor-Ziels für Angebot/Rechnung.

Nach Umsetzung sollte der Ablauf so sein:
```text
PDF ansehen öffnen
→ oben rechts „PDF bearbeiten“ klicken
→ PDF-Fenster schließt sich
→ PDF-Editor öffnet sich sichtbar mit Vorschau links und Bearbeitung rechts
```