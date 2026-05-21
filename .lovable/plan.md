## Ultimativer Plan

### 1. Empfängeradresse: nicht mehr „hoffen“, sondern erzwingen

**Ziel:** Oben links im Empfängerblock steht weiterhin Kunde/Firma + Ansprechpartner, aber die Adresse kommt zwingend vom ausgewählten Objekt, wenn die Rechnung ein `objektId` hat.

Ich ändere dafür die PDF-Datenkette so, dass die Objekt-Adresse nicht mehr unterwegs verloren gehen kann:

- In der PDF-Erzeugung wird eine eindeutige Funktion genutzt:
  - Name/Firma vom Kunden
  - Ansprechpartner bleibt vom Kunden/Ansprechpartner
  - Straße, PLZ, Ort, Land zuerst vom Objekt
  - nur wenn das Objekt keine Adresse hat, Fallback auf Kundenadresse
- In der Rechnungs-Detailseite wird das Objekt direkt zur Rechnung geladen und an die PDF-Erzeugung gekoppelt.
- In `useRechnungPdf` wird gewartet, bis das Objekt geladen ist, wenn `rechnung.objektId` existiert. Dadurch wird die PDF nicht vorher ohne Objekt-Adresse gebaut und dann aus dem Cache weiter angezeigt.
- Die PDF-Cache-Keys werden um `objektId` und `objekt.geaendertAm` erweitert, damit nach Objekt-/Adressänderungen sicher eine neue PDF erzeugt wird.
- Falls ein Pi-Backend-PDF kommt, wird die serverseitige PDF-Erzeugung genauso geprüft/angepasst, damit Browser-Vorschau und echtes Backend-PDF dieselbe Adresse nutzen.

### 2. Bestehender Cache darf keine falsche alte PDF mehr anzeigen

**Problem:** Selbst wenn der Code richtig ist, kann eine alte PDF weiter sichtbar sein, wenn React Query oder PDF-Cache sie wiederverwendet.

Ich mache deshalb:

- PDF-Query-Key nicht mehr nur `rechnung.id`, sondern zusätzlich relevante PDF-Daten:
  - `rechnung.geaendertAm`
  - `rechnung.objektId`
  - `objekt.geaendertAm`
  - `kunde.geaendertAm`
- Beim Objekt-Update wird zusätzlich der betroffene Kunde invalidiert, damit eingebettete `kunde.objekte` nicht alt bleiben.
- Für Detailseite/Preview wird die PDF erst als „ready“ genommen, wenn die Objekt-Abhängigkeit fertig ist.

### 3. Detailseite unten rechts: alle PDF-Seiten anzeigen

**Root Cause ist klar:** `PdfPreviewCard` übergibt aktuell `firstPageOnly` an `PdfCanvasViewer`. Dadurch wird absichtlich nur Seite 1 gerendert.

Ich ändere:

- `PdfPreviewCard` zeigt standardmäßig alle Seiten.
- Die Scroll-Fläche bleibt erhalten (`max-h-[70vh] overflow-y-auto`), damit Seite 1, Seite 2, Seite 3 usw. untereinander erscheinen.
- Optional bleibt die Komponente technisch fähig, nur Seite 1 zu zeigen, aber auf Rechnungs-/Angebots-Detailseiten wird sie nicht mehr so genutzt.

### 4. Auch Angebote mitziehen, weil dieselbe PDF-Komponente genutzt wird

Damit derselbe Fehler nicht beim Angebot weiterlebt:

- `useAngebotPdf` bekommt dieselbe Objekt-Warte-/Cache-Logik.
- Angebots-Detailseite nutzt dieselbe mehrseitige Vorschau.
- PDF-Adresslogik bleibt identisch für Angebot und Rechnung.

### 5. Release-/Bundle-Falle prüfen

Im Kontext ist sichtbar, dass ein gebautes `dist-spa`-Asset noch `firstPageOnly: true` enthält und alte Logik haben kann. Deshalb prüfe ich zusätzlich:

- Keine manuelle Datenänderung, keine Datenbank-Migration.
- Source-Code wird korrekt angepasst.
- Falls im Projekt gebaute Assets für den Pi-Release mitgeführt werden, stelle ich sicher, dass der nächste Release-Build die neue Vorschau- und Adresslogik enthält und nicht alte Chunks ausliefert.

### 6. Abschlussprüfung

Nach Umsetzung prüfe ich konkret:

- Suche: Es darf auf Detailseiten kein hartes `firstPageOnly` mehr aktiv sein.
- Suche: `generateRechnungPdf` und `rechnungDocDef` bekommen Objekt-Daten.
- Suche: `useRechnungPdf` wartet bei vorhandener `objektId` auf das Objekt.
- Suche: PDF-Key enthält Objekt-/Kundenänderungen, damit keine alte PDF hängen bleibt.

**Ergebnis nach Umsetzung:**

- Rechnung mit Objekt A zeigt im Empfängerblock Adresse von Objekt A.
- Rechnung mit Objekt B zeigt Adresse von Objekt B.
- Ansprechpartner bleibt gleich.
- Rechnung ohne Objekt fällt sauber auf Kundenadresse zurück.
- Detailseite zeigt unten rechts alle PDF-Seiten, nicht nur Seite 1.