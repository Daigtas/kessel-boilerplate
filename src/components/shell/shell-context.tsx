"use client"

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"

/**
 * LocalStorage Keys für Shell-State
 * HINWEIS: Panel-Breiten werden jetzt von react-resizable-panels via autoSaveId verwaltet
 */
const STORAGE_KEYS = {
  navbarCollapsed: "shell-navbar-collapsed",
  explorerOpen: "shell-explorer-open",
  chatOverlayOpen: "shell-chat-overlay-open",
} as const

/**
 * Feste Pixel-Werte für Navbar Collapsed
 * Diese garantieren, dass Icons nie abgeschnitten werden, egal wie breit das Fenster ist.
 */
export const NAVBAR_COLLAPSED_PX = 48 // Breite für Icon-only Navbar
export const NAVBAR_MIN_PX = 100 // Autocollapse-Trigger: unter 100px → collapse

/**
 * Panel-Größen in PROZENT (1-100)
 * react-resizable-panels arbeitet nur mit Prozenten.
 *
 * HINWEIS: navbarCollapsed wird NICHT hier definiert, sondern dynamisch
 * in AppShell berechnet: (NAVBAR_COLLAPSED_PX / containerWidth) * 100
 */
export const PANEL_SIZES = {
  /** Navbar expanded: 15% der Fensterbreite */
  navbar: 15,
  /** Explorer: 15% der Fensterbreite */
  explorer: 15,
  /** Detail-Drawer (Assist): 15% der Fensterbreite */
  assist: 15,
} as const

/**
 * Panel Min/Max Constraints in PROZENT
 * Werden direkt an react-resizable-panels übergeben
 *
 * HINWEIS: navbar.min wird dynamisch in AppShell berechnet (NAVBAR_MIN_PX / containerWidth * 100)
 * um das Autocollapse-Verhalten zu ermöglichen.
 */
export const PANEL_CONSTRAINTS = {
  navbar: { max: 25 }, // min wird dynamisch berechnet
  explorer: { min: 10, max: 25 },
  assist: { min: 10, max: 25 },
  main: { min: 30 },
} as const

/**
 * Detail-Drawer Content Type
 * Wird von Seiten gesetzt, um optionalen Detail-Content anzuzeigen
 */
export type DetailDrawerContent = ReactNode | null

/**
 * Shell-State Interface
 * Panel-Breiten sind NICHT mehr Teil des State - sie werden von der Library verwaltet
 */
export interface ShellState {
  /** Navbar ist auf Icons-only minimiert */
  navbarCollapsed: boolean
  /** Explorer-Panel (Spalte 2) ist sichtbar */
  explorerOpen: boolean
  /** Detail-Drawer (Spalte 4) ist sichtbar */
  detailDrawerOpen: boolean
  /** Detail-Drawer Content (wird von Seiten gesetzt) */
  detailDrawerContent: DetailDrawerContent
  /** Chat-Overlay ist geöffnet */
  chatOverlayOpen: boolean
  /** Transition aktiviert (nur während Navbar Collapse/Expand) */
  navbarTransitionEnabled: boolean
}

/**
 * Shell-Context-Value Interface
 */
export interface ShellContextValue extends ShellState {
  /** Toggle Navbar Collapsed */
  toggleNavbar: () => void
  /** Set Navbar Collapsed */
  setNavbarCollapsed: (collapsed: boolean) => void
  /** Toggle Explorer */
  toggleExplorer: () => void
  /** Set Explorer Open */
  setExplorerOpen: (open: boolean) => void
  /** Toggle Detail Drawer */
  toggleDetailDrawer: () => void
  /** Set Detail Drawer Open */
  setDetailDrawerOpen: (open: boolean) => void
  /** Set Detail Drawer Content */
  setDetailDrawerContent: (content: DetailDrawerContent) => void
  /** Toggle Chat Overlay */
  toggleChatOverlay: () => void
  /** Set Chat Overlay Open */
  setChatOverlayOpen: (open: boolean) => void
  /** Enable/Disable Navbar Transition (für smooth collapse/expand) */
  setNavbarTransitionEnabled: (enabled: boolean) => void
}

/**
 * Default State - sinnvolle Standardwerte bei Hard Reload
 */
const defaultState: ShellState = {
  navbarCollapsed: false,
  explorerOpen: false,
  detailDrawerOpen: false,
  detailDrawerContent: null,
  chatOverlayOpen: false,
  navbarTransitionEnabled: false,
}

/**
 * Shell Context
 */
const ShellContext = createContext<ShellContextValue | null>(null)

/**
 * Hook zum Zugriff auf Shell-State
 */
export function useShell(): ShellContextValue {
  const context = useContext(ShellContext)
  if (!context) {
    throw new Error("useShell must be used within ShellProvider")
  }
  return context
}

/**
 * Convenience Hook für Explorer-Panel
 */
export function useExplorer() {
  const { explorerOpen, toggleExplorer, setExplorerOpen } = useShell()
  return { isOpen: explorerOpen, toggle: toggleExplorer, setOpen: setExplorerOpen }
}

/**
 * Convenience Hook für Detail-Drawer
 */
