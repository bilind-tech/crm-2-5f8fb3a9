---
name: Backend-Roadmap (Pi, Fastify, SQLite)
description: Schrittweiser Plan für den Aufbau des Pi-Backends. Jeder Step wird einzeln im Plan-Modus geplant, vom User genehmigt, dann zu 100% umgesetzt bevor der nächste startet.
type: feature
---

# Backend-Roadmap

## Arbeitsweise (verbindlich)
1. **Plan-Modus pro Step**: Vor jedem Step erstelle ich einen detaillierten Plan (Datenmodell, Endpunkte, UI-Anbindung, Edge Cases, Tests, betroffene Dateien). User genehmigt → erst dann Umsetzung.
2. **Modul fertig vor Wechsel**: Ein Modul wird zu 100% fertig (Backend + Frontend-Anbindung + Dashboard/Liste/Detail/Einstellungen synchron) bevor das nächste startet.
3. **Lange Aufgaben in einem Prompt**: Wenn ein Step viele Files/Logik braucht, arbeite ich ohne Rückfragen durch bis fertig.
4. **Konsistenz-Regel**: Jede neue Funktion muss überall wirken (Liste, Detail, Dashboard-KPI, Aktivitäten, Benachrichtigungen, Einstellungen).
5. **Pi-kompatibel von Tag 1**: Keine Cloud-Lock-ins, alles arm64-/Pi-OS-Lite-/Node 20+ -kompatibel.

## ABSOLUTE Regeln (nicht verhandelbar)

### Code/Daten-Trennung
- **Code**: `/opt/mycleancenter/current/` — read-only zur Laufzeit. Updates ersetzen NUR Code via atomarem Symlink-Switch. Ein Vorgänger-Ordner für Rollback.
- **Daten**: `/var/lib/mycleancenter/` — der EINZIGE Ort an dem das Backend schreiben darf. Struktur:
  ```
  /var/lib/mycleancenter/
    db/mycleancenter.sqlite        (Hauptdatenbank, WAL-Mode)
    db/mycleancenter.sqlite-wal    (Write-Ahead-Log)
    db/mycleancenter.sqlite-shm    (Shared Memory)
    keys/master.key                (root:root 0600, AES-256-Key für Settings-Verschlüsselung)
    uploads/logo.png               (Firmenlogo für PDFs)
    uploads/...                    (sonstige Uploads)
    pdfs/cache/                    (generierte PDFs Cache)
    backups/daily/                 (tägliche Snapshots)
    backups/weekly/                (wöchentliche)
    backups/monthly/               (monatliche)
    backups/safety/                (Sicherheits-Backups vor Update/Restore)
    logs/app.log                   (Rotation via logrotate)
  ```
- **Jede Schreib-Operation** im Code muss über `path.join(process.env.DATA_DIR, ...)` laufen. Keine hartkodierten Pfade.
- **Bei System-Update**: Daten-Verzeichnis bleibt komplett unangetastet, nur Symlink wird umgeschaltet.
- **Bei Restore**: Sicherheits-Backup ZUERST → dann Daten-Verzeichnis sauber tauschen → Migration-Runner bringt Schema auf aktuellen Stand.

### Credentials & Secrets — NIEMALS in Lovable-Secrets / nicht in den Code
**Alle privaten Zugangsdaten** (Strato SMTP, Google OAuth Client ID + Secret + Refresh-Token, Stundenzettel-URL, etc.) werden:
1. Vom User in der **Einstellungen-UI** eingegeben
2. Vom Backend mit dem `master.key` (AES-256-GCM) verschlüsselt
3. In `einstellungen` Tabelle gespeichert (Spalten: `key`, `value_encrypted`, `iv`, `auth_tag`)
4. Beim Lesen on-the-fly entschlüsselt, niemals geloggt

**Lovable-Secrets werden NICHT verwendet.** Der Master-Key wird einmalig beim ersten Backend-Start auf dem Pi generiert und liegt unter `/var/lib/mycleancenter/keys/master.key` (root:root 0600).

