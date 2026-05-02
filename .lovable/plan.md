
# Step 15 — Release-Bundle, Build-Pipeline & Pi-Erstinstallation

Step 13/14 sind fertig: Backend-Mahn-Automatik läuft, Frontend zeigt sie korrekt an.
Was jetzt fehlt, damit das CRM tatsächlich auf dem Pi 5 läuft: ein reproduzierbarer
**Release-Bundler**, der ein signiertes ZIP baut (Backend kompiliert, Frontend gebaut,
Manifest signiert), plus ein **Bootstrap-Pfad für die Erstinstallation** (Frontend
wird vom Backend mit ausgeliefert, nicht aus separatem Webserver).

Step 15 schließt den Loop: lokal `bun run release` → fertiges `mycleancenter-vX.Y.Z.zip`
→ auf den Pi kopieren → `install.sh` → läuft.

## Ziele

1. **Ein einziges Artefakt** (`mycleancenter-vX.Y.Z.zip`) enthält Backend (kompiliert), Frontend (gebaut), Migrationen, Manifest, signiert mit `master.key`.
2. **Backend serviert das Frontend** statisch (kein zweiter Webserver auf dem Pi nötig).
3. **Reproduzierbarer Build** über `scripts/build-release.ts` — funktioniert lokal und in CI.
4. **Update-Pfad konsistent**: dasselbe ZIP, das man frisch installiert, kann über die System-Update-UI (Step Backend bereits vorhanden) eingespielt werden.
5. **Erstinstallation 1-Befehl-Erlebnis** auf dem Pi.

## Umfang

### A — Release-Builder (`scripts/build-release.ts`)

Neues Script im Repo-Root unter `scripts/`. Verwendet `bun`/`tsx` und nutzt vorhandenes
`signManifest` aus `backend/src/system/manifest.ts`.

Ablauf:
1. Liest `version` aus `package.json` und `backend/package.json` (müssen synchron sein, sonst Abbruch).
2. Liest aktuelle `schemaVersion` aus `backend/src/db/migrations/` (höchste Migrations-Nummer).
3. Baut Frontend: `bun run build` → Output nach `dist/` (TanStack/Vite SSR).
4. Baut Backend: `cd backend && bun run build` → `backend/dist/`.
5. Kopiert in `tmp/release-bundle/`:
   - `backend/dist/` → `backend/dist/`
   - `backend/package.json`, `backend/package-lock.json`
   - `backend/src/db/migrations/` → `backend/src/db/migrations/` (SQL-Dateien werden zur Laufzeit gelesen)
   - `backend/deploy/` (install.sh, systemd, sudoers, logrotate)
   - `dist/` (Frontend-Output, vom Backend statisch ausgeliefert)
   - `node_modules/` für Backend nicht — wird auf Pi via `npm ci --omit=dev` neu installiert (Native-Module wie `better-sqlite3`/`@node-rs/argon2` müssen für Pi-Architektur gebaut werden).
6. Generiert Manifest:
   - `appVersion`, `schemaVersion`, `createdAt = ISO now`, `minBackendVersion` (aus Konfig-Konstante in script), `hinweise` (aus `RELEASE_NOTES.md` falls vorhanden).
   - Signiert mit `master.key` (Pfad via Flag `--key=<path>`, default `~/.mycleancenter/master.key`).
   - Schreibt `manifest.json` ins Bundle-Root.
7. Zip-Stream → `dist-release/mycleancenter-vX.Y.Z.zip`.
8. Berechnet SHA256 → schreibt `dist-release/mycleancenter-vX.Y.Z.zip.sha256`.
9. Logging: jeder Schritt mit Zeitstempel, Größenangabe.

CLI-Flags:
- `--out=<dir>` (default `dist-release/`)
- `--key=<path>` (default `~/.mycleancenter/master.key`)
- `--allow-same-version` (für Test-Builds)
- `--skip-frontend` / `--skip-backend` (Schnell-Iteration)

Neuer npm-Script in Root-`package.json`: `"release": "tsx scripts/build-release.ts"`.

### B — Backend serviert Frontend statisch

`backend/src/server.ts`:
- Neue Registrierung `@fastify/static` (Plugin hinzufügen) — Root `dist/` (relativ zu `process.cwd()` bzw. `APP_DIR/current/dist`).
- Konfig: `config.frontendDir = path.resolve(process.cwd(), "../dist")` mit Override via `FRONTEND_DIR`.
- Reihenfolge: API-Routen zuerst (`/api/*`, `/auth/*`, `/health`, etc. — alles, was das Backend bereits anbietet bleibt unter denselben Pfaden), danach SPA-Fallback: alle nicht-API-Pfade liefern `index.html` (HTML5-History-Routing).
- Wenn `FRONTEND_DIR` nicht existiert (Dev-Modus), kein Static-Plugin laden, nur Log-Hinweis. Frontend läuft dann wie bisher über Vite-Dev-Server.

`backend/package.json`: `@fastify/static` als Dependency.

### C — Frontend → Backend-API-Konfiguration

Aktuelles Frontend nutzt vermutlich relative Pfade gegen Backend (siehe `src/lib/api/`).
Step 15 stellt sicher:
- Production-Build verwendet `window.location.origin` als API-Basis (kein hardcoded `localhost:8787`).
- Falls aktuell `VITE_API_URL` o.ä. gesetzt ist: in Production-Build leer lassen, im
  Dev-Build auf `http://localhost:8787`.
- Kontroll-Lesen: `src/lib/api/client.ts` (oder Pendant) anpassen.

### D — Pi-Erstinstallations-Erlebnis verbessern

