-- Migration: Role Delete Fallback
-- Beim Löschen einer Rolle werden alle User mit dieser Rolle auf die Default-Rolle 'user' gesetzt

-- ============================================
-- 1. Funktion für automatisches Fallback
-- ============================================

-- Trigger-Funktion: Vor dem Löschen einer Rolle alle User umsetzen
CREATE OR REPLACE FUNCTION handle_role_deletion()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  default_role_id UUID;
BEGIN
  -- Finde die Default-Rolle 'user'
  SELECT id INTO default_role_id FROM roles WHERE name = 'user';
  
  -- Falls keine Default-Rolle existiert, Fehler werfen
  IF default_role_id IS NULL THEN
    RAISE EXCEPTION 'Default-Rolle "user" nicht gefunden. Kann Rolle nicht löschen.';
  END IF;
  
  -- Setze alle Profile mit der zu löschenden Rolle auf die Default-Rolle
  UPDATE profiles 
  SET role_id = default_role_id 
  WHERE role_id = OLD.id;
  
  -- Log für Debugging (optional)
  RAISE NOTICE 'Rolle % gelöscht. Betroffene User wurden auf Default-Rolle gesetzt.', OLD.name;
  
  RETURN OLD;
END;
$$;

-- Kommentar
COMMENT ON FUNCTION handle_role_deletion() IS 'Setzt User auf Default-Rolle wenn ihre Rolle gelöscht wird';

-- ============================================
-- 2. Trigger erstellen
-- ============================================

DROP TRIGGER IF EXISTS trigger_role_deletion_fallback ON roles;

CREATE TRIGGER trigger_role_deletion_fallback
  BEFORE DELETE ON roles
  FOR EACH ROW
  EXECUTE FUNCTION handle_role_deletion();

-- ============================================
-- HINWEIS:
-- Diese Migration fügt einen BEFORE DELETE Trigger hinzu.
-- Wenn eine Rolle gelöscht wird, werden alle User mit dieser
-- Rolle automatisch auf die 'user' Rolle gesetzt.
-- ============================================

