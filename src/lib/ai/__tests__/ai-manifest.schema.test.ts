/**
 * Tests für AI Manifest Schema
 */

import { describe, it, expect } from "vitest"
import { AIComponentSchema, AIManifestSchema, validateManifest } from "../ai-manifest.schema"

describe("AI Manifest Schema", () => {
  describe("AIComponentSchema", () => {
    it("sollte valides Component akzeptieren", () => {
      const valid = {
        id: "nav-users",
        description: "Öffnet die Benutzer-Verwaltung",
        action: "navigate",
        target: "/account/users",
        category: "navigation",
        keywords: ["users", "benutzer"],
        requiredRole: "admin",
      }

      const result = AIComponentSchema.safeParse(valid)
      expect(result.success).toBe(true)
    })

    it("sollte id ohne kebab-case ablehnen", () => {
      const invalid = {
        id: "navUsers", // PascalCase statt kebab-case
        description: "Test",
        action: "navigate",
        category: "navigation",
        keywords: ["test"],
      }

      const result = AIComponentSchema.safeParse(invalid)
      expect(result.success).toBe(false)
    })

    it("sollte zu kurze Beschreibung ablehnen", () => {
      const invalid = {
        id: "nav-test",
        description: "Kurz", // < 10 Zeichen
        action: "navigate",
        category: "navigation",
        keywords: ["test"],
      }

      const result = AIComponentSchema.safeParse(invalid)
      expect(result.success).toBe(false)
    })

    it("sollte zu wenige Keywords ablehnen", () => {
      const invalid = {
        id: "nav-test",
        description: "Test Beschreibung",
        action: "navigate",
        category: "navigation",
        keywords: ["test"], // Nur 1 Keyword, mindestens 2 erforderlich
      }

      const result = AIComponentSchema.safeParse(invalid)
      expect(result.success).toBe(false)
    })

    it("sollte default requiredRole verwenden", () => {
      const component = {
        id: "nav-test",
        description: "Test Beschreibung",
        action: "navigate",
        category: "navigation",
        keywords: ["test", "test2"],
      }

      const result = AIComponentSchema.safeParse(component)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.requiredRole).toBe("public")
      }
    })
  })

  describe("AIManifestSchema", () => {
    it("sollte valides Manifest akzeptieren", () => {
      const valid = {
        version: "1.0.0",
        components: [
          {
            id: "nav-test",
            description: "Test Beschreibung",
            action: "navigate",
            category: "navigation",
            keywords: ["test", "test2"],
          },
        ],
      }

      const result = AIManifestSchema.safeParse(valid)
      expect(result.success).toBe(true)
    })

    it("sollte Manifest ohne Version ablehnen", () => {
      const invalid = {
        components: [],
      }

      const result = AIManifestSchema.safeParse(invalid)
      expect(result.success).toBe(false)
    })
  })

  describe("validateManifest", () => {
    it("sollte valides Manifest validieren", () => {
      const manifest = {
        version: "1.0.0",
        components: [
          {
            id: "nav-test",
            description: "Test Beschreibung",
            action: "navigate",
            category: "navigation",
            keywords: ["test", "test2"],
          },
        ],
      }

      const result = validateManifest(manifest)
      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
    })

    it("sollte ungültiges Manifest ablehnen", () => {
      const manifest = {
        version: "1.0.0",
        components: [
          {
            id: "invalidId", // Kein kebab-case
            description: "Test",
            action: "navigate",
            category: "navigation",
            keywords: ["test"],
          },
        ],
      }

      const result = validateManifest(manifest)
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })
})
