# Finaler Backend-Härtungs-Pass — Status

## ✅ Umgesetzt

### K1 — DB-Pfad-Konstante
- `backend/src/config.ts`: `DB_FILENAME = "mycleancenter.db"` exportiert.
- `backup/create.ts` und `backup/restore.ts` nutzen die Konstante.

### K2 — Restore: Inverse Daten-Guard
- `system/data-guard.ts`: neue `assertInsideDataDir(path, op)` Funktion.
- `backup/restore.ts`: `swapDir()` und `rollbackSwap()` rufen sie auf — Restore kann nicht versehentlich außerhalb von `dataDir` schreiben (Defense-in-Depth gegen tar-slip).

### K3 — Drive-Backup OHNE Master-Key (Variante A)
- `backup/drive-mirror.ts`: vor jedem Drive-Upload wird das Archiv entpackt, `keys/master.key` entfernt und neu gepackt. Lokales Backup bleibt vollständig (für lokales Restore mit verschlüsselten Settings).
- Wer aus Drive restored, muss SMTP-Passwort + Drive-Token einmalig neu eingeben — das ist ehrlicher und sicherer als Master-Key in der Cloud.

### K4 — install.sh Setup-URL Box
- ASCII-Box durch saubere 3-Zeilen-Ausgabe mit `═` ersetzt — bricht bei langen Tokens nicht mehr.

### W5 — `/auth/setup` Rate-Limit
- 5/min ergänzt → Bruteforce auf Setup-Token gedeckelt.

### P3 — `wrangler.jsonc` gelöscht
- War Cloudflare-Reststand, wir laufen auf dem Pi mit Fastify. Verhindert Verwechslung beim Deploy.

## Nicht angefasst (bewusst)

- K5 (FRONTEND_DIR): verifiziert in `scripts/build-release.ts` — Frontend liegt korrekt unter `dist/` Top-Level.
- W2/W4: nur Doku-Hinweise, kein Code-Change.
- P2 Test, P4 Kategorien: Polish, nach Erst-Deploy.
- Mahn-/Mail-Pfad: drei Schichten Schutz (Cron deaktiviert + `quelle==="cron"` Guard + `enqueueVersand` wirft auf alles ≠ `manuell`). Nichts ändern.
- Update-Runner: Daten-Guards sitzen, keine Refactoring nötig.

## Pi-Deployment-Checkliste

1. Pi-OS-Lite, USB-SSD an `/var/lib/mycleancenter` via fstab (`nofail`).
2. `sudo timedatectl set-timezone Europe/Berlin`.
3. Hostname `mycleancenter` + `avahi-daemon` aktiv → `mycleancenter.local`.
4. `install.sh` ausführen → Setup-Token-URL aus Konsole nehmen → Passwort + Recovery-Code SOFORT aufschreiben.
5. Drive verbinden in Einstellungen → erstes manuelles Backup → Restore-Test in Test-Umgebung (Drive-Restore: SMTP/Drive-Token müssen neu eingegeben werden — by design).
6. GitHub-PAT (Fine-grained, „Contents: Read") für Auto-Updates.
7. Vor Go-Live: SMTP-Test senden, Mahn-Cron als deaktiviert verifizieren, KEIN WAN-Exposure ohne TLS-Reverse-Proxy (Cookies sind im LAN unverschlüsselt — akzeptiert für Single-User-LAN).

## Sicherheits-Posture (kurz)
- Code/Daten getrennt: `assertCodeAndDataSeparated()` Bootcheck + `assertNotInDataDir` (Update-Runner) + `assertInsideDataDir` (Restore-Flow). Beide Richtungen gegeneinander geschützt.
- Backups: SHA256-Verify VOR Swap, Schema-Downgrade verboten, atomarer Rollback aus `old/`, Drive-Mirror schlüssel-frei.
- Auth: argon2id, Lockout 10/15min, Rate-Limit auf login/recovery/setup/backup-write/restore.
- Mails: drei Schutzschichten, kein automatischer Versand möglich.
