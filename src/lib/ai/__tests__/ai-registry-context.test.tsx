/**
 * Tests für AI Registry Context
 */

import { describe, it, expect, beforeEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { AIRegistryProvider, useAIRegistry } from "../ai-registry-context"
import type { AIAction } from "../ai-registry-context"
import { ReactNode } from "react"

function wrapper({ children }: { children: ReactNode }) {
  return <AIRegistryProvider>{children}</AIRegistryProvider>
}

describe("AI Registry Context", () => {
  describe("register", () => {
    it("sollte eine Aktion registrieren", () => {
      const { result } = renderHook(() => useAIRegistry(), { wrapper })

      const action: AIAction = {
        id: "test-action",
        action: "navigate",
        target: "/test",
        description: "Test Aktion",
        keywords: ["test"],
        category: "navigation",
        isAvailable: true,
        execute: () => {},
      }

      act(() => {
        result.current.register(action)
      })

      const available = result.current.getAvailableActions()
      expect(available).toHaveLength(1)
      expect(available[0].id).toBe("test-action")
    })

    it("sollte unregister-Funktion zurückgeben", () => {
      const { result } = renderHook(() => useAIRegistry(), { wrapper })

      const action: AIAction = {
        id: "test-action",
        action: "navigate",
        description: "Test",
        keywords: ["test"],
        category: "navigation",
        isAvailable: true,
        execute: () => {},
      }

      let unregister: (() => void) | undefined

      act(() => {
        unregister = result.current.register(action)
      })

      expect(result.current.getAvailableActions()).toHaveLength(1)

      act(() => {
        unregister?.()
      })

      expect(result.current.getAvailableActions()).toHaveLength(0)
    })
  })

  describe("executeAction", () => {
    it("sollte eine Aktion ausführen", async () => {
      const { result } = renderHook(() => useAIRegistry(), { wrapper })

      let executed = false

      const action: AIAction = {
        id: "test-action",
        action: "navigate",
        description: "Test",
        keywords: ["test"],
        category: "navigation",
        isAvailable: true,
        execute: () => {
          executed = true
        },
      }

      act(() => {
        result.current.register(action)
      })

      const execResult = await result.current.executeAction("test-action")

      expect(execResult.success).toBe(true)
      expect(executed).toBe(true)
    })

    it("sollte Fehler zurückgeben wenn Aktion nicht gefunden", async () => {
      const { result } = renderHook(() => useAIRegistry(), { wrapper })

      const execResult = await result.current.executeAction("not-found")

      expect(execResult.success).toBe(false)
      expect(execResult.message).toContain("nicht gefunden")
    })

    it("sollte Fehler zurückgeben wenn Aktion nicht verfügbar", async () => {
      const { result } = renderHook(() => useAIRegistry(), { wrapper })

      const action: AIAction = {
        id: "test-action",
        action: "navigate",
        description: "Test",
        keywords: ["test"],
        category: "navigation",
        isAvailable: false,
        execute: () => {},
      }

      act(() => {
        result.current.register(action)
      })

      const execResult = await result.current.executeAction("test-action")

      expect(execResult.success).toBe(false)
      expect(execResult.message).toContain("nicht verfügbar")
    })
  })

  describe("getAvailableActions", () => {
    it("sollte nur verfügbare Aktionen zurückgeben", () => {
      const { result } = renderHook(() => useAIRegistry(), { wrapper })

      act(() => {
        result.current.register({
          id: "available",
          action: "navigate",
          description: "Available",
          keywords: ["test"],
          category: "navigation",
          isAvailable: true,
          execute: () => {},
        })

        result.current.register({
          id: "unavailable",
          action: "navigate",
          description: "Unavailable",
          keywords: ["test"],
          category: "navigation",
          isAvailable: false,
          execute: () => {},
        })
      })

      const available = result.current.getAvailableActions()
      expect(available).toHaveLength(1)
      expect(available[0].id).toBe("available")
    })
  })
})
