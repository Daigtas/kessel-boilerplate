-- ============================================
-- Migration: AI Datasources & Tool Permissions
-- Verwaltet, welche Tabellen die AI lesen/schreiben darf
-- ============================================

-- 1. Permission-Level Enum
CREATE TYPE ai_access_level AS ENUM ('none', 'read', 'read_write', 'full');

COMMENT ON TYPE ai_access_level IS 'Zugriffslevel für AI auf Datenbank-Tabellen: none=kein Zugriff, read=nur lesen, read_write=lesen+schreiben, full=inkl. löschen';

-- 2. AI Datasources Tabelle
CREATE TABLE IF NOT EXISTS public.ai_datasources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Tabellen-Identifikation
  table_schema TEXT NOT NULL DEFAULT 'public',
  table_name TEXT NOT NULL,
  
  -- Anzeige-Informationen
  display_name TEXT NOT NULL,
  description TEXT,
  
  -- Berechtigungen
  access_level ai_access_level NOT NULL DEFAULT 'none',
  
  -- Konfiguration
  is_enabled BOOLEAN DEFAULT true,
  allowed_columns TEXT[] DEFAULT '{}', -- Leer = alle Spalten
  excluded_columns TEXT[] DEFAULT '{}', -- z.B. ['password_hash', 'secret']
  max_rows_per_query INTEGER DEFAULT 100,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  
  UNIQUE(table_schema, table_name)
);

COMMENT ON TABLE ai_datasources IS 'Steuert AI-Zugriff auf Datenbank-Tabellen';
COMMENT ON COLUMN ai_datasources.access_level IS 'none=kein Zugriff, read=nur lesen, read_write=lesen+schreiben, full=inkl. löschen';
COMMENT ON COLUMN ai_datasources.excluded_columns IS 'Spalten, die nie an die AI übergeben werden';
COMMENT ON COLUMN ai_datasources.allowed_columns IS 'Leer = alle Spalten erlaubt, sonst nur diese Spalten';

-- Index für schnelle Lookups
CREATE INDEX IF NOT EXISTS idx_ai_datasources_table ON ai_datasources(table_schema, table_name);
CREATE INDEX IF NOT EXISTS idx_ai_datasources_enabled ON ai_datasources(is_enabled) WHERE is_enabled = true;

-- 3. AI Tool Calls Audit Log
CREATE TABLE IF NOT EXISTS public.ai_tool_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Kontext
  user_id UUID REFERENCES auth.users(id),
  session_id TEXT,
  
  -- Tool-Details
  tool_name TEXT NOT NULL,
  tool_args JSONB NOT NULL DEFAULT '{}',
  
  -- Ergebnis
  success BOOLEAN NOT NULL,
  result JSONB,
  error_message TEXT,
  
  -- Dry-Run Info
  is_dry_run BOOLEAN DEFAULT false,
  
  -- Timing
  executed_at TIMESTAMPTZ DEFAULT NOW(),
  duration_ms INTEGER
);

COMMENT ON TABLE ai_tool_calls IS 'Audit-Log aller AI Tool-Aufrufe';
COMMENT ON COLUMN ai_tool_calls.is_dry_run IS 'True wenn nur SQL generiert, aber nicht ausgeführt wurde';

