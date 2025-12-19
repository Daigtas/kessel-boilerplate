"use client"

import { ThemeProvider as NextThemesProvider, useTheme as useNextTheme } from "next-themes"
import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react"

import { loadGoogleFonts } from "@/lib/fonts"

/**
 * LocalStorage Key für das gespeicherte Theme.
 */
const THEME_STORAGE_KEY = "tweakcn-theme"

/**
 * Default Theme ID (Fallback).
 */
const DEFAULT_THEME_ID = "default"

/**
 * Theme-Metadaten Interface.
 */
export interface ThemeMeta {
  id: string
  name: string
  description: string
  dynamicFonts?: string[]
}

/**
 * Theme Context Value Type.
 * Vereinfachte API für CSS-First Architektur.
 */
export interface ThemeContextValue {
  /** Aktuelle Theme-ID */
  theme: string
  /** Theme wechseln */
  setTheme: (id: string) => void
  /** Alle verfügbaren Themes (builtin + dynamisch) */
  themes: ThemeMeta[]
  /** Aktueller Color-Mode (light/dark/system) */
  colorMode: string
  /** Color-Mode wechseln */
  setColorMode: (mode: "light" | "dark" | "system") => void
  /** Themes neu laden (nach Import/Delete) */
  refreshThemes: () => Promise<void>
  /** Lädt gerade Themes */
  isLoading: boolean
}

/**
 * Theme Context.
 */
const ThemeContext = createContext<ThemeContextValue | null>(null)

/**
 * Hook zum Zugriff auf den Theme-Context.
 *
 * @throws Error wenn außerhalb des ThemeProviders verwendet
 * @returns ThemeContextValue
 */
export const useTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider")
  }
  return context
}

interface CustomThemeProviderProps {
  children: ReactNode
  /** Standard-Theme-ID, falls nichts gespeichert ist */
  defaultTheme?: string
}

/**
 * Lädt dynamische Theme-CSS-Datei aus Supabase Storage.
 * Prüft zuerst, ob das CSS bereits serverseitig oder client-seitig geladen wurde.
 */
async function loadDynamicThemeCSS(themeId: string): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl) return

  // Prüfe, ob das CSS bereits serverseitig geladen wurde (als <style> Tag)
  const existingStyle = document.getElementById("default-theme-css")
  if (themeId === "default" && existingStyle) {
    // Default-Theme ist bereits serverseitig geladen - nichts zu tun
    return
  }

  // Prüfe, ob das CSS bereits als <link> geladen wurde
  const existingLink = document.querySelector(`link[data-theme-id="${themeId}"]`)
  if (existingLink) return

  // Multi-Tenant: Schema-basierter Storage-Pfad
  const schemaName = process.env.NEXT_PUBLIC_PROJECT_SCHEMA || "public"
  const storagePath = schemaName === "public" ? `${themeId}.css` : `${schemaName}/${themeId}.css`
  const cssUrl = `${supabaseUrl}/storage/v1/object/public/themes/${storagePath}`

  // Erstelle neues Link-Element
  const link = document.createElement("link")
  link.rel = "stylesheet"
  link.href = cssUrl
  link.setAttribute("data-theme-id", themeId)

  // Füge zum Head hinzu
  document.head.appendChild(link)
}

/**
 * Custom Theme Provider Komponente.
 *
 * CSS-First Architektur:
 * - Setzt nur das data-theme Attribut auf document.documentElement
 * - Lädt alle Themes aus Supabase Storage (keine lokalen Themes mehr)
 */
