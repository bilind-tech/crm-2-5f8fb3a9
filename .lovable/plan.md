## Problem

Auf der Kundendetailseite öffnet der Button „Neues Objekt" das `ObjektForm` im `kompakt`-Modus. Aktuell fragt dieser Modus **nur** die Bezeichnung ab — Adresse muss man nachträglich auf der Objekt-Detailseite ergänzen. Das ist umständlich, weil Objekte praktisch immer eine Adresse haben.

## Lösung

Im `kompakt`-Modus von `ObjektForm` zusätzlich Adressfelder anbieten — optional, damit die Schnell-Anlage trotzdem schnell bleibt.

### Änderungen in `src/components/forms/ObjektForm.tsx`

1. **Kompakter Block erweitern** (Zeilen 73–95):
   - Bezeichnung bleibt als Pflichtfeld oben.
   - Darunter Adressfelder hinzufügen — gleiches Layout wie der Voll-Modus:
     - „Straße & Hausnummer" (volle Breite)
     - „PLZ" (1 Spalte) + „Ort" (2 Spalten) im `sm:grid-cols-3`-Grid
   - Alle Adressfelder bleiben **optional** (kein Toast-Error wenn leer).
   - Hinweistext „Adresse später ergänzen…" entfernen, da nicht mehr nötig.

2. **`submit()` anpassen** (Zeilen 45–67):
   - Im `isKompakt`-Zweig die Adressfelder mit übergeben (`strasse`, `plz`, `ort` jeweils `|| undefined`), genau wie im Voll-Modus.
   - Restliche Defaults (`typ: "buero"`, `frequenz: "auf_abruf"`, `reinigungstage: []`, `status: "aktiv"`) bleiben gleich.

### Nicht geändert

- Voll-Modus (`/objekte/neu`) bleibt unverändert.
- Kein neues State, keine API-/Backend-Änderung nötig — `useCreateObjekt` akzeptiert die Felder bereits.
- Objektnummer bleibt im kompakten Modus weiterhin automatisch (kein Feld).

## Ergebnis

Beim Klick auf „Neues Objekt" auf der Kundendetailseite erscheint zusätzlich zur Bezeichnung ein Adressblock (Straße, PLZ, Ort). Adresse ist optional, sodass der schnelle Flow erhalten bleibt, aber direkt mit erfasst werden kann.
