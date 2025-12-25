/**
 * Tests für Special Tools (create_user, delete_user, etc.)
 *
 * Testet:
 * - Admin-Berechtigungsprüfung
 * - User-Anlage via Admin API
 * - Dry-Run Modus
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { generateSpecialTools, SPECIAL_TOOL_NAMES } from "../special-tools"
import type { ToolExecutionContext } from "../tool-executor"

// Mock Supabase Client
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: { role: "admin" }, error: null })),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null })),
      })),
    })),
    auth: {
      admin: {
        createUser: vi.fn(() =>
          Promise.resolve({
            data: {
              user: {
                id: "new-user-uuid",
                email: "test@example.com",
                created_at: new Date().toISOString(),
              },
            },
            error: null,
          })
        ),
        inviteUserByEmail: vi.fn(() => Promise.resolve({ error: null })),
        deleteUser: vi.fn(() => Promise.resolve({ error: null })),
      },
    },
  })),
}))

describe("Special Tools", () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetAllMocks()
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
    }
  })

  afterEach(() => {
    process.env = originalEnv
    vi.restoreAllMocks()
  })

  describe("Tool Generation", () => {
    it("sollte alle Special Tools generieren", () => {
      const ctx: ToolExecutionContext = {
        userId: "admin-user-id",
        sessionId: "test-session",
        dryRun: false,
      }

      const tools = generateSpecialTools(ctx)

      expect(Object.keys(tools)).toContain("create_user")
      expect(Object.keys(tools)).toContain("delete_user")
      expect(Object.keys(tools).length).toBe(SPECIAL_TOOL_NAMES.length)
    })

    it("sollte SPECIAL_TOOL_NAMES exportieren", () => {
      expect(SPECIAL_TOOL_NAMES).toContain("create_user")
      expect(SPECIAL_TOOL_NAMES).toContain("delete_user")
    })
  })

  describe("create_user Tool", () => {
    it("sollte im Dry-Run Modus keine echte Aktion ausführen", async () => {
      const ctx: ToolExecutionContext = {
        userId: "admin-user-id",
        sessionId: "test-session",
        dryRun: true,
      }

      const tools = generateSpecialTools(ctx)
      const createUser = tools.create_user

      // @ts-expect-error - Tool execute Signatur
      const result = await createUser.execute({
        email: "carmen@example.com",
        display_name: "Carmen König",
        role: "user",
      })

      expect(result.dryRun).toBe(true)
      expect(result.action).toBe("create_user")
      expect(result.data.email).toBe("carmen@example.com")
    })

    it("sollte Standardwerte für optionale Felder verwenden", async () => {
      const ctx: ToolExecutionContext = {
        userId: "admin-user-id",
        sessionId: "test-session",
        dryRun: true,
      }

      const tools = generateSpecialTools(ctx)
      const createUser = tools.create_user

      // @ts-expect-error - Tool execute Signatur
      const result = await createUser.execute({
        email: "test@example.com",
      })

      expect(result.dryRun).toBe(true)
      expect(result.data.display_name).toBe("test") // Teil vor @
      expect(result.data.role).toBe("user")
      expect(result.data.send_invite).toBe(true)
    })

    it("sollte User mit korrekten Daten anlegen", async () => {
      // Mock für diesen spezifischen Test - gibt die angegebene E-Mail zurück
      const { createClient } = await import("@supabase/supabase-js")
      vi.mocked(createClient).mockReturnValue({
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() => Promise.resolve({ data: { role: "admin" }, error: null })),
            })),
          })),
          update: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ error: null })),
          })),
        })),
        auth: {
          admin: {
            createUser: vi.fn(() =>
              Promise.resolve({
                data: {
                  user: {
                    id: "new-user-uuid",
                    email: "carmen@example.com", // Korrekter Wert
                    created_at: new Date().toISOString(),
                  },
                },
                error: null,
              })
            ),
            inviteUserByEmail: vi.fn(() => Promise.resolve({ error: null })),
          },
        },
      } as ReturnType<typeof createClient>)

      const ctx: ToolExecutionContext = {
        userId: "admin-user-id",
        sessionId: "test-session",
        dryRun: false,
      }

      const tools = generateSpecialTools(ctx)
      const createUser = tools.create_user

      // @ts-expect-error - Tool execute Signatur
      const result = await createUser.execute({
        email: "carmen@example.com",
        display_name: "Carmen König",
        role: "user",
        send_invite: true,
      })

      expect(result.success).toBe(true)
      expect(result.user.email).toBe("carmen@example.com")
      expect(result.user.display_name).toBe("Carmen König")
      expect(result.user.role).toBe("user")
      expect(result.message).toContain("Einladungs-E-Mail")
    })

    it("sollte Fehler bei nicht-Admin User werfen", async () => {
      // Mock: User ist kein Admin
      const { createClient } = await import("@supabase/supabase-js")
      vi.mocked(createClient).mockReturnValue({
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() => Promise.resolve({ data: { role: "user" }, error: null })),
            })),
          })),
        })),
        auth: { admin: {} },
      } as ReturnType<typeof createClient>)

      const ctx: ToolExecutionContext = {
        userId: "normal-user-id",
        sessionId: "test-session",
        dryRun: false,
      }

      const tools = generateSpecialTools(ctx)
      const createUser = tools.create_user

      await expect(
        // @ts-expect-error - Tool execute Signatur
        createUser.execute({ email: "test@example.com" })
      ).rejects.toThrow("Nur Admins können neue Benutzer anlegen")
    })
  })

  describe("delete_user Tool", () => {
    it("sollte confirm-Flag erfordern", async () => {
      const ctx: ToolExecutionContext = {
        userId: "admin-user-id",
        sessionId: "test-session",
        dryRun: false,
      }

      const tools = generateSpecialTools(ctx)
      const deleteUser = tools.delete_user

      await expect(
        // @ts-expect-error - Tool execute Signatur
        deleteUser.execute({
          user_id: "some-user-uuid",
          confirm: false,
        })
      ).rejects.toThrow("Löschen erfordert confirm: true")
    })

    it("sollte Selbst-Löschung verhindern", async () => {
      const ctx: ToolExecutionContext = {
        userId: "admin-user-id",
        sessionId: "test-session",
        dryRun: false,
      }

      const tools = generateSpecialTools(ctx)
      const deleteUser = tools.delete_user

      await expect(
        // @ts-expect-error - Tool execute Signatur
        deleteUser.execute({
          user_id: "admin-user-id", // Gleiche ID wie ctx.userId
          confirm: true,
        })
      ).rejects.toThrow("Du kannst dich nicht selbst löschen")
    })

    it("sollte im Dry-Run Modus keine echte Aktion ausführen", async () => {
      const ctx: ToolExecutionContext = {
        userId: "admin-user-id",
        sessionId: "test-session",
        dryRun: true,
      }

      const tools = generateSpecialTools(ctx)
      const deleteUser = tools.delete_user

      // @ts-expect-error - Tool execute Signatur
      const result = await deleteUser.execute({
        user_id: "other-user-uuid",
        confirm: true,
      })

      expect(result.dryRun).toBe(true)
      expect(result.action).toBe("delete_user")
      expect(result.user_id).toBe("other-user-uuid")
    })
  })
})