export function useDetailDrawer() {
  const {
    detailDrawerOpen,
    detailDrawerContent,
    toggleDetailDrawer,
    setDetailDrawerOpen,
    setDetailDrawerContent,
  } = useShell()
  return {
    isOpen: detailDrawerOpen,
    content: detailDrawerContent,
    toggle: toggleDetailDrawer,
    setOpen: setDetailDrawerOpen,
    setContent: setDetailDrawerContent,
  }
}

/**
 * Convenience Hook für Chat-Overlay
 */
export function useChatOverlay() {
  const { chatOverlayOpen, toggleChatOverlay, setChatOverlayOpen } = useShell()
  return {
    isOpen: chatOverlayOpen,
    toggle: toggleChatOverlay,
    setOpen: setChatOverlayOpen,
  }
}

/**
 * LocalStorage Helper
 */
function loadFromStorage<T>(key: string, defaultValue: T): T {
  if (typeof window === "undefined") return defaultValue
  try {
    const stored = localStorage.getItem(key)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch {
    // Ignore parse errors
  }
  return defaultValue
}

function saveToStorage<T>(key: string, value: T): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Ignore storage errors
  }
}

/**
 * Shell Provider Props
 */
interface ShellProviderProps {
  children: ReactNode
  /** Initial State Override */
  initialState?: Partial<ShellState>
}

/**
 * Shell Provider Komponente
 *
 * Verwaltet den Shell-State (Toggle-Zustände, Drawer-Content).
 * Panel-Breiten werden NICHT hier verwaltet - react-resizable-panels
 * handhabt das via autoSaveId automatisch.
 */
export function ShellProvider({ children, initialState }: ShellProviderProps): React.ReactElement {
  const [mounted, setMounted] = useState(false)
  const [state, setState] = useState<ShellState>(() => ({
    ...defaultState,
    ...initialState,
  }))

  // Load from LocalStorage on mount
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Setting mounted state after hydration is intentional
    setMounted(true)

    // Lade gespeicherte Toggle-Zustände
    // HINWEIS: Panel-Breiten werden von react-resizable-panels via autoSaveId verwaltet
    setState((prev) => ({
      ...prev,
      navbarCollapsed: loadFromStorage(STORAGE_KEYS.navbarCollapsed, prev.navbarCollapsed),
      explorerOpen: loadFromStorage(STORAGE_KEYS.explorerOpen, prev.explorerOpen),
      chatOverlayOpen: loadFromStorage(STORAGE_KEYS.chatOverlayOpen, prev.chatOverlayOpen),
    }))
  }, [])

  // Persist to LocalStorage on change
  useEffect(() => {
    if (!mounted) return
    saveToStorage(STORAGE_KEYS.navbarCollapsed, state.navbarCollapsed)
  }, [state.navbarCollapsed, mounted])

  useEffect(() => {
    if (!mounted) return
    saveToStorage(STORAGE_KEYS.explorerOpen, state.explorerOpen)
  }, [state.explorerOpen, mounted])

  useEffect(() => {
    if (!mounted) return
    saveToStorage(STORAGE_KEYS.chatOverlayOpen, state.chatOverlayOpen)
  }, [state.chatOverlayOpen, mounted])

  // Actions
  const toggleNavbar = useCallback(() => {
    setState((prev) => ({ ...prev, navbarCollapsed: !prev.navbarCollapsed }))
  }, [])

  const setNavbarCollapsed = useCallback((collapsed: boolean) => {
    setState((prev) => ({ ...prev, navbarCollapsed: collapsed }))
  }, [])

  const toggleExplorer = useCallback(() => {
    setState((prev) => ({ ...prev, explorerOpen: !prev.explorerOpen }))
  }, [])

  const setExplorerOpen = useCallback((open: boolean) => {
    setState((prev) => ({ ...prev, explorerOpen: open }))
  }, [])

  const toggleDetailDrawer = useCallback(() => {
    setState((prev) => ({
      ...prev,
      detailDrawerOpen: !prev.detailDrawerOpen,
    }))
  }, [])

  const setDetailDrawerOpen = useCallback((open: boolean) => {
    setState((prev) => ({
      ...prev,
      detailDrawerOpen: open,
    }))
  }, [])

  const setDetailDrawerContent = useCallback((content: DetailDrawerContent) => {
    setState((prev) => ({
      ...prev,
      detailDrawerContent: content,
      detailDrawerOpen: content !== null,
    }))
  }, [])

  const toggleChatOverlay = useCallback(() => {
    setState((prev) => ({
      ...prev,
      chatOverlayOpen: !prev.chatOverlayOpen,
    }))
  }, [])

  const setChatOverlayOpen = useCallback((open: boolean) => {
    setState((prev) => ({
      ...prev,
      chatOverlayOpen: open,
    }))
  }, [])

  const setNavbarTransitionEnabled = useCallback((enabled: boolean) => {
    setState((prev) => ({ ...prev, navbarTransitionEnabled: enabled }))
  }, [])

  const contextValue: ShellContextValue = {
    ...state,
    toggleNavbar,
    setNavbarCollapsed,
    toggleExplorer,
    setExplorerOpen,
    toggleDetailDrawer,
    setDetailDrawerOpen,
    setDetailDrawerContent,
    toggleChatOverlay,
    setChatOverlayOpen,
    setNavbarTransitionEnabled,
  }

  return <ShellContext.Provider value={contextValue}>{children}</ShellContext.Provider>
}
