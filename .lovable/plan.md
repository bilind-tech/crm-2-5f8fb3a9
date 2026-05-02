## Ziel

1. Ansprechpartner können nach dem Anlegen jederzeit vollständig bearbeitet werden (Inline-Edit auf der Kunden-Detailseite, Tab "Ansprechpartner").
2. Das Objekt-Formular (Anlegen) wird vereinfacht: **Frequenz** und **Quadratmeter** komplett raus. Stattdessen Pflichtfelder/Eingaben für **Name**, **Objektnummer** (manuell oder automatisch) sowie **vollständige Adresse** (Straße, PLZ, Ort).
3. Objekt-Detailseite: Adresse prominent anzeigen, Frequenz-/m²-Zeilen entfernen.
4. Objekte können auch im Nachhinein bearbeitet werden (gleiche Felder wie beim Anlegen).

---

## 1. Ansprechpartner bearbeiten — `src/components/kunden/AnsprechpartnerTab.tsx`

Komponente erweitern:
- Zustand `editId: string | null` zusätzlich zu `showForm`.
- "Bearbeiten"-Button (Stift-Icon) pro Listeneintrag, neben "Als primär" / "Löschen".
- Klick auf Bearbeiten → öffnet dasselbe Form-Panel wie "Neu", aber befüllt mit den vorhandenen Werten und im Edit-Modus.
- Speichern im Edit-Modus ruft `useUpdateAnsprechpartner` mit `{ id, ...felder }` auf statt `useCreateAnsprechpartner`.
- Header des Form-Panels zeigt "Ansprechpartner bearbeiten" vs. "Neuer Ansprechpartner".
- Abbrechen schließt das Panel und setzt `editId = null`.
- "Als primär"-Toggle bleibt im Edit-Form ebenfalls bedienbar (mit korrekter Demote-Logik wie beim Anlegen).

Keine API-Änderungen nötig — Hook existiert bereits.

---

## 2. Objekt-Formular vereinfachen — `src/components/forms/ObjektForm.tsx`

Entfernen:
- Feld "m² zu reinigen" (`qmZuReinigen`)
- Feld "Reinigungsfrequenz" (`frequenz` Select)
- Feld "Objekttyp" (`typ` Select) — passt nicht mehr ins schlanke Formular
- Feld "Zugang / Hinweise" — auf Detailseite editierbar (optional behalten? **entfernen**, da User explizit "nur Name und Objektnummer" + Adresse will)

Behalten / hinzufügen:
- **Kunde** (Select, Pflicht)
- **Objektnummer** (neues Feld, optional — wenn leer, generiert Backend automatisch wie bisher; manuell eintippbar als Override)
- **Bezeichnung / Name** (Pflicht)
- **Straße & Hausnummer**
- **PLZ** + **Ort**

Submit-Defaults für entfernte Pflichtfelder im Datenmodell:
- `typ: "buero"` (fester Default, da Pflicht im Typ)
- `frequenz: "auf_abruf"` (fester Default)
- `reinigungstage: []`
- `status: "aktiv"`

Der `kompakt`-Zweig (Schnell-Anlage im Kunden-Detail) bleibt unverändert (nur Bezeichnung).

---

## 3. Objekt-Detailseite — `src/routes/objekte.$id.tsx`

- Frequenz, Tage, m²-Zeile entfernen.
- Adresse + Zugang in der Detail-Card behalten.
- "Bearbeiten"-Button hinzufügen, der einen `ObjektBearbeitenDialog` öffnet (analog zu `KundeBearbeitenDialog`).

## 4. Neue Komponente `src/components/forms/ObjektBearbeitenDialog.tsx`

- Dialog (gleicher Stil wie `KundeBearbeitenDialog`: `w-[calc(100vw-1rem)]`, `overflow-x-hidden`, `bg-background`).
- Felder: Name, Objektnummer, Straße, PLZ, Ort, Status (aktiv/pausiert/beendet).
- Verwendet `useUpdateObjekt(id)` (existiert bereits).
- Speichern → Toast + Close.

## 5. Objekt-Listenansicht — `src/routes/objekte.tsx`

- Tabellenspalten "Frequenz" und "m²" entfernen, dafür Spalte "Adresse" (Straße + PLZ Ort) ergänzen.
- Mobile Card: Frequenz/m² aus `meta` entfernen, stattdessen Straße zeigen.

---

## Nicht-Ziele

- Datenmodell `Objekt` bleibt unverändert (Felder existieren weiterhin im Type, werden nur in der UI nicht mehr eingeben/anzeigen).
- Keine Migration vorhandener Datensätze nötig.
- `ObjektForm` `kompakt`-Modus (im Kunden-Detail) bleibt wie er ist.
