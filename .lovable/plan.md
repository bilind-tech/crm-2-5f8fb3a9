
# Plan: MyCleanCenter sauber neu auf Raspberry Pi 5

Ziel: Ein System, das nach **einem** Befehl auf einem frisch geflashten Pi läuft, deine Daten unter allen Umständen schützt und nicht mehr durch SSR-Drift, Worker-Bundler oder fehlende Pakete kaputt geht.

## Leitplanken (nicht verhandelbar)

1. **Daten sind heilig** — `/var/lib/mycleancenter/` wird durch Code-Updates niemals angefasst. Jedes Update und jeder Restore erstellen vorher ein Sicherheits-Backup.
2. **Code und Daten getrennt** — Code unter `/opt/mycleancenter/releases/<ts>/`, Daten unter `/var/lib/mycleancenter/`. Atomar via Symlink `current →`.
3. **Nur LAN, kein Internet** — kein SEO, kein Cloudflare, keine SSR. Hörbar nur auf `0.0.0.0:8787` im Heimnetz.
4. **Single User** — kein Multi-Tenant, keine Rollen, ein Konto + Recovery-Code.
5. **Niemals automatischer Mailversand** — Cron deaktiviert, nur User-Klick.

---

## 1. Architektur-Entscheidung

**Frontend wird reine SPA**, gebaut mit Vite + `@vitejs/plugin-react` + TanStack **Router** (ohne TanStack **Start**). Kein SSR, kein Cloudflare-Worker-Bundle, keine `wrangler.jsonc` auf dem Pi.

**Backend (Fastify)** ist der einzige Server: liefert die statische SPA aus `dist/` und alle JSON-APIs. Genau ein Prozess, eine Portnummer (8787), eine systemd-Unit.

```text
Browser  ──HTTP──►  Fastify (8787)
                     ├─ /assets/*, /index.html  (statische SPA)
                     ├─ /auth, /kunden, /belege, ... (JSON API)
                     └─ SPA-Fallback: alles andere → index.html
```

Warum SPA statt SSR: Die letzten Crashes (`Cannot read properties of undefined (reading 'get')` in `router-core/ssr-server.js`, `HTTPError 500`, fehlendes `main-*.js`) kommen alle daher, dass das TanStack-Start-SSR-Bundle für Cloudflare Workers gebaut wird, aber unter normalem Node auf dem Pi läuft. Das ist eine Sackgasse. SPA hat keine SSR-Runtime und keine Worker-Abhängigkeiten.

## 2. Frontend-Umbau

- Zweite Vite-Konfig `vite.spa.config.ts` (parallel zur bestehenden Lovable-Konfig für die Cloud-Preview):
  - `@vitejs/plugin-react`, `@tanstack/router-plugin/vite` (nur Router, nicht Start), `@tailwindcss/vite`, `vite-tsconfig-paths`
  - `build.outDir = "dist"`, `build.rollupOptions.input = "index.html"`, deterministische Asset-Namen
- Neue `index.html` im Projekt-Root mit `<div id="root">` und `<script type="module" src="/src/main.tsx">`
- Neuer Client-Entry `src/main.tsx`: erstellt den Router via `createRouter({ routeTree })` und mountet ihn mit `ReactDOM.createRoot(...).render(<RouterProvider router={router} />)`
- `src/routes/__root.tsx` verliert `shellComponent`/HTML-Shell — die HTML-Shell kommt jetzt aus `index.html`
- Neues Script in `package.json`: `"build:spa": "vite build --config vite.spa.config.ts"`
- Lovable-Cloud-Preview bleibt unangetastet (weiterhin TanStack-Start), nur das Pi-Bundle nutzt SPA

## 3. Backend-Härtung

- `backend/src/server.ts`: SPA-Fallback bleibt (ist schon korrekt), zusätzlich:
  - Healthcheck `/health` antwortet IMMER, auch wenn Frontend fehlt
  - Beim Boot: wenn `index.html` in `FRONTEND_DIR` fehlt, sauberer Log + 503 mit klarer Meldung — kein 500
- `assertCodeAndDataSeparated()` bleibt als Wall vor dem ersten DB-Open
- Alle Pfade kommen aus `config.ts` mit Default `/var/lib/mycleancenter/...`
- Migrations laufen auf `openDatabase()` automatisch + idempotent

## 4. Release-Bundler reparieren

`scripts/build-release.ts`:
- Ruft `bun run build:spa` (statt `vite build`) → liefert flaches `dist/index.html` + `dist/assets/*`
- Entfernt `createSpaIndex()` komplett (nicht mehr nötig — Vite erzeugt korrektes `index.html`)
- ZIP-Inhalt:
  ```text
  manifest.json            (signiert, HMAC mit master.key)
  dist/                    (SPA: index.html + assets/)
  backend/dist/            (kompiliertes Backend)
  backend/package.json
  backend/package-lock.json
  backend/src/db/migrations/
  backend/dist/db/migrations/
  backend/deploy/          (install.sh, systemd, sudoers, logrotate)
  ```
- SHA256 + Größencheck wie bisher

## 5. Pi-Installer (idempotent, ein Befehl)

`backend/deploy/install.sh` wird so erweitert, dass ein **frischer Pi** mit genau einem Befehl läuft:

