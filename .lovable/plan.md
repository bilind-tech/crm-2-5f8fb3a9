# Strato-SMTP-Integration — Plan

Ziel: SMTP über Strato funktioniert zuverlässig, sauber, transparent — und es geht **garantiert nie eine E-Mail raus, die du nicht vorher in der UI bestätigt hast**. Keine Hintergrund-Mails. Keine Cron-Mails. Keine Auto-Mahnungen. Punkt.

## 1. Bestandsanalyse (kurz)

- `backend/src/email/transport.ts` baut nodemailer aus Settings — solide, aber Passwort-Lese/Verify/Pool-Logik fehlt.
- `backend/src/email/worker.ts` registriert einen **30-Sekunden-Cron** (`startEmailWorker`) der die Queue automatisch leert. → muss weg.
- `mahnung/automatik.ts` ruft `enqueueVersand` ohne harten User-Klick. Cron ist im Server zwar auskommentiert, aber `enqueueVersand` würde, sobald irgendetwas in die Queue geht, vom 30-s-Worker rausgeschickt.
- `routes/email.ts` → `POST /email/versand` triggert direkt `tickEmailQueue(1)`. Solange das nur per User-Klick aus `EmailVersandDialog` läuft, ist es ok — muss aber vor allen anderen Quellen geschützt werden.
- Settings-Schema für SMTP existiert (Strato-Defaults: `smtp.strato.de:465 secure`).

## 2. Manual-Only-Garantie (oberste Priorität)

Drei harte Schutzschichten, alle gleichzeitig aktiv:

1. **Kein Hintergrund-Worker.** `startEmailWorker` wird ersatzlos entfernt. Es gibt keinen Cron, keinen Intervall, kein „später senden".
2. **`enqueueVersand` verlangt Quelle `manuell`.** Neuer Pflicht-Parameter `quelle: "user-klick"`. Alles andere wirft. Mahn-Automatik & jeder Trigger/Hook werden gecheckt — keine Stelle außer dem `EmailVersandDialog`-Endpoint darf das setzen.
3. **Sofort-Send statt Queue-Polling.** `POST /email/versand` sendet **synchron im Request** (mit Timeout). Erfolg/Fehler kommt direkt zurück in die UI. Es gibt keinen „pending → wird später versendet" Zustand mehr aus User-Sicht. Die Tabelle `email_versand` bleibt nur als **Audit-Log** (gesendet / fehler), nicht als Sende-Queue.

→ Ergebnis: physisch unmöglich, dass eine Mail ohne den Klick im Dialog rausgeht.

## 3. Strato-SMTP korrekt konfigurieren

Backend:

- Schema bleibt: `host=smtp.strato.de`, `port=465`, `secure=true`, `user`, `fromEmail`, `fromName`. Passwort weiter verschlüsselt (`SmtpPasswordSchema`, AES via Masterkey).
- Validierung beim Speichern: `fromEmail` muss valide Mail sein und (Empfehlung-Hinweis) zur Strato-Domain passen — sonst Warnung in UI, kein Block.
- `transport.ts` aufräumen:
  - `pool: true`, `maxConnections: 1`, `maxMessages: 50` → Strato mag keine Bursts.
  - `connectionTimeout: 15s`, `greetingTimeout: 10s`, `socketTimeout: 30s`.
  - `tls: { minVersion: "TLSv1.2", servername: host }`.
  - `resetTransport()` bei jeder Settings-Änderung (existiert) + bei Auth-Fehler (neu).

## 4. Verbindungstest („Verbindung prüfen")

Neuer Endpoint `POST /einstellungen/smtp/verify` (kein Versand!):

1. Lädt Settings + Passwort.
2. Baut Transport, ruft `transporter.verify()` auf.
3. Liefert `{ ok, latencyMs, error?, errorCode? }` mit klar übersetzten Fehlern:
   - `EAUTH` → „Benutzername oder Passwort falsch"
   - `ECONNECTION`/`ETIMEDOUT` → „Strato nicht erreichbar / Port blockiert"
   - `ESOCKET`/TLS → „TLS-Problem — Port 465 secure prüfen"

Bestehender `POST /email/test` bleibt — schickt **eine** echte Test-Mail an eine vom User eingegebene Adresse, ausschließlich nach Klick.

## 5. Sende-Pipeline (synchron, sauber)

`POST /email/versand` (User-Klick aus Dialog):

1. Zod-Validierung (To/CC/BCC RFC-konform, max. 20 Empfänger gesamt, Betreff ≤ 500, Body ≤ 200 KB).
2. Idempotenz-Key prüfen → wenn schon gesendet, vorhandenen Datensatz zurückgeben (kein Doppelversand bei Doppelklick).
3. Anti-Flood: pro Idempotenz-Key max. 1 Send / 5 s, global max. 30 Mails/Minute (in-memory Token-Bucket, bei Überschreitung HTTP 429 + UI-Toast).
4. Anhang: PDF frisch via `renderAngebot/RechnungPdf` aus `belegId` bauen — Größenlimit 15 MB.
5. `transport.sendMail` mit Timeout 30 s.
6. Bei Erfolg: `email_versand` Eintrag mit `status=gesendet`, `messageId`, `versendet_am=now`. Event `email.gesendet` für SSE.
7. Bei Fehler: Eintrag `status=fehler`, `fehler_text` mit übersetztem Klartext. Kein Auto-Retry — User sieht Fehler im Dialog, kann „Erneut senden" klicken (das ist wieder ein expliziter Klick).
8. Response inkl. `messageId` und finalem Status.

