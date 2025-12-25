-- Migration: Normalisierte Rollen-Architektur
-- Erstellt roles Tabelle und module_role_access Junction
-- Migriert bestehende Daten aus role_permissions

-- ============================================
-- 1. Roles Tabelle erstellen
-- ============================================

CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  is_system BOOLEAN DEFAULT false,  -- admin/user sind System-Rollen (nicht löschbar)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Kommentare
COMMENT ON TABLE roles IS 'Verfügbare Rollen im System';
COMMENT ON COLUMN roles.name IS 'Eindeutiger Slug (z.B. "admin", "user", "superuser")';
COMMENT ON COLUMN roles.display_name IS 'Anzeigename (z.B. "Administrator")';
COMMENT ON COLUMN roles.is_system IS 'System-Rollen können nicht gelöscht werden';

-- Index für schnelle Lookups
CREATE INDEX IF NOT EXISTS idx_roles_name ON roles(name);

-- ============================================
-- 2. Initiale System-Rollen anlegen
-- ============================================

INSERT INTO roles (name, display_name, is_system, description) VALUES
  ('admin', 'Administrator', true, 'Vollzugriff auf alle Bereiche'),
  ('user', 'Benutzer', true, 'Standard-Benutzer mit eingeschränkten Rechten'),
  ('superuser', 'Superuser', false, 'Erweiterte Rechte zwischen Admin und User')
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- 3. Module Role Access Junction-Tabelle
-- ============================================

CREATE TABLE IF NOT EXISTS module_role_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id TEXT NOT NULL,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  has_access BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(module_id, role_id)
);

-- Kommentare
COMMENT ON TABLE module_role_access IS 'Junction-Tabelle: Welche Rolle hat Zugriff auf welches Modul';
COMMENT ON COLUMN module_role_access.module_id IS 'ID des Moduls/der Seite (z.B. "app-content", "account-profile")';
COMMENT ON COLUMN module_role_access.role_id IS 'Referenz zur Rolle';
COMMENT ON COLUMN module_role_access.has_access IS 'Hat die Rolle Zugriff auf dieses Modul?';

-- Indizes für schnelle Lookups
CREATE INDEX IF NOT EXISTS idx_module_role_access_module_id ON module_role_access(module_id);
CREATE INDEX IF NOT EXISTS idx_module_role_access_role_id ON module_role_access(role_id);
CREATE INDEX IF NOT EXISTS idx_module_role_access_has_access ON module_role_access(has_access);

-- Updated_at Trigger
CREATE OR REPLACE FUNCTION update_module_role_access_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_module_role_access_updated_at ON module_role_access;
CREATE TRIGGER trigger_module_role_access_updated_at
  BEFORE UPDATE ON module_role_access
  FOR EACH ROW
  EXECUTE FUNCTION update_module_role_access_updated_at();

-- ============================================
-- 4. RLS aktivieren
-- ============================================

ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE module_role_access ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 5. RLS Policies für roles
-- ============================================

-- Alle können Rollen lesen
DROP POLICY IF EXISTS "Alle können Rollen lesen" ON roles;
CREATE POLICY "Alle können Rollen lesen"
  ON roles
  FOR SELECT
  USING (true);

-- Nur Admins können Rollen erstellen
DROP POLICY IF EXISTS "Nur Admins können Rollen erstellen" ON roles;
CREATE POLICY "Nur Admins können Rollen erstellen"
  ON roles
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Nur Admins können Rollen aktualisieren
DROP POLICY IF EXISTS "Nur Admins können Rollen aktualisieren" ON roles;
CREATE POLICY "Nur Admins können Rollen aktualisieren"
  ON roles
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Nur Admins können nicht-System-Rollen löschen
DROP POLICY IF EXISTS "Nur Admins können nicht-System-Rollen löschen" ON roles;
CREATE POLICY "Nur Admins können nicht-System-Rollen löschen"
  ON roles
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
    AND is_system = false  -- System-Rollen können nicht gelöscht werden
  );

-- ============================================
-- 6. RLS Policies für module_role_access
-- ============================================

-- Alle können Berechtigungen lesen
DROP POLICY IF EXISTS "Alle können Berechtigungen lesen" ON module_role_access;
CREATE POLICY "Alle können Berechtigungen lesen"
  ON module_role_access
  FOR SELECT
  USING (true);

-- Nur Admins können Berechtigungen erstellen
DROP POLICY IF EXISTS "Nur Admins können Berechtigungen erstellen" ON module_role_access;
CREATE POLICY "Nur Admins können Berechtigungen erstellen"
  ON module_role_access
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Nur Admins können Berechtigungen aktualisieren
DROP POLICY IF EXISTS "Nur Admins können Berechtigungen aktualisieren" ON module_role_access;
CREATE POLICY "Nur Admins können Berechtigungen aktualisieren"
  ON module_role_access
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Nur Admins können Berechtigungen löschen
DROP POLICY IF EXISTS "Nur Admins können Berechtigungen löschen" ON module_role_access;
CREATE POLICY "Nur Admins können Berechtigungen löschen"
  ON module_role_access
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- ============================================
-- 7. Migration bestehender Daten aus role_permissions
-- ============================================

-- Migriere admin_access Einträge
INSERT INTO module_role_access (module_id, role_id, has_access)
SELECT 
  rp.module_id,
  (SELECT id FROM roles WHERE name = 'admin'),
  rp.admin_access
FROM role_permissions rp
WHERE rp.admin_access IS NOT NULL
ON CONFLICT (module_id, role_id) DO UPDATE
SET has_access = EXCLUDED.has_access;

-- Migriere user_access Einträge
INSERT INTO module_role_access (module_id, role_id, has_access)
SELECT 
  rp.module_id,
  (SELECT id FROM roles WHERE name = 'user'),
  rp.user_access
FROM role_permissions rp
WHERE rp.user_access IS NOT NULL
ON CONFLICT (module_id, role_id) DO UPDATE
SET has_access = EXCLUDED.has_access;

-- Migriere superuser Einträge (falls vorhanden, sonst Standard: true)
INSERT INTO module_role_access (module_id, role_id, has_access)
SELECT DISTINCT
  rp.module_id,
  (SELECT id FROM roles WHERE name = 'superuser'),
  true  -- Standard: Superuser hat Zugriff
FROM role_permissions rp
ON CONFLICT (module_id, role_id) DO NOTHING;

