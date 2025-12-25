/**
 * Tests für Model Router
 *
 * Testet die intelligente Modell-Auswahl:
 * - Gemini 3 Flash für normale Chats
 * - Claude Opus 4.5 für Tool-Calling
 */

import { describe, it, expect } from "vitest"
import type { CoreMessage } from "ai"
import { detectToolNeed, modelSupportsTools } from "../model-router"
import { DEFAULT_CHAT_MODEL, DEFAULT_TOOL_MODEL } from "../openrouter-provider"

describe("Model Router", () => {
  describe("detectToolNeed - Chat ohne Tools", () => {
    it("sollte Chat-Model für einfache Fragen wählen", () => {
      const messages: CoreMessage[] = [{ role: "user", content: "Hallo, wie geht es dir?" }]

      const result = detectToolNeed(messages)

      expect(result.needsTools).toBe(false)
      expect(result.model).toBe(DEFAULT_CHAT_MODEL)
      expect(result.reason).toBe("general-chat")
      expect(result.maxSteps).toBe(1)
    })

    it("sollte Chat-Model bei leeren Messages wählen", () => {
      const messages: CoreMessage[] = []

      const result = detectToolNeed(messages)

      expect(result.needsTools).toBe(false)
      expect(result.model).toBe(DEFAULT_CHAT_MODEL)
      expect(result.reason).toBe("no-user-message")
    })

    it("sollte Chat-Model für allgemeine Hilfe-Anfragen wählen", () => {
      const messages: CoreMessage[] = [
        { role: "user", content: "Erkläre mir was diese Anwendung macht" },
      ]

      const result = detectToolNeed(messages)

      expect(result.needsTools).toBe(false)
      expect(result.model).toBe(DEFAULT_CHAT_MODEL)
    })
  })

  describe("detectToolNeed - Tool-Calling erforderlich", () => {
    it("sollte Tool-Model für explizite DB-Referenzen wählen", () => {
      const messages: CoreMessage[] = [{ role: "user", content: "Zeige mir die Datenbank" }]

      const result = detectToolNeed(messages)

      expect(result.needsTools).toBe(true)
      expect(result.model).toBe(DEFAULT_TOOL_MODEL)
      expect(result.reason).toBe("explicit-db-reference")
      expect(result.maxSteps).toBe(8)
    })

    it("sollte Tool-Model für Supabase-Referenzen wählen", () => {
      const messages: CoreMessage[] = [{ role: "user", content: "Frage Supabase ab" }]

      const result = detectToolNeed(messages)

      expect(result.needsTools).toBe(true)
      expect(result.model).toBe(DEFAULT_TOOL_MODEL)
    })

    it("sollte Tool-Model für Rollen-Queries wählen", () => {
      const messages: CoreMessage[] = [{ role: "user", content: "Zeige mir alle Rollen" }]

      const result = detectToolNeed(messages)

      expect(result.needsTools).toBe(true)
      expect(result.reason).toMatch(/entity-crud:rolle/)
    })

    it("sollte Tool-Model für Profil-Erstellung wählen", () => {
      const messages: CoreMessage[] = [
        { role: "user", content: "Erstelle ein neues Profil für Max" },
      ]

      const result = detectToolNeed(messages)

      expect(result.needsTools).toBe(true)
      expect(result.reason).toMatch(/entity-crud:profil/)
    })

    it("sollte Tool-Model für Benutzer-Update wählen", () => {
      const messages: CoreMessage[] = [{ role: "user", content: "Ändere den Benutzer mit ID 5" }]

      const result = detectToolNeed(messages)

      expect(result.needsTools).toBe(true)
      expect(result.reason).toMatch(/entity-crud:benutzer/)
    })

    it("sollte Tool-Model für Bug-Löschung wählen", () => {
      const messages: CoreMessage[] = [{ role: "user", content: "Lösche den Bug #123" }]

      const result = detectToolNeed(messages)

      expect(result.needsTools).toBe(true)
      expect(result.reason).toMatch(/entity-crud:bug/)
    })

    it("sollte Tool-Model für englische CRUD-Keywords wählen", () => {
      const messages: CoreMessage[] = [{ role: "user", content: "List all users" }]

      const result = detectToolNeed(messages)

      expect(result.needsTools).toBe(true)
      expect(result.reason).toMatch(/entity-crud:user/)
    })

    it("sollte Tool-Model für 'lege...an' Formulierung wählen", () => {
      const messages: CoreMessage[] = [
        { role: "user", content: "Bitte lege einen neuen User an: Carmen König" },
      ]

      const result = detectToolNeed(messages)

      expect(result.needsTools).toBe(true)
      expect(result.reason).toMatch(/entity-crud:user\+create/)
    })
  })

  describe("detectToolNeed - Edge Cases", () => {
    it("sollte nur letzte User-Nachricht analysieren", () => {
      const messages: CoreMessage[] = [
        { role: "user", content: "Zeige alle Rollen" }, // Würde Tool triggern
        { role: "assistant", content: "Hier sind die Rollen..." },
        { role: "user", content: "Danke, das war hilfreich!" }, // Kein Tool
      ]

      const result = detectToolNeed(messages)

      expect(result.needsTools).toBe(false)
    })

    it("sollte nur Entity OHNE CRUD als Chat behandeln", () => {
      const messages: CoreMessage[] = [
        { role: "user", content: "Was ist eine Rolle?" }, // Entity aber kein CRUD
      ]

      const result = detectToolNeed(messages)

      expect(result.needsTools).toBe(false)
    })

    it("sollte nur CRUD OHNE Entity als Chat behandeln", () => {
      const messages: CoreMessage[] = [
        { role: "user", content: "Zeige mir was du kannst" }, // CRUD aber keine Entity
      ]

      const result = detectToolNeed(messages)

      expect(result.needsTools).toBe(false)
    })

    it("sollte multimodale Nachrichten mit Text-Parts analysieren", () => {
      const messages: CoreMessage[] = [
        {
          role: "user",
          content: [
            { type: "text", text: "Erstelle eine neue Rolle" },
            { type: "image", image: new Uint8Array() }, // Würde vom Router ignoriert
          ],
        },
      ]

      const result = detectToolNeed(messages)

      expect(result.needsTools).toBe(true)
    })
  })

  describe("modelSupportsTools", () => {
    it("sollte Tool-Support für Claude Opus 4.5 erkennen", () => {
      expect(modelSupportsTools(DEFAULT_TOOL_MODEL)).toBe(true)
    })

    it("sollte Tool-Support für GPT-4.1 erkennen", () => {
      expect(modelSupportsTools("openai/gpt-4.1")).toBe(true)
    })

    it("sollte keinen Tool-Support für Chat-Modelle erkennen", () => {
      expect(modelSupportsTools(DEFAULT_CHAT_MODEL)).toBe(false)
    })

    it("sollte keinen Tool-Support für unbekannte Modelle erkennen", () => {
      expect(modelSupportsTools("some/unknown-model")).toBe(false)
    })
  })
})
