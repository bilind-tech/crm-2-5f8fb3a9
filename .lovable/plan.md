# Fix: Pauschal-Belege über mehrere Seiten + falsche Summen in Listen

Zwei voneinander unabhängige Bugs, beide bestätigt im Code. Helfer `src/lib/belege/summen.ts` existiert bereits, wird in den Listen aber nicht genutzt.

## Bug 1 — Listen zeigen 0 € bei Pauschal-Positionen

**Wo:** `src/routes/rechnungen.tsx:73` und `src/routes/angebote.tsx:91`
Beide rechnen nur `menge * einzelpreisNetto * (1 - rabatt/100)`. Bei Pauschal-Positionen ist `einzelpreisNetto = 0`, der Wert liegt in `pauschalpreisNetto` → Liste zeigt 0 €. Detailseite + PDF rechnen schon korrekt.

**Fix:**
- `summePosition` / `summenRechnung` aus `src/lib/belege/summen.ts` verwenden (existiert, deckt Pauschal-Modus ab).
- `brutto(r)` in `rechnungen.tsx` umstellen auf `summenRechnung(r.positionen, r.rabattGesamt).brutto`.
- Inline-Summe in `angebote.tsx` (Zeile ~91) ebenfalls auf `summenRechnung(...)` umstellen.
- Keine Steuer-/Rabatt-Logik ändern, nur die Position-Berechnung.

## Bug 2 — Lange Pauschal-Beschreibung → Tabelle wird nicht gerendert / kein Seitenumbruch

**Wo:** `backend/src/pdf/layout.ts`
- `leistungstabelle` (Z. 187): `dontBreakRows: true` verhindert, dass eine einzelne Zeile mit sehr langer Beschreibung über die Seite umgebrochen wird. Wenn die Zeile höher als eine Seite ist, "verschluckt" pdfmake die Tabelle.
- Intro-Block (Z. 378–383) und Outro-Block (Z. 386–393) sind beide `unbreakable: true`. Bei langem Intro kann die Seite eskalieren.

**Fix:**
- `dontBreakRows: false` (Default) setzen, `keepWithHeaderRows: 1` lassen → Header wandert mit, lange Position-Zeilen brechen sauber um.
- Die zwei Summenzeilen (MwSt + Gesamtbetrag) in eine eigene kleine Tabelle direkt darunter auslagern, **mit** `dontBreakRows: true` und `keepWithHeaderRows` der zweiten Zeile, damit „MwSt" und „Gesamtbetrag" nicht getrennt werden.
- `unbreakable: true` am Intro-Stack (Z. 383) entfernen — Intro darf brechen. Am Outro-Stack (Z. 392) belassen (klein, soll mit Gruß zusammenbleiben).
- Kurze Belege bleiben optisch identisch.

## Zu ändernde Dateien

- `src/routes/rechnungen.tsx` — `brutto(r)` über `summenRechnung` neu berechnen
- `src/routes/angebote.tsx` — Inline-Summe ersetzen
- `backend/src/pdf/layout.ts` — `dontBreakRows` ausschalten, Summen-Subtabelle, Intro `unbreakable` entfernen

## Außerhalb des Scopes

- Andere Beleg-Designs, Drive-Sync, PDF-Pipeline-Refactor, Druck-Stylesheets im Browser (PDF-Druck-Pfad ist serverseitig identisch).

## Verifikation

- Build grün.
- Liste Rechnungen: Rechnung mit ausschließlich Pauschal-Position zeigt korrekten Brutto-Wert.
- Pauschal-Beleg mit sehr langer Beschreibung erzeugt mehrseitiges PDF, Tabelle + Summenzeilen sichtbar, Header wiederholt sich auf Folgeseiten.
