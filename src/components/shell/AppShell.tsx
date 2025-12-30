"use client"

import { type ReactNode, useRef, useEffect, useState, useCallback, useMemo } from "react"
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable"
import { type ImperativePanelHandle } from "react-resizable-panels"
import { cn } from "@/lib/utils"
import { ShellProvider, useShell, DEFAULT_PANEL_WIDTHS, PANEL_CONSTRAINTS } from "./shell-context"
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
 * Konvertiert Prozent zu Pixel basierend auf Container-Breite
 */
function percentToPx(percent: number, containerWidth: number): number {
  return (percent / 100) * containerWidth
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
 */
function ShellInner({ children, navbar, explorer, className }: AppShellProps): React.ReactElement {
  const {
    navbarCollapsed,
    setNavbarCollapsed,
    explorerOpen,
    detailDrawerOpen,
    detailDrawerContent,
    panelWidths,
    updatePanelWidths,
    navbarTransitionEnabled,
    setNavbarTransitionEnabled,
  } = useShell()

  // Container-Breite für Pixel ↔ Prozent Umrechnung
  // WICHTIG: Fester Default für SSR, wird nach Mount aktualisiert
  const [containerWidth, setContainerWidth] = useState(1800)
  const [isMounted, setIsMounted] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Explorer wird angezeigt wenn: Prop vorhanden UND State offen
  const hasExplorer = !!explorer && explorerOpen

  // Detail-Drawer wird angezeigt wenn: Content vorhanden UND State offen
  const hasDetailDrawer = detailDrawerContent !== null && detailDrawerOpen

  // Ref für imperative Panel-Kontrolle
  const navbarPanelRef = useRef<ImperativePanelHandle>(null)

  // Flag um Drag-initiierte Expands zu erkennen (verhindert doppeltes Expand)
  const isDragExpandingRef = useRef(false)

  // Flag um initiale Panel-Synchronisation zu tracken (nur einmal nach Mount)
  const hasInitialSyncRef = useRef(false)

  // Mount-State und Container-Breite tracken
  useEffect(() => {
    // Markiere als gemountet (wird nur einmal ausgeführt)
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional: isMounted tracks hydration state
    setIsMounted(true)

    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth)
      }
    }

    updateWidth()
    window.addEventListener("resize", updateWidth)
    return () => window.removeEventListener("resize", updateWidth)
  }, [])

  // Einmalige Panel-Synchronisation nach Mount
  // Problem: defaultSize wird nur beim ersten Render verwendet, danach ignoriert
  // Lösung: Nach dem Mount das Panel imperativ auf die korrekte Größe setzen
  useEffect(() => {
    // Nur einmal ausführen, nach Mount
    if (hasInitialSyncRef.current || !isMounted) return

    const panel = navbarPanelRef.current
    if (!panel) return

    // Markiere als synchronisiert
    hasInitialSyncRef.current = true

    // Wenn Navbar collapsed ist, Panel auf collapsed-Größe setzen
    if (navbarCollapsed) {
      if (!panel.isCollapsed()) {
        panel.collapse()
      }
      return
    }

    // Wenn Navbar expanded ist, auf feste 15% setzen
    const currentSize = panel.getSize()
    const targetPercent = 15 // Fester Wert, keine Pixel-Konvertierung

    // Nur resizen wenn signifikante Abweichung (> 0.5%)
    if (Math.abs(currentSize - targetPercent) > 0.5) {
      panel.resize(targetPercent)
    }
  }, [isMounted, navbarCollapsed])

  // Synchronisiere Panel mit State (NUR für Keyboard-Shortcuts, nicht für Drag)
  useEffect(() => {
    const panel = navbarPanelRef.current
    if (!panel || containerWidth <= 0) return

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
  }, [navbarCollapsed, containerWidth, setNavbarTransitionEnabled])

  // Handle panel resize - Prozente zurück in Pixel umrechnen
  const handlePanelResize = useCallback(
    (sizes: number[]) => {
      if (containerWidth <= 0) return

      let idx = 0
      const navbarPercent = sizes[idx++]
      const explorerPercent = hasExplorer ? sizes[idx++] : 0
      // main wird nicht gespeichert - ist immer der Rest
      idx++ // skip main
      const detailDrawerPercent = hasDetailDrawer ? sizes[idx++] : 0

      // Nur speichern wenn nicht collapsed (collapsed hat feste Breite)
      const newWidths: Partial<typeof panelWidths> = {}

      if (!navbarCollapsed && navbarPercent > 0) {
        newWidths.navbar = Math.round(percentToPx(navbarPercent, containerWidth))
      }
      if (hasExplorer && explorerPercent > 0) {
        newWidths.explorer = Math.round(percentToPx(explorerPercent, containerWidth))
      }
      if (hasDetailDrawer && detailDrawerPercent > 0) {
        newWidths.assist = Math.round(percentToPx(detailDrawerPercent, containerWidth))
      }

      if (Object.keys(newWidths).length > 0) {
        updatePanelWidths(newWidths)
      }
    },
    [containerWidth, hasExplorer, hasDetailDrawer, navbarCollapsed, updatePanelWidths]
  )

  // SSR-sichere Default-Prozente (für konsistente Hydration)
  // Alle optionalen Spalten (Navbar, Explorer, Assist) haben 15% als Standard
  const SSR_DEFAULTS = useMemo(
    () => ({
      navbar: 15, // 15% der Fensterbreite
      navbarCollapsed: 2.7, // ~48px bei 1800px
      explorer: 15, // 15% der Fensterbreite
      assist: 15, // 15% der Fensterbreite
      navbarMin: 2.7,
      navbarMax: 22,
      explorerMin: 10,
      explorerMax: 25,
      assistMin: 10,
      assistMax: 25,
    }),
    []
  )

  // Berechne Prozent-Größen aus gespeicherten Pixel-Werten
  // Vor Mount: SSR-Defaults, nach Mount: echte Berechnung
  const getNavbarPercent = useCallback(() => {
    if (!isMounted) return navbarCollapsed ? SSR_DEFAULTS.navbarCollapsed : SSR_DEFAULTS.navbar
    if (navbarCollapsed) {
      return pxToPercent(DEFAULT_PANEL_WIDTHS.navbarCollapsed, containerWidth)
    }
    return pxToPercent(panelWidths.navbar, containerWidth)
  }, [navbarCollapsed, panelWidths.navbar, containerWidth, isMounted, SSR_DEFAULTS])

  const getExplorerPercent = useCallback(() => {
    if (!isMounted) return SSR_DEFAULTS.explorer
    return pxToPercent(panelWidths.explorer, containerWidth)
  }, [panelWidths.explorer, containerWidth, isMounted, SSR_DEFAULTS])

  const getAssistPercent = useCallback(() => {
    if (!isMounted) return SSR_DEFAULTS.assist
    return pxToPercent(panelWidths.assist, containerWidth)
  }, [panelWidths.assist, containerWidth, isMounted, SSR_DEFAULTS])

  // Main Area = Rest (100% - fixe Panels)
  const getMainPercent = useCallback(() => {
    const navbar = getNavbarPercent()
    const explorer = hasExplorer ? getExplorerPercent() : 0
    const detailDrawer = hasDetailDrawer ? getAssistPercent() : 0
    const main = 100 - navbar - explorer - detailDrawer
    // Mindestens 20% für Main
    return Math.max(20, main)
  }, [getNavbarPercent, getExplorerPercent, getAssistPercent, hasExplorer, hasDetailDrawer])

  // Min/Max in Prozent umrechnen (SSR-sicher)
  const getNavbarMinPercent = () =>
    isMounted ? pxToPercent(PANEL_CONSTRAINTS.navbar.min, containerWidth) : SSR_DEFAULTS.navbarMin
  const getNavbarMaxPercent = () =>
    isMounted ? pxToPercent(PANEL_CONSTRAINTS.navbar.max, containerWidth) : SSR_DEFAULTS.navbarMax
  const getExplorerMinPercent = () =>
    isMounted
      ? pxToPercent(PANEL_CONSTRAINTS.explorer.min, containerWidth)
      : SSR_DEFAULTS.explorerMin
  const getExplorerMaxPercent = () =>
    isMounted
      ? pxToPercent(PANEL_CONSTRAINTS.explorer.max, containerWidth)
      : SSR_DEFAULTS.explorerMax
  const getAssistMinPercent = () =>
    isMounted ? pxToPercent(PANEL_CONSTRAINTS.assist.min, containerWidth) : SSR_DEFAULTS.assistMin
  const getAssistMaxPercent = () =>
    isMounted ? pxToPercent(PANEL_CONSTRAINTS.assist.max, containerWidth) : SSR_DEFAULTS.assistMax
  const getNavbarCollapsedPercent = () =>
    isMounted
      ? pxToPercent(DEFAULT_PANEL_WIDTHS.navbarCollapsed, containerWidth)
      : SSR_DEFAULTS.navbarCollapsed

  // Callbacks für Navbar Collapse/Expand (durch Drag-Interaktion)
  // Bei Drag: Kein Transition nötig - das Panel wird bereits vom User gezogen
  const handleNavbarCollapse = useCallback(() => {
    setNavbarCollapsed(true)
  }, [setNavbarCollapsed])

  const handleNavbarExpand = useCallback(() => {
    // Flag setzen um useEffect zu überspringen (Drag-initiiert, nicht Keyboard)
    isDragExpandingRef.current = true
    // State aktualisieren (ohne Transition - der Drag macht das bereits)
    setNavbarCollapsed(false)
  }, [setNavbarCollapsed])

  // Fester Prozent-Wert für Navbar-Expand (einfacher als Pixel↔Prozent-Konvertierung)
  const NAVBAR_EXPANDED_PERCENT = 15

  // Single-Click auf Navbar-Handle: Bei collapsed Navbar sofort expandieren
  // Löst das "zweimal klicken" Problem von react-resizable-panels
  const handleNavbarHandleClick = useCallback(() => {
    const panel = navbarPanelRef.current
    if (!panel) return

    // Nur reagieren wenn collapsed - sonst normales Drag-Verhalten
    if (navbarCollapsed || panel.isCollapsed()) {
      setNavbarTransitionEnabled(true)
      setNavbarCollapsed(false)
      panel.expand()
      setTimeout(() => {
        panel.resize(NAVBAR_EXPANDED_PERCENT)
        setNavbarTransitionEnabled(false)
      }, 50)
    }
  }, [navbarCollapsed, setNavbarCollapsed, setNavbarTransitionEnabled])

  // Doppelklick auf Navbar-Handle: Toggle zwischen collapsed/expanded
  const handleNavbarHandleDoubleClick = useCallback(() => {
    const panel = navbarPanelRef.current
    if (!panel) return

    if (navbarCollapsed || panel.isCollapsed()) {
      // Collapsed → Expand auf feste 15%
      setNavbarTransitionEnabled(true)
      setNavbarCollapsed(false)
      panel.expand()
      setTimeout(() => {
        panel.resize(NAVBAR_EXPANDED_PERCENT)
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

  // Doppelklick auf Detail-Drawer-Handle: Panel komplett ausblenden
  const handleDetailDrawerHandleDoubleClick = useCallback(() => {
    // Detail-Drawer wird durch setContent(null) geschlossen
    // Hier können wir nichts tun, da setContent nicht im Context verfügbar ist
    // Die Seite muss das selbst handhaben
  }, [])

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
        onLayout={handlePanelResize}
        className="h-full"
      >
        {/* Spalte 1: Navbar
            Pixel-basierte Breite, wird in Prozent umgerechnet
            Transition nur bei explizitem Collapse/Expand
        */}
        <ResizablePanel
          ref={navbarPanelRef}
          id="navbar"
          order={1}
          defaultSize={getNavbarPercent()}
          minSize={getNavbarMinPercent()}
          maxSize={getNavbarMaxPercent()}
          collapsible
          collapsedSize={getNavbarCollapsedPercent()}
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
            Pixel-basierte Breite, bleibt stabil wenn Assist toggled
        */}
        {hasExplorer && (
          <>
            <ResizablePanel
              id="explorer"
              order={2}
              defaultSize={getExplorerPercent()}
              minSize={getExplorerMinPercent()}
              maxSize={getExplorerMaxPercent()}
              className="bg-background"
            >
              <div className="flex h-full flex-col">{explorer}</div>
            </ResizablePanel>

            <ResizableHandle id="explorer-handle" />
          </>
        )}

        {/* Spalte 3: Main Area
            Flexibel - nimmt den restlichen Platz ein
        */}
        <ResizablePanel
          id="main"
          order={3}
          defaultSize={getMainPercent()}
          minSize={20}
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
            Pixel-basierte Breite
            Wird nur angezeigt wenn Content vorhanden ist
        */}
        {hasDetailDrawer && (
          <>
            <ResizableHandle
              id="detail-drawer-handle"
              onDoubleClick={handleDetailDrawerHandleDoubleClick}
            />

            <ResizablePanel
              id="detail-drawer"
              order={4}
              defaultSize={getAssistPercent()}
              minSize={getAssistMinPercent()}
              maxSize={getAssistMaxPercent()}
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
 * - Spalte 1: Navbar (User kann togglen/resizen)
 * - Spalte 2: Explorer (Entwickler steuert Sichtbarkeit, User kann resizen)
 * - Spalte 3: Main Area (flex-grow) mit ChatOverlay und FloatingChatButton
 * - Spalte 4: Detail-Drawer (optional, wird von Seiten gesetzt)
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
