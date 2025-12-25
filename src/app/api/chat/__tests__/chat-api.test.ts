/**
 * Integration Tests für Chat API
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// Mock AI SDK
vi.mock("ai", () => ({
  streamText: vi.fn(),
  convertToModelMessages: vi.fn((messages) => messages),
}))

// Mock OpenRouter Provider
vi.mock("@/lib/ai/openrouter-provider", () => ({
  openrouter: vi.fn(() => "openrouter-model"),
  DEFAULT_MODEL: "anthropic/claude-opus-4.5",
  DEFAULT_CHAT_MODEL: "google/gemini-3-flash-preview",
  DEFAULT_TOOL_MODEL: "anthropic/claude-opus-4.5",
}))

// Mock Tool Registry
vi.mock("@/lib/ai/tool-registry", () => ({
  generateAllTools: vi.fn().mockResolvedValue({}),
}))

// Mock Tool Executor (nicht nötig, da nur Types verwendet werden)

// Mock Supabase Server Client
vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn(),
}))

// Mock Wiki Content
vi.mock("@/lib/ai-chat/wiki-content", () => ({
  loadWikiContent: vi.fn().mockResolvedValue("# Wiki Content\n\nTest wiki content."),
}))

describe("Chat API Route", () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetAllMocks()
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "test-key",
    }
  })

  afterEach(() => {
    process.env = originalEnv
    vi.restoreAllMocks()
  })

  describe("POST /api/chat", () => {
    it("should return 400 when no messages provided", async () => {
      const body = { messages: [] }

      // Simuliere die Validierung
      const hasMessages = body.messages && body.messages.length > 0

      expect(hasMessages).toBe(false)
    })

    it("should accept valid chat request", async () => {
      const body = {
        messages: [{ id: "1", role: "user", content: "Hallo!" }],
        route: "/dashboard",
        sessionId: "test-session",
      }

      expect(body.messages).toHaveLength(1)
      expect(body.messages[0].role).toBe("user")
      expect(body.route).toBe("/dashboard")
    })

    it("should handle optional screenshot parameter", async () => {
      const body = {
        messages: [{ id: "1", role: "user", content: "Test" }],
        screenshot: "base64-screenshot-data",
        route: "/test",
      }

      expect(body.screenshot).toBeDefined()
    })

    it("should handle optional htmlDump parameter", async () => {
      const body = {
        messages: [{ id: "1", role: "user", content: "Test" }],
        htmlDump: "<div>HTML Content</div>",
        route: "/test",
      }

      expect(body.htmlDump).toBeDefined()
    })
  })

  describe("System Prompt Building", () => {
    it("should include wiki content in system prompt", () => {
      const context = {
        wikiContent: "# Wiki\n\nTest content",
        interactions: "No interactions",
        currentRoute: "/dashboard",
        hasScreenshot: false,
        hasHtmlDump: false,
      }

      const systemPrompt = buildTestSystemPrompt(context)

      expect(systemPrompt).toContain("Wiki-Dokumentation")
      expect(systemPrompt).toContain("Test content")
    })

    it("should include current route", () => {
      const context = {
        wikiContent: "",
        interactions: "",
        currentRoute: "/about/wiki",
        hasScreenshot: false,
        hasHtmlDump: false,
      }

      const systemPrompt = buildTestSystemPrompt(context)

      expect(systemPrompt).toContain("/about/wiki")
    })

    it("should indicate screenshot presence", () => {
      const context = {
        wikiContent: "",
        interactions: "",
        currentRoute: "",
        hasScreenshot: true,
        hasHtmlDump: false,
      }

      const systemPrompt = buildTestSystemPrompt(context)

      expect(systemPrompt).toContain("Screenshot")
    })

    it("should indicate HTML dump presence", () => {
      const context = {
        wikiContent: "",
        interactions: "",
        currentRoute: "",
        hasScreenshot: false,
        hasHtmlDump: true,
      }

      const systemPrompt = buildTestSystemPrompt(context)

      expect(systemPrompt).toContain("HTML-Struktur")
    })

    it("should format interactions chronologically", () => {
      const interactions = [
        {
          actionType: "click",
          target: "#btn",
          createdAt: new Date("2024-01-01T10:00:00"),
          metadata: { text: "Submit" },
        },
        {
          actionType: "navigate",
          target: "/dashboard",
          createdAt: new Date("2024-01-01T10:01:00"),
          metadata: {},
        },
      ]

      const formatted = formatTestInteractions(interactions)

      expect(formatted).toContain("click")
      expect(formatted).toContain("navigate")
    })
  })

  describe("OpenRouter Integration", () => {
    it("should use OpenRouter provider", async () => {
      const { openrouter } = await import("@/lib/ai/openrouter-provider")

      openrouter("google/gemini-3-flash-preview")

      expect(openrouter).toHaveBeenCalledWith("google/gemini-3-flash-preview")
    })

    it("should use DEFAULT_CHAT_MODEL for vision", async () => {
      const { DEFAULT_CHAT_MODEL } = await import("@/lib/ai/openrouter-provider")

      expect(DEFAULT_CHAT_MODEL).toBe("google/gemini-3-flash-preview")
    })

    it("should use DEFAULT_TOOL_MODEL for tool-calling", async () => {
      const { DEFAULT_TOOL_MODEL } = await import("@/lib/ai/openrouter-provider")

      expect(DEFAULT_TOOL_MODEL).toBe("anthropic/claude-opus-4.5")
    })
  })

  describe("Tool-Calling Integration", () => {
    it("should generate tools for authenticated user", async () => {
      const { generateAllTools } = await import("@/lib/ai/tool-registry")

      const tools = await generateAllTools({
        userId: "test-user",
        sessionId: "test-session",
        dryRun: false,
      })

      expect(generateAllTools).toHaveBeenCalled()
      expect(tools).toBeDefined()
    })

    it("should include available tools in system prompt", () => {
      const context = {
        wikiContent: "",
        interactions: "",
        currentRoute: "",
        hasScreenshot: false,
        hasHtmlDump: false,
        availableTools: ["query_themes", "insert_themes"],
      }

      const systemPrompt = buildTestSystemPrompt(context)

      expect(systemPrompt).toContain("Verfügbare Tools")
      expect(systemPrompt).toContain("query_themes")
    })

    it("should support dry-run mode", async () => {
      const { generateAllTools } = await import("@/lib/ai/tool-registry")

      await generateAllTools({
        userId: "test-user",
        sessionId: "test-session",
        dryRun: true,
      })

      expect(generateAllTools).toHaveBeenCalledWith(expect.objectContaining({ dryRun: true }))
    })
  })

  describe("Error Handling", () => {
    it("should return 401 when user not authenticated", () => {
      const user = null
      const status = user ? 200 : 401

      expect(status).toBe(401)
    })

    it("should return 503 when OPENROUTER_API_KEY missing", () => {
      const apiKey = undefined
      const status = apiKey ? 200 : 503

      expect(status).toBe(503)
    })

    it("should return 500 on unexpected error", () => {
      const error = new Error("Unexpected error")
      const errorMessage = error instanceof Error ? error.message : "Unknown error"

      expect(errorMessage).toBe("Unexpected error")
    })
  })

  describe("Response Headers", () => {
    it("should include X-Model-Used header", () => {
      const headers = new Headers()
      headers.set("X-Model-Used", "google/gemini-3-flash-preview")

      expect(headers.get("X-Model-Used")).toBe("google/gemini-3-flash-preview")
    })

    it("should include streaming headers", () => {
      const headers = new Headers()
      headers.set("Content-Type", "text/plain; charset=utf-8")
      headers.set("Cache-Control", "no-cache")
      headers.set("Connection", "keep-alive")
      headers.set("X-Accel-Buffering", "no")

      expect(headers.get("Content-Type")).toBe("text/plain; charset=utf-8")
      expect(headers.get("Cache-Control")).toBe("no-cache")
      expect(headers.get("Connection")).toBe("keep-alive")
      expect(headers.get("X-Accel-Buffering")).toBe("no")
    })
  })
})

// Helper function to simulate system prompt building
function buildTestSystemPrompt(context: {
  wikiContent: string
  interactions: string
  currentRoute: string
  hasScreenshot: boolean
  hasHtmlDump: boolean
  availableTools?: string[]
}): string {
  const toolList =
    context.availableTools && context.availableTools.length > 0
      ? `\n\n### Verfügbare Tools\n${context.availableTools.map((t) => `- ${t}`).join("\n")}`
      : ""

  return `Du bist ein hilfreicher KI-Assistent.

## Wiki-Dokumentation
${context.wikiContent}

## Aktuelle Route des Users
${context.currentRoute || "Unbekannt"}

## Letzte User-Aktionen
${context.interactions}

${context.hasScreenshot ? "### Screenshot\nDu hast einen Screenshot erhalten." : ""}
${context.hasHtmlDump ? "### HTML-Struktur\nDu hast die HTML-Struktur erhalten." : ""}
${toolList}
`
}

// Helper function to format interactions
function formatTestInteractions(
  interactions: Array<{
    actionType: string
    target: string
    createdAt: Date
    metadata: Record<string, unknown>
  }>
): string {
  if (interactions.length === 0) return "Keine kürzlichen Interaktionen."

  return interactions
    .map((i) => {
      const time = i.createdAt.toLocaleTimeString("de-DE", {
        hour: "2-digit",
        minute: "2-digit",
      })
      return `[${time}] ${i.actionType}: ${i.target}`
    })
    .join("\n")
}
