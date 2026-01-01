"use client"

import { useEffect } from "react"
import { cn } from "@/lib/utils"
import { useChatOverlay } from "./shell-context"
import { AIChatPanel } from "./AIChatPanel"

/**
 * ChatOverlay Komponente
 *
 * Overlay-Panel für den KI-Chat mit Blur-Background.
 * Positioniert unten rechts, resizable, schwebt über dem Content.
 *
 * @example
 * ```tsx
 * {chatOverlayOpen && <ChatOverlay />}
 * ```
 */
export function ChatOverlay(): React.ReactElement | null {
  const { isOpen, setOpen } = useChatOverlay()

  // Escape-Key zum Schließen
  useEffect(() => {
    if (!isOpen) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false)
      }
    }

    window.addEventListener("keydown", handleEscape)
    return () => window.removeEventListener("keydown", handleEscape)
  }, [isOpen, setOpen])

  if (!isOpen) return null

  return (
    <>
      {/* Transparenter Klick-Bereich zum Schließen (innerhalb Spalte 3) */}
      <div className="absolute inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />

      {/* Chat-Panel mit Glassmorphism (innerhalb Spalte 3) */}
      <div className="absolute top-24 right-6 z-50 h-[calc(100%-6rem-5rem)] w-full max-w-md">
        <div
          className={cn(
            "flex h-full flex-col overflow-hidden rounded-xl",
            // Glassmorphism: mehr Transparenz
            "bg-popover/60 backdrop-blur-md",
            "border shadow-2xl"
          )}
        >
          {/* Chat Content - Thread-Breite auf 100% für Overlay */}
          <div
            className="flex min-h-0 flex-1 flex-col"
            style={{ ["--thread-max-width" as string]: "100%" }}
          >
            <AIChatPanel />
          </div>
        </div>
      </div>
    </>
  )
}
