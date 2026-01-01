"use client"

import { type ReactNode, useRef, useEffect, useCallback, useState } from "react"
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable"
import { type ImperativePanelHandle } from "react-resizable-panels"
import { cn } from "@/lib/utils"
import {
  ShellProvider,
  useShell,
  PANEL_SIZES,
  PANEL_CONSTRAINTS,
  NAVBAR_COLLAPSED_PX,
  NAVBAR_MIN_PX,
} from "./shell-context"
import { DetailDrawer } from "./DetailDrawer"
import { ChatOverlay } from "./ChatOverlay"
import { FloatingChatButton } from "./FloatingChatButton"
import { UserAvatar } from "./UserAvatar"

/**
 * Konvertiert Pixel zu Prozent basierend auf Container-Breite
 */
function pxToPercent(px: number, containerWidth: number): number {
  if (containerWidth <= 0) return 0
  return (px / containerWidth) * 100
}

/**
 * AppShell Props
 */
interface AppShellProps {
  children: ReactNode
  /** Navbar Content (Spalte 1) */
  navbar?: ReactNode
  /** Explorer Content (Spalte 2) */
  explorer?: ReactNode
  /** CSS Klassen für das Root-Element */
  className?: string
}

/**
 * Innere Shell-Komponente (benötigt ShellProvider)
 *
 * Panel-Größen sind in PROZENT (1-100).
 * AUSNAHME: Navbar collapsed/minSize werden aus festen Pixel-Werten berechnet,
 * um sicherzustellen dass Icons bei schmalen Fenstern nie abgeschnitten werden.
 */
