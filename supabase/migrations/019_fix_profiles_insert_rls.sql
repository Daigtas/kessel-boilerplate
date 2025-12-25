-- ============================================
-- Migration 019: Fix Profiles INSERT RLS Policy
-- ============================================
-- 
-- Problem: Admins können keine Profile anlegen, weil es keine 
-- Admin-Override-Policy für INSERT gibt.
--
-- Lösung: Füge eine Policy hinzu, die Admins erlaubt, Profile 
-- für beliebige Tenants anzulegen.
-- ============================================

-- Admin-Override: Admins können Profile anlegen (plattform-weit)
-- Diese Policy fehlt aktuell!
CREATE POLICY "admins_can_insert_profiles"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() 
      AND p.role = 'admin'
    )
  );

-- Kommentar hinzufügen
COMMENT ON POLICY "admins_can_insert_profiles" ON public.profiles IS 
  'Erlaubt Admins, neue Profile anzulegen (z.B. via AI Tool-Calling)';

