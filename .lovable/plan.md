Bug in Migration 019 übersehen: `belegnummer_zaehler_v2` wird am Ende auf `belegnummer_zaehler` umbenannt — die v2-Tabelle existiert zur Laufzeit gar nicht mehr.

## Fix

Datei: `backend/src/routes/testdaten-reset.ts` — im DELETE-Block:

```diff
- DELETE FROM belegnummer_zaehler_v2;
+ DELETE FROM belegnummer_zaehler;
```

Sonst nichts ändern. `belegnummer_reserviert`, `kunde_nummer_zaehler`, `objekt_nummer_zaehler` existieren tatsächlich und bleiben im Block.

Keine Migration, kein Schema-Change.