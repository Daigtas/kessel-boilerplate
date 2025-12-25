/**
 * Tests für AIInteractable Komponente
 */

import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { AIInteractable } from "../AIInteractable"
import { AIRegistryProvider } from "@/lib/ai/ai-registry-context"

describe("AIInteractable", () => {
  it("sollte children rendern", () => {
    render(
      <AIRegistryProvider>
        <AIInteractable
          id="test-id"
          action="navigate"
          description="Test Beschreibung"
          keywords={["test"]}
          category="navigation"
        >
          <button>Test Button</button>
        </AIInteractable>
      </AIRegistryProvider>
    )

    expect(screen.getByText("Test Button")).toBeInTheDocument()
  })

  it("sollte data-ai-id Attribut setzen", () => {
    const { container } = render(
      <AIRegistryProvider>
        <AIInteractable
          id="test-id"
          action="navigate"
          description="Test"
          keywords={["test"]}
          category="navigation"
        >
          <button>Test</button>
        </AIInteractable>
      </AIRegistryProvider>
    )

    const element = container.querySelector('[data-ai-id="test-id"]')
    expect(element).toBeInTheDocument()
  })

  it("sollte data-ai-action Attribut setzen", () => {
    const { container } = render(
      <AIRegistryProvider>
        <AIInteractable
          id="test-id"
          action="toggle"
          description="Test"
          keywords={["test"]}
          category="layout"
        >
          <button>Test</button>
        </AIInteractable>
      </AIRegistryProvider>
    )

    const element = container.querySelector('[data-ai-action="toggle"]')
    expect(element).toBeInTheDocument()
  })
})
