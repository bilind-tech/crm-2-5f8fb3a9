## Ziel

Alle Standard-E-Mail-Vorlagen werden neu geschrieben. Tonfall: natürlich, professionell, ohne Gedankenstriche („—") und ohne aufgesetztes „freundlich" im Betreff. Anzahl drastisch reduziert: pro Vorgang genau eine Standardvorlage. Eigene Vorlagen kann der Nutzer wie bisher in den Einstellungen anlegen — die bleiben unberührt.

## Neuer Vorlagen-Satz (insgesamt 5 statt bisher 11)

**Angebot**
1. **Angebot-Versand** — Standard für „Angebot per Mail senden". Betreff: `Angebot {{angebot.nummer}}`

**Rechnung**
2. **Rechnung-Versand** — Standard für „Rechnung per Mail senden". Betreff: `Rechnung {{rechnung.nummer}}`
3. **Zahlungserinnerung** — eine einzige Vorlage. Betreff: `Zahlungserinnerung zu Rechnung {{rechnung.nummer}}` (kein „freundlich" im Betreff)

**Mahnung**
4. **Mahnung Stufe 2** — Betreff: `2. Mahnung zu Rechnung {{rechnung.nummer}}`
5. **Mahnung Stufe 3 (letzte)** — Betreff: `Letzte Mahnung zu Rechnung {{rechnung.nummer}}`

**Protokoll**
6. **Protokoll-Versand** — für Übergabe- und Schlüsselprotokolle. Betreff: `Protokoll {{protokoll.nummer}}`

**Entfallen ersatzlos:**
- „Angebot freundlich nachfassen"
- „Auftragsbestätigung"
- „Zahlungseingang Bestätigung"
- „Mahnung Stufe 1" (die Zahlungserinnerung ersetzt sie)
- „Allgemeine Nachricht"
- „Dankesnachricht"
- Die zweite, vom Dashboard angelegte „Zahlungserinnerung (freundlich) v2"

## Tonalitäts-Regeln für alle neuen Texte

- Keine Gedankenstriche („—", „–"). Stattdessen Kommas, Punkte oder einfache Bindestriche in zusammengesetzten Wörtern bleiben natürlich erlaubt.
- Kein „freundliche Erinnerung" oder „kurze freundliche" im Betreff oder als Einleitung.
- Kurz, sachlich, höflich. Maximal 3–4 kurze Absätze.
- Anrede über `{{anrede.zeile}}` (Fallback „Sehr geehrte Damen und Herren,").
- Bankdaten-Block nur dort, wo bezahlt werden muss (Rechnung, Erinnerung, Mahnung).

Beispiel „Zahlungserinnerung" (zur Illustration des Tons):
> Sehr geehrte Frau Mustermann,
>
> die Rechnung R0526/01 vom 02.05.2026 über 1.250,00 € ist seit dem 16.05.2026 fällig. Bislang konnten wir keinen Zahlungseingang feststellen.
>
> Wir bitten Sie, den offenen Betrag von 1.250,00 € auf das unten genannte Konto zu überweisen. Sollte die Zahlung bereits erfolgt sein, ist diese Nachricht gegenstandslos.
>
> Empfänger: MyCleanCenter GmbH
> IBAN: DE…
> Verwendungszweck: R0526/01
>
> Vielen Dank für Ihre Rückmeldung.

## Umsetzung

### Backend (`backend/src/email/templates.ts`)

- `DEFAULTS`-Array komplett ersetzen durch die oben gelisteten 6 Einträge mit neuen `seedKey`-Suffixen (`.v3`), damit das idempotente Seeding sie als „neu" erkennt und einspielt.
- Alte Vorlagen mit `seedKey` auf `.v2` (oder älter) werden über eine neue Migration einmalig **gelöscht**, sofern sie vom Nutzer nicht editiert wurden (Marker: gleicher Wortlaut wie damals geseedet — sicherer Weg: nur per `seed_key LIKE '%.v2'` löschen, weil User-Vorlagen `seed_key IS NULL` haben).
- Beim Boot stellt `seedOrUpdateDefaultVorlagen()` sicher, dass pro Kontext genau eine `ist_standard=1` gesetzt ist. Falls die alte Standardvorlage gelöscht wurde, wird die neue automatisch Standard.
- Neuer Kontext-Wert `protokoll` (für Protokoll-Versand). CHECK-Constraint per Migration erweitert: `kontext IN ('rechnung','angebot','mahnung','allgemein','protokoll')`.

### Migration `backend/src/db/migrations/026_email_vorlagen_v3.sql`

```sql
-- 1) Alte Default-Vorlagen entfernen (nur die ungetauchten Defaults, niemals
--    User-Vorlagen mit seed_key IS NULL).
DELETE FROM email_vorlage WHERE seed_key LIKE '%.v2' OR seed_key LIKE '%.v1';

-- 2) Auch die Frontend-gesäte „Zahlungserinnerung (freundlich) v2"
--    (seed_key IS NULL, identifiziert über exakten Namen) entfernen.
DELETE FROM email_vorlage
 WHERE seed_key IS NULL
   AND name = 'Zahlungserinnerung (freundlich) v2';

-- 3) Kontext um 'protokoll' erweitern (SQLite: Tabelle neu aufbauen).
CREATE TABLE email_vorlage_new (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  betreff       TEXT NOT NULL DEFAULT '',
  body_html     TEXT NOT NULL DEFAULT '',
  kontext       TEXT NOT NULL DEFAULT 'allgemein'
                CHECK (kontext IN ('rechnung','angebot','mahnung','allgemein','protokoll')),
  ist_standard  INTEGER NOT NULL DEFAULT 0 CHECK (ist_standard IN (0,1)),
  seed_key      TEXT,
  erstellt_am   TEXT NOT NULL DEFAULT (datetime('now')),
  geaendert_am  TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO email_vorlage_new SELECT id,name,betreff,body_html,kontext,ist_standard,seed_key,erstellt_am,geaendert_am FROM email_vorlage;
DROP TABLE email_vorlage;
ALTER TABLE email_vorlage_new RENAME TO email_vorlage;
CREATE INDEX IF NOT EXISTS ix_email_vorlage_kontext ON email_vorlage(kontext);
CREATE UNIQUE INDEX IF NOT EXISTS ux_email_vorlage_seedkey ON email_vorlage(seed_key) WHERE seed_key IS NOT NULL;
```

### Frontend

- `src/lib/erinnerung/seedVorlage.ts`: **entfernen**. Stattdessen sucht der Hook `useErinnerungVorlageId` jetzt einfach `vorlagen.find(v => v.seedKey === 'rechnung.erinnerung.v3')` (oder fällt zurück auf die erste rechnungs-Standardvorlage). Damit wird keine zweite Vorlage mehr nebenher angelegt.
- `EmailEinstellungen.tsx` / Vorlagen-Liste: kein UI-Change nötig — der Nutzer sieht die neue, kürzere Liste und kann weiterhin eigene Vorlagen anlegen, bearbeiten und löschen wie bisher.
- Mahn-Settings (`backend/src/mahnung/settings-adapter.ts`): Standardzuordnung Stufe 1 entfällt; falls Stufe 1 noch referenziert wird, auf `rechnung.erinnerung.v3` mappen.

### TanStack-Typen

`EmailKontext` in `src/lib/api/types.ts` um `"protokoll"` erweitern.

### Tests

- `backend/test/`: Smoke-Test, dass nach Boot genau 6 Default-Vorlagen mit den neuen seed_keys existieren, pro Kontext genau eine `ist_standard=1`.
- Sicherstellen, dass User-eigene Vorlagen (`seed_key IS NULL`, nicht der gelöschte Erinnerungs-Name) erhalten bleiben.

## Was unverändert bleibt

- Vorlagen-CRUD im Frontend (Einstellungen → Vorlagen) bleibt 1:1.
- Signaturen bleiben unverändert.
- Es wird weiterhin nichts automatisch verschickt; jede Mail braucht weiter den User-Klick.
- Bestehende User-Vorlagen werden **nicht** angerührt.
