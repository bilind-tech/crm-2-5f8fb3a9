## Problem

Auf der Rechnungen-Seite öffnet „Aus Dauerauftrag" einen Dialog, der **leer** bleibt, obwohl du Rechnungen mit dem Häkchen „Wiederkehrend/Dauerauftrag" angelegt hast.

## Ursache

Beim Anlegen einer Rechnung gibt es zwei getrennte Konzepte, die heute nicht miteinander verbunden sind:

1. **`Rechnung.optionen.wiederkehrend = true`** — nur ein Marker auf einer einzelnen Rechnung. Macht das kleine Repeat-Icon in der Liste sichtbar, mehr nicht.
2. **`Dauerauftrag`-Datensatz** in `d.dauerauftraege` — die eigentliche wiederkehrende Vorlage, aus der der Generator monatlich Rechnungen erzeugt. Wird heute nur über die Kunden-Anlage oder das Kunden-Detail erzeugt.

Der Dialog „Aus Dauerauftrag erzeugen" liest ausschließlich aus `d.dauerauftraege`. Da deine Test-Rechnungen nur Marker (1) gesetzt haben, ohne eine echte Dauerauftrag-Vorlage (2), zeigt der Dialog korrekt „nichts gefunden".

## Fix

Wenn du beim Anlegen/Bearbeiten einer Rechnung „Wiederkehrend" anhakst, soll **automatisch im Hintergrund ein Dauerauftrag** angelegt werden, der dann im Dialog auftaucht und vom Scheduler bedient wird.

### Verhalten

- **Neue Rechnung mit Häkchen „Wiederkehrend"** → nach `POST /rechnungen` wird zusätzlich ein `Dauerauftrag` für denselben Kunden erzeugt mit:
  - Bezeichnung = Rechnungstitel
  - Positionen = übernommen aus der Rechnung (ohne MwSt-Aufschlag, Netto wie eingegeben)
  - Frequenz/Stichtag/Modus = aus `wiederkehrendDetails` der Rechnung (oder Defaults aus `dauerauftragEinstellungen`, falls leer)
  - Status = `aktiv`
  - kundeId, objektId = von der Rechnung übernommen
  - Verknüpfung: die ursprüngliche Rechnung wird als „Erstrechnung" registriert; ein Lauf für die aktuelle Periode wird auf `manuell-erstellt` gesetzt, damit der Generator nicht doppelt abrechnet.
- **Bestehende Rechnung wird auf „Wiederkehrend" umgestellt** (PATCH) → gleicher Effekt, falls noch kein Dauerauftrag für (kunde+titel) existiert.
- **Häkchen wieder entfernen** → der zugehörige Dauerauftrag bleibt erhalten (kein automatisches Löschen — sonst Datenverlust). Hinweis-Toast: „Bestehender Dauerauftrag bleibt aktiv. Zum Beenden öffne ihn beim Kunden."
- **Rechnung mit Wiederkehrend wird gelöscht** → Dauerauftrag bleibt unangetastet.

### Toast-Feedback

Nach erfolgreichem Speichern einer wiederkehrenden Rechnung:
„Rechnung gespeichert · Dauerauftrag {DA-2026-0007} angelegt"

### UI-Anpassungen

- **Dialog „Rechnungen aus Daueraufträgen erzeugen"**: Empty-State-Text bleibt, ist aber durch den Auto-Dauerauftrag praktisch nicht mehr erreichbar.
- **Filter „Nur Daueraufträge anzeigen"** auf der Rechnungsliste: bleibt wie er ist, zeigt weiterhin Rechnungen mit dem Marker.
- **Kunden-Detail / Daueraufträge-Tab**: zeigt den neuen Dauerauftrag automatisch, da er ganz normal in `d.dauerauftraege` landet.

## Geänderte Dateien

- `src/lib/mock/backend.ts` — in `POST /rechnungen` und `PATCH /rechnungen/:id`: wenn `optionen.wiederkehrend` neu gesetzt wird, Auto-Dauerauftrag erzeugen, Lauf für aktuelle Periode als `manuell-erstellt` mit Verweis auf die Rechnungs-ID anlegen. Hilfsfunktion `erzeugeDauerauftragAusRechnung(d, rechnung)`.
- `src/hooks/useApi.ts` — `useCreateRechnung` und `useUpdateRechnung`: nach Erfolg auch `["dauerauftraege"]` und `["dauerauftrag-laeufe"]` invalidieren.
- `src/components/forms/RechnungForm.tsx` — Toast-Text leicht anpassen, wenn Server-Antwort `dauerauftragErzeugt: { nummer }` enthält.

## Was NICHT geändert wird

- Der bestehende Weg „Dauerauftrag direkt beim Kunden anlegen" bleibt unverändert.
- Der Scheduler/Generator bleibt unverändert — er findet die neuen DAs automatisch.
- Keine Änderung am Datenmodell `Rechnung` oder `Dauerauftrag`.

## Was du danach siehst

1. Häkchen „Wiederkehrend" beim Anlegen einer Rechnung setzen, speichern.
2. Toast bestätigt: „Dauerauftrag DA-2026-XXXX angelegt".
3. Klick auf „Aus Dauerauftrag" → der Dauerauftrag erscheint in der Liste, mit Hinweis „bereits erzeugt für 2026-05" (weil die Erstrechnung schon zählt).
4. Im nächsten Monat erzeugt der Scheduler automatisch die Folgerechnung.