### Datenbank-Architektur (kritisch für Backups)
- **WAL-Mode** ist Pflicht (`PRAGMA journal_mode=WAL`) — sonst werden laufende Schreibvorgänge bei Backup zu Korruption führen.
- **Backups via `db.backup()` API** von better-sqlite3 (nutzt SQLite Online Backup API) — NIEMALS plain `cp` der DB-Datei.
- **Schema-Versionierung**: Tabelle `_migrations(id, name, applied_at)`. Migration-Runner läuft bei jedem Backend-Start. Restore alter Backups → Migrations bringen sie auf aktuellen Stand.
- **Foreign Keys** aktivieren: `PRAGMA foreign_keys=ON`.
- **Synchronous = NORMAL** (Standard bei WAL, schneller, immer noch crash-safe).
- **Auto-Checkpoint** alle 1000 Pages (Standard) — verhindert dass WAL unbegrenzt wächst.
- **Transaktionen** für alle Multi-Statement-Operationen (`db.transaction(() => {...})`).
- **Prepared Statements** für alle wiederkehrenden Queries (Performance + SQL-Injection-Schutz).

### Was in jedes Backup gehört
1. SQLite-DB (via `db.backup()` API, konsistent)
2. Inhalt von `uploads/` (Logo, Anhänge)
3. `keys/master.key` (sonst sind die Settings nach Restore unbrauchbar — der Key ist Teil der Daten, nicht des Codes)
4. Schema-Version + App-Version als Metadaten in einer `backup-manifest.json`

→ Backup ist ein **TAR.GZ** mit dieser Struktur, nicht nur die DB-Datei.

## Tech-Stack Backend
- Node.js 20 LTS, Fastify, better-sqlite3, Zod, pdfkit (oder puppeteer-core, Entscheidung in Step 5), nodemailer, googleapis, systemd

## Repo-Layout (geplant)
```
/backend
  /src
    /db          (init, migrations runner, backup helper)
    /lib         (crypto, pdf, mail, drive, backup, belegnummer, audit)
    /modules     (auth, einstellungen, kunden, rechnungen, angebote, zahlungen, ...)
       /<modul>
         routes.ts
         service.ts
         schema.ts
    /server.ts
  /migrations    (0001_init.sql, 0002_kunden.sql, ...)
  package.json
/frontend (= aktuelles Lovable-Projekt)
  src/api/*.ts   (typed Client gegen Pi-API)
```

---

## Steps (Reihenfolge ist verbindlich, NEU sortiert)

### Step 0 — Backend-Grundgerüst, DB-Init, Master-Key
- `/backend` anlegen: Fastify + better-sqlite3 + Zod + tsx
- ENV: `DATA_DIR`, `PORT`, `BIND_HOST` (default `0.0.0.0` für LAN)
- DB-Init unter `${DATA_DIR}/db/mycleancenter.sqlite` mit **WAL + foreign_keys**
- Migration-Runner mit `_migrations`-Tabelle und Schema-Versionierung
- **Master-Key-Generierung** beim ersten Start (`crypto.randomBytes(32)` → `keys/master.key`, 0600)
- `crypto.ts` Lib mit `encryptSetting()` / `decryptSetting()` (AES-256-GCM)
- Health-Endpunkt `/health` mit Schema-Version
- systemd-Unit-Template
- Frontend: zentraler `apiClient` mit `VITE_API_URL`
- **Akzeptanz**: Backend startet, generiert Master-Key (oder lädt vorhandenen), DB-Datei mit WAL existiert, `/health` antwortet mit Schema-Version, encrypt/decrypt Roundtrip in Test grün.

