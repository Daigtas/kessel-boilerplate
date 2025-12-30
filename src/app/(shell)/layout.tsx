"use client"

import { usePathname } from "next/navigation"
import dynamic from "next/dynamic"
import { AppShell, ExplorerPanel, ExplorerFileTree, KeyboardShortcuts } from "@/components/shell"
import { ThemeEditorProvider } from "@/hooks/use-theme-editor"
import { DatasourceFilterProvider } from "@/hooks/use-datasource-filter"
import { DatasourceExplorerWrapper } from "@/components/admin/datasource-explorer-wrapper"

// Navbar als Client-Only laden (Radix UI Collapsibles haben dynamische IDs)
const Navbar = dynamic(() => import("@/components/shell").then((mod) => mod.Navbar), {
  ssr: false,
  loading: () => <div className="bg-sidebar h-full" />,
})

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

  // Datenquellen-Seite: Provider muss VOR dem Explorer-Element sein
  if (isDatasourcesPage) {
    return (
      <DatasourceFilterProvider>
        <AppShell navbar={<Navbar />} explorer={<DatasourceExplorerWrapper />}>
          <KeyboardShortcuts />
          {children}
        </AppShell>
      </DatasourceFilterProvider>
    )
  }

  // Design System Seite mit ThemeEditorProvider
  if (isDesignSystemPage) {
    return (
      <ThemeEditorProvider>
        <AppShell
          navbar={<Navbar />}
          explorer={
            <ExplorerPanel variant="files">
              <ExplorerFileTree />
            </ExplorerPanel>
          }
        >
          <KeyboardShortcuts />
          {children}
        </AppShell>
      </ThemeEditorProvider>
    )
  }

  // Standard-Layout für alle anderen Seiten
  return (
    <AppShell
      navbar={<Navbar />}
      explorer={
        <ExplorerPanel variant="files">
          <ExplorerFileTree />
        </ExplorerPanel>
      }
    >
      <KeyboardShortcuts />
      {children}
    </AppShell>
  )
}
