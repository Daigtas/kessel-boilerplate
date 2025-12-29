/**
 * Unit Tests für DetailDrawer Komponente
 */

import React from "react"
import { describe, it, expect, beforeEach, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { DetailDrawer } from "../DetailDrawer"
import { ShellProvider, useDetailDrawer } from "../shell-context"

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}

Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
})

// Test-Wrapper mit ShellProvider
function TestWrapper({ children }: { children: React.ReactNode }) {
  return <ShellProvider>{children}</ShellProvider>
}

describe("DetailDrawer", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    localStorageMock.getItem.mockReturnValue(null)
  })

  it("sollte null rendern wenn kein Content vorhanden ist", () => {
    const { container } = render(
      <TestWrapper>
        <DetailDrawer />
      </TestWrapper>
    )
    expect(container.firstChild).toBeNull()
  })

  it("sollte Content rendern wenn vorhanden", () => {
    function TestComponent() {
      const { setContent } = useDetailDrawer()
      React.useEffect(() => {
        setContent(<div data-testid="test-content">Test Content</div>)
      }, [setContent])
      return <DetailDrawer />
    }

    render(
      <TestWrapper>
        <TestComponent />
      </TestWrapper>
    )

    expect(screen.getByTestId("test-content")).toBeInTheDocument()
    expect(screen.getByText("Test Content")).toBeInTheDocument()
  })

  it("sollte h-full und w-full Klassen auf dem Container haben", () => {
    function TestComponent() {
      const { setContent } = useDetailDrawer()
      React.useEffect(() => {
        setContent(<div>Test</div>)
      }, [setContent])
      return <DetailDrawer />
    }

    const { container } = render(
      <TestWrapper>
        <TestComponent />
      </TestWrapper>
    )

    const wrapper = container.firstChild as HTMLElement
    expect(wrapper).toHaveClass("h-full", "w-full")
  })

  it("sollte zusätzliche className Props unterstützen", () => {
    function TestComponent() {
      const { setContent } = useDetailDrawer()
      React.useEffect(() => {
        setContent(<div>Test</div>)
      }, [setContent])
      return <DetailDrawer className="custom-class" />
    }

    const { container } = render(
      <TestWrapper>
        <TestComponent />
      </TestWrapper>
    )

    const wrapper = container.firstChild as HTMLElement
    expect(wrapper).toHaveClass("custom-class")
  })

  it("sollte komplexen React-Content rendern", () => {
    function TestComponent() {
      const { setContent } = useDetailDrawer()
      React.useEffect(() => {
        setContent(
          <div>
            <h1>Title</h1>
            <p>Description</p>
            {/* eslint-disable-next-line local/use-design-system-components */}
            <button type="button">Click me</button>
          </div>
        )
      }, [setContent])
      return <DetailDrawer />
    }

    render(
      <TestWrapper>
        <TestComponent />
      </TestWrapper>
    )

    expect(screen.getByText("Title")).toBeInTheDocument()
    expect(screen.getByText("Description")).toBeInTheDocument()
    expect(screen.getByText("Click me")).toBeInTheDocument()
  })
})
