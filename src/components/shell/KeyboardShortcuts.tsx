"use client"

import { useEffect } from "react"
import { useShell, useChatOverlay } from "./shell-context"

/**
 * Keyboard Shortcuts Komponente
 *
 * Registriert globale Keyboard Shortcuts für die Shell:
 * - Ctrl/Cmd + B: Navbar toggle
 * - Ctrl/Cmd + J: Chat Overlay toggle
 * - Escape: Schließt Chat Overlay
 *
 * Hinweis: Explorer (Spalte 2) wird vom Entwickler gesteuert,
 * nicht vom User, daher kein Keyboard Shortcut.
 */
export function KeyboardShortcuts(): null {
  const { toggleNavbar } = useShell()
  const { toggle: toggleChatOverlay, isOpen: chatOverlayOpen } = useChatOverlay()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignoriere wenn Input/Textarea fokussiert
      const target = e.target as HTMLElement
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        return
      }

      const isMod = e.metaKey || e.ctrlKey

      // Ctrl/Cmd + B: Navbar toggle
      if (isMod && e.key === "b") {
        e.preventDefault()
        toggleNavbar()
      }

      // Ctrl/Cmd + J: Chat Overlay toggle
      if (isMod && e.key === "j") {
        e.preventDefault()
        toggleChatOverlay()
      }

      // Escape: Close Chat Overlay
      if (e.key === "Escape" && chatOverlayOpen) {
        toggleChatOverlay()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [toggleNavbar, toggleChatOverlay, chatOverlayOpen])

  return null
}
