## Ziel

1. In **Einstellungen → Firmendaten → Kontakt** ein neues Feld **Mobil** ergänzen (zwischen Telefon und E-Mail).
2. Auf allen Beleg-PDFs (Rechnung, Angebot, Übergabe-/Schlüsselprotokoll) den Footer umbauen:
   - **Spalte 1 (links, max. 3 Zeilen):** Firmenname · Straße · PLZ Ort
   - **Spalte 2 (Mitte links):** Bank, Bankname, IBAN (unverändert)
   - **Spalte 3 (Mitte rechts):** Telefon · Mobil · E-Mail
   - **Spalte 4 (rechts):** Handelsregister · USt-ID · Webseite · **Geschäftsführer** (neu unten angehängt)

## Änderungen

### Datenmodell
- `backend/src/settings/schemas.ts` → `FirmaSchema`: Feld `mobil: optStr.default("")` ergänzen.
- `backend/src/pdf/types.ts` → `FirmaForPdf`: `mobil?: string | null`.
- `backend/src/pdf/firma.ts` → `FirmaSettings.mobil` + Mapping in `loadFirmaForPdf()`.
- `src/lib/api/types.ts` → `Firmendaten.mobil?: string`.

### Einstellungen-UI
- `src/routes/einstellungen.tsx` Sektion „Kontakt": Grid bleibt 3-spaltig; neue Reihenfolge **Telefon | Mobil | E-Mail**, Website rutscht in eine zweite Zeile (1 Feld).

### PDF-Footer (3 Stellen identisch anpassen)
- `backend/src/pdf/layout.ts` `footer()`
- `src/lib/pdf/belegPdf.ts` `footer()`
- `src/lib/pdf/werkzeugePdf.ts` `footer()`

Neue Spalten:
```text
cell([firmenname, strasse, "PLZ Ort"])               // links, exakt 3 Zeilen
cell(["Bank", bankName, iban], "center")             // unverändert
cell([telefon, mobil, email], "center")              // Tel/Mobil/Mail
cell([handelsregister, "USt-ID: …", webseite,
      geschaeftsfuehrer ? "Geschäftsführer: …" : null], "right")
```
Geschäftsführer-Zeile aus Spalte 1 entfernen.

### Backend-Routenmapping
- `backend/src/routes/einstellungen.ts`: `firmaToWire/firmaFromWire` braucht keine Anpassung — `mobil` heißt UI- und Backend-seitig gleich und fließt automatisch durch.

### Tests
- `backend/test/firma-settings.spec.ts`: `mobil` ins Payload aufnehmen und im Roundtrip-Assert prüfen.

### Migration / Bestandsdaten
Keine DB-Migration nötig (Settings liegen in JSON-Store). `mobil` ist optional und defaultet auf `""`.
