-- ============================================
-- Migration: App Settings & Icon Storage
-- Erstellt Singleton-Tabelle für App-Branding und Storage-Bucket für Icons
-- ============================================

-- 1. App Settings Tabelle (Singleton-Pattern)
CREATE TABLE IF NOT EXISTS public.app_settings (
  id UUID PRIMARY KEY DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  app_name TEXT NOT NULL DEFAULT 'Kessel App',
  app_description TEXT,
  app_category TEXT,
  icon_url TEXT,
  icon_variants JSONB DEFAULT '[]'::jsonb,
  icon_provider TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT app_settings_singleton CHECK (id = '00000000-0000-0000-0000-000000000001'::uuid)
);

-- Kommentare
COMMENT ON TABLE public.app_settings IS 'Singleton-Tabelle für App-Branding-Einstellungen (nur 1 Row erlaubt)';
COMMENT ON COLUMN public.app_settings.app_name IS 'App-Name für Prompt-Kontext';
COMMENT ON COLUMN public.app_settings.app_description IS 'Beschreibung für Prompt';
COMMENT ON COLUMN public.app_settings.app_category IS 'Kategorie (z.B. Boilerplate/Framework, Benutzerverwaltung)';
COMMENT ON COLUMN public.app_settings.icon_url IS 'URL des aktiven Icons (Supabase Storage)';
COMMENT ON COLUMN public.app_settings.icon_variants IS 'JSON-Array mit Varianten-URLs zur Auswahl';
COMMENT ON COLUMN public.app_settings.icon_provider IS 'Verwendeter Provider (openrouter, fal)';

-- Index für schnelle Abfragen
CREATE INDEX IF NOT EXISTS idx_app_settings_singleton ON public.app_settings(id);

-- RLS aktivieren
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Jeder kann lesen (App-Icon muss öffentlich sein)
CREATE POLICY "App Settings sind öffentlich lesbar"
ON public.app_settings FOR SELECT
USING (true);

-- Nur Admins können schreiben
CREATE POLICY "Nur Admins können App Settings ändern"
ON public.app_settings FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Nur Admins können App Settings aktualisieren"
ON public.app_settings FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Trigger für updated_at
CREATE OR REPLACE FUNCTION update_app_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS app_settings_updated_at ON public.app_settings;
CREATE TRIGGER app_settings_updated_at
BEFORE UPDATE ON public.app_settings
FOR EACH ROW
EXECUTE FUNCTION update_app_settings_updated_at();

-- Initiale Zeile einfügen (falls nicht vorhanden)
INSERT INTO public.app_settings (id, app_name, app_description)
VALUES ('00000000-0000-0000-0000-000000000001'::uuid, 'Kessel App', 'Boilerplate für B2B-Apps')
ON CONFLICT (id) DO NOTHING;

-- 2. Storage Bucket für App-Icons erstellen
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'app-icons',
  'app-icons',
  true, -- Public, damit Icons ohne Auth geladen werden können
  5242880, -- 5MB max pro Datei (für PNG/Base64)
  ARRAY['image/png', 'image/svg+xml']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage Policies für den app-icons Bucket

-- Jeder kann lesen (Icons müssen öffentlich sein)
CREATE POLICY "App Icons sind öffentlich lesbar"
ON storage.objects FOR SELECT
USING (bucket_id = 'app-icons');

-- Nur Admins können Icons hochladen
CREATE POLICY "Nur Admins können App Icons hochladen"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'app-icons' AND
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Nur Admins können Icons aktualisieren
CREATE POLICY "Nur Admins können App Icons aktualisieren"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'app-icons' AND
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Nur Admins können Icons löschen
CREATE POLICY "Nur Admins können App Icons löschen"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'app-icons' AND
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- ============================================
-- HINWEIS:
-- - app_settings ist ein Singleton (nur 1 Row)
-- - Icons werden im Storage-Bucket app-icons gespeichert
-- - Nur Admins können Icons generieren und speichern
-- ============================================
