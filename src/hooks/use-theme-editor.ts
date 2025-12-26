"use client"

import { useState, useCallback, useEffect } from "react"
import { useTheme } from "@/lib/themes"
import { saveTheme } from "@/lib/themes/storage"

/**
 * Konvertiert einen String zu einer URL-freundlichen ID
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "") // Entferne Sonderzeichen
    .replace(/[\s_-]+/g, "-") // Ersetze Leerzeichen/Underscores mit Bindestrichen
    .replace(/^-+|-+$/g, "") // Entferne führende/trailing Bindestriche
}

/**
 * Token-Wert für Light/Dark Mode
 */
export interface TokenValue {
  light: string
  dark: string
}

/**
 * Theme Editor State
 */
export interface ThemeEditorState {
  /** Welches Theme als Basis dient */
  baseThemeId: string | null
  /** Map von Token-Name zu Werten */
  pendingChanges: Map<string, TokenValue>
  /** Gibt es ungespeicherte Änderungen? */
  isDirty: boolean
}

/**
 * Theme Editor Actions
 */
export interface ThemeEditorActions {
  /** Setzt Live-Preview für einen Token */
  previewToken: (name: string, light: string, dark: string) => void
  /** Setzt Vorschau zurück auf Basis-Theme */
  resetPreview: () => void
  /** Speichert Änderungen als neues Theme */
  saveAsNewTheme: (name: string, description?: string) => Promise<string>
  /** Liest aktuelle Token-Werte */
  getCurrentTokens: () => Record<string, TokenValue>
}

/**
 * Hook für Live-Theme-Editing
 *
 * Verwaltet temporäre Inline-Style-Änderungen und ermöglicht das Speichern als neues Theme.
 */
export function useThemeEditor(): ThemeEditorState & ThemeEditorActions {
  const { theme: currentThemeId } = useTheme()
  const [baseThemeId, setBaseThemeId] = useState<string | null>(null)
  const [pendingChanges, setPendingChanges] = useState<Map<string, TokenValue>>(new Map())

  const previewToken = useCallback((name: string, light: string, dark: string) => {
    // Skip on server
    if (typeof window === "undefined") return

    const root = document.documentElement
    const isDark = root.classList.contains("dark")

    // Setze Inline-Style für aktuellen Modus
    root.style.setProperty(name, isDark ? dark : light)

    // Speichere beide Werte im State
    setPendingChanges((prev) => {
      const next = new Map(prev)
      next.set(name, { light, dark })
      return next
    })
  }, [])

  const resetPreview = useCallback(() => {
    // Skip on server
    if (typeof window === "undefined") return

    const root = document.documentElement

    // Entferne alle Inline-Styles die wir gesetzt haben
    pendingChanges.forEach((_, tokenName) => {
      root.style.removeProperty(tokenName)
    })

    setPendingChanges(new Map())
  }, [pendingChanges])

  // Initialisiere baseThemeId beim Mount
  useEffect(() => {
    if (currentThemeId && !baseThemeId) {
      setBaseThemeId(currentThemeId)
    }
  }, [currentThemeId, baseThemeId])

  // Aktualisiere baseThemeId wenn Theme gewechselt wird
  useEffect(() => {
    if (currentThemeId !== baseThemeId) {
      // Wenn Theme gewechselt wird, alle Änderungen zurücksetzen
      resetPreview()
      setBaseThemeId(currentThemeId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resetPreview ändert sich bei jeder pendingChanges-Änderung
  }, [currentThemeId, baseThemeId])

  const getCurrentTokens = useCallback((): Record<string, TokenValue> => {
    // Return empty on server
    if (typeof window === "undefined") return {}

    const root = document.documentElement
    const computedStyle = window.getComputedStyle(root)
    const tokens: Record<string, TokenValue> = {}

    // Liste aller CSS-Variablen die wir bearbeiten können
    const editableTokens = [
      "--primary",
      "--primary-foreground",
      "--secondary",
      "--secondary-foreground",
      "--background",
      "--foreground",
      "--card",
      "--card-foreground",
      "--popover",
      "--popover-foreground",
      "--muted",
      "--muted-foreground",
      "--accent",
      "--accent-foreground",
      "--destructive",
      "--destructive-foreground",
      "--border",
      "--input",
      "--ring",
      "--radius",
      "--success",
      "--success-foreground",
      "--warning",
      "--warning-foreground",
      "--info",
      "--info-foreground",
    ]

    // Lade aktuelle Werte (aus Inline-Styles oder CSS)
    editableTokens.forEach((tokenName) => {
      const value = computedStyle.getPropertyValue(tokenName).trim()
      // Für jetzt nehmen wir den gleichen Wert für Light/Dark
      // Später können wir das aus dem Theme-CSS extrahieren
      tokens[tokenName] = { light: value, dark: value }
    })

    return tokens
  }, [])

  const saveAsNewTheme = useCallback(
    async (name: string, description?: string): Promise<string> => {
      // This should only run on client
      if (typeof window === "undefined") {
        throw new Error("saveAsNewTheme kann nur auf dem Client aufgerufen werden")
      }

      if (!baseThemeId) {
        throw new Error("Kein Basis-Theme ausgewählt")
      }

      const root = document.documentElement
      const computedStyle = window.getComputedStyle(root)

      // Generiere Theme-ID aus Name
      const themeId = slugify(name)

      // Sammle alle geänderten Tokens
      const lightTokens: string[] = []
      const darkTokens: string[] = []

      // Basis-Werte aus aktuellen Computed Styles
      const allTokens = getCurrentTokens()

      // Geänderte Tokens haben Priorität, sonst Basis-Wert
      pendingChanges.forEach((value, tokenName) => {
        lightTokens.push(`  ${tokenName}: ${value.light};`)
        darkTokens.push(`  ${tokenName}: ${value.dark};`)
      })

      // Generiere CSS
      const lightCSS = `[data-theme="${themeId}"] {\n${lightTokens.join("\n")}\n}`
      const darkCSS = `.dark[data-theme="${themeId}"] {\n${darkTokens.join("\n")}\n}`

      // Speichere Theme
      const result = await saveTheme({
        id: themeId,
        name,
        description: description ?? `Basiert auf ${baseThemeId}`,
        lightCSS,
        darkCSS,
      })

      if (!result.success) {
        throw new Error(result.error ?? "Fehler beim Speichern des Themes")
      }

      // Entferne Inline-Styles nach erfolgreichem Speichern
      resetPreview()

      return themeId
    },
    [baseThemeId, pendingChanges, getCurrentTokens, resetPreview]
  )

  const isDirty = pendingChanges.size > 0

  return {
    baseThemeId,
    pendingChanges,
    isDirty,
    previewToken,
    resetPreview,
    saveAsNewTheme,
    getCurrentTokens,
  }
}
