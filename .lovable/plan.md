## Bug

Im `KundeBearbeitenDialog` wird beim Speichern jedes leere Stammdaten-Feld als `undefined` übergeben (`strasse: strasse || undefined`, dasselbe für `plz`, `ort`, `telefon`, `email`, `firmenname`, `vorname`).

Beim JSON-Serialisieren entfernt `JSON.stringify` `undefined`-Keys vollständig — der PATCH-Request enthält das Feld dann gar nicht. Das Backend (`updateKunde` in `backend/src/kunden/repo.ts`) iteriert nur über tatsächlich gesendete Keys → der alte DB-Wert bleibt erhalten. Beim erneuten Öffnen sieht der Nutzer wieder die alte Adresse.

## Fix

In `src/components/forms/KundeBearbeitenDialog.tsx` (Submit-Block ab Zeile 130) bei allen leerbaren Stammdaten-Feldern `|| undefined` durch `|| null` ersetzen:

```ts
strasse: strasse || null,
plz: plz || null,
ort: ort || null,
telefon: telefon || null,
email: email || null,
firmenname: firmenname || null,
vorname: vorname || null,
```

`null` überlebt `JSON.stringify` und wird im Backend (`v ?? null`) als SQL-NULL gespeichert → Feld wird tatsächlich geleert.

`nachname` bleibt unverändert (Pflichtfeld, Validierung weiter oben). `kuerzel` bleibt `|| undefined` (Backend-Logik unterscheidet "nicht gesendet" vs. "geleert" hier bewusst). `notizen` und `startZaehlerAktuellerMonat` bleiben wie sie sind (touched-Logik).

## Scope

Nur eine Datei: `src/components/forms/KundeBearbeitenDialog.tsx`. Backend, Typen und `KundeForm.tsx` (Neuanlage — dort macht `|| undefined` Sinn, weil bei INSERT nicht zwischen „nicht gesetzt" und „geleert" unterschieden werden muss) bleiben unverändert.
