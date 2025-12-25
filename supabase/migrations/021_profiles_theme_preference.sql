-- Migration: Profiles Theme Preference
-- Dokumentiert das theme_preference Feld in der profiles Tabelle
-- HINWEIS: Dieses Feld existiert bereits in der Datenbank

-- ============================================
-- 1. Spalte hinzufügen (falls nicht vorhanden)
-- ============================================

-- PostgreSQL unterstützt kein "ADD COLUMN IF NOT EXISTS" direkt,
-- daher nutzen wir einen DO-Block
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'profiles' 
      AND column_name = 'theme_preference'
  ) THEN
    ALTER TABLE public.profiles 
      ADD COLUMN theme_preference TEXT DEFAULT 'default';
  END IF;
END $$;

-- ============================================
-- 2. Kommentar hinzufügen
-- ============================================

COMMENT ON COLUMN public.profiles.theme_preference IS 
  'Bevorzugtes Theme des Users (Theme-ID aus themes Tabelle, z.B. "default", "dark-ocean")';

-- ============================================
-- 3. Index für schnelle Lookups (optional)
-- ============================================

CREATE INDEX IF NOT EXISTS idx_profiles_theme_preference 
  ON public.profiles(theme_preference);

-- ============================================
-- 4. Foreign Key zur themes Tabelle (optional, soft reference)
-- ============================================

-- HINWEIS: Wir setzen KEINEN harten Foreign Key, da:
-- 1. Themes können gelöscht werden → User sollte dann auf 'default' fallen
-- 2. Flexibilität für zukünftige Theme-Varianten
-- 
-- Stattdessen: Validierung auf Anwendungsebene oder via Trigger

-- ============================================
-- HINWEIS:
-- Diese Migration dokumentiert ein bereits existierendes Feld.
-- Das Feld speichert die Theme-ID die der User bevorzugt.
-- Beispielwerte: 'default', 'dark-ocean', 'light-modern'
-- ============================================

