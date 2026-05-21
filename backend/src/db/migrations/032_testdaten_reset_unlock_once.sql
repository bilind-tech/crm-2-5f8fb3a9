-- EINMALIGE Freischaltung des Testdaten-Resets auf Anforderung des Nutzers.
-- Diese Migration läuft nur einmal (Migrations-Versionierung verhindert
-- Wiederholung), setzt die Sperre genau einmal zurück und ändert
-- danach nichts mehr — die Regel "Updates dürfen reset_state nicht
-- zurücksetzen" bleibt für künftige Migrationen verbindlich.
UPDATE reset_state
   SET testdaten_reset_genutzt_am = NULL,
       testdaten_reset_von_user_id = NULL
 WHERE id = 1;