function ShellInner({ children, navbar, explorer, className }: AppShellProps): React.ReactElement {
  const {
    navbarCollapsed,
    setNavbarCollapsed,
    explorerOpen,
    detailDrawerOpen,
    detailDrawerContent,
    navbarTransitionEnabled,
    setNavbarTransitionEnabled,
  } = useShell()

  // Container-Breite für dynamische Berechnung von collapsed/minSize
  const [containerWidth, setContainerWidth] = useState(1600) // SSR-safe Default
  const containerRef = useRef<HTMLDivElement>(null)

  // Explorer wird angezeigt wenn: Prop vorhanden UND State offen
  const hasExplorer = !!explorer && explorerOpen

  // Detail-Drawer wird angezeigt wenn: Content vorhanden UND State offen
  const hasDetailDrawer = detailDrawerContent !== null && detailDrawerOpen

  // Ref für imperative Panel-Kontrolle
  const navbarPanelRef = useRef<ImperativePanelHandle>(null)

  // Flag um Drag-initiierte Expands zu erkennen (verhindert doppeltes Expand)
  const isDragExpandingRef = useRef(false)

  // Flag um initiale Synchronisation zu tracken (nur einmal nach Mount)
  const hasInitialSyncRef = useRef(false)

  // Container-Breite messen und bei Resize aktualisieren
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth)
      }
    }

    updateWidth()
    window.addEventListener("resize", updateWidth)
    return () => window.removeEventListener("resize", updateWidth)
  }, [])

  // Synchronisiere navbarCollapsed State mit tatsächlichem Panel-Zustand nach Mount
  // Dies behebt den Bug nach Hard Reload: autoSaveId lädt Panel-Größe,
  // aber navbarCollapsed State kann aus dem Sync sein
  useEffect(() => {
    // Nur einmal nach Mount ausführen, mit kleinem Delay damit Panel initialisiert ist
    if (hasInitialSyncRef.current) return

    const timer = setTimeout(() => {
      const panel = navbarPanelRef.current
      if (!panel) return

      hasInitialSyncRef.current = true

      const panelIsCollapsed = panel.isCollapsed()
      if (panelIsCollapsed !== navbarCollapsed) {
        // State mit tatsächlichem Panel-Zustand synchronisieren
        setNavbarCollapsed(panelIsCollapsed)
      }
    }, 100) // Kurzer Delay damit autoSaveId das Panel initialisiert hat

    return () => clearTimeout(timer)
  }, [navbarCollapsed, setNavbarCollapsed])

  // Dynamisch berechnete Prozent-Werte für Navbar collapsed/min
  // Diese garantieren feste Pixel-Breiten unabhängig von der Fensterbreite
  const navbarCollapsedPercent = pxToPercent(NAVBAR_COLLAPSED_PX, containerWidth)
  const navbarMinPercent = pxToPercent(NAVBAR_MIN_PX, containerWidth)

  // Synchronisiere Panel mit State (NUR für Keyboard-Shortcuts, nicht für Drag)
  useEffect(() => {
    const panel = navbarPanelRef.current
    if (!panel) return

    // Skip wenn Expand durch Drag initiiert wurde
    if (isDragExpandingRef.current) {
      isDragExpandingRef.current = false
      return
    }

    if (navbarCollapsed && !panel.isCollapsed()) {
      // Keyboard-Shortcut: Collapse
      setNavbarTransitionEnabled(true)
      panel.collapse()
      setTimeout(() => setNavbarTransitionEnabled(false), 200)
    } else if (!navbarCollapsed && panel.isCollapsed()) {
      // Keyboard-Shortcut: Expand
      setNavbarTransitionEnabled(true)
      panel.expand()
      setTimeout(() => setNavbarTransitionEnabled(false), 200)
    }
  }, [navbarCollapsed, setNavbarTransitionEnabled])

  // Callbacks für Navbar Collapse/Expand (durch Drag-Interaktion)
  const handleNavbarCollapse = useCallback(() => {
    setNavbarCollapsed(true)
  }, [setNavbarCollapsed])

  const handleNavbarExpand = useCallback(() => {
    // Flag setzen um useEffect zu überspringen (Drag-initiiert, nicht Keyboard)
    isDragExpandingRef.current = true
    setNavbarCollapsed(false)
  }, [setNavbarCollapsed])

  // Single-Click auf Navbar-Handle: Bei collapsed Navbar sofort expandieren
  const handleNavbarHandleClick = useCallback(() => {
    const panel = navbarPanelRef.current
    if (!panel) return

    // Nur reagieren wenn collapsed - sonst normales Drag-Verhalten
    if (navbarCollapsed || panel.isCollapsed()) {
      setNavbarTransitionEnabled(true)
      setNavbarCollapsed(false)
      panel.expand()
      setTimeout(() => {
        panel.resize(PANEL_SIZES.navbar)
        setNavbarTransitionEnabled(false)
      }, 50)
    }
  }, [navbarCollapsed, setNavbarCollapsed, setNavbarTransitionEnabled])

  // Doppelklick auf Navbar-Handle: Toggle zwischen collapsed/expanded
  const handleNavbarHandleDoubleClick = useCallback(() => {
    const panel = navbarPanelRef.current
    if (!panel) return

    if (navbarCollapsed || panel.isCollapsed()) {
      // Collapsed → Expand auf 15%
      setNavbarTransitionEnabled(true)
      setNavbarCollapsed(false)
      panel.expand()
      setTimeout(() => {
        panel.resize(PANEL_SIZES.navbar)
        setNavbarTransitionEnabled(false)
      }, 50)
    } else {
      // Expanded → Collapse mit Animation
      setNavbarTransitionEnabled(true)
      setNavbarCollapsed(true)
      panel.collapse()
      setTimeout(() => setNavbarTransitionEnabled(false), 200)
    }
  }, [navbarCollapsed, setNavbarCollapsed, setNavbarTransitionEnabled])

  return (
    <div
      ref={containerRef}
      className={cn(
        "bg-background h-screen w-screen overflow-hidden",
        // Transition nur aktivieren wenn explizit gewünscht (Navbar Collapse/Expand)
        navbarTransitionEnabled && "enable-panel-transition",
        className
      )}
      suppressHydrationWarning
    >
      <ResizablePanelGroup
        id="app-shell-panels"
        direction="horizontal"
        autoSaveId="app-shell"
        className="h-full"
      >
        {/* Spalte 1: Navbar
            - Feste 15% als Default
            - Collapsible auf feste 48px (Icon-only) - dynamisch in % berechnet
            - Autocollapse wenn unter 100px gezogen - dynamisch in % berechnet
            - User kann resizen (wird via autoSaveId persistiert)
        */}
        <ResizablePanel
          ref={navbarPanelRef}
          id="navbar"
          order={1}
          defaultSize={navbarCollapsed ? navbarCollapsedPercent : PANEL_SIZES.navbar}
          minSize={navbarMinPercent}
          maxSize={PANEL_CONSTRAINTS.navbar.max}
          collapsible
          collapsedSize={navbarCollapsedPercent}
          onCollapse={handleNavbarCollapse}
          onExpand={handleNavbarExpand}
          className="bg-background"
        >
          <div className="flex h-full flex-col">
            {navbar ?? (
              <div className="text-muted-foreground flex h-full items-center justify-center">
                Navbar
              </div>
            )}
          </div>
        </ResizablePanel>

        <ResizableHandle
          id="navbar-handle"
          onClick={handleNavbarHandleClick}
          onDoubleClick={handleNavbarHandleDoubleClick}
        />

        {/* Spalte 2: Explorer (optional)
            - 15% Default
            - Wird nur angezeigt wenn explorerOpen && explorer prop vorhanden
        */}
        {hasExplorer && (
          <>
            <ResizablePanel
              id="explorer"
              order={2}
              defaultSize={PANEL_SIZES.explorer}
              minSize={PANEL_CONSTRAINTS.explorer.min}
              maxSize={PANEL_CONSTRAINTS.explorer.max}
              className="bg-background"
            >
              <div className="flex h-full flex-col">{explorer}</div>
            </ResizablePanel>

            <ResizableHandle id="explorer-handle" />
          </>
        )}

        {/* Spalte 3: Main Area
            - Flexibel - nimmt den restlichen Platz ein
            - Mindestens 30%
        */}
        <ResizablePanel
          id="main"
          order={3}
          minSize={PANEL_CONSTRAINTS.main.min}
          className="bg-background"
        >
          <div className="relative flex h-full flex-col overflow-hidden">
            {/* Floating UserAvatar oben rechts */}
            <div className="absolute top-6 right-6 z-20">
              <UserAvatar />
            </div>
            {/* Chat Overlay (innerhalb Spalte 3) */}
            <ChatOverlay />
            {/* Floating ChatButton unten rechts (innerhalb Spalte 3) */}
            <div className="absolute right-6 bottom-6 z-20">
              <FloatingChatButton />
            </div>
            {children}
          </div>
        </ResizablePanel>

        {/* Spalte 4: Detail-Drawer (optional)
            - 15% Default
            - Wird nur angezeigt wenn Content vorhanden ist
        */}
        {hasDetailDrawer && (
          <>
            <ResizableHandle id="detail-drawer-handle" />

            <ResizablePanel
              id="detail-drawer"
              order={4}
              defaultSize={PANEL_SIZES.assist}
              minSize={PANEL_CONSTRAINTS.assist.min}
              maxSize={PANEL_CONSTRAINTS.assist.max}
              className="bg-muted"
            >
              <DetailDrawer />
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>
    </div>
  )
}

/**
 * AppShell Komponente
 *
 * 4-Spalten-Layout basierend auf react-resizable-panels:
 * - Spalte 1: Navbar (15%, collapsible auf feste 48px)
 * - Spalte 2: Explorer (15%, optional)
 * - Spalte 3: Main Area (flexibel, min 30%)
 * - Spalte 4: Detail-Drawer (15%, optional)
 *
 * Panel-Größen sind in PROZENT, AUSSER:
 * - Navbar collapsed: feste 48px (Icons werden nie abgeschnitten)
 * - Navbar minSize: feste 100px (Autocollapse-Trigger)
 *
 * Persistenz erfolgt automatisch via autoSaveId="app-shell" in localStorage.
 *
 * @example
 * ```tsx
 * // Mit Explorer (vom Entwickler aktiviert)
 * <AppShell
 *   navbar={<Navbar />}
 *   explorer={<ExplorerPanel />}
 * >
 *   <MainContent />
 * </AppShell>
 *
 * // Ohne Explorer
 * <AppShell navbar={<Navbar />}>
 *   <MainContent />
 * </AppShell>
 * ```
 */
export function AppShell(props: AppShellProps): React.ReactElement {
  return (
    <ShellProvider>
      <ShellInner {...props} />
    </ShellProvider>
  )
}

/**
 * AppShell mit externem Provider
 * Für Fälle, wo der ShellProvider bereits weiter oben in der Hierarchie ist
 */
export function AppShellWithoutProvider(props: AppShellProps): React.ReactElement {
  return <ShellInner {...props} />
}
