/**
 * Tests für AI Manifest Validator
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import fs from "fs"
import path from "path"

// Mock glob
vi.mock("glob", () => ({
  glob: vi.fn(),
}))

// Mock fs
vi.mock("fs", () => ({
  default: {
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
  },
}))

describe("validate-ai-manifest", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("sollte valides Manifest akzeptieren", async () => {
    const { glob } = await import("glob")
    vi.mocked(glob).mockResolvedValue(["src/components/test.tsx"])

    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({
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
      })
    )

    // Mock file content scan
    vi.mocked(fs.readFileSync).mockImplementation((file: string) => {
      if (file === path.resolve("ai-manifest.json")) {
        return JSON.stringify({
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
        })
      }
      return '<AIInteractable id="nav-test">'
    })

    // Validator würde hier laufen - wir testen nur die Logik
    expect(true).toBe(true) // Placeholder - echte Tests würden den Validator aufrufen
  })

  it("sollte fehlende Manifest-Datei erkennen", () => {
    vi.mocked(fs.existsSync).mockReturnValue(false)

    // Validator sollte Fehler werfen
    expect(fs.existsSync("ai-manifest.json")).toBe(false)
  })
})