### Step 1 — Einstellungen-Modul + Auth (VORGEZOGEN)
- Tabelle `einstellungen(key TEXT PRIMARY KEY, value_encrypted BLOB, iv BLOB, auth_tag BLOB, updated_at)`
- Tabelle `users(id, username, password_hash, created_at)` — argon2id
- Auth-Endpunkte: `/auth/login`, `/auth/logout`, `/auth/me` mit Fastify-Cookie + Session
- Settings-Endpunkte: `GET /einstellungen/:key` (entschlüsselt), `PUT /einstellungen/:key` (verschlüsselt speichern), `GET /einstellungen` (Liste mit `is_set: boolean`, NIEMALS Werte)
- Frontend: Einstellungen-UI für SMTP, Google OAuth, Stundenzettel-URL, Firmendaten — alles wird hier eingegeben und gespeichert
- Login-Screen + Session-Handling im Frontend
- **Akzeptanz**: User setzt im Frontend SMTP-Daten → DB enthält verschlüsselten Wert → Restart → Werte sind noch da → falscher Master-Key macht sie unlesbar.

### Step 2 — Kunden-Modul
- Tabellen `kunden`, `kunden_zaehler` (für Belegnummern pro Kunde+Monat)
- CRUD + `/kunden/kuerzel-frei?kuerzel=…` (Live-Check)
- `naechsteBelegnummer(kuerzel, jahrMonat)` atomar in Transaktion
- Frontend: bestehende Kunden-Seiten an API hängen, Live-Kürzel-Check
- **Akzeptanz**: Anlegen, Konflikt-Erkennung, Live-Updates ohne Reload.

### Step 3 — Backup & Restore (VORGEZOGEN, BEVOR ECHTDATEN)
- Backup-Lib: `db.backup()` → temp-Datei → tar.gz mit `db/`, `uploads/`, `keys/master.key`, `backup-manifest.json`
- Cron im Backend: täglich 03:00, Rotation Daily 7 / Weekly 4 / Monthly 12
- Endpunkte: `/backups` (list, sichtbar nur wenn `status==='erfolg' && abgeschlossenAm`), `/backups/create`, `/backups/:id/download`, `/backups/:id/restore`
- **Restore-Flow**: 
  1. Sicherheits-Backup von aktuellem Stand → `backups/safety/`
  2. Backend in Wartungsmodus
  3. tar.gz entpacken nach temp
  4. Manifest prüfen (Schema-Version ≤ aktuell)
  5. Atomar swappen: `db/`, `uploads/`, `keys/`
  6. Migration-Runner laufen lassen (alte Schemas auf aktuell heben)
  7. Backend neu laden
- Frontend: Backup-Liste, „Jetzt sichern", „Wiederherstellen" mit Bestätigungs-Dialog
- **Akzeptanz**: Echtdaten-Test: Kunden anlegen → Backup → Kunden löschen → Restore → alles wieder da, inkl. Settings (= Master-Key wurde mitgesichert).

### Step 4 — Rechnungen-Modul (Kern)
- Tabellen `rechnungen`, `rechnung_positionen`, `zahlungen`
- Status-Lifecycle nach `mem://features/document-lifecycle`, Teilzahlungs-Logik
- Belegnummer beim Erstellen via Step-2-Helper
- Endpunkte: list/get/create/update/delete/send, addZahlung/deleteZahlung, Status-Übergänge
- Status-Ableitung aus Zahlungssumme (offen/teilbezahlt/bezahlt/überfällig)
- KPIs: `/dashboard/kennzahlen`, `/dashboard/umsatz`, `/dashboard/warnungen`
- Frontend: Liste, Detail, KPIs, Dashboard-Kacheln, FlowBar, Aktivitäten — alles live
- **Akzeptanz**: Komplette Rechnungs-UI live gegen Pi, Teilzahlungen durchgängig, alle KPIs/Dashboard updaten ohne Reload.

### Step 5 — PDF-Engine + Live-Editor + Logo-Upload (Rechnung)
- Entscheidung pdfkit vs. puppeteer-core im Plan (puppeteer-core ist schwerer auf Pi, pdfkit reicht meist)
- Logo-Upload-Endpunkt → `${DATA_DIR}/uploads/logo.png`
- Template exakt nach User-Vorlage (kommt nach Step 4)
- `/rechnungen/:id/pdf` (stream), Cache in `${DATA_DIR}/pdfs/cache/`
- Live-Editor `/rechnungen/:id/bearbeiten` nach `mem://features/pdf-editor`
- **Akzeptanz**: PDF 1:1 zu Vorlage, Live-Edit mit Autosave, Logo erscheint.

