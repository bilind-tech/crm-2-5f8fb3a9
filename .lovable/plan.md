Ich werde das jetzt nicht wieder nur oberflächlich anfassen, sondern an den zwei tatsächlichen Ursachen sauber korrigieren:

1. **Pauschalblock/Tabelle auf Seite 1 erzwingen**
   - In der Frontend-PDF-Vorschau wird die Leistungstabelle aktuell weiterhin als echte pdfmake-Tabelle mit einer extrem hohen Pauschal-Zelle gebaut. Genau solche riesigen Tabellenzeilen kann pdfmake nicht zuverlässig innerhalb einer Seite aufteilen; dadurch wird die Tabelle auf Seite 1 leer/verschoben.
   - Ich baue Pauschalpositionen deshalb nicht mehr als eine riesige Tabellenzeile, sondern als einen eigenen PDF-Block mit Tabellenrahmen: Beschreibung links, Abrechnungsart/Preis rechts. Die Beschreibung selbst darf natürlich über Seite 1, 2, 3 weiterlaufen.
   - Normale Einzel-/Stundenpositionen bleiben weiter als Tabelle erhalten.
   - Der Summenblock bleibt separat und wird nicht zerschnitten.
   - Dasselbe Layout wird auch im Backend-PDF angepasst, damit Vorschau, Download, Druck und Drive-PDF identisch funktionieren.

2. **Empfänger-Adresse aus Objekt wirklich laden**
   - Die aktuelle Bearbeiten-Seite sucht das Objekt nur im bereits geladenen Kunden-Detail (`kunde.objekte`). Wenn diese Liste leer/alt/nicht vollständig ist, kommt trotz gewähltem Objekt keine Adresse in der Vorschau an.
   - Ich lade das gewählte Objekt zusätzlich direkt per `useObjekt(rechnung.objektId)` und verwende dieses Objekt bevorzugt für die PDF-Vorschau.
   - Das gleiche mache ich für Angebote, damit beide Belegarten gleich funktionieren.

3. **Adresslogik korrekt machen**
   - Wenn ein Objekt ausgewählt ist und dort eine Adresse hinterlegt ist, wird diese Objekt-Adresse im Empfängerbereich verwendet.
   - Falls das Objekt keine Adresse hat, fällt es auf die Kundenadresse zurück.
   - Firmen-/Personenname bleibt wie bisher vom Kunden/Ansprechpartner.

4. **Noch vorhandenen Preis-0-Fehler in der Rechnungsliste korrigieren**
   - In der Rechnungsübersicht wird der Status/Preis noch mit alter Summenlogik berechnet und Pauschalpositionen können dort als 0 erscheinen.
   - Ich passe die Berechnung so an, dass Pauschalpreise überall denselben Betrag ergeben wie im Detail und PDF.

5. **Prüfung nach dem Fix**
   - Ich prüfe per gezieltem TypeScript-/Suchcheck, dass alle PDF-Generator-Aufrufe das Objekt weitergeben.
   - Außerdem prüfe ich die betroffenen Layoutstellen, damit keine `keepWithHeaderRows`/riesige Tabellenzeile mehr den Pauschalblock von Seite 1 wegdrücken kann.