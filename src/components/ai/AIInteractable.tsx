/**
 * AIInteractable Wrapper Component
 *
 * Wrappt eine Komponente und macht sie KI-steuerbar.
 * Registriert sich automatisch in der AI Registry.
 */

"use client"

import { useEffect, useRef, type ReactNode } from "react"
import { useAIRegistry } from "@/lib/ai/ai-registry-context"
import type { AIActionType, AIComponentCategory } from "@/lib/ai/ai-manifest.schema"

/**
 * AIInteractable Props
 */
export interface AIInteractableProps {
  /** Eindeutige Komponenten-ID (muss im ai-manifest.json registriert sein) */
  id: string
  /** Aktion-Typ */
  action: AIActionType
  /** Ziel der Aktion (Route, Panel-Name, etc.) */
  target?: string
  /** Menschenlesbare Beschreibung */
  description: string
  /** Keywords für KI-Erkennung */
  keywords: string[]
  /** Kategorie */
  category: AIComponentCategory
  /** Wann ist diese Aktion verfügbar? */
  availableWhen?: () => boolean
  /** Kinder-Komponenten */
  children: ReactNode
  /** Zusätzliche CSS-Klassen */
  className?: string
}

/**
 * AIInteractable Wrapper
 *
 * Wrappt eine Komponente und registriert sie in der AI Registry.
 * Die Komponente kann dann von der KI gesteuert werden.
 */
export function AIInteractable({
  id,
  action,
  target,
  description,
  keywords,
  category,
  availableWhen,
  children,
  className,
}: AIInteractableProps): React.ReactElement {
  const { register } = useAIRegistry()
  const elementRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Prüfe Verfügbarkeit
    const isAvailable = availableWhen?.() ?? true

    // Execute-Funktion: Klickt das Element
    const execute = () => {
      const element = elementRef.current
      if (!element) return

      // Suche nach klickbarem Element innerhalb des Containers
      const clickableElement = element.querySelector<HTMLElement>("button, a, [role='button']")
      if (clickableElement) {
        clickableElement.click()
      } else {
        // Fallback: Klicke den Container selbst
        element.click()
      }
    }

    // Registriere die Aktion
    const unregister = register({
      id,
      action,
      target,
      description,
      keywords,
      category,
      isAvailable,
      execute,
    })

    // Cleanup beim Unmount
    return unregister
  }, [id, action, target, description, keywords, category, availableWhen, register])

  return (
    <div ref={elementRef} data-ai-id={id} data-ai-action={action} className={className}>
      {children}
    </div>
  )
}
