---
name: Testdaten-Reset
description: Einmaliger Reset für Test-Kunden/Belege; Sentinel sperrt Funktion dauerhaft nach erstem Erfolg
type: feature
---
Einmaliger "Testdaten löschen"-Button in Einstellungen → Sicherheit. Löscht Kunden, Objekte, Ansprechpartner, Angebote, Rechnungen, Zahlungen, Mahnungen, Protokolle, Dokumente (inkl. Dateien), Belegnummern-Zähler, Aktivitäten/Benachrichtigungen, Email-Versand/Drive-Queue-Einträge für diese Belege.

**Bleibt unangetastet:** Firma, SMTP, Drive-Token, Backups, E-Mail-Vorlagen/Signaturen, Steuern, Login/Recovery, Daueraufträge.

**Sperre:** Tabelle `reset_state` (id=1) hält `testdaten_reset_genutzt_am`. Sobald gesetzt, liefert `POST /testdaten-reset` 410 Gone und der Button verschwindet aus der UI.

**Schutz:** Passwort + exakt getippte Phrase `ALLES LÖSCHEN`. Vor dem Löschen läuft `createBackup({ category: "manual", trigger: "manual" })`.

**Wichtig:** System-Updates UND Restore dürfen `reset_state` NIEMALS zurücksetzen. Migration nur additiv (`CREATE TABLE IF NOT EXISTS`).
