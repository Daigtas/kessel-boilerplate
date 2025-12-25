/**
 * Tool Registry Tests
 *
 * Testet die dynamische Tool-Generierung aus DB-Schema und Berechtigungen.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  loadDataSources,
  generateAllTools,
  validateToolCall,
  type DataSource,
} from "../tool-registry"
import type { ToolExecutionContext } from "../tool-executor"
import { executeTool } from "../tool-executor"

// Mock Supabase Client
vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn(),
}))

// Mock Tool Executor
vi.mock("../tool-executor", async () => {
  const actual = await vi.importActual("../tool-executor")
  return {
    ...actual,
    executeTool: vi.fn(),
  }
})

describe("Tool Registry", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("loadDataSources", () => {
    it("sollte aktivierte Datasources mit access_level != 'none' laden", async () => {
      // Arrange
      const { createClient } = await import("@/utils/supabase/server")
      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
      }

      const mockDataSources: DataSource[] = [
        {
          id: "1",
          table_schema: "public",
          table_name: "themes",
          display_name: "Themes",
          description: "App Themes",
          access_level: "read",
          is_enabled: true,
          allowed_columns: [],
          excluded_columns: [],
          max_rows_per_query: 100,
        },
        {
          id: "2",
          table_schema: "public",
          table_name: "profiles",
          display_name: "Profiles",
          description: null,
          access_level: "read_write",
          is_enabled: true,
          allowed_columns: [],
          excluded_columns: ["password_hash"],
          max_rows_per_query: 50,
        },
      ]

      // @ts-expect-error -- Mock braucht nicht alle Supabase-Client-Methoden
      vi.mocked(createClient).mockResolvedValue(mockSupabase)
      mockSupabase.neq.mockResolvedValue({
        data: mockDataSources,
        error: null,
      })

      // Act
      const result = await loadDataSources()

      // Assert
      expect(result).toEqual(mockDataSources)
      expect(mockSupabase.from).toHaveBeenCalledWith("ai_datasources")
      expect(mockSupabase.eq).toHaveBeenCalledWith("is_enabled", true)
      expect(mockSupabase.neq).toHaveBeenCalledWith("access_level", "none")
    })

    it("sollte leeres Array zurückgeben wenn keine Datasources gefunden werden", async () => {
      // Arrange
      const { createClient } = await import("@/utils/supabase/server")
      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
      }

      // @ts-expect-error -- Mock braucht nicht alle Supabase-Client-Methoden
      vi.mocked(createClient).mockResolvedValue(mockSupabase)
      mockSupabase.neq.mockResolvedValue({
        data: [],
        error: null,
      })

      // Act
      const result = await loadDataSources()

      // Assert
      expect(result).toEqual([])
    })

    it("sollte Fehler werfen wenn Supabase-Fehler auftritt", async () => {
      // Arrange
      const { createClient } = await import("@/utils/supabase/server")
      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
      }

      const mockError = { message: "Database error", code: "PGRST116" }

      // @ts-expect-error -- Mock braucht nicht alle Supabase-Client-Methoden
      vi.mocked(createClient).mockResolvedValue(mockSupabase)
      mockSupabase.neq.mockResolvedValue({
        data: null,
        error: mockError,
      })

      // Act & Assert
      await expect(loadDataSources()).rejects.toEqual(mockError)
    })
  })

  describe("generateAllTools", () => {
    it("sollte Tools für alle aktivierten Datasources generieren", async () => {
      // Arrange
      const { createClient } = await import("@/utils/supabase/server")
      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        rpc: vi.fn(),
      }

      const mockDataSources: DataSource[] = [
        {
          id: "1",
          table_schema: "public",
          table_name: "themes",
          display_name: "Themes",
          description: "App Themes",
          access_level: "read",
          is_enabled: true,
          allowed_columns: [],
          excluded_columns: [],
          max_rows_per_query: 100,
        },
      ]

      const mockColumns = [
        {
          column_name: "id",
          data_type: "uuid",
          is_nullable: false,
          column_default: "gen_random_uuid()",
        },
        {
          column_name: "name",
          data_type: "text",
          is_nullable: false,
          column_default: null,
        },
      ]

      // @ts-expect-error -- Mock braucht nicht alle Supabase-Client-Methoden
      vi.mocked(createClient).mockResolvedValue(mockSupabase)
      mockSupabase.neq.mockResolvedValue({
        data: mockDataSources,
        error: null,
      })
      mockSupabase.rpc.mockResolvedValue({
        data: mockColumns,
        error: null,
      })

      const ctx: ToolExecutionContext = {
        userId: "test-user",
        sessionId: "test-session",
        dryRun: false,
      }

      // Mock executeTool für Tool-Execution
      vi.mocked(executeTool).mockResolvedValue({
        success: true,
        data: [],
      })

      // Act
      const tools = await generateAllTools(ctx)

      // Assert
      expect(Object.keys(tools)).toContain("query_themes")
      expect(Object.keys(tools).length).toBeGreaterThan(0)
    })

    it("sollte keine Tools generieren wenn keine Datasources aktiviert sind", async () => {
      // Arrange
      const { createClient } = await import("@/utils/supabase/server")
      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
      }

      // @ts-expect-error -- Mock braucht nicht alle Supabase-Client-Methoden
      vi.mocked(createClient).mockResolvedValue(mockSupabase)
      mockSupabase.neq.mockResolvedValue({
        data: [],
        error: null,
      })

      const ctx: ToolExecutionContext = {
        userId: "test-user",
        sessionId: "test-session",
        dryRun: false,
      }

      // Act
      const tools = await generateAllTools(ctx)

      // Assert: Keine CRUD-Tools, aber Special Tools sind immer dabei
      // Special Tools (create_user, delete_user) werden immer geladen
      expect(Object.keys(tools)).toContain("create_user")
      expect(Object.keys(tools)).toContain("delete_user")
      // Keine CRUD-Tools (query_*, insert_*, etc.)
      expect(Object.keys(tools).filter((k) => k.startsWith("query_"))).toHaveLength(0)
      expect(Object.keys(tools).filter((k) => k.startsWith("insert_"))).toHaveLength(0)
    })
  })

  describe("validateToolCall", () => {
    it("sollte gültigen Tool-Call für 'read' Datasource validieren", async () => {
      // Arrange
      const { createClient } = await import("@/utils/supabase/server")
      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
      }

      const mockDataSources: DataSource[] = [
        {
          id: "1",
          table_schema: "public",
          table_name: "themes",
          display_name: "Themes",
          description: null,
          access_level: "read",
          is_enabled: true,
          allowed_columns: [],
          excluded_columns: [],
          max_rows_per_query: 100,
        },
      ]

      // @ts-expect-error -- Mock braucht nicht alle Supabase-Client-Methoden
      vi.mocked(createClient).mockResolvedValue(mockSupabase)
      mockSupabase.neq.mockResolvedValue({
        data: mockDataSources,
        error: null,
      })

      // Act
      const result = await validateToolCall("query_themes", { limit: 10 })

      // Assert
      expect(result.valid).toBe(true)
      expect(result.dataSource).toBeDefined()
      expect(result.dataSource?.table_name).toBe("themes")
    })

    it("sollte ungültigen Tool-Call für 'none' Datasource ablehnen", async () => {
      // Arrange
      const { createClient } = await import("@/utils/supabase/server")
      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
      }

      // Datasource mit access_level: "none" - wird nicht in Tools aufgenommen
      // daher gibt neq.mockResolvedValue ein leeres Array zurück

      // @ts-expect-error -- Mock braucht nicht alle Supabase-Client-Methoden
      vi.mocked(createClient).mockResolvedValue(mockSupabase)
      mockSupabase.neq.mockResolvedValue({
        data: [],
        error: null,
      })

      // Act
      const result = await validateToolCall("query_themes", { limit: 10 })

      // Assert
      expect(result.valid).toBe(false)
      expect(result.error).toContain("No datasource configured")
    })

    it("sollte DELETE ohne confirm ablehnen", async () => {
      // Arrange
      const { createClient } = await import("@/utils/supabase/server")
      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
      }

      const mockDataSources: DataSource[] = [
        {
          id: "1",
          table_schema: "public",
          table_name: "themes",
          display_name: "Themes",
          description: null,
          access_level: "full",
          is_enabled: true,
          allowed_columns: [],
          excluded_columns: [],
          max_rows_per_query: 100,
        },
      ]

      // @ts-expect-error -- Mock braucht nicht alle Supabase-Client-Methoden
      vi.mocked(createClient).mockResolvedValue(mockSupabase)
      mockSupabase.neq.mockResolvedValue({
        data: mockDataSources,
        error: null,
      })

      // Act
      const result = await validateToolCall("delete_themes", {
        filters: { id: "123" },
        confirm: false,
      })

      // Assert
      expect(result.valid).toBe(false)
      expect(result.error).toContain("confirm: true")
    })

    it("sollte UPDATE ohne Filter ablehnen", async () => {
      // Arrange
      const { createClient } = await import("@/utils/supabase/server")
      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
      }

      const mockDataSources: DataSource[] = [
        {
          id: "1",
          table_schema: "public",
          table_name: "themes",
          display_name: "Themes",
          description: null,
          access_level: "read_write",
          is_enabled: true,
          allowed_columns: [],
          excluded_columns: [],
          max_rows_per_query: 100,
        },
      ]

      // @ts-expect-error -- Mock braucht nicht alle Supabase-Client-Methoden
      vi.mocked(createClient).mockResolvedValue(mockSupabase)
      mockSupabase.neq.mockResolvedValue({
        data: mockDataSources,
        error: null,
      })

      // Act
      const result = await validateToolCall("update_themes", {
        filters: {},
        data: { name: "New Name" },
      })

      // Assert
      expect(result.valid).toBe(false)
      expect(result.error).toContain("at least one filter")
    })

    it("sollte unbekanntes Tool-Format ablehnen", async () => {
      // Arrange
      const { createClient } = await import("@/utils/supabase/server")
      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
      }

      // @ts-expect-error -- Mock braucht nicht alle Supabase-Client-Methoden
      vi.mocked(createClient).mockResolvedValue(mockSupabase)
      mockSupabase.neq.mockResolvedValue({
        data: [],
        error: null,
      })

      // Act
      const result = await validateToolCall("unknown_tool", {})

      // Assert
      expect(result.valid).toBe(false)
      expect(result.error).toContain("Unknown tool format")
    })
  })
})
