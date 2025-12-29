"use client"

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"

/**
 * LocalStorage Keys für Shell-State
 */
const STORAGE_KEYS = {
  navbarCollapsed: "shell-navbar-collapsed",
  explorerOpen: "shell-explorer-open",
  detailDrawerOpen: "shell-detail-drawer-open",
  chatOverlayOpen: "shell-chat-overlay-open",
  panelWidths: "shell-panel-widths-px", // NEU: Pixel-basiert
} as const

/**
 * Default Panel-Breiten in PIXELN
 * Diese werden bei Hard Reload verwendet
 */
export const DEFAULT_PANEL_WIDTHS = {
  navbar: 200, // Schmale aber lesbare Breite
  navbarCollapsed: 48, // Icon-only
  explorer: 250, // Moderate Breite für Explorer
  assist: 320, // Komfortable Breite für Chat/Wiki
} as const

/**
 * Min/Max Breiten in Pixeln
 */
export const PANEL_CONSTRAINTS = {
  navbar: { min: 48, max: 400 },
  explorer: { min: 180, max: 500 },
  assist: { min: 250, max: 600 },
  main: { min: 400 }, // Mindestbreite für Main
} as const

/**
 * Detail-Drawer Content Type
 * Wird von Seiten gesetzt, um optionalen Detail-Content anzuzeigen
 */
export type DetailDrawerContent = ReactNode | null

/**
 * Panel-Breiten in Pixeln
 */
export interface PanelWidths {
  navbar: number
  explorer: number
  assist: number
}

/**
 * Shell-State Interface
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
  /** Panel-Breiten in PIXELN (stabil bei Toggle) */
  panelWidths: PanelWidths
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
  /** Update Panel-Breiten in Pixeln */
  updatePanelWidths: (widths: Partial<PanelWidths>) => void
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
  panelWidths: {
    navbar: DEFAULT_PANEL_WIDTHS.navbar,
    explorer: DEFAULT_PANEL_WIDTHS.explorer,
    assist: DEFAULT_PANEL_WIDTHS.assist,
  },
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
    setState((prev) => ({
      ...prev,
      navbarCollapsed: loadFromStorage(STORAGE_KEYS.navbarCollapsed, prev.navbarCollapsed),
      explorerOpen: loadFromStorage(STORAGE_KEYS.explorerOpen, prev.explorerOpen),
      detailDrawerOpen: loadFromStorage(STORAGE_KEYS.detailDrawerOpen, prev.detailDrawerOpen),
      chatOverlayOpen: loadFromStorage(STORAGE_KEYS.chatOverlayOpen, prev.chatOverlayOpen),
      panelWidths: loadFromStorage(STORAGE_KEYS.panelWidths, prev.panelWidths),
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
    saveToStorage(STORAGE_KEYS.detailDrawerOpen, state.detailDrawerOpen)
  }, [state.detailDrawerOpen, mounted])

  useEffect(() => {
    if (!mounted) return
    saveToStorage(STORAGE_KEYS.chatOverlayOpen, state.chatOverlayOpen)
  }, [state.chatOverlayOpen, mounted])

  useEffect(() => {
    if (!mounted) return
    saveToStorage(STORAGE_KEYS.panelWidths, state.panelWidths)
  }, [state.panelWidths, mounted])

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

  const updatePanelWidths = useCallback((widths: Partial<PanelWidths>) => {
    setState((prev) => ({
      ...prev,
      panelWidths: { ...prev.panelWidths, ...widths },
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
    updatePanelWidths,
    setNavbarTransitionEnabled,
  }

  return <ShellContext.Provider value={contextValue}>{children}</ShellContext.Provider>
}
