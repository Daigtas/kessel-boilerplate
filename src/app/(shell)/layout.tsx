"use client"

import { usePathname } from "next/navigation"
import { useEffect, useRef } from "react"
import dynamic from "next/dynamic"
import {
  AppShell,
  ExplorerPanel,
  ExplorerFileTree,
  KeyboardShortcuts,
  useExplorer,
} from "@/components/shell"
import { ThemeEditorProvider } from "@/hooks/use-theme-editor"
import { DatasourceFilterProvider } from "@/hooks/use-datasource-filter"
import { DatasourceExplorerWrapper } from "@/components/admin/datasource-explorer-wrapper"

// Navbar als Client-Only laden (Radix UI Collapsibles haben dynamische IDs)
const Navbar = dynamic(() => import("@/components/shell").then((mod) => mod.Navbar), {
  ssr: false,
  loading: () => <div className="bg-sidebar h-full" />,
})

/**
 * Komponente zum automatischen Öffnen/Schließen des Explorers für bestimmte Routen.
 * Muss innerhalb des ShellProvider (AppShell) gerendert werden.
 *
 * Verwendet einen localStorage-Key um den "pre-route" State zu persistieren,
 * damit er auch bei Full-Page-Navigation erhalten bleibt.
 */
const EXPLORER_PRE_ROUTE_KEY = "shell-explorer-pre-datasources"

function ExplorerAutoOpen({ shouldBeOpen }: { shouldBeOpen: boolean }): null {
  const { isOpen, setOpen } = useExplorer()
  const hasInitialized = useRef(false)

  useEffect(() => {
    if (shouldBeOpen) {
      // Beim Betreten der Route: aktuellen Zustand speichern (falls nicht bereits gespeichert)
      const savedState = sessionStorage.getItem(EXPLORER_PRE_ROUTE_KEY)
      if (savedState === null) {
        sessionStorage.setItem(EXPLORER_PRE_ROUTE_KEY, String(isOpen))
      }
      // Explorer öffnen
      setOpen(true)
      hasInitialized.current = true
    } else if (hasInitialized.current || sessionStorage.getItem(EXPLORER_PRE_ROUTE_KEY) !== null) {
      // Beim Verlassen: auf gespeicherten Zustand zurücksetzen
      const savedState = sessionStorage.getItem(EXPLORER_PRE_ROUTE_KEY)
      if (savedState !== null) {
        setOpen(savedState === "true")
        sessionStorage.removeItem(EXPLORER_PRE_ROUTE_KEY)
      }
      hasInitialized.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Nur bei shouldBeOpen-Änderung
  }, [shouldBeOpen])

  return null
}

/**
 * Explorer-Inhalt basierend auf der Route
 */
function RouteExplorer({ pathname }: { pathname: string }): React.ReactElement {
  const isDatasourcesPage = pathname === "/app-verwaltung/datenquellen"

  if (isDatasourcesPage) {
    return <DatasourceExplorerWrapper />
  }

  return (
    <ExplorerPanel variant="files">
      <ExplorerFileTree />
    </ExplorerPanel>
  )
}

/**
 * Shell Layout
 *
 * Wrapper für alle Seiten innerhalb der App Shell.
 * Verwendet das 4-Spalten-Layout mit react-resizable-panels.
 *
 * Route Protection: proxy.ts schützt diese Routen - nur eingeloggte User kommen hierher.
 *
 * Keyboard Shortcuts:
 * - Ctrl/Cmd + B: Navbar toggle
 * - Ctrl/Cmd + E: Explorer toggle
 * - Ctrl/Cmd + J: Chat Overlay toggle
 * - Escape: Chat Overlay schließen
 *
 * Route-spezifische Explorer:
 * - /app-verwaltung/datenquellen → DatasourceExplorer (Filter-Tree)
 * - Alle anderen Routen → Standard ExplorerFileTree
 */
export default function ShellLayout({
  children,
}: {
  children: React.ReactNode
}): React.ReactElement {
  const pathname = usePathname()
  const isDesignSystemPage = pathname === "/app-verwaltung/design-system"
  const isDatasourcesPage = pathname === "/app-verwaltung/datenquellen"

  // Gemeinsamer Shell-Inhalt mit einheitlicher ExplorerAutoOpen-Instanz
  const shellContent = (
    <>
      <ExplorerAutoOpen shouldBeOpen={isDatasourcesPage} />
      <KeyboardShortcuts />
      {children}
    </>
  )

  // Datenquellen-Seite: Provider muss VOR dem Explorer-Element sein
  if (isDatasourcesPage) {
    return (
      <DatasourceFilterProvider>
        <AppShell navbar={<Navbar />} explorer={<RouteExplorer pathname={pathname} />}>
          {shellContent}
        </AppShell>
      </DatasourceFilterProvider>
    )
  }

  // Design System Seite mit ThemeEditorProvider
  if (isDesignSystemPage) {
    return (
      <ThemeEditorProvider>
        <AppShell navbar={<Navbar />} explorer={<RouteExplorer pathname={pathname} />}>
          {shellContent}
        </AppShell>
      </ThemeEditorProvider>
    )
  }

  // Standard-Layout für alle anderen Seiten
  return (
    <AppShell navbar={<Navbar />} explorer={<RouteExplorer pathname={pathname} />}>
      {shellContent}
    </AppShell>
  )
}
