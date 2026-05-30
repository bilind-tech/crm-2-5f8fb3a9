# Empfänger nicht fett + Druck passt auf A4

## 1. Empfänger-Adressblock: Firmenname nicht mehr fett

In allen PDF-Generatoren (Angebot, Rechnung, Übergabeprotokoll, Schlüsselübergabe) wird die erste Zeile des Empfänger-Blocks aktuell mit `bold: i === 0` fett gesetzt. Das wird in folgenden Dateien entfernt — die Adresszeilen erscheinen einheitlich in normaler Schriftstärke:

- `src/lib/pdf/belegPdf.ts` (Zeile ~661, Frontend-Beleg-PDF)
- `backend/src/pdf/layout.ts` (Zeile ~471, Backend-Beleg-PDF)
- `src/lib/pdf/werkzeugePdf.ts` (Zeilen ~356 und ~538, Übergabe-/Schlüsselprotokoll)

Reihenfolge und Inhalt der Zeilen bleiben unverändert (Firmenname, Person, Straße, PLZ Ort).

## 2. Druckdialog: PDF passt sauber auf A4, mehrseitig

Aktuell rendert `src/lib/pdf/printBlob.ts` jede PDF-Seite als PNG in ein Iframe mit:
```css
@page { size: A4; margin: 0; }
.page img { width: 100%; height: auto; }
```
Das führt im macOS-Druckdialog dazu, dass das Bild oben angeschnitten wird (Logo halb abgeschnitten), weil `height: auto` die Bildhöhe nicht an die A4-Seite bindet und Browser/Drucker eigene Skalierung anwenden.

Fix in `src/lib/pdf/printBlob.ts` (Funktion `buildPrintHtml`): Bild fest auf A4-Maße zwingen, jede Seite genau eine A4-Seite, mehrseitige PDFs sauber umbrechen:
```css
@page { size: A4; margin: 0; }
html, body { margin: 0; padding: 0; background: #fff; }
.page {
  width: 210mm;
  height: 297mm;
  page-break-after: always;
  overflow: hidden;
}
.page:last-child { page-break-after: auto; }
.page img {
  width: 210mm;
  height: 297mm;
  display: block;
  object-fit: contain;
}
```

Damit:
- jede Seite belegt exakt eine A4-Seite (kein Anschnitt oben, Logo vollständig sichtbar),
- `object-fit: contain` verhindert Verzerrung, falls der PDF-Renderer minimal abweichende Proportionen liefert,
- mehrseitige Rechnungen brechen automatisch auf Seite 2, 3 … um (via `page-break-after: always`).

Der eigentliche PDF-Inhalt (pdfmake-Layout, Seitenränder, Tabellen-Umbruch) bleibt unverändert — die Mehrseitigkeit funktioniert dort bereits über pdfmake und wird durch die CSS-Anpassung nur korrekt im Druckdialog wiedergegeben.

## Out of Scope

- Keine Änderungen an pdfmake-Seitenrändern, Header, Footer oder Tabellen.
- Keine Backend-/Datenänderungen.
- Keine UI-Änderungen außerhalb der PDF-Generierung.
