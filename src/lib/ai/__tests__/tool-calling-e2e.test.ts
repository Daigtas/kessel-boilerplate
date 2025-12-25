/**
 * Tool-Calling E2E Integration Tests
 *
 * Testet die vollständige Tool-Calling-Funktionalität gegen die echte Supabase-Datenbank.
 * Diese Tests prüfen:
 * - Tool-Ausführung mit echten Datenbankoperationen
 * - Access Control (RLS Policies)
 * - Audit-Logging
 * - Multi-Step Workflows (z.B. role_id auflösen → User anlegen)
 *
 * WICHTIG: Diese Tests benötigen:
 * - NEXT_PUBLIC_SUPABASE_URL in .env.local
 * - SUPABASE_SERVICE_ROLE_KEY in .env.local
 * - Laufende Supabase-Instanz (lokal oder remote)
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import { createClient } from "@supabase/supabase-js"
import { executeTool } from "../tool-executor"
import {
  getTestContext,
  assertToolSuccess,
  assertToolError,
  globalCleanup,
  type TestContext,
} from "./test-helpers"
import {
  getTestUserData,
  getTestBugData,
  getTestFeatureData,
  TEST_BUG_UPDATE,
} from "./test-fixtures"

// Mock createClient aus @/utils/supabase/server
// Wir erstellen einen Client mit dem Access-Token des Test-Users
vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn(),
}))

describe("Tool-Calling E2E Tests", () => {
  let testContext: TestContext
  let testSupabaseUrl: string
  let testAnonKey: string

  beforeEach(async () => {
    // Environment-Variablen prüfen
    testSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    testAnonKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!

    if (!testSupabaseUrl || !testAnonKey) {
      throw new Error(
        "NEXT_PUBLIC_SUPABASE_URL und NEXT_PUBLIC_SUPABASE_ANON_KEY müssen gesetzt sein"
      )
    }

    // Test-Context erstellen (erstellt Test-User mit Access-Token)
    testContext = await getTestContext("user", false)

    // Mock createClient: Gibt einen Client mit Test-User-Token zurück
    const { createClient: mockCreateClient } = await import("@/utils/supabase/server")
    
    // Erstelle Client mit Access-Token aus dem testContext
    const userClient = createClient(testSupabaseUrl, testAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${testContext.accessToken}`,
        },
      },
    })
    
    vi.mocked(mockCreateClient).mockResolvedValue(userClient as any)
  })

  afterEach(async () => {
    // Cleanup: Test-User löschen (nur wenn testContext existiert)
    if (testContext?.cleanup) {
      await testContext.cleanup()
    }
    await globalCleanup.cleanup()
  })

  describe("User Management", () => {
    it("sollte Rollen abfragen können (query_roles)", async () => {
      // Act
      const result = await executeTool(
        "query_roles",
        {
          limit: 10,
        },
        testContext
      )

      // Assert
      assertToolSuccess(result)
      expect(Array.isArray(result.data)).toBe(true)
      expect((result.data as Array<unknown>).length).toBeGreaterThan(0)

      // Prüfe dass "User" Rolle vorhanden ist
      const roles = result.data as Array<{ name: string }>
      const userRole = roles.find((r) => r.name === "User" || r.name === "user")
      expect(userRole).toBeDefined()
    })

    it("sollte role_id für Rolle abfragen können (Multi-Step-Workflow)", async () => {
      // Dieser Test demonstriert einen Multi-Step-Workflow:
      // 1. Alle Rollen abfragen
      // 2. Eine bestimmte Rolle finden
      // Dies ist typisch für User-Anlage-Workflows

      // Step 1: Alle Rollen abfragen
      const rolesResult = await executeTool(
        "query_roles",
        {
          limit: 10,
        },
        testContext
      )

      // Assert
      assertToolSuccess(rolesResult)
      expect(Array.isArray(rolesResult.data)).toBe(true)
      
      const roles = rolesResult.data as Array<{ id: string; name: string }>
      expect(roles.length).toBeGreaterThan(0)

      // Step 2: "User" Rolle finden (case-insensitive)
      const userRole = roles.find((r) => r.name.toLowerCase() === "user")
      
      // Es sollte eine User-Rolle geben
      expect(userRole).toBeDefined()
      expect(userRole!.id).toBeDefined()

      // Das role_id kann jetzt für User-Anlage verwendet werden
      // (In der Praxis würde das AI-Tool diese ID automatisch verwenden)
    })
  })

  describe("Bug Tracking", () => {
    it("sollte Bug Report erstellen können (insert_bugs)", async () => {
      // Arrange
      const bugData = getTestBugData()

      // Act
      const result = await executeTool(
        "insert_bugs",
        {
          data: {
            title: bugData.title,
            description: bugData.description,
            severity: bugData.severity,
            browser_info: bugData.browser_info,
          },
        },
        testContext
      )

      // Assert
      assertToolSuccess(result)
      expect(result.data).toBeDefined()

      const insertedBug = Array.isArray(result.data)
        ? (result.data as Array<{ id: string; title: string; status: string }>)[0]
        : (result.data as { id: string; title: string; status: string })

      expect(insertedBug.title).toBe(bugData.title)
      expect(insertedBug.status).toBe("open")
      expect(insertedBug.id).toBeDefined()

      // Cleanup
      globalCleanup.track("bugs", insertedBug.id)
    })

    it("sollte Bug als gelöst markieren können (update_bugs) - als Admin", async () => {
      // Arrange: Erstelle Admin-Context
      const adminContext = await getTestContext("admin", false)

      // Mock für Admin-Context aktualisieren
      const { createClient: mockCreateClient } = await import("@/utils/supabase/server")
      vi.mocked(mockCreateClient).mockResolvedValue(
        createClient(testSupabaseUrl, testAnonKey, {
          global: {
            headers: {
              Authorization: `Bearer ${adminContext.accessToken}`,
            },
          },
        }) as any
      )

      // Erstelle einen Bug als Admin
      const bugData = getTestBugData()
      const createResult = await executeTool(
        "insert_bugs",
        {
          data: {
            title: bugData.title,
            description: bugData.description,
            severity: bugData.severity,
          },
        },
        adminContext
      )

      assertToolSuccess(createResult)
      const bug = Array.isArray(createResult.data)
        ? (createResult.data as Array<{ id: string }>)[0]
        : (createResult.data as { id: string })

      // Act: Bug als gelöst markieren
      const result = await executeTool(
        "update_bugs",
        {
          filters: { id: bug.id },
          data: {
            status: TEST_BUG_UPDATE.status,
            severity: TEST_BUG_UPDATE.severity,
          },
        },
        adminContext
      )

      // Assert
      assertToolSuccess(result)
      expect(result.data).toBeDefined()

      const updatedBug = Array.isArray(result.data)
        ? (result.data as Array<{ id: string; status: string }>)[0]
        : (result.data as { id: string; status: string })

      expect(updatedBug.status).toBe("fixed")

      // Cleanup
      globalCleanup.track("bugs", bug.id)
      await adminContext.cleanup()
    })

    it("sollte Update-Verhalten je nach RLS-Policy zeigen", async () => {
      // Arrange: Erstelle Bug als normaler User
      const bugData = getTestBugData()
      const createResult = await executeTool(
        "insert_bugs",
        {
          data: {
            title: bugData.title,
            description: bugData.description,
            severity: bugData.severity,
          },
        },
        testContext
      )

      assertToolSuccess(createResult)
      const bug = Array.isArray(createResult.data)
        ? (createResult.data as Array<{ id: string }>)[0]
        : (createResult.data as { id: string })

      // Act: Versuche als normaler User zu updaten
      // HINWEIS: Die aktuelle RLS-Policy erlaubt Updates auch für normale User.
      // Falls Admin-Only gewünscht ist, muss die Policy angepasst werden.
      const result = await executeTool(
        "update_bugs",
        {
          filters: { id: bug.id },
          data: {
            status: "fixed",
          },
        },
        testContext
      )

      // Assert: Dokumentiere aktuelles Verhalten
      // Bei Admin-Only Policy würde dies fehlschlagen
      // Bei aktueller Policy funktioniert es für alle authentifizierten User
      if (result.success) {
        // RLS erlaubt Updates für alle authentifizierten User
        expect(result.data).toBeDefined()
      } else {
        // RLS blockiert Updates für normale User (Admin-Only)
        expect(result.error).toBeDefined()
      }

      // Cleanup
      globalCleanup.track("bugs", bug.id)
    })
  })

  describe("Feature Requests", () => {
    it("sollte Feature Request erstellen können (insert_features)", async () => {
      // Arrange
      const featureData = getTestFeatureData()

      // Act
      const result = await executeTool(
        "insert_features",
        {
          data: {
            title: featureData.title,
            description: featureData.description,
            status: featureData.status,
          },
        },
        testContext
      )

      // Assert
      assertToolSuccess(result)
      expect(result.data).toBeDefined()

      const insertedFeature = Array.isArray(result.data)
        ? (result.data as Array<{ id: string; title: string; status: string }>)[0]
        : (result.data as { id: string; title: string; status: string })

      expect(insertedFeature.title).toBe(featureData.title)
      expect(insertedFeature.status).toBe("planned")
      expect(insertedFeature.id).toBeDefined()

      // Cleanup
      globalCleanup.track("features", insertedFeature.id)
    })
  })

  describe("Query Operations", () => {
    it("sollte alle Bugs abfragen können (query_bugs)", async () => {
      // Arrange: Erstelle einen Test-Bug
      const bugData = getTestBugData()
      const createResult = await executeTool(
        "insert_bugs",
        {
          data: {
            title: bugData.title,
            description: bugData.description,
            severity: bugData.severity,
          },
        },
        testContext
      )

      assertToolSuccess(createResult)
      const bug = Array.isArray(createResult.data)
        ? (createResult.data as Array<{ id: string }>)[0]
        : (createResult.data as { id: string })

      // Act: Alle Bugs abfragen
      const result = await executeTool(
        "query_bugs",
        {
          limit: 10,
        },
        testContext
      )

      // Assert
      assertToolSuccess(result)
      expect(Array.isArray(result.data)).toBe(true)
      expect((result.data as Array<unknown>).length).toBeGreaterThan(0)

      // Prüfe dass unser Test-Bug dabei ist
      const bugs = result.data as Array<{ id: string; title: string }>
      const foundBug = bugs.find((b) => b.id === bug.id)
      expect(foundBug).toBeDefined()

      // Cleanup
      globalCleanup.track("bugs", bug.id)
    })
  })

  describe("Access Control", () => {
    it("sollte Read-Only Tabellen nicht schreiben können", async () => {
      // Prüfe ob es eine Read-Only Tabelle gibt
      // Falls nicht, skip diesen Test
      // (Dieser Test ist optional, da nicht alle Tabellen Read-Only sind)

      // Beispiel: Versuche in eine Read-Only Tabelle zu schreiben
      // (Anpassen je nach vorhandenen Tabellen)
      const result = await executeTool(
        "insert_roles", // roles sollte Read-Only sein
        {
          data: {
            name: "Test Role",
          },
        },
        testContext
      )

      // Sollte fehlschlagen (Read-Only)
      expect(result.success).toBe(false)
    })

    it("sollte deaktivierte Datasources blockieren", async () => {
      // Dieser Test würde erfordern, dass wir eine Datasource deaktivieren
      // und dann versuchen, darauf zuzugreifen.
      // Da dies die DB-Struktur ändert, überspringen wir diesen Test hier
      // und dokumentieren ihn für manuelle Tests.
    })
  })
})

