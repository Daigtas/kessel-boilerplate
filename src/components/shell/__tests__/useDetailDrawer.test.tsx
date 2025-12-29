/**
 * Unit Tests für useDetailDrawer Hook
 */

import { describe, it, expect, beforeEach, vi } from "vitest"
import { renderHook, act } from "@testing-library/react"
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

describe("useDetailDrawer Hook", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    localStorageMock.getItem.mockReturnValue(null)
  })

  it("sollte initial isOpen: false und content: null zurückgeben", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ShellProvider>{children}</ShellProvider>
    )

    const { result } = renderHook(() => useDetailDrawer(), { wrapper })

    expect(result.current.isOpen).toBe(false)
    expect(result.current.content).toBeNull()
  })

  it("sollte setContent den Content setzen und isOpen auf true setzen", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ShellProvider>{children}</ShellProvider>
    )

    const { result } = renderHook(() => useDetailDrawer(), { wrapper })

    const testContent = <div>Test Content</div>

    act(() => {
      result.current.setContent(testContent)
    })

    expect(result.current.content).toBe(testContent)
    expect(result.current.isOpen).toBe(true)
  })

  it("sollte setContent(null) den Content löschen und isOpen auf false setzen", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ShellProvider>{children}</ShellProvider>
    )

    const { result } = renderHook(() => useDetailDrawer(), { wrapper })

    const testContent = <div>Test Content</div>

    // Erst Content setzen
    act(() => {
      result.current.setContent(testContent)
    })

    expect(result.current.isOpen).toBe(true)

    // Dann Content löschen
    act(() => {
      result.current.setContent(null)
    })

    expect(result.current.content).toBeNull()
    expect(result.current.isOpen).toBe(false)
  })

  it("sollte setOpen den Open-State ändern", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ShellProvider>{children}</ShellProvider>
    )

    const { result } = renderHook(() => useDetailDrawer(), { wrapper })

    act(() => {
      result.current.setOpen(true)
    })

    expect(result.current.isOpen).toBe(true)

    act(() => {
      result.current.setOpen(false)
    })

    expect(result.current.isOpen).toBe(false)
  })

  it("sollte toggle den Open-State umschalten", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ShellProvider>{children}</ShellProvider>
    )

    const { result } = renderHook(() => useDetailDrawer(), { wrapper })

    expect(result.current.isOpen).toBe(false)

    act(() => {
      result.current.toggle()
    })

    expect(result.current.isOpen).toBe(true)

    act(() => {
      result.current.toggle()
    })

    expect(result.current.isOpen).toBe(false)
  })

  it("sollte setContent automatisch isOpen auf true setzen", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ShellProvider>{children}</ShellProvider>
    )

    const { result } = renderHook(() => useDetailDrawer(), { wrapper })

    expect(result.current.isOpen).toBe(false)

    act(() => {
      result.current.setContent(<div>Test</div>)
    })

    expect(result.current.isOpen).toBe(true)
  })
})
