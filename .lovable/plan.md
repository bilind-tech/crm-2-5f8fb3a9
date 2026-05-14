## Ziel
Die Kundendetailseite muss auf dem Raspberry Pi zuverlässig funktionieren:

- Klick auf einen Kunden öffnet die Detailseite ohne Crash.
- Reload auf `/kunden/<id>` zeigt die App, nicht rohen JSON-Text.
- Der Fix muss nach „Jetzt aktualisieren“ wirklich im ausgelieferten Build landen.

## Was ich jetzt als Ursache sehe
Der aktuelle Code enthält bereits den richtigen Ansatz, aber auf deinem Pi kommt offenbar noch nicht der neue, gebaute Frontend-/Backend-Stand an.

Zusätzlich ist im aktuell vorhandenen gebauten Frontend (`dist-spa/assets/kunden._id-...js`) noch eine alte gefährliche Version sichtbar: Dort wird weiterhin direkt auf `s.objekte.filter`, `s.ansprechpartner.length`, `s.notizen.length` usw. zugegriffen. Wenn das Backend eine ältere/teilweise Kundenantwort liefert, crasht genau diese gebaute Datei weiterhin.

Das bedeutet: Wir müssen nicht nur den Quellcode fixen, sondern auch sicherstellen, dass der Release-/Update-Prozess den neuen sicheren Build erzeugt und verteilt.

## Umsetzungsplan

### 1. Gebauten SPA-Stand erneuern und absichern
Ich sorge dafür, dass der Pi-Update-Prozess garantiert den aktuellen SPA-Build verwendet, nicht alte `dist-spa`-Artefakte.

- Release-Bundle soll vor dem Packen immer frisch bauen.
- Alte/liegengebliebene `dist-spa`-Dateien dürfen nicht versehentlich weiter ausgeliefert werden.
- Nach dem Build wird geprüft, dass die gebaute Kundendetail-Datei nicht mehr die alten riskanten Zugriffe enthält.

### 2. Kunden-Detailseite vollständig crash-sicher machen
Die Detailseite wird so gehärtet, dass sie auch mit unvollständigen Backend-Antworten stabil bleibt.

- Alle Listen werden lokal normalisiert:
  - `ansprechpartner`
  - `objekte`
  - `angebote`
  - `rechnungen`
  - `dokumente`
  - `notizen`
  - `tags`
- Alle Zähler und Dialoge verwenden nur noch diese normalisierten Listen.
- Der Löschdialog bekommt ebenfalls eine sichere Kunden-Ansicht, damit `kunde.objekte.length` usw. nicht mehr crashen kann.
- Felder wie `o.frequenz` werden defensiv behandelt, damit fehlende Werte keine Fehler werfen.

### 3. Backend-SPA-Fallback stärker machen
Der bisherige Fallback erkennt `Accept: text/html`. Das ist korrekt, aber ich mache ihn robuster:

- Browser-Navigation auf bekannten Frontend-Routen bekommt immer `index.html`.
- API-/Fetch-Aufrufe mit `Accept: application/json` bekommen weiter JSON.
- `/kunden/kuerzel-frei` und andere echte API-Sonderpfade bleiben API.
- Wenn ein Browser versehentlich `Accept: */*` sendet, soll das für bekannte Frontend-Routen trotzdem als Seitenaufruf behandelt werden können.

### 4. Tests erweitern
Ich ergänze Tests genau gegen diesen Wiederholungsfehler:

- `/kunden/<id>` + HTML-Request → `index.html`.
- `/kunden/<id>` + JSON-Request → JSON.
- `/kunden/kuerzel-frei` bleibt API.
- Kunden-Detail-Frontend darf mit minimaler Antwort nicht crashen.
- Release-Bundle enthält einen aktuellen SPA-Build.

### 5. Update-Prozess sichtbar verlässlich machen
Der Code soll verhindern, dass du wieder im Zustand „Update geklickt, aber alter Build läuft weiter“ landest.

- Update-Vorbereitung prüft `dist/index.html` und Backend-Build vor dem Umschalten.
- Wenn der Build fehlt oder alt ist, wird eindeutig abgebrochen statt halb zu aktualisieren.
- Die bestehende Trennung von Code und Daten bleibt unangetastet.
- Vor Update/Restore wird weiterhin kein Datenverzeichnis gelöscht oder überschrieben.

## Technische Details

```text
Browser Reload /kunden/<id>
  -> Accept HTML oder bekannte SPA-Route
  -> Backend liefert dist/index.html
  -> React lädt Kunden-Detailseite
  -> API-Client fordert /kunden/<id> mit Accept: application/json an
  -> Backend liefert JSON
  -> Frontend normalisiert fehlende Arrays
  -> Seite rendert stabil
```

## Erwartetes Ergebnis
Nach Umsetzung und anschließendem Pi-Update gilt:

- Kundenliste öffnen.
- Kunde anklicken.
- Detailseite lädt stabil.
- Seite neu laden.
- Es erscheint kein roher JSON-Text mehr.
- Auch ältere/unvollständige Kundenantworten lösen keinen `Something went wrong`-Crash mehr aus.