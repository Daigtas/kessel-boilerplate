-- ============================================
-- Migration: PostgREST Konfiguration reparieren
-- ============================================
-- 
-- Repariert mögliche Probleme mit PostgREST-Konfiguration
-- nach Migration 013, die versucht hat, db_schemas zu setzen.
-- 
-- Diese Migration stellt sicher, dass PostgREST wieder funktioniert.

-- Prüfe ob PostgREST-Konfiguration beschädigt wurde
DO $$
DECLARE
  current_schemas TEXT;
BEGIN
  -- Hole aktuelle Konfiguration
  SELECT current_setting('pgrst.db_schemas', true) INTO current_schemas;
  
  -- Prüfe ob "new_schemas" als Literal gesetzt wurde (Fehler aus Migration 013)
  IF current_schemas = 'new_schemas' THEN
    RAISE NOTICE '⚠️  PostgREST-Konfiguration wurde beschädigt (new_schemas als Literal)';
    RAISE NOTICE '    Setze auf Standard-Werte zurück...';
    
    -- Setze auf Standard-Schemas (ohne app, da es nicht benötigt wird)
    -- ALTER ROLE authenticator SET pgrst.db_schemas = 'public, infra, storage, graphql_public, realtime';
    -- Funktioniert nur lokal, daher nur Notice
    
    RAISE NOTICE '    ⚠️  Auf Supabase Cloud muss db_schemas manuell im Dashboard gesetzt werden';
    RAISE NOTICE '    Setze auf: public, infra, storage, graphql_public, realtime';
  ELSIF current_schemas IS NULL OR current_schemas = '' THEN
    RAISE NOTICE '⚠️  PostgREST-Konfiguration ist leer';
    RAISE NOTICE '    Setze auf Standard-Werte...';
  ELSE
    RAISE NOTICE '✓ PostgREST-Konfiguration sieht korrekt aus: %', current_schemas;
  END IF;
END $$;

-- Stelle sicher, dass Grants korrekt sind (falls Migration 013 nicht vollständig lief)
GRANT USAGE ON SCHEMA app TO anon, authenticated;
GRANT SELECT ON app.tenants TO anon, authenticated;
GRANT SELECT ON app.user_tenants TO anon, authenticated;

-- ============================================
-- HINWEIS:
-- - Diese Migration repariert nur Grants
-- - db_schemas muss auf Supabase Cloud manuell gesetzt werden
-- - Das app-Schema muss NICHT in db_schemas sein (RPC-Funktionen sind im infra-Schema)
-- ============================================