```bash
curl -fsSL https://raw.githubusercontent.com/<dein-repo>/main/backend/deploy/bootstrap.sh | sudo bash
```

`bootstrap.sh` (neu, klein):
1. apt update + git, curl, unzip, build-essential, python3
2. Node 20 LTS via NodeSource
3. Lädt das neueste Release-ZIP von GitHub Releases (oder nimmt ein lokal hochgeladenes)
4. Ruft `install.sh --bootstrap=<zip>` auf

`install.sh` (Erweiterungen):
- Vor jedem Re-Install: prüft `/var/lib/mycleancenter/` und legt **Sicherheits-Backup** an (`backups/safety/pre-install-<ts>.tgz`)
- Native Module explizit für ARM64 bauen: `npm rebuild better-sqlite3 @node-rs/argon2 --build-from-source` mit Fallback auf Prebuilt
- Symlink `current → releases/<ts>/` atomar via `ln -sfn` + `mv`
- Hält genau **einen** Vorgänger-Release vor (`releases/previous`) für Rollback
- `chmod 0700 /var/lib/mycleancenter/keys` und `chown mycleancenter:mycleancenter` rekursiv auf Daten + Code
- systemd-Unit + sudoers + logrotate werden installiert (idempotent)
- `systemctl restart mycleancenter` + Healthcheck-Loop (max 30 s) gegen `/health`
- Druckt am Ende die Setup-URL `http://<host>.local:8787/setup?token=…`

## 6. Daten- und Backup-Sicherheit

- **Tägliches SQLite-Snapshot** (bestehender Scheduler) auf `/var/lib/mycleancenter/backups/daily/`, Rotation daily/weekly/monthly
- **Vor jedem System-Update** automatisches Sicherheits-Backup; Restore-Flow erzeugt zuerst ebenfalls ein Sicherheits-Backup
- USB-SSD: `install.sh` prüft, ob `/var/lib/mycleancenter` auf der SSD liegt und warnt, wenn auf SD-Karte
- Optionaler Drive-Mirror der Backups (existiert bereits) bleibt opt-in
- Backups erscheinen in der UI nur mit `status="erfolg" AND abgeschlossenAm IS NOT NULL` (bereits umgesetzt)

## 7. Stabilität & Beobachtbarkeit

- `setErrorHandler` im Backend logt Stacktrace, antwortet sauberes JSON
- Pino-Logs gehen via systemd in `journalctl -u mycleancenter`, plus logrotate für eigene App-Logs
- `/health` liefert: `version`, `schemaVersion`, `dbOk`, `dataDirOk`, `frontendOk`, `uptime`
- Jeder Start prüft DB-Integrität (`PRAGMA integrity_check`) — bei Fehler: read-only-Modus + lauter UI-Banner

## 8. Vorgehen Schritt für Schritt

```text
[Code-Änderungen in Lovable]
 1. vite.spa.config.ts + index.html + src/main.tsx anlegen
 2. __root.tsx auf SPA-Modus umstellen (kein shellComponent)
 3. package.json: "build:spa" Script
 4. scripts/build-release.ts auf build:spa umstellen, createSpaIndex entfernen
 5. backend/src/server.ts: 503-statt-500 wenn Frontend fehlt, Healthcheck erweitern
 6. backend/deploy/install.sh: Sicherheits-Backup + ARM64-Rebuild + atomares Symlink-Switch
 7. backend/deploy/bootstrap.sh (neu) für One-Liner-Install
 8. Release bauen: bun run release  →  dist-release/mycleancenter-vX.Y.Z.zip

[Auf dem Pi]
 9. Pi 5 mit Raspberry Pi OS Lite (64-bit) flashen, SSH aktivieren
10. SSD anschließen, /var/lib/mycleancenter auf SSD mounten (fstab)
11. ZIP via scp auf den Pi kopieren
12. sudo bash install.sh --bootstrap=mycleancenter-vX.Y.Z.zip
13. Browser: http://<host>.local:8787/setup?token=…  → Konto + Recovery-Code
```

## 9. Was passiert bei Problemen

- Service startet nicht → `journalctl -u mycleancenter -n 100` zeigt echten Stacktrace
- Update bricht ab → Symlink wird nicht umgelegt, alte Version läuft weiter
- DB-Integrität verletzt → automatisch letztes Daily-Backup angeboten, kein Schreiben
- Rollback: `ln -sfn /opt/mycleancenter/releases/previous /opt/mycleancenter/current && systemctl restart mycleancenter`

## 10. Was bewusst NICHT im Plan ist

- Kein Cloud-Deploy, kein Cloudflare, kein Wrangler auf dem Pi
- Kein SSR, keine TanStack-Start-Runtime auf dem Pi
- Keine Multi-User-Logik, keine Rollen, kein Auto-Mailversand
- Keine Änderungen an deiner Lovable-Cloud-Preview (die bleibt wie sie ist zum Entwickeln)

---

**Bereit zum Umsetzen?** Sag „Plan ok", dann setze ich Schritte 1–7 in einem Rutsch um, baue ein Release-ZIP und schicke dir die exakten Pi-Befehle für Schritt 9–13.