`POST /email/versand/:id/retry` bleibt — auch nur per User-Klick, läuft durch dieselbe Pipeline.

## 6. Mahn-/Automatik-Stellen entschärfen

- `mahnung/automatik.ts` Modus `auto` wird hart auf `vorschlag` umgestuft (Memory bestätigt das schon — wird im Code verifiziert).
- `enqueueVersand`-Aufruf in `automatik.ts` wird **entfernt**. Mahnungen erzeugen nur einen Vorschlag-Eintrag; das tatsächliche Mailen passiert ausschließlich, wenn der User in der Mahn-UI auf „Mahnung senden" klickt → öffnet `EmailVersandDialog` → User klickt „Senden". Fertig.
- Kein anderer Trigger (Status-Wechsel, Hook, Cron, Backup) darf irgendwo `sendMail`/`enqueueVersand` aufrufen — wird per `rg` auditiert und im Code per Kommentar-Guard markiert.

## 7. UI

**Einstellungen → E-Mail / SMTP** (`EmailEinstellungen.tsx`):

- Strato-Preset-Button („Strato-Standard übernehmen") setzt host/port/secure korrekt.
- Felder: Host, Port, TLS, Benutzer, Passwort (write-only Maskierung), Absender-Name, Absender-E-Mail.
- Statusleiste oben: „Verbindung: ✓ geprüft vor 2 min" / „nicht geprüft" / „Fehler: …".
- Buttons: **Speichern**, **Verbindung prüfen** (ruft `/verify`), **Test-Mail senden** (Dialog mit Empfänger-Input → ruft `/email/test`).
- Klare Fehler-Texte (siehe §4).

**E-Mail-Versand-Dialog** (`EmailVersandDialog.tsx`):

- Pflicht-Vorschau (HTML-Render) **vor** Senden-Button — Senden-Button ist nur aktiv, wenn Vorschau angezeigt wurde mind. einmal.
- Prominenter zweistufiger Bestätigen-Flow für Mahnungen: Klick „Senden" → Mini-Confirm „Diese Mail jetzt wirklich an `kunde@x.de` senden?" → erst dann tatsächlicher Request.
- Status-Toast nach Antwort: ✓ gesendet (mit messageId-Hinweis) / ✗ Fehler-Klartext.
- Kein Auto-Send, kein „in Hintergrund senden", kein „später senden" — diese Optionen existieren nicht.

**Versand-Historie** (`EmailVersandHistorie.tsx`): bleibt — zeigt nur reale Sende-Ereignisse, nichts „pending".

## 8. Sicherheit & Robustheit

- Passwort nie loggen, nie in Responses zurückgeben (`passwordIsSet: boolean` reicht).
- Settings-Schreiben nur über `requireAuth`.
- `connection-id` Header für Logs, damit du im Pi-Log Versand-Versuche eindeutig siehst.
- Strukturierte Logs: `email.send.start/ok/fail` mit `idempotenzKey`, `to`, `latencyMs`, **ohne** Body.
- Tests:
  - Unit: `transport.verify` Erfolg/Fehler-Mapping, Validierung, Anti-Flood-Bucket.
  - Integration: `POST /email/versand` mit Mock-Transport (bereits via `setTestTransport` möglich) → Idempotenz, Doppelklick, Limit, Fehlerpfad.
  - Audit-Test: grep-Test im CI, der fehlschlägt, falls irgendwo außer im Dialog-Endpoint `transporter.sendMail` oder `enqueueVersand` aufgerufen wird.

## 9. Migrations & Cleanup

- Migration 020: Spalte `quelle` (`'manuell'` only) auf `email_versand` (Audit), Index auf `idempotenz_key` UNIQUE absichern.
- `worker.ts` reduziert sich auf eine reine `sendNow(row)`-Funktion (ohne Cron, ohne Polling). `startEmailWorker` Export ersatzlos entfernt.
- Anker `void startEmailWorker;` etc. werden gelöscht.

## 10. Technische Details (Stack-Notiz)

- Backend = Node + Fastify + nodemailer + better-sqlite3 (Pi-lokal). Keine Cloud, kein Worker-Cron.
- Frontend = bestehende React-Komponenten, react-query Hooks (`useSendEmail`, `useTestSmtp`, neu: `useVerifySmtp`).
- Keine neuen npm-Pakete nötig.

---

## Reihenfolge der Umsetzung

1. Worker entfernen + `enqueueVersand` Quelle-Pflicht + Mahn-Automatik entkoppeln.
2. Transport hardening (Pool, Timeouts, TLS) + `/smtp/verify` Endpoint.
3. `POST /email/versand` auf synchron umbauen + Anti-Flood + Fehler-Mapping.
4. UI: Verify-Button, Status-Banner, zweistufiger Mahn-Confirm im Dialog.
5. Migration 020 + Audit-Tests + grep-Guard.

Sag „weiter", dann setze ich Schritt 1–3 in einem Rutsch um, danach 4–5.
