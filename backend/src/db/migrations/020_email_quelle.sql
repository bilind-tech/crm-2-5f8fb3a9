-- Migration 020: Audit-Spalte `quelle` für email_versand.
-- Stellt sicher, dass jede Email-Sendung nachvollziehbar einen User-Klick als
-- Ursprung hat. Die Backend-Logik akzeptiert ausschließlich `quelle='manuell'`.

ALTER TABLE email_versand ADD COLUMN quelle TEXT NOT NULL DEFAULT 'manuell';

-- Idempotenz-Key sollte bereits unique sein; falls noch nicht abgesichert,
-- legen wir einen eindeutigen Index an (IF NOT EXISTS schützt vor Doppel-Run).
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_versand_idempotenz
  ON email_versand(idempotenz_key);
