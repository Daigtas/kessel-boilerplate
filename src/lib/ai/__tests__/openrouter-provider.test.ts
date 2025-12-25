/**
 * Tests für OpenRouter Provider
 *
 * Testet Model-Routing:
 * - DEFAULT_CHAT_MODEL: Gemini 3 Flash (Vision, kein Tool-Calling)
 * - DEFAULT_TOOL_MODEL: Claude Opus 4.5 (zuverlässiges Tool-Calling)
 */

import { describe, it, expect, beforeAll } from "vitest"
import { config } from "dotenv"
import { resolve } from "path"
import {
  openrouter,
  DEFAULT_MODEL,
  DEFAULT_CHAT_MODEL,
  DEFAULT_TOOL_MODEL,
  modelSupportsVision,
  modelSupportsTools,
} from "../openrouter-provider"
import { generateText } from "ai"

// .env.local laden für Tests
config({ path: resolve(process.cwd(), ".env.local") })

describe("OpenRouter Provider", () => {
  beforeAll(() => {
    // Prüfe ob API Key vorhanden ist
    if (!process.env.OPENROUTER_API_KEY) {
      throw new Error("OPENROUTER_API_KEY nicht gesetzt - Tests können nicht ausgeführt werden")
    }
  })

  describe("Provider-Konfiguration", () => {
    it("sollte Provider-Instanz exportieren", () => {
      expect(openrouter).toBeDefined()
    })

    it("sollte Chat-Model (Gemini 3 Flash) definieren", () => {
      expect(DEFAULT_CHAT_MODEL).toBe("google/gemini-3-flash-preview")
    })

    it("sollte Tool-Model (Claude Opus 4.5) definieren", () => {
      expect(DEFAULT_TOOL_MODEL).toBe("anthropic/claude-opus-4.5")
    })

    it("sollte DEFAULT_MODEL auf Tool-Model zeigen (Backward-Kompatibilität)", () => {
      expect(DEFAULT_MODEL).toBe(DEFAULT_TOOL_MODEL)
    })
  })

  describe("Model-Unterstützung", () => {
    it("sollte Vision-Support für Gemini 3 Flash erkennen", () => {
      expect(modelSupportsVision("google/gemini-3-flash-preview")).toBe(true)
    })

    it("sollte Vision-Support für Claude Opus 4.5 erkennen", () => {
      expect(modelSupportsVision("anthropic/claude-opus-4.5")).toBe(true)
    })

    it("sollte Vision-Support für Legacy-Modelle erkennen", () => {
      expect(modelSupportsVision("anthropic/claude-3.5-sonnet")).toBe(true)
      expect(modelSupportsVision("openai/gpt-4o")).toBe(true)
    })

    it("sollte Tool-Support korrekt erkennen", () => {
      // Gemini 3 Flash: KEIN Tool-Support (via OpenRouter unzuverlässig)
      expect(modelSupportsTools("google/gemini-3-flash-preview")).toBe(false)

      // Claude Opus 4.5: Tool-Support
      expect(modelSupportsTools("anthropic/claude-opus-4.5")).toBe(true)

      // GPT-4.1: Tool-Support
      expect(modelSupportsTools("openai/gpt-4.1")).toBe(true)

      // Legacy-Modelle: Tool-Support
      expect(modelSupportsTools("anthropic/claude-3.5-sonnet")).toBe(true)
      expect(modelSupportsTools("openai/gpt-4o")).toBe(true)
    })
  })

  describe("Chat-Completion Integration", () => {
    it("sollte einfache Chat-Completion mit Chat-Model durchführen können", async () => {
      const result = await generateText({
        model: openrouter(DEFAULT_CHAT_MODEL),
        prompt: "Antworte nur mit 'OK' wenn du diese Nachricht erhalten hast.",
        maxTokens: 10,
      })

      expect(result.text).toBeDefined()
      expect(result.text.length).toBeGreaterThan(0)
    }, 30000) // 30s Timeout für API-Call

    it("sollte Vision-Capability mit Bild unterstützen (Chat-Model)", async () => {
      // Erstelle ein minimales Test-Bild (1x1 Pixel PNG, Base64)
      const testImageBase64 =
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
      const imageBuffer = Buffer.from(testImageBase64, "base64")

      const result = await generateText({
        model: openrouter(DEFAULT_CHAT_MODEL),
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Was siehst du auf diesem Bild? Antworte nur mit 'Test erfolgreich' wenn du das Bild sehen kannst.",
              },
              {
                type: "image",
                image: imageBuffer,
                mimeType: "image/png",
              },
            ],
          },
        ],
        maxTokens: 50,
      })

      expect(result.text).toBeDefined()
      // Prüfe ob Antwort "Test erfolgreich" enthält (oder ähnlich)
      expect(result.text.toLowerCase()).toMatch(/test|erfolgreich|bild|image/i)
    }, 30000)
  })
})
