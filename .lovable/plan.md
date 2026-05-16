## Ziel
Der QR-Handy-Upload muss auf iPhone und Android sichtbar und nachvollziehbar funktionieren: Nach Kamera oder Galerie-Auswahl muss das Bild sofort auf der Handy-Seite erscheinen, danach hochgeladen werden, und bei Fehlern muss klar sichtbar sein, was passiert ist.

## Problem, das ich behebe
Aktuell wird der Datei-Input direkt im `onChange` geleert. Auf iOS/Safari kann das dazu führen, dass die ausgewählte Datei nicht zuverlässig übernommen wird. Zusätzlich startet der Upload sofort und der sichtbare Zustand hängt davon ab, ob Datei-Übernahme, Preview-Erzeugung und Upload sauber durchlaufen. Wenn einer dieser Schritte scheitert, sieht man zu wenig.

## Umsetzung
1. **Datei-Auswahl iPhone-sicher machen**
   - Datei-Liste im `onChange` sofort synchron in ein echtes Array kopieren.
   - `input.value = ""` erst nach dieser Kopie und nicht vor der Verarbeitung ausführen.
   - Separate Refs für Kamera und Galerie verwenden, damit erneutes Auswählen derselben Datei sauber funktioniert.

2. **Preview immer sofort anzeigen**
   - Direkt nach Auswahl einen sichtbaren Eintrag erzeugen.
   - Bilder mit `URL.createObjectURL(file)` anzeigen.
   - Falls Object-URL/Preview scheitert, trotzdem eine sichtbare Dateikachel mit Dateiname, Größe und Status anzeigen.

3. **Upload erst nach sichtbarer Übernahme starten**
   - Neuer Statusfluss: `Ausgewählt` → `Wird vorbereitet` → `Wird hochgeladen` → `Gespeichert` oder `Fehler`.
   - Die Datei bleibt auf der Handy-Seite stehen, auch nach Erfolg oder Fehler.

4. **Fehler-Diagnose direkt auf dem Handy einbauen**
   - Bei jedem Fehler wird eine klare Fehlermeldung mit Code angezeigt.
   - Zusätzlich ein kleiner Bereich „Fehlerdetails kopieren“ auf der Handy-Seite, damit du mir den echten Fehler schicken kannst.
   - Erfasst werden unter anderem: Browser, Dateiname, Dateityp, Dateigröße, Session-Token gekürzt, Schritt, HTTP-Status und Fehlermeldung.

5. **Upload-API robuster machen**
   - `postWithProgress` bekommt sichere JSON-Fehlerbehandlung, falls das Backend kein sauberes JSON zurückgibt.
   - Upload-Timeout klarer melden.
   - Nach erfolgreichem Upload wird die Session einmal neu abgefragt, damit „am PC sichtbar“ erst kommt, wenn der Server die Datei wirklich kennt.

6. **PC-Dialog weiter synchron halten**
   - Die vorhandene Live-Abfrage bleibt.
   - Bei neu empfangener Datei wird die Dokumentenliste invalidiert, damit sie sofort erscheint.

## Dateien
- `src/routes/m.upload.$session.tsx`
- `src/lib/dokument/upload.ts`
- `src/lib/api/piClient.ts`
- bei Bedarf klein: `src/components/dokumente/HandyScanDialog.tsx`

## Nicht betroffen
- Keine Änderungen an Datenordnern, Backup, Restore oder System-Update.
- Kein automatischer E-Mail-Versand.
- Keine Cloud-Umstellung.