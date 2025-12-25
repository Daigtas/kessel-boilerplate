/**
 * Tool Executor Tests
 *
 * Testet die sichere Ausführung von Tool-Calls mit Permission-Checks und Audit-Logging.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { executeTool, type ToolExecutionContext } from "../tool-executor"
import { validateToolCall } from "../tool-registry"

// Mock Supabase Client
vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn(),
}))

// Mock Tool Registry
vi.mock("../tool-registry", async () => {
  const actual = await vi.importActual("../tool-registry")
  return {
    ...actual,
    validateToolCall: vi.fn(),
  }
})

describe("Tool Executor", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("executeTool", () => {
    it("sollte erfolgreichen Query-Tool-Call ausführen", async () => {
      // Arrange
      const { createClient } = await import("@/utils/supabase/server")
      const mockData = [{ id: "1", name: "Test Theme" }]

      const mockQueryChain = {
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: mockData,
          error: null,
        }),
        order: vi.fn().mockResolvedValue({
          data: mockData,
          error: null,
        }),
      }

      const mockInsertChain = {
        insert: vi.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      }

      const mockSupabase = {
        from: vi.fn((table) => {
          if (table === "ai_tool_calls") {
            return mockInsertChain
          }
          return {
            select: vi.fn().mockReturnValue(mockQueryChain),
          }
        }),
      }

      vi.mocked(createClient).mockResolvedValue(mockSupabase as any)

      vi.mocked(validateToolCall).mockResolvedValue({
        valid: true,
        dataSource: {
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
      })

      const ctx: ToolExecutionContext = {
        userId: "test-user",
        sessionId: "test-session",
        dryRun: false,
      }

      // Act
      const result = await executeTool("query_themes", { limit: 10 }, ctx)

      // Assert
      expect(result.success).toBe(true)
      expect(result.data).toEqual(mockData)
      expect(result.rowCount).toBe(1)
    })

    it("sollte Query-Tool-Call mit Filters ausführen", async () => {
      // Arrange
      const { createClient } = await import("@/utils/supabase/server")
      const mockData = [{ id: "1", name: "Dark Theme" }]

      const mockQueryChain = {
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: mockData,
          error: null,
        }),
      }

      const mockInsertChain = {
        insert: vi.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      }

      const mockSupabase = {
        from: vi.fn((table) => {
          if (table === "ai_tool_calls") {
            return mockInsertChain
          }
          return {
            select: vi.fn().mockReturnValue(mockQueryChain),
          }
        }),
      }

      vi.mocked(createClient).mockResolvedValue(mockSupabase as any)

      vi.mocked(validateToolCall).mockResolvedValue({
        valid: true,
        dataSource: {
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
      })

      const ctx: ToolExecutionContext = {
        userId: "test-user",
        sessionId: "test-session",
        dryRun: false,
      }

      // Act
      const result = await executeTool(
        "query_themes",
        { filters: { name: "Dark Theme" }, limit: 10 },
        ctx
      )

      // Assert
      expect(result.success).toBe(true)
      expect(mockQueryChain.eq).toHaveBeenCalledWith("name", "Dark Theme")
    })

    it("sollte Insert-Tool-Call im Dry-Run-Modus ausführen", async () => {
      // Arrange
      const { createClient } = await import("@/utils/supabase/server")
      const mockInsertChain = {
        insert: vi.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      }

      const mockSupabase = {
        from: vi.fn((table) => {
          if (table === "ai_tool_calls") {
            return mockInsertChain
          }
          return {
            insert: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
          }
        }),
      }

      vi.mocked(createClient).mockResolvedValue(mockSupabase as any)

      vi.mocked(validateToolCall).mockResolvedValue({
        valid: true,
        dataSource: {
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
      })

      const ctx: ToolExecutionContext = {
        userId: "test-user",
        sessionId: "test-session",
        dryRun: true,
      }

      // Act
      const result = await executeTool(
        "insert_themes",
        { data: { name: "New Theme", description: "Test" } },
        ctx
      )

      // Assert
      expect(result.success).toBe(true)
      expect(result.dryRunQuery).toBeDefined()
      expect(result.dryRunQuery).toContain("INSERT INTO")
      expect(result.dryRunQuery).toContain("themes")
      // Audit-Log wird trotzdem geschrieben
      expect(mockSupabase.from).toHaveBeenCalledWith("ai_tool_calls")
    })

    it("sollte Insert-Tool-Call tatsächlich ausführen wenn nicht Dry-Run", async () => {
      // Arrange
      const { createClient } = await import("@/utils/supabase/server")
      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
      }

      const mockInsertedData = [{ id: "2", name: "New Theme", description: "Test" }]

      vi.mocked(createClient).mockResolvedValue(mockSupabase as any)
      mockSupabase.select.mockResolvedValue({
        data: mockInsertedData,
        error: null,
      })

      vi.mocked(validateToolCall).mockResolvedValue({
        valid: true,
        dataSource: {
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
      })

      const ctx: ToolExecutionContext = {
        userId: "test-user",
        sessionId: "test-session",
        dryRun: false,
      }

      // Act
      const result = await executeTool(
        "insert_themes",
        { data: { name: "New Theme", description: "Test" } },
        ctx
      )

      // Assert
      expect(result.success).toBe(true)
      expect(result.data).toEqual(mockInsertedData)
      expect(mockSupabase.insert).toHaveBeenCalled()
    })

    it("sollte Update-Tool-Call im Dry-Run-Modus ausführen", async () => {
      // Arrange
      const { createClient } = await import("@/utils/supabase/server")
      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
      }

      vi.mocked(createClient).mockResolvedValue(mockSupabase as any)

      vi.mocked(validateToolCall).mockResolvedValue({
        valid: true,
        dataSource: {
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
      })

      const ctx: ToolExecutionContext = {
        userId: "test-user",
        sessionId: "test-session",
        dryRun: true,
      }

      // Act
      const result = await executeTool(
        "update_themes",
        { filters: { id: "1" }, data: { name: "Updated Theme" } },
        ctx
      )

      // Assert
      expect(result.success).toBe(true)
      expect(result.dryRunQuery).toBeDefined()
      expect(result.dryRunQuery).toContain("UPDATE")
      expect(result.dryRunQuery).toContain("themes")
      expect(result.dryRunQuery).toContain("WHERE")
    })

    it("sollte Delete-Tool-Call im Dry-Run-Modus ausführen", async () => {
      // Arrange
      const { createClient } = await import("@/utils/supabase/server")
      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
      }

      vi.mocked(createClient).mockResolvedValue(mockSupabase as any)

      vi.mocked(validateToolCall).mockResolvedValue({
        valid: true,
        dataSource: {
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
      })

      const ctx: ToolExecutionContext = {
        userId: "test-user",
        sessionId: "test-session",
        dryRun: true,
      }

      // Act
      const result = await executeTool(
        "delete_themes",
        { filters: { id: "1" }, confirm: true },
        ctx
      )

      // Assert
      expect(result.success).toBe(true)
      expect(result.dryRunQuery).toBeDefined()
      expect(result.dryRunQuery).toContain("DELETE FROM")
      expect(result.dryRunQuery).toContain("themes")
      expect(result.dryRunQuery).toContain("WHERE")
    })

    it("sollte Fehler zurückgeben wenn Validierung fehlschlägt", async () => {
      // Arrange
      vi.mocked(validateToolCall).mockResolvedValue({
        valid: false,
        error: "Action not allowed",
      })

      const ctx: ToolExecutionContext = {
        userId: "test-user",
        sessionId: "test-session",
        dryRun: false,
      }

      // Act
      const result = await executeTool("query_themes", { limit: 10 }, ctx)

      // Assert
      expect(result.success).toBe(false)
      expect(result.error).toBe("Action not allowed")
    })

    it("sollte Excluded Columns aus Insert-Daten entfernen", async () => {
      // Arrange
      const { createClient } = await import("@/utils/supabase/server")
      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
      }

      vi.mocked(createClient).mockResolvedValue(mockSupabase as any)
      mockSupabase.select.mockResolvedValue({
        data: [{ id: "1", name: "Test" }],
        error: null,
      })

      vi.mocked(validateToolCall).mockResolvedValue({
        valid: true,
        dataSource: {
          id: "1",
          table_schema: "public",
          table_name: "themes",
          display_name: "Themes",
          description: null,
          access_level: "read_write",
          is_enabled: true,
          allowed_columns: [],
          excluded_columns: ["password_hash", "secret"],
          max_rows_per_query: 100,
        },
      })

      const ctx: ToolExecutionContext = {
        userId: "test-user",
        sessionId: "test-session",
        dryRun: false,
      }

      // Act
      await executeTool(
        "insert_themes",
        { data: { name: "Test", password_hash: "secret", secret: "value" } },
        ctx
      )

      // Assert
      expect(mockSupabase.insert).toHaveBeenCalled()
      const insertCall = mockSupabase.insert.mock.calls[0][0]
      expect(insertCall).not.toHaveProperty("password_hash")
      expect(insertCall).not.toHaveProperty("secret")
      expect(insertCall).toHaveProperty("name")
    })

    it("sollte Tool-Call in Audit-Log speichern", async () => {
      // Arrange
      const { createClient } = await import("@/utils/supabase/server")
      const mockData = [{ id: "1", name: "Test Theme" }]

      const mockQueryChain = {
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: mockData,
          error: null,
        }),
      }

      const mockInsertChain = {
        insert: vi.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      }

      const mockSupabase = {
        from: vi.fn((table) => {
          if (table === "ai_tool_calls") {
            return mockInsertChain
          }
          return {
            select: vi.fn().mockReturnValue(mockQueryChain),
          }
        }),
      }

      vi.mocked(createClient).mockResolvedValue(mockSupabase as any)

      vi.mocked(validateToolCall).mockResolvedValue({
        valid: true,
        dataSource: {
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
      })

      const ctx: ToolExecutionContext = {
        userId: "test-user",
        sessionId: "test-session",
        dryRun: false,
      }

      // Act
      await executeTool("query_themes", { limit: 10 }, ctx)

      // Assert
      expect(mockSupabase.from).toHaveBeenCalledWith("ai_tool_calls")
      expect(mockInsertChain.insert).toHaveBeenCalled()
      const auditLogCall = mockInsertChain.insert.mock.calls[0]?.[0]
      expect(auditLogCall).toBeDefined()
      expect(auditLogCall.tool_name).toBe("query_themes")
    })
  })
})
