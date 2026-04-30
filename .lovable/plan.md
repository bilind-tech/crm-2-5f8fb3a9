## Ziel

Das Frontend exakt an die mitgeschickten Screenshots angleichen — vollständiges Redesign der Sidebar, des Headers, der Listen, des Dashboards und der Einstellungen. Das Logo „My Clean Center" wird eingebunden. Module wie **Steuer-Export, Aufträge, Mahnwesen** werden NICHT in der Einstellungen-Seite umgesetzt (laut deiner Anweisung ignorieren) — sie erscheinen aber als Sidebar-Einträge wie auf den Screenshots.

## 1. Branding & Logo

- Logo `ORIGINAL_LOGO_ohne_schatten.png` nach `src/assets/logo.png` kopieren.
- Sidebar-Header: Logo + zweizeilig „**My Clean Center**" / „CRM • GmbH" (statt aktuell „MCC / Reinigungs-CRM" mit Sparkles-Icon).
- Sidebar-Gruppen umbenennen entsprechend Screenshots:
  - **Übersicht** → Dashboard
  - **Stammdaten** → Kunden
  - **Vertrieb & Abrechnung** → Angebote, Aufträge, Rechnungen, Mahnwesen, Dokumente, Steuer-Export
  - **System** → Einstellungen
- „Aktivität" aus Sidebar entfernen.
- Sperren-Button als kleiner Eintrag unten links in der Sidebar (Icon „Schloss" + „Sperren") statt im Header.
- Sidebar: hellerer Hintergrund (nahezu weiß mit leichtem Blaustich wie im Screenshot), aktiver Eintrag mit dezentem Border + Primary-Akzent.

## 2. Farbschema umstellen (Apple-like, Marineblau-Akzent)

Die Screenshots zeigen klar **dunkles Marineblau** als Primärfarbe (Buttons „+ Neu", „+ Neues Angebot", aktive Sidebar-Indikator, Überschriften), nicht Türkis. Türkis bleibt nur als Logo-Akzent.

- `--primary` → tiefes Navy/Marineblau (~ `oklch(0.32 0.09 255)`, Hex ~ `#1E3A5F`).
- `--background` → fast weiß mit Hauch Blau (`oklch(0.985 0.005 230)`).
- `--sidebar` → noch heller, mit feinem rechten Border.
- Erfolgs-Grün und Warn-Rot wie in Screenshots (Beträge grün, „0,00 € Überfällig" rot).
- Card-Stil: weißer Hintergrund, sehr dezenter Schatten, weiche Border, `rounded-2xl`.

## 3. Header

- Höhe ~64 px, weißer Hintergrund (statt blur).
- Suche: längeres Pill-Input mit grauem Rand und ⌘K-Badge rechts.
- „+ Neu"-Button: Marineblau, abgerundet, mit Plus-Icon.
- Glocken-Icon für Benachrichtigungen.
- Schloss-Button raus aus Header (jetzt in Sidebar unten).

## 4. Listen-Seiten (Angebote, Rechnungen, Dokumente)

Layout exakt wie Screenshot:

```text
Breadcrumb (Home › Angebote)
H1 + Untertitel                                    [+ Neues Angebot]
─────────────────────────────────────────────────
[ KPI-Card ] [ KPI-Card ] [ KPI-Card ] [ KPI-Card ]
─────────────────────────────────────────────────
[ Tabs: Alle | Entwurf | Versendet | Angenommen ]   [ 🔍 Suche ]
─────────────────────────────────────────────────
Tabelle mit Hover-Zeilen + Aktions-Icons rechts
```

Details:
- KPI-Cards: weißer Hintergrund, große Zahl oben (Navy oder Grün), kleines Label darunter.
- Filter-Tabs als Pill-Group mit Outline-Stil.
- Tabellen-Aktionen: Auge (Detail), Papier-Flieger (Senden), Mülleimer rot (Löschen), Chevron (Details).
- Status-Badges: hellgrauer Pill für „Entwurf", grüner Pill für „Angenommen/Bezahlt", blauer Pill für „Versendet".

## 5. Dashboard

Wie Screenshot 2:
- 4 große KPI-Cards (Kunden, Aufträge, Umsatz Monat, Offene Rechnungen) mit Icon rechts oben.
- Umsatz-Diagramm-Card (Linien-/Balken-Chart, Recharts) mit „Summe"-Anzeige rechts oben.
- Zwei Cards unten nebeneinander: „Offene Rechnungen" und „Aktive Aufträge".

## 6. Einstellungen-Seite (komplett neu)

Tab-Leiste exakt wie Screenshot 6:
**Firmendaten · Erscheinungsbild · Nummernkreise · Mahnwesen · Textbausteine & Vorlagen · Google Drive · Backup & Download · Verlauf**

> Hinweis: Inhaltlich umgesetzt wird in dieser Runde nur **Firmendaten** (laut Screenshot 6 + 7) — die anderen Tabs bekommen einen Platzhalter „kommt mit Backend".  Die alten Bereiche „Steuer-Export", „Mahnwesen-Setup" usw. werden auf der Einstellungen-Seite **NICHT** als eigene Sektionen umgesetzt (deine Anweisung).

Firmendaten-Tab erhält die Sektionen aus den Screenshots:
- **Unternehmen** (Firmenname, Rechtsform, Slogan)
- **Anschrift** (Straße, PLZ, Ort, Land)
- **Kontakt** (Telefon, E-Mail, Website)
- **Steuer & Register** (USt-IdNr., Steuernummer, Handelsregister, Geschäftsführung)
- **Bankverbindung** (Bank, IBAN, BIC)
- **Standardwerte** (Standard-Steuersatz %, Zahlungsziel Tage)

Footer-Leiste fix unten: „Änderungen werden im Aktivitätsprotokoll festgehalten." + [Zurücksetzen] [💾 Speichern]

Default-Werte aus Screenshot vorbefüllt (My Clean Center GmbH, Gartenstr. 16, 53757 St. Augustin, DE459095049, Sparkasse Köln Bonn, IBAN DE50…, etc.).

## 7. Neue Sidebar-Routen (nur Stub-Seiten)

Damit die im Screenshot sichtbaren Sidebar-Einträge auch klickbar sind, kommen leere Routen mit Empty-State + „kommt im nächsten Schritt"-Hinweis:
- `/auftraege`
- `/mahnwesen`
- `/steuer-export`

Inhaltlich kein Aufwand — nur damit die Navigation komplett ist wie im Screenshot.

## Technische Umsetzung

1. `code--copy user-uploads://ORIGINAL_LOGO_ONLY_ohne_schatten.png src/assets/logo.png`
2. `src/styles.css` — neue Primary/Background/Sidebar-Tokens (Navy + fast-weiß).
3. `src/components/layout/AppSidebar.tsx` — neue Gruppen, Logo, Sperren-Footer-Button.
4. `src/components/layout/AppHeader.tsx` — Suchpill, „+ Neu", Glocke; Schloss raus.
5. `src/routes/__root.tsx` (falls nötig) — Layout-Hintergrund anpassen.
6. `src/routes/index.tsx` — Dashboard-KPIs/Charts an Screenshot 2 angleichen.
7. `src/routes/angebote.tsx`, `rechnungen.tsx`, `dokumente.tsx`, `kunden.tsx` — neues Listen-Layout (Breadcrumb, KPI-Row, Tabs+Suche, Tabelle).
8. `src/routes/einstellungen.tsx` — komplett neu schreiben mit Tabs + Firmendaten-Form.
9. `src/routes/auftraege.tsx`, `mahnwesen.tsx`, `steuer-export.tsx` — neue Stub-Seiten.
10. `src/lib/mock/seed.ts` & `src/lib/api/types.ts` — Firmendaten um neue Felder erweitern (Slogan, Rechtsform, Anschriftsfelder einzeln, Steuernummer, Handelsregister, Geschäftsführung, Bankname, Standard-Steuersatz, Zahlungsziel).

## Out of Scope (diese Runde)

- Echte Implementierung von Mahnwesen, Aufträge, Steuer-Export (nur Stub-Seiten).
- Andere Einstellungen-Tabs außer Firmendaten (Platzhalter).
- Backend-Integration — bleibt Mock.