const CustomThemeProvider = ({
  children,
  defaultTheme = DEFAULT_THEME_ID,
}: CustomThemeProviderProps): React.ReactElement => {
  // next-themes Hook für Dark/Light Mode
  const { theme: colorModeValue, setTheme: setNextTheme } = useNextTheme()

  const [theme, setThemeState] = useState<string>(defaultTheme)
  const [themes, setThemes] = useState<ThemeMeta[]>([])
  const [mounted, setMounted] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  /**
   * Lädt Themes aus der Supabase API.
   */
  const refreshThemes = useCallback(async (): Promise<void> => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/themes/list")

      // Prüfe Content-Type bevor JSON geparst wird
      const contentType = response.headers.get("content-type")
      if (!contentType || !contentType.includes("application/json")) {
        console.warn("API-Route /api/themes/list liefert kein JSON:", contentType)
        // Fallback: Leeres Array setzen
        setThemes([])
        return
      }

      if (response.ok) {
        const data = await response.json()
        if (data.themes && Array.isArray(data.themes)) {
          // Transformiere API-Response zu ThemeMeta-Format
          const apiThemes: ThemeMeta[] = data.themes.map(
            (t: { id: string; name: string; description: string; dynamicFonts?: string[] }) => ({
              id: t.id,
              name: t.name,
              description: t.description,
              dynamicFonts: t.dynamicFonts,
            })
          )
          setThemes(apiThemes)
        } else {
          // Fallback: Leeres Array wenn keine Themes vorhanden
          setThemes([])
        }
      } else {
        console.warn(`API-Route /api/themes/list fehlgeschlagen: ${response.status}`)
        // Fallback: Leeres Array setzen
        setThemes([])
      }
    } catch (error) {
      console.error("Fehler beim Laden der Themes:", error)
      // Fallback: Leeres Array setzen statt zu crashen
      setThemes([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Initialisierung beim Mount
  useEffect(() => {
    setMounted(true)

    // Gespeichertes Theme laden
    const savedThemeId = localStorage.getItem(THEME_STORAGE_KEY)
    if (savedThemeId) {
      setThemeState(savedThemeId)
    }

    // Themes aus API laden
    refreshThemes()
  }, [refreshThemes])

  // KERNLOGIK: Theme-Attribut setzen + Fonts/CSS laden
  useEffect(() => {
    if (!mounted) return

    // Setze data-theme Attribut
    document.documentElement.setAttribute("data-theme", theme)

    // Finde Theme-Metadaten
    const themeMeta = themes.find((t) => t.id === theme)

    if (themeMeta) {
      // Lade dynamische Fonts, falls das Theme welche benötigt
      if (themeMeta.dynamicFonts && themeMeta.dynamicFonts.length > 0) {
        loadGoogleFonts(themeMeta.dynamicFonts).catch((err) => {
          console.error("Fehler beim Laden dynamischer Fonts:", err)
        })
      }
    }

    // Lade Theme-CSS aus Supabase Storage (für alle Themes)
    loadDynamicThemeCSS(theme).catch((err) => {
      console.error("Fehler beim Laden des Theme-CSS:", err)
    })
  }, [theme, themes, mounted])

  const setTheme = useCallback(
    (id: string): void => {
      // Prüfe, ob Theme in der aktuellen Liste existiert
      const isValid = themes.some((t) => t.id === id)
      if (isValid) {
        setThemeState(id)
        localStorage.setItem(THEME_STORAGE_KEY, id)
      }
    },
    [themes]
  )

  const setColorMode = useCallback(
    (mode: "light" | "dark" | "system"): void => {
      setNextTheme(mode)
    },
    [setNextTheme]
  )

  // Bestimme den aktuellen colorMode für den Context
  const colorMode = colorModeValue ?? "system"

  const contextValue: ThemeContextValue = {
    theme,
    setTheme,
    themes,
    colorMode,
    setColorMode,
    refreshThemes,
    isLoading,
  }

  return <ThemeContext.Provider value={contextValue}>{children}</ThemeContext.Provider>
}

interface ThemeProviderProps {
  children: ReactNode
  defaultTheme?: string
}

/**
 * Kombinierter Theme Provider.
 *
 * Integriert:
 * - next-themes für Dark/Light Mode (.dark Klasse auf html)
 * - Custom Theme Provider für TweakCN Themes (data-theme Attribut)
 * - Dynamisches Laden von Themes aus Supabase
 */
export const ThemeProvider = ({
  children,
  defaultTheme,
}: ThemeProviderProps): React.ReactElement => {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <CustomThemeProvider defaultTheme={defaultTheme}>{children}</CustomThemeProvider>
    </NextThemesProvider>
  )
}
