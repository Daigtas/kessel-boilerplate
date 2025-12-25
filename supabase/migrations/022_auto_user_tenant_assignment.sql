-- Migration: Auto User-Tenant Assignment
-- Stellt sicher, dass neue User automatisch in app.user_tenants eingetragen werden
-- Das ist wichtig für die JWT-Claims und RLS-Policies

-- ============================================
-- 1. Trigger-Funktion: Bei neuem Profil auch user_tenants befüllen
-- ============================================

CREATE OR REPLACE FUNCTION public.sync_user_tenant_on_profile_insert()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, app
LANGUAGE plpgsql
AS $$
DECLARE
  v_tenant_role TEXT;
BEGIN
  -- Nur wenn tenant_id gesetzt ist
  IF NEW.tenant_id IS NOT NULL THEN
    -- Bestimme die Rolle im Tenant basierend auf der App-Rolle
    v_tenant_role := CASE 
      WHEN NEW.role = 'admin' THEN 'owner'
      WHEN NEW.role = 'superuser' THEN 'admin'
      ELSE 'member'
    END;
    
    -- Füge Eintrag in user_tenants hinzu (falls nicht vorhanden)
    INSERT INTO app.user_tenants (user_id, tenant_id, role)
    VALUES (NEW.id, NEW.tenant_id, v_tenant_role)
    ON CONFLICT (user_id, tenant_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Kommentar
COMMENT ON FUNCTION public.sync_user_tenant_on_profile_insert() IS 'Fügt automatisch einen Eintrag in app.user_tenants hinzu wenn ein Profil mit tenant_id erstellt wird';

-- ============================================
-- 2. Trigger erstellen (falls nicht vorhanden)
-- ============================================

DROP TRIGGER IF EXISTS sync_user_tenant_on_profile_insert_trigger ON public.profiles;

CREATE TRIGGER sync_user_tenant_on_profile_insert_trigger
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_user_tenant_on_profile_insert();

-- ============================================
-- 3. Trigger für UPDATE: Wenn tenant_id geändert wird
-- ============================================

CREATE OR REPLACE FUNCTION public.sync_user_tenant_on_profile_update()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, app
LANGUAGE plpgsql
AS $$
DECLARE
  v_tenant_role TEXT;
BEGIN
  -- Wenn tenant_id geändert wurde
  IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
    -- Alten Eintrag entfernen (falls vorhanden)
    IF OLD.tenant_id IS NOT NULL THEN
      DELETE FROM app.user_tenants 
      WHERE user_id = NEW.id AND tenant_id = OLD.tenant_id;
    END IF;
    
    -- Neuen Eintrag hinzufügen (falls tenant_id gesetzt)
    IF NEW.tenant_id IS NOT NULL THEN
      v_tenant_role := CASE 
        WHEN NEW.role = 'admin' THEN 'owner'
        WHEN NEW.role = 'superuser' THEN 'admin'
        ELSE 'member'
      END;
      
      INSERT INTO app.user_tenants (user_id, tenant_id, role)
      VALUES (NEW.id, NEW.tenant_id, v_tenant_role)
      ON CONFLICT (user_id, tenant_id) DO NOTHING;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Kommentar
COMMENT ON FUNCTION public.sync_user_tenant_on_profile_update() IS 'Synchronisiert app.user_tenants wenn tenant_id im Profil geändert wird';

-- Trigger erstellen
DROP TRIGGER IF EXISTS sync_user_tenant_on_profile_update_trigger ON public.profiles;

CREATE TRIGGER sync_user_tenant_on_profile_update_trigger
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_user_tenant_on_profile_update();

-- ============================================
-- 4. Backfill: Alle existierenden Profile synchronisieren
-- ============================================

INSERT INTO app.user_tenants (user_id, tenant_id, role)
SELECT 
  p.id,
  p.tenant_id,
  CASE 
    WHEN p.role = 'admin' THEN 'owner'
    WHEN p.role = 'superuser' THEN 'admin'
    ELSE 'member'
  END
FROM public.profiles p
WHERE p.tenant_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM app.user_tenants ut 
    WHERE ut.user_id = p.id AND ut.tenant_id = p.tenant_id
  )
ON CONFLICT (user_id, tenant_id) DO NOTHING;

-- ============================================
-- HINWEIS:
-- Diese Migration stellt sicher, dass:
-- 1. Bei neuen Profilen automatisch ein user_tenants Eintrag erstellt wird
-- 2. Bei Änderung der tenant_id die user_tenants Tabelle aktualisiert wird
-- 3. Alle existierenden Profile nachträglich synchronisiert werden
-- ============================================

