## Problem

Die Firmendaten-Einstellungen werden derzeit nur **teilweise** gespeichert. Nach einem Neustart oder `mcc-update` wirken viele Felder „verschwunden" — sie wurden in Wahrheit nie persistiert.

**Ursache:** Frontend und Backend benutzen unterschiedliche Feldnamen für dieselben Daten, und das Backend (Zod) verwirft unbekannte Felder still beim Speichern.

| Im Formular eingegeben | Was das Backend kennt | Was passiert beim Speichern |
|---|---|---|
| `firmenname` | `name` | wird verworfen, `name` bleibt Default „MyCleanCenter GmbH" |
| `webseite` | `web` | wird verworfen |
| `rechtsform` | (existiert nicht) | wird verworfen |
| `slogan` | (existiert nicht) | wird verworfen |
| `land` | (existiert nicht) | wird verworfen |
| `logoUrl` | (existiert nicht) | wird verworfen |
| `standardSteuersatz` | (existiert nicht) | wird verworfen |
| `standardZahlungszielTage` | (existiert nicht) | wird verworfen |

Felder mit identischem Namen (Straße, PLZ, Ort, Telefon, E-Mail, USt-ID, Steuernummer, Handelsregister, Geschäftsführer, IBAN, BIC, Bank, Inhaber) wurden bisher korrekt gespeichert — alles andere ging nach Neustart verloren.

Die restlichen Einstellungs-Bereiche (SMTP, Mahnung, Nummernkreise, Steuern, Backup, Drive, Sicherheit, Erscheinung, Stundenzettel, Dauerauftrag) verwenden bereits einen Mapper oder identische Feldnamen — diese funktionieren bereits korrekt. Datenverzeichnis (`/var/lib/mycleancenter/`) bleibt bei Updates ohnehin unberührt; das eigentliche Problem liegt nur an dieser Datenmodell-Diskrepanz.

## Lösung

1. **Backend `FirmaSchema` erweitern** um alle fehlenden Felder, damit nichts mehr stillschweigend verworfen wird:
   - `rechtsform`, `slogan`, `land`, `logoUrl` (Data-URL bis ~500 KB),
   - `standardSteuersatz` (0–100, Default 19),
   - `standardZahlungszielTage` (0–365, Default 14).
2. **Alias-Adapter `firmaToWire` / `firmaFromWire`** analog zu SMTP einbauen:
   - akzeptiert beim PATCH sowohl `firmenname` als auch `name`, sowohl `webseite` als auch `web`,
   - liefert beim GET **beide Schreibweisen** zurück, damit UI und ggf. PDF-Code beides finden.
3. **Migration / Daten-Heilung:** beim ersten GET nach dem Update, falls `firmenname` leer aber Default-Backend-Wert „MyCleanCenter GmbH" steht und kein User-Inhalt existiert, bleibt alles wie bisher — es gehen also keine bestehenden Daten verloren.
4. **Defensiver Speicher-Hook:** beim PATCH zusätzlich einen Audit-Log-Eintrag mit der Anzahl tatsächlich übernommener Felder schreiben, damit künftige Mismatches sofort auffallen.
5. **Frontend `useFirmendaten`-Hook** unverändert lassen — die zurückgelieferte Wire-Form enthält jetzt `firmenname`+`webseite`, sodass Formular und PDF-Render sofort die persistierten Werte sehen.
6. **Sanity-Test** ergänzen (`backend/test/settings.spec.ts`): „runtrip Firmendaten" — PATCH mit allen Frontend-Feldern, GET muss exakt diese Werte zurückliefern.

## Technische Details

- Betroffene Dateien:
  - `backend/src/settings/schemas.ts` — `FirmaSchema` um 6 Felder erweitern.
  - `backend/src/routes/einstellungen.ts` — Firma bekommt eigenen Handler mit `firmaToWire`/`firmaFromWire`, raus aus `simpleAreas`.
  - `backend/src/pdf/firma.ts` — Wenn `logoUrl` / `slogan` / `rechtsform` jetzt aus den Settings kommen, im PDF-Layout verwenden (nur lesen, keine Pflicht).
  - `backend/test/settings.spec.ts` — neuer Roundtrip-Test.
- **Keine** Datenmigration nötig: neue Felder bekommen Defaults, alte gespeicherte Werte (`name`, `web`, …) werden vom Adapter parallel als `firmenname`/`webseite` ausgeliefert.
- **Updates bleiben sicher:** `/var/lib/mycleancenter/db/mycleancenter.db` wird vom Update nicht angefasst (bereits durch `data-guard.ts` geschützt). Diese Änderung betrifft nur den Code-Mapper.
- **Kein automatischer Mailversand**, keine Schema-Brüche, keine Veränderung des Daten-Verzeichnisses — die absolute Regel bleibt eingehalten.

## Was du danach merkst

- Firmenname, Webseite, Rechtsform, Slogan, Land, Logo, Standard-Steuersatz und Standard-Zahlungsziel bleiben nach Speichern, Neustart **und** `mcc-update` zuverlässig erhalten.
- Bestehende, bisher korrekt gespeicherte Felder (Adresse, IBAN, USt-ID …) bleiben unverändert.
- Bei zukünftigen Settings-Erweiterungen schlägt der Roundtrip-Test sofort an, falls wieder Feldnamen auseinanderlaufen.
