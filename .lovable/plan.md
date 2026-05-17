# Plan: TS-Build-Fehler in `backend/src/routes/extern.ts` beheben

## Problem
TypeScript meldet `TS2578: Unused '@ts-expect-error' directive` in Zeile 56. Die `RequestInit & { duplex?: string }`-Erweiterung deckt das Feld bereits ab, sodass die Direktive keinen Fehler unterdrückt und der strict-Build fehlschlägt.

## Fix
- `// @ts-expect-error …`-Zeile in `backend/src/routes/extern.ts` entfernen.
- Inline-Typ behalten (`RequestInit & { duplex?: "half" }`), damit `init.duplex = "half"` weiterhin gültig ist.

## Validierung
- `cd backend && npx tsc --noEmit` lokal in der Sandbox laufen lassen, sofern verfügbar — sonst nur Datei prüfen.
