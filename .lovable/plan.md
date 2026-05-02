## Problem

Auf den Seiten **Rechnungen** und **Angebote** wird die Aktions-Spalte (mit E-Mail-, Bezahlt-, Lösch-Button etc.) bei mittlerer Bildschirmbreite (Desktop-Tabelle ab `md`, also 768–1100 px) zusammengedrückt oder ganz abgeschnitten. Ursache:

- Die Tabelle nutzt `w-full` → sie passt sich der Container-Breite an, statt eine echte Mindestbreite zu beanspruchen.
- Es gibt zwar einen `overflow-x-auto`-Wrapper, aber ohne `min-w` an der Tabelle wird nichts horizontal scrollbar — stattdessen quetschen Zellen, FlowBar/Badges/Aktions-Buttons werden überlappt oder sind unklickbar.
- Die Aktions-Zelle ist `text-right` ohne `whitespace-nowrap` → die Buttons brechen um oder werden abgeschnitten.

## Lösung

### `src/routes/rechnungen.tsx` (Desktop-Tabelle ab Zeile 268)

1. **Tabelle bekommt Mindestbreite**, damit bei zu engem Viewport sauber horizontal gescrollt werden kann statt zu quetschen:
   - `<table className="w-full text-sm">` → `<table className="w-full min-w-[1100px] text-sm">`
2. **Aktions-Spalte schützen**:
   - `<th>` und `<td>` der Aktionsspalte bekommen `whitespace-nowrap`
   - Inneres `<div>` der Aktionen bekommt `whitespace-nowrap` und `gap-1.5`, damit Buttons nicht umbrechen
3. **Scroll-Container deutlich machen**: Der Wrapper `<div className="overflow-x-auto">` bleibt — durch `min-w-[1100px]` wird er jetzt aber tatsächlich scrollbar, sobald der Bildschirm < 1100 px ist. Damit bleibt die E-Mail-Action immer erreichbar.

### `src/routes/angebote.tsx` (Desktop-Tabelle, gleiche Struktur ab Zeile ~250)

Analog:
1. `min-w-[1000px]` auf die Tabelle (Angebote haben eine Spalte weniger als Rechnungen).
2. `whitespace-nowrap` auf Aktions-`<th>`/`<td>` und das innere Buttons-`<div>`.

### Optional (klein, nicht zwingend)

- Kein Funktions- oder Datenmodell-Change.
- Mobile-Karten-Layout (`md:hidden`) bleibt unverändert — dort gibt es das Problem nicht.

## Ergebnis

Bei jeder Bildschirmbreite ab `md` ist die Aktions-Spalte vollständig sichtbar — bei kleineren Desktop-Größen scrollt die Tabelle horizontal innerhalb ihres Containers, statt Buttons unsichtbar zu quetschen. E-Mail-, Bezahlt- und Lösch-Button bleiben immer klickbar.