### Step 6 — Mail (Strato) + Google Drive Upload
- nodemailer mit SMTP-Daten aus `einstellungen` (entschlüsselt zur Laufzeit)
- Google OAuth Flow: `/einstellungen/google/connect` → Auth-URL → Callback `/einstellungen/google/callback` → Refresh-Token verschlüsselt in `einstellungen`
- Drive-Upload nach `mycleancenter.cm/Rechnungen/{YYYY}/{MM}/` mit Dateinamen-Schema
- Status-Indikator dezent in UI
- Versand-Endpunkt + Status-Übergang `versendet`
- **Akzeptanz**: Test-Mail kommt an, PDF im richtigen Drive-Ordner, geräteübergreifend gleicher „verbunden"-Status.

### Step 7 — Angebote-Modul
- Tabellen `angebote`, `angebot_positionen`
- Status-Lifecycle, Übergang Angebot → Rechnung (kopiert Positionen, neue Belegnummer)
- PDF, Live-Editor, Mail, Drive — Wiederverwendung Step 5/6
- **Akzeptanz**: Identische Funktionstiefe wie Rechnungen, Konvertierung funktioniert.

### Step 8 — Aktivitäten + Benachrichtigungen + Audit-Log
- Tabelle `aktivitaeten` (Event-Log für UI)
- Tabelle `audit_log` (Login, Restore, Update, Settings-Änderungen — sicherheitsrelevant, separat)
- `/aktivitaeten`, `/benachrichtigungen` (mit ungelesen-Counter), `/audit-log` (nur Admin)
- Live: Polling alle 5s oder SSE (Entscheidung im Plan)
- **Akzeptanz**: Jede Aktion erzeugt Eintrag, Bell-Counter live, Audit-Log zeigt Logins/Restores/Updates.

### Step 9 — System-Update (NACH Backup)
- ZIP-Upload-Endpunkt
- Validierung: Signatur/Manifest-Check
- **Pflicht-Sicherheits-Backup** vor Update (nutzt Step 3)
- Atomarer Symlink-Switch `current → versions/2026-05-02-1430`
- Vorgänger-Version für Rollback aufheben
- Live-Steps in UI nach `mem://features/system-update`
- Daten-Verzeichnis bleibt unangetastet (Code-only-Update)
- **Akzeptanz**: Update läuft, Daten unverändert, Rollback funktioniert, Sicherheits-Backup wurde erstellt.

### Step 10 — Steuer-Modul
- Tabellen `steuer_termine`, `steuer_berechnungen`
- Sätze nach `mem://features/steuern`, drei Hauptsteuern automatisch
- Dashboard-Widget „Rücklage 35%"
- **Akzeptanz**: Berechnungen stimmen, Disclaimer sichtbar.

### Step 11 — Stundenzettel-Embed + Pi-Deployment + Feinschliff
- Stundenzettel-URL aus Einstellungen → Iframe-Logik nach `mem://features/stundenzettel-iframe`
- Einstellungen final: SMTP-Test-Button, Drive-Status, Backup-Plan-Anzeige, Update-Verlauf
- Pi-Deployment-Doku: Image-Setup, systemd, nginx-reverse-proxy, mDNS `mycleancenter.local`, USB-SSD-Mount, logrotate, fail2ban
- **Akzeptanz**: Frische Pi-Installation in unter 30 Min einsatzbereit, alle Module bestehen End-to-End-Test.

---

## Was VOR Step-Start vom User kommt
- Step 5: PDF-Vorlagen für Rechnung + Angebot
- Step 6: User konfiguriert SMTP + Google OAuth selbst in der UI (kein Lovable-Secret nötig)
- Step 11: User konfiguriert Stundenzettel-URL selbst in der UI

## Was bewusst NICHT enthalten ist
- Kein Multi-Mandanten-Setup (nur eine Firma: GmbH Sankt Augustin)
- Keine externe Cloud-DB
- Keine Lovable-Secrets für private Credentials
- Kein §48 Bauleistungs-Steuer-Handling
