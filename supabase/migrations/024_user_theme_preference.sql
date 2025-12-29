-- ============================================
-- Migration: User Theme Preference
-- Fügt Theme-Auswahl zur profiles-Tabelle hinzu
-- ============================================

-- Spalte für ausgewähltes Theme hinzufügen
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS selected_theme TEXT DEFAULT 'default';

-- Spalte für Theme-Berechtigung (kann eigenes Theme wählen)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS can_select_theme BOOLEAN DEFAULT true;

-- Kommentare
COMMENT ON COLUMN public.profiles.selected_theme IS 'ID des vom User ausgewählten Themes';
COMMENT ON COLUMN public.profiles.can_select_theme IS 'Ob der User ein eigenes Theme auswählen darf (false = verwendet Admin-Theme)';

-- Index für schnelle Theme-Abfragen
CREATE INDEX IF NOT EXISTS idx_profiles_selected_theme ON public.profiles(selected_theme);

-- ============================================
-- Funktion: Admin-Theme abrufen
-- Gibt das Theme des ersten Admins zurück
-- ============================================
CREATE OR REPLACE FUNCTION public.get_admin_theme()
RETURNS TEXT AS $$
DECLARE
  admin_theme TEXT;
BEGIN
  SELECT selected_theme INTO admin_theme
  FROM public.profiles
  WHERE role = 'admin'
  ORDER BY created_at ASC
  LIMIT 1;
  
  RETURN COALESCE(admin_theme, 'default');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Funktion: Effektives Theme für User abrufen
-- Berücksichtigt can_select_theme Berechtigung
-- ============================================
CREATE OR REPLACE FUNCTION public.get_user_effective_theme(user_id UUID)
RETURNS TEXT AS $$
DECLARE
  user_theme TEXT;
  can_select BOOLEAN;
BEGIN
  -- User-Daten abrufen
  SELECT selected_theme, can_select_theme 
  INTO user_theme, can_select
  FROM public.profiles
  WHERE id = user_id;
  
  -- Wenn User nicht gefunden oder keine Berechtigung hat
  IF can_select IS NULL OR can_select = false THEN
    RETURN public.get_admin_theme();
  END IF;
  
  RETURN COALESCE(user_theme, 'default');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- HINWEIS:
-- - Jeder User bekommt standardmäßig can_select_theme = true
-- - Admins können can_select_theme für andere User auf false setzen
-- - User ohne Berechtigung bekommen automatisch das Admin-Theme
-- ============================================