-- Index für schnelle Abfragen
CREATE INDEX IF NOT EXISTS idx_ai_tool_calls_user ON ai_tool_calls(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_tool_calls_tool ON ai_tool_calls(tool_name);
CREATE INDEX IF NOT EXISTS idx_ai_tool_calls_time ON ai_tool_calls(executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_tool_calls_session ON ai_tool_calls(session_id);

-- 4. AI Models Tabelle (optional, für Multi-Model Support)
CREATE TABLE IF NOT EXISTS public.ai_models (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL, -- 'openrouter', 'openai', 'anthropic'
  display_name TEXT NOT NULL,
  description TEXT,
  supports_vision BOOLEAN DEFAULT false,
  supports_tools BOOLEAN DEFAULT true,
  max_tokens INTEGER DEFAULT 4096,
  is_default BOOLEAN DEFAULT false,
  is_enabled BOOLEAN DEFAULT true,
  cost_per_1k_input DECIMAL(10,6),
  cost_per_1k_output DECIMAL(10,6),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE ai_models IS 'Verfügbare AI-Modelle und deren Konfiguration';
COMMENT ON COLUMN ai_models.id IS 'Model-ID (z.B. google/gemini-3-flash-preview, anthropic/claude-opus-4.5)';

-- Index für schnelle Lookups
CREATE INDEX IF NOT EXISTS idx_ai_models_provider ON ai_models(provider);
CREATE INDEX IF NOT EXISTS idx_ai_models_enabled ON ai_models(is_enabled) WHERE is_enabled = true;
CREATE INDEX IF NOT EXISTS idx_ai_models_default ON ai_models(is_default) WHERE is_default = true;

-- Default-Modelle einfügen
INSERT INTO ai_models (id, provider, display_name, supports_vision, supports_tools, is_default) VALUES
  ('google/gemini-3-flash-preview', 'openrouter', 'Gemini 3 Flash', true, false, true),
  ('anthropic/claude-opus-4.5', 'openrouter', 'Claude Opus 4.5', true, true, false),
  ('openai/gpt-4.1', 'openrouter', 'GPT-4.1', true, true, false)
ON CONFLICT (id) DO NOTHING;

-- 5. Helper-Funktion: Spalten einer Tabelle abrufen
CREATE OR REPLACE FUNCTION get_table_columns(
  p_schema TEXT,
  p_table TEXT
)
RETURNS TABLE (
  column_name TEXT,
  data_type TEXT,
  is_nullable BOOLEAN,
  column_default TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.column_name::TEXT,
    c.data_type::TEXT,
    c.is_nullable::BOOLEAN,
    c.column_default::TEXT
  FROM information_schema.columns c
  WHERE c.table_schema = p_schema
    AND c.table_name = p_table
  ORDER BY c.ordinal_position;
END;
$$;

COMMENT ON FUNCTION get_table_columns IS 'Gibt alle Spalten einer Tabelle zurück für Schema-Introspection';

-- 6. RLS aktivieren
ALTER TABLE ai_datasources ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_tool_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_models ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies

-- ai_datasources: Alle können lesen, nur Admins können verwalten
DROP POLICY IF EXISTS "Alle können Datasources lesen" ON ai_datasources;
CREATE POLICY "Alle können Datasources lesen" ON ai_datasources
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Nur Admins können Datasources ändern" ON ai_datasources;
CREATE POLICY "Nur Admins können Datasources ändern" ON ai_datasources
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- ai_tool_calls: User sieht eigene, Admin sieht alle
DROP POLICY IF EXISTS "Users sehen eigene Tool-Calls" ON ai_tool_calls;
CREATE POLICY "Users sehen eigene Tool-Calls" ON ai_tool_calls
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins sehen alle Tool-Calls" ON ai_tool_calls;
CREATE POLICY "Admins sehen alle Tool-Calls" ON ai_tool_calls
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "System kann Tool-Calls erstellen" ON ai_tool_calls;
CREATE POLICY "System kann Tool-Calls erstellen" ON ai_tool_calls
  FOR INSERT WITH CHECK (true);

-- ai_models: Alle können lesen, Admins können ändern
DROP POLICY IF EXISTS "Alle können Models lesen" ON ai_models;
CREATE POLICY "Alle können Models lesen" ON ai_models
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Nur Admins können Models ändern" ON ai_models;
CREATE POLICY "Nur Admins können Models ändern" ON ai_models
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- 8. Trigger für updated_at
CREATE TRIGGER ai_datasources_updated_at
  BEFORE UPDATE ON ai_datasources
  FOR EACH ROW EXECUTE FUNCTION update_profiles_updated_at();

-- 9. Auto-Discovery: Erstelle initiale Einträge für alle public-Tabellen
-- Default: access_level = 'none' (sicher)
DO $$
DECLARE
  table_rec RECORD;
BEGIN
  FOR table_rec IN
    SELECT table_schema, table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      AND table_name NOT IN ('ai_datasources', 'ai_tool_calls', 'ai_models') -- Exclude self
  LOOP
    INSERT INTO ai_datasources (table_schema, table_name, display_name, access_level)
    VALUES (
      table_rec.table_schema,
      table_rec.table_name,
      INITCAP(REPLACE(table_rec.table_name, '_', ' ')), -- "themes" -> "Themes"
      'none' -- Sicher: Standard ist kein Zugriff
    )
    ON CONFLICT (table_schema, table_name) DO NOTHING;
  END LOOP;
END $$;

-- 10. Default-Datasources für wichtige Infra-Tabellen aktivieren (nur read)
UPDATE ai_datasources
SET 
  access_level = 'read',
  is_enabled = true,
  description = CASE 
    WHEN table_name = 'themes' THEN 'App-Themes und Farbschemata'
    WHEN table_name = 'profiles' THEN 'Benutzerprofile (ohne sensible Daten)'
    WHEN table_name = 'roles' THEN 'Verfügbare Benutzerrollen'
    WHEN table_name = 'module_role_access' THEN 'Zugriffsrechte pro Modul'
    ELSE description
  END
WHERE table_name IN ('themes', 'profiles', 'roles', 'module_role_access');

