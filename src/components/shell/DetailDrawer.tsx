"use client"

import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
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

  return (
    <div className={cn("flex h-full flex-col", className)}>
      <ScrollArea className="flex-1">
        <div className="p-4">{content}</div>
      </ScrollArea>
    </div>
  )
}
