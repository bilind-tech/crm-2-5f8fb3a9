-- 034_rechnung_leistungsmonat.sql
-- Optionaler Leistungsmonat einer Rechnung (Format "YYYY-MM").
-- Wird im PDF-Intro angezeigt: "hiermit übersenden wir Ihnen die
-- Rechnung v. April 2026 für folgende Leistungen:".

ALTER TABLE rechnung ADD COLUMN leistungsmonat TEXT NULL;