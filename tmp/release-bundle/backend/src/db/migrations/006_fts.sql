-- Step 3: Volltextsuche (FTS5).
-- "contentless" + Diakritik-tolerantes Tokenizing — "gartner" findet "Gärtner".
-- Trigger synchronisieren kunde/objekt/notiz in den Index. Angebote und
-- Rechnungen folgen in Step 4/7 mit additiven Triggern.

CREATE VIRTUAL TABLE IF NOT EXISTS suche_idx USING fts5(
  entity_typ      UNINDEXED,
  entity_id       UNINDEXED,
  titel,
  untertitel,
  body,
  link_route      UNINDEXED,
  link_param_id   UNINDEXED,
  tokenize = "unicode61 remove_diacritics 2"
);

-- =============================================================================
-- KUNDE → suche_idx
-- =============================================================================
CREATE TRIGGER IF NOT EXISTS kunde_ai AFTER INSERT ON kunde BEGIN
  INSERT INTO suche_idx(entity_typ, entity_id, titel, untertitel, body, link_route, link_param_id)
  VALUES (
    'kunde',
    NEW.id,
    COALESCE(NULLIF(TRIM(COALESCE(NEW.firmenname,'') || ' ' || COALESCE(NEW.nachname,'') || ' ' || COALESCE(NEW.vorname,'')),''), NEW.nummer),
    COALESCE(NEW.nummer,'') || ' ' || COALESCE(NEW.kuerzel,''),
    COALESCE(NEW.email,'') || ' ' || COALESCE(NEW.telefon,'') || ' ' || COALESCE(NEW.mobil,'') || ' ' ||
    COALESCE(NEW.strasse,'') || ' ' || COALESCE(NEW.plz,'') || ' ' || COALESCE(NEW.ort,'') || ' ' ||
    COALESCE(NEW.notizen,''),
    '/kunden/$id',
    NEW.id
  );
END;

CREATE TRIGGER IF NOT EXISTS kunde_ad AFTER DELETE ON kunde BEGIN
  DELETE FROM suche_idx WHERE entity_typ='kunde' AND entity_id=OLD.id;
END;

CREATE TRIGGER IF NOT EXISTS kunde_au AFTER UPDATE ON kunde BEGIN
  DELETE FROM suche_idx WHERE entity_typ='kunde' AND entity_id=OLD.id;
  INSERT INTO suche_idx(entity_typ, entity_id, titel, untertitel, body, link_route, link_param_id)
  VALUES (
    'kunde',
    NEW.id,
    COALESCE(NULLIF(TRIM(COALESCE(NEW.firmenname,'') || ' ' || COALESCE(NEW.nachname,'') || ' ' || COALESCE(NEW.vorname,'')),''), NEW.nummer),
    COALESCE(NEW.nummer,'') || ' ' || COALESCE(NEW.kuerzel,''),
    COALESCE(NEW.email,'') || ' ' || COALESCE(NEW.telefon,'') || ' ' || COALESCE(NEW.mobil,'') || ' ' ||
    COALESCE(NEW.strasse,'') || ' ' || COALESCE(NEW.plz,'') || ' ' || COALESCE(NEW.ort,'') || ' ' ||
    COALESCE(NEW.notizen,''),
    '/kunden/$id',
    NEW.id
  );
END;

-- =============================================================================
-- OBJEKT → suche_idx
-- =============================================================================
CREATE TRIGGER IF NOT EXISTS objekt_ai AFTER INSERT ON objekt BEGIN
  INSERT INTO suche_idx(entity_typ, entity_id, titel, untertitel, body, link_route, link_param_id)
  VALUES (
    'objekt',
    NEW.id,
    NEW.name,
    NEW.nummer || ' · ' || COALESCE(NEW.ort,''),
    COALESCE(NEW.strasse,'') || ' ' || COALESCE(NEW.plz,'') || ' ' || COALESCE(NEW.ort,'') || ' ' ||
    COALESCE(NEW.zugangsinfo,'') || ' ' || COALESCE(NEW.alarm_info,'') || ' ' || COALESCE(NEW.notizen,''),
    '/objekte/$id',
    NEW.id
  );
END;

CREATE TRIGGER IF NOT EXISTS objekt_ad AFTER DELETE ON objekt BEGIN
  DELETE FROM suche_idx WHERE entity_typ='objekt' AND entity_id=OLD.id;
END;

CREATE TRIGGER IF NOT EXISTS objekt_au AFTER UPDATE ON objekt BEGIN
  DELETE FROM suche_idx WHERE entity_typ='objekt' AND entity_id=OLD.id;
  INSERT INTO suche_idx(entity_typ, entity_id, titel, untertitel, body, link_route, link_param_id)
  VALUES (
    'objekt',
    NEW.id,
    NEW.name,
    NEW.nummer || ' · ' || COALESCE(NEW.ort,''),
    COALESCE(NEW.strasse,'') || ' ' || COALESCE(NEW.plz,'') || ' ' || COALESCE(NEW.ort,'') || ' ' ||
    COALESCE(NEW.zugangsinfo,'') || ' ' || COALESCE(NEW.alarm_info,'') || ' ' || COALESCE(NEW.notizen,''),
    '/objekte/$id',
    NEW.id
  );
END;

-- =============================================================================
-- NOTIZ → suche_idx (an Kunde oder Objekt aufgehängt — Link führt zur Parent-Entity)
-- =============================================================================
CREATE TRIGGER IF NOT EXISTS notiz_ai AFTER INSERT ON notiz BEGIN
  INSERT INTO suche_idx(entity_typ, entity_id, titel, untertitel, body, link_route, link_param_id)
  VALUES (
    'notiz',
    NEW.id,
    'Notiz',
    substr(NEW.text, 1, 80),
    NEW.text,
    CASE
      WHEN NEW.kunde_id    IS NOT NULL THEN '/kunden/$id'
      WHEN NEW.objekt_id   IS NOT NULL THEN '/objekte/$id'
      WHEN NEW.angebot_id  IS NOT NULL THEN '/angebote/$id'
      WHEN NEW.rechnung_id IS NOT NULL THEN '/rechnungen/$id'
    END,
    COALESCE(NEW.kunde_id, NEW.objekt_id, NEW.angebot_id, NEW.rechnung_id)
  );
END;

CREATE TRIGGER IF NOT EXISTS notiz_ad AFTER DELETE ON notiz BEGIN
  DELETE FROM suche_idx WHERE entity_typ='notiz' AND entity_id=OLD.id;
END;

CREATE TRIGGER IF NOT EXISTS notiz_au AFTER UPDATE ON notiz BEGIN
  DELETE FROM suche_idx WHERE entity_typ='notiz' AND entity_id=OLD.id;
  INSERT INTO suche_idx(entity_typ, entity_id, titel, untertitel, body, link_route, link_param_id)
  VALUES (
    'notiz',
    NEW.id,
    'Notiz',
    substr(NEW.text, 1, 80),
    NEW.text,
    CASE
      WHEN NEW.kunde_id    IS NOT NULL THEN '/kunden/$id'
      WHEN NEW.objekt_id   IS NOT NULL THEN '/objekte/$id'
      WHEN NEW.angebot_id  IS NOT NULL THEN '/angebote/$id'
      WHEN NEW.rechnung_id IS NOT NULL THEN '/rechnungen/$id'
    END,
    COALESCE(NEW.kunde_id, NEW.objekt_id, NEW.angebot_id, NEW.rechnung_id)
  );
END;
