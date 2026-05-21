## Logo in Protokollen aus den Einstellungen verwenden

### Problem
In `src/lib/pdf/werkzeugePdf.ts` fetcht `logoDataUrl(firma.logoUrl)` die URL und wandelt sie über `FileReader` erneut in einen data‑URL um. Dabei fällt der Code zu oft auf das gebündelte Fallback `@/assets/logo.png` zurück, sodass im Protokoll-/Schlüsselübergabe-PDF nicht das in **Einstellungen → Firma** hochgeladene Logo (als `data:`‑URL in `firma.logoUrl`) erscheint, sondern der Standard.

In `src/lib/pdf/belegPdf.ts` (Zeile 633–637) ist es bereits richtig gelöst: ist `firma.logoUrl` gesetzt, wird der Wert **direkt** als pdfmake-`image` verwendet — kein Fetch nötig, da pdfmake `data:`-URLs nativ unterstützt.

### Lösung
`werkzeugePdf.ts` an dieselbe Logik angleichen:

1. Neue Helper-Funktion `resolveLogo(firma)`:
   - Wenn `firma?.logoUrl` getrimmt nicht leer ist → diese **direkt** zurückgeben (keine `fetch` Pipeline).
   - Sonst Fallback `@/assets/logo.png` über `fetch` als data‑URL laden.
2. In `generateUebergabeprotokollPdf` (Zeile 316) und `generateSchluesseluebergabePdf` (Zeile 459) `logoDataUrl(data.firma?.logoUrl)` durch `resolveLogo(data.firma)` ersetzen.
3. Die alte `logoDataUrl()`‑Pipeline behalten, aber nur noch als Fallback‑Loader für das gebündelte Asset (ohne `src`‑Parameter).

### Nicht betroffen
- `header()`, `footer()` und alle übrigen Layoutbausteine bleiben unverändert.
- Beleg-PDFs (Angebot/Rechnung) sind nicht betroffen.
- `firma.logoUrl` selbst (Speicherort, Schema) wird nicht angefasst.

### Verifikation
- In Einstellungen ein Logo hochladen, dann ein Übergabeprotokoll und eine Schlüsselübergabe öffnen.
- Rechts oben muss das hochgeladene Logo erscheinen, **nicht** das Standard‑MCC‑Logo.
- Wenn man das Logo in Einstellungen entfernt, soll das gebündelte Fallback‑Logo erscheinen.
