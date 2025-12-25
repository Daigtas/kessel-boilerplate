/**
 * Tests für OpenRouter Provider
 */

import { describe, it, expect, beforeAll } from "vitest"
import { config } from "dotenv"
import { resolve } from "path"
import {
  openrouter,
  DEFAULT_MODEL,
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

    it("sollte Standard-Model definieren", () => {
      expect(DEFAULT_MODEL).toBe("google/gemini-2.5-flash")
    })
  })

  describe("Model-Unterstützung", () => {
    it("sollte Vision-Support für Gemini erkennen", () => {
      expect(modelSupportsVision("google/gemini-2.5-flash")).toBe(true)
    })

    it("sollte Vision-Support für Claude erkennen", () => {
      expect(modelSupportsVision("anthropic/claude-3.5-sonnet")).toBe(true)
    })

    it("sollte Vision-Support für GPT-4o erkennen", () => {
      expect(modelSupportsVision("openai/gpt-4o")).toBe(true)
    })

    it("sollte Tool-Support für alle Modelle erkennen", () => {
      expect(modelSupportsTools("google/gemini-2.5-flash")).toBe(true)
      expect(modelSupportsTools("anthropic/claude-3.5-sonnet")).toBe(true)
      expect(modelSupportsTools("openai/gpt-4o")).toBe(true)
    })
  })

  describe("Chat-Completion Integration", () => {
    it("sollte einfache Chat-Completion durchführen können", async () => {
      const result = await generateText({
        model: openrouter(DEFAULT_MODEL),
        prompt: "Antworte nur mit 'OK' wenn du diese Nachricht erhalten hast.",
        maxTokens: 10,
      })

      expect(result.text).toBeDefined()
      expect(result.text.length).toBeGreaterThan(0)
    }, 30000) // 30s Timeout für API-Call

    it("sollte Vision-Capability mit Bild unterstützen", async () => {
      // Erstelle ein minimales Test-Bild (1x1 Pixel PNG, Base64)
      const testImageBase64 =
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
      const imageBuffer = Buffer.from(testImageBase64, "base64")

      const result = await generateText({
        model: openrouter(DEFAULT_MODEL),
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
