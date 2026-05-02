# Steuer-Seite: vollautomatisch, keine manuellen Eingaben

Alles, was nur durch Rechnungen/Belege berechenbar ist, läuft automatisch. Manuelle Eingaben (Termin anlegen, Bezahlt-Markierung, tatsächlicher Betrag) verschwinden komplett.

## Was rausfliegt

- **Button „Steuer-Termin anlegen"** komplett raus (inkl. PrimaryAction-Header)
- **„Bezahlt"-Button** an jeder Posten-Zeile raus
- **„Widerrufen"-Button** raus
- **„Löschen"-Button** raus
- **SteuerBezahltDialog** + **ManuellerPostenDialog** als Komponenten + Imports raus
- **„Bezahlt {jahr}" KPI-Kachel** raus (ohne manuelle Bezahlung gibt es keine bezahlten Posten zu zählen)
- **„Bezahlte Posten"-Sektion** raus
- **Section „Manuell"-Badge** raus
- localStorage-Hooks `useManuellePosten` und `useBezahltMarkierungen` werden auf der Seite nicht mehr genutzt (Hooks selbst bleiben im Store für späteren Bedarf, aber ungenutzt)

## Was bleibt und stärker betont wird

### KPI-Reihe (4 Kacheln, aussagekräftiger)

1. **Umsatzsteuer-Schuld aktuell** — Summe aller offenen USt-Voranmeldungen (das, was du wirklich zahlen musst, sehr präzise berechenbar)
2. **Nächste Fälligkeit** — Datum + Betrag des nächsten USt-Termins
3. **Empfohlene Rücklage gesamt** — der "wenn Finanzamt kommt"-Betrag = USt-Schuld + projizierte Jahres-Ertragsteuern (KSt + Soli + GewSt) auf Basis YTD
4. **Gewinn YTD** — Netto-Einnahmen minus Netto-Ausgaben, transparent

### Hauptbereich

**„Was du zurücklegen solltest"** — eine prominente Karte mit dem Gesamt-Rücklagen-Betrag groß, darunter aufgeschlüsselt:
- USt-Schuld (präzise) — Betrag X €
- KSt + Soli (Schätzung Jahr) — Betrag X €
- GewSt (Schätzung Jahr, Hebesatz Sankt Augustin 525 %) — Betrag X €
- = Gesamt-Rücklage X €

Mit Hinweis: USt-Teil ist exakt, Ertragsteuer-Teil ist Hochrechnung aus YTD.

### Posten-Liste (read-only)

- **Offene USt-Voranmeldungen** mit genauen Beträgen und Fälligkeitsdaten — sortiert nach Fälligkeit, überfällige rot
- **Offene Quartals-Vorauszahlungen** KSt/Soli/GewSt — sortiert nach Fälligkeit
- Klick auf Zeile → Detail-Dialog (zeigt verknüpfte Rechnungen/Belege wie bisher)
- Keine Buttons an den Zeilen, nur Info

### Disclaimer bleibt

„Schätzung — keine Steuerberatung. USt-Beträge sind exakt aus deinen bezahlten Rechnungen berechnet, Ertragsteuern (KSt/Soli/GewSt) sind YTD-Hochrechnungen."

## Berechnungs-Engine: keine Änderung nötig

Die `generiereAutomatischePosten` und `berechneKennzahlen` aus dem letzten Durchgang funktionieren weiter — sie liefern bereits alles. Wir entfernen nur das Mergen mit `manuellePosten` und das `bezahltMap`-Overlay.

## Zusammenfassung

Die Seite zeigt nur noch das, was technisch sicher berechenbar ist:
- USt: zu 100 % präzise (aus Brutto/Netto bezahlter Rechnungen + Vorsteuer aus Belegen)
- KSt/Soli/GewSt: ehrliche YTD-Hochrechnung mit Hinweis
- Rücklagen-Empfehlung als zentraler "Sicherheitspuffer"

Keine Klicks nötig, keine Eingaben, keine Verwirrung.
