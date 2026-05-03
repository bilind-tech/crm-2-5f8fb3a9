-- 005_backup_drive.sql
-- Drive-Mirror-Status für Backup-Einträge.
-- Wert "skip" = Mirror ist deaktiviert; "pending" = wartet auf Worker;
-- "synced" = erfolgreich in Drive; "error" = Drive-Fehler (Backup lokal trotzdem ok).
ALTER TABLE backup_history ADD COLUMN drive_status TEXT NOT NULL DEFAULT 'skip';
ALTER TABLE backup_history ADD COLUMN drive_file_id TEXT;
ALTER TABLE backup_history ADD COLUMN drive_error TEXT;
ALTER TABLE backup_history ADD COLUMN drive_synced_at TEXT;
