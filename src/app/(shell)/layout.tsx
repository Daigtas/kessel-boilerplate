"use client"

import { usePathname } from "next/navigation"
import dynamic from "next/dynamic"
import { AppShell, ExplorerPanel, ExplorerFileTree, KeyboardShortcuts } from "@/components/shell"
import { ThemeEditorProvider } from "@/hooks/use-theme-editor"

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
 */
export default function ShellLayout({
  children,
}: {
  children: React.ReactNode
}): React.ReactElement {
  const pathname = usePathname()
  const isTweakPage = pathname?.includes("/design-system/tweak")

  const content = (
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

  // ThemeEditorProvider nur auf der Tweak-Seite
  if (isTweakPage) {
    return <ThemeEditorProvider>{content}</ThemeEditorProvider>
  }

  return content
}
