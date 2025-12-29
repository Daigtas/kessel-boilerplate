"use client"

import { cn } from "@/lib/utils"
import { useDetailDrawer } from "./shell-context"

/**
 * DetailDrawer Props
 */
interface DetailDrawerProps {
  /** Zusätzliche CSS-Klassen */
  className?: string
}

/**
 * DetailDrawer Komponente
 *
 * Spalte 4 des 4-Spalten-Layouts.
 * Zeigt optionalen Detail-Content, der von Seiten gesetzt wird.
 * Wenn kein Content vorhanden ist, wird das Panel automatisch versteckt.
 *
 * Der Content wird direkt gerendert ohne zusätzliche Layout-Wrapper.
 * Panels wie ThemeDetailPanel kontrollieren ihr eigenes Layout (h-full, ScrollArea, etc.).
 *
 * @example
 * ```tsx
 * // In einer Seite:
 * const { setContent } = useDetailDrawer()
 * useEffect(() => {
 *   setContent(<MyDetailContent />)
 *   return () => setContent(null) // Cleanup
 * }, [])
 * ```
 */
export function DetailDrawer({ className }: DetailDrawerProps): React.ReactElement | null {
  const { content } = useDetailDrawer()

  // Wenn kein Content, nichts rendern (Panel wird in AppShell versteckt)
  if (!content) {
    return null
  }

  // Content direkt rendern - Panels kontrollieren ihr eigenes Layout
  return <div className={cn("h-full w-full", className)}>{content}</div>
}
