/**
 * Test-Fixtures für Tool-Calling Tests
 *
 * Vordefinierte Testdaten für alle Szenarien.
 * Diese können in Tests verwendet werden, um konsistente Test-Daten zu haben.
 */

/**
 * Test-User Fixture
 */
export const TEST_USER = {
  email: "test-carmen@example.com",
  display_name: "Carmen König",
  role: "user" as const,
  password: "test-password-123",
}

/**
 * Test-Admin Fixture
 */
export const TEST_ADMIN = {
  email: "test-admin@example.com",
  display_name: "Test Admin",
  role: "admin" as const,
  password: "test-password-123",
}

/**
 * Test-Bug Fixture
 */
export const TEST_BUG = {
  title: "Test-Bug: Button funktioniert nicht",
  description: "Der Submit-Button auf der Login-Seite reagiert nicht auf Klicks.",
  severity: "medium" as const,
  status: "open" as const,
  browser_info: "Chrome 120.0.0.0, Windows 11",
}

/**
 * Test-Bug Update Fixture (für "als gelöst markieren")
 */
export const TEST_BUG_UPDATE = {
  status: "fixed" as const,
  severity: "low" as const,
}

/**
 * Test-Feature Fixture
 */
export const TEST_FEATURE = {
  title: "Feature: Dark Mode",
  description: "Dark Mode für bessere Lesbarkeit bei Nachtarbeit.",
  status: "planned" as const,
}

/**
 * Test-Theme Fixture (für Theme-Wechsel)
 */
export const TEST_THEME = {
  name: "test-theme-dark",
  display_name: "Test Dark Theme",
  description: "Ein Test-Theme für Integration-Tests",
  css_content: `
    :root {
      --background: oklch(0.1 0.01 230);
      --foreground: oklch(0.95 0.01 230);
    }
  `,
  is_active: false,
}

/**
 * Generiert eine eindeutige E-Mail-Adresse für Tests
 */
export function generateTestEmail(prefix: string = "test"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(7)}@test.local`
}

/**
 * Generiert einen eindeutigen Test-Namen
 */
export function generateTestName(prefix: string = "Test"): string {
  return `${prefix} ${Date.now()}`
}

/**
 * Test-Daten für User-Anlage
 */
export function getTestUserData() {
  return {
    email: generateTestEmail("user"),
    display_name: generateTestName("Test User"),
    role: "user" as const,
  }
}

/**
 * Test-Daten für Bug-Report
 */
export function getTestBugData() {
  return {
    title: `${generateTestName("Bug")}: Button funktioniert nicht`,
    description: "Beschreibung des Problems",
    severity: "medium" as const,
    browser_info: "Chrome 120.0.0.0",
  }
}

/**
 * Test-Daten für Feature-Request
 */
export function getTestFeatureData() {
  return {
    title: `Feature: ${generateTestName()}`,
    description: "Beschreibung des Features",
    status: "planned" as const,
  }
}