`backend/deploy/install.sh`:
- Nach `ensure_node` neue Funktion `install_backend_deps`: wenn `$APP_DIR/current/backend/package.json` existiert und `node_modules` fehlt → `cd $APP_DIR/current/backend && sudo -u $APP_USER npm ci --omit=dev`.
- Nach erfolgreichem Service-Start: Healthcheck (`curl -fsS http://localhost:8787/health`) mit 30s Retry-Loop, Ausgabe der Setup-URL.
- Neuer `--bootstrap=<zip>` Flag: nimmt direkt ein Release-ZIP entgegen und entpackt es nach `releases/initial/`, setzt `current`-Symlink, danach normaler Setup-Flow. Spart die manuellen `tar`/`ln`-Schritte aus dem README.

`backend/deploy/README.md`:
- Erstinstallation auf 2 Befehle reduziert:
  ```bash
  scp mycleancenter-v0.2.0.zip pi@mycleancenter.local:~/
  ssh pi@mycleancenter.local 'sudo bash <(unzip -p mycleancenter-v0.2.0.zip backend/deploy/install.sh) --bootstrap=mycleancenter-v0.2.0.zip'
  ```
  (Erläutert + alternative manuelle Variante belassen.)

`backend/deploy/systemd/mycleancenter.service`:
- `WorkingDirectory=/opt/mycleancenter/current/backend` bleibt.
- `Environment=FRONTEND_DIR=/opt/mycleancenter/current/dist` neu.
- `ExecStart` bleibt `node dist/server.js`.

### E — Master-Key-Bootstrap für Builder

Problem: Builder braucht `master.key`, der erst beim ersten Pi-Start generiert wird.
Lösung:
- Erstinstallations-Skript zeigt nach erstem Boot den Pfad zum `master.key` und einen
  Befehl, mit dem man ihn auf die Build-Maschine kopiert (`scp pi@…:/var/lib/mycleancenter/keys/master.key ~/.mycleancenter/master.key`).
- README ergänzt um Abschnitt „Build-Maschine einrichten" (Master-Key kopieren, Berechtigungen 0600).
- `scripts/build-release.ts` gibt klare Fehlermeldung mit Anleitung, wenn Key fehlt.

### F — Release-Notes-Workflow

- Neue Datei `RELEASE_NOTES.md` (Root, optional) — wird vom Builder ins Manifest-Feld `hinweise` kopiert (max. 4000 Zeichen, sonst Abbruch).
- Anzeige im Frontend: System-Update-Dialog zeigt `manifest.hinweise` bereits (vorhanden checken — sonst kleine UI-Ergänzung in `EinstellungenSystemTab` bzw. Update-Komponente).

### G — Tests

`backend/test/release-bundle.spec.ts` (neu):
- Erzeugt Test-Master-Key.
- Ruft `build-release` mit `--skip-frontend --skip-backend` und Mock-Bundle-Verzeichnis auf.
- Prüft: ZIP enthält `manifest.json`, Manifest validiert via `validateManifest` gegen denselben Key, SHA256-Datei korrekt.
- Optional Smoke: entpacke ZIP → starte Update-Runner gegen Test-DB → Roll-forward + Rollback funktioniert.

### H — CI-Hinweis (optional, nur Doku)

Kurzer Abschnitt in `backend/deploy/README.md`: wenn später CI gewünscht, Master-Key als Secret hinterlegen, `bun run release` ausführen, ZIP als Artefakt veröffentlichen. Keine Konfiguration in diesem Step — nur Hinweis.

## Was NICHT in Step 15

- Auto-Update-Polling (Pi pullt sich selbst neue Releases) — bleibt manueller Upload.
- Multi-Tenant / Mehr-Pi-Sync.
- Frontend-Setup-Wizard für Erst-Admin-Erstellung (separater Step, falls noch nicht vorhanden).
- Prometheus / Monitoring-Endpoints.

## Akzeptanzkriterien

1. `bun run release` auf der Build-Maschine erzeugt ein gültiges, signiertes ZIP plus SHA256, ohne manuelle Nacharbeit.
2. Das gleiche ZIP, hochgeladen über System-Update-UI, durchläuft den bestehenden Update-Runner ohne Fehler.
3. Frisch geflashter Pi: nach `install.sh --bootstrap=…` läuft `http://mycleancenter.local:8787` und liefert die SPA aus, API-Calls treffen denselben Origin.
4. Daten unter `/var/lib/mycleancenter/` werden nie angefasst (Update + Erstinstallation).
5. `release-bundle.spec.ts` grün.
6. Build schlägt sauber fehl, wenn `master.key` fehlt oder Versionen nicht synchron sind.

## Geänderte / neue Dateien

**Neu:**
- `scripts/build-release.ts`
- `dist-release/.gitignore` (`*` außer `.gitignore`)
- `RELEASE_NOTES.md` (Template/Stub)
- `backend/test/release-bundle.spec.ts`

**Editiert:**
- `package.json` (root: `release`-Script, ggf. `tsx`/`archiver` als devDep)
- `backend/package.json` (`@fastify/static` als dep)
- `backend/src/server.ts` (Static-Serving + SPA-Fallback)
- `backend/src/config.ts` (`frontendDir`)
- `backend/deploy/install.sh` (`--bootstrap`, `install_backend_deps`, Healthcheck-Loop)
- `backend/deploy/README.md` (Erstinstallation 1-Befehl, Build-Maschine, Master-Key-Bootstrap)
- `backend/deploy/systemd/mycleancenter.service` (`FRONTEND_DIR` env)
- `src/lib/api/client.ts` (oder vergleichbarer Einstiegspunkt) — Origin-basierte API-URL in Production
- ggf. `EinstellungenSystemTab` / Update-Dialog: `hinweise` anzeigen, falls noch nicht

---

**Sag „los Step 15", dann setze ich um.**
