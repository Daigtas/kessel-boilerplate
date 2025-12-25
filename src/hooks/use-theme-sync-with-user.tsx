"use client"

import { useEffect, useRef } from "react"
import { useAuth } from "@/components/auth"
import { useTheme } from "@/lib/themes"
import { createClient } from "@/utils/supabase/client"

/**
 * LocalStorage Key (muss mit theme-provider.tsx übereinstimmen)
 */
const THEME_STORAGE_KEY = "tweakcn-theme"

/**
 * Hook zur Synchronisierung des Themes mit dem User-Profil.
 *
 * Funktionsweise:
 * 1. Bei Login: Lädt theme_preference aus DB und setzt Theme
 * 2. Bei Theme-Wechsel: Speichert neues Theme in DB
 *
 * WICHTIG: Dieser Hook muss innerhalb von AuthProvider UND ThemeProvider verwendet werden!
 */
export function useThemeSyncWithUser(): void {
  const { user, isAuthenticated } = useAuth()
  const { theme, setTheme, themes, isLoading: themesLoading } = useTheme()

  // Track ob wir bereits das initiale Sync gemacht haben
  const initialSyncDone = useRef(false)
  // Track den letzten User, um Änderungen zu erkennen
  const lastUserId = useRef<string | null>(null)
  // Track das letzte Theme, um Änderungen zu erkennen
  const lastTheme = useRef<string>(theme)

  // ═══════════════════════════════════════════════════════════════════════════
  // SYNC VON DB → CLIENT (bei Login)
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    // Warte bis Themes geladen sind
    if (themesLoading) return

    // Prüfe ob User sich geändert hat (Login/Logout)
    const userChanged = user?.id !== lastUserId.current
    lastUserId.current = user?.id ?? null

    // Bei Logout: Nichts tun (localStorage bleibt)
    if (!isAuthenticated || !user) {
      initialSyncDone.current = false
      return
    }

    // Bei Login: Theme aus DB anwenden
    if (userChanged && user.themePreference) {
      const dbTheme = user.themePreference

      // Prüfe ob Theme existiert
      const themeExists = themes.some((t) => t.id === dbTheme)

      if (themeExists && dbTheme !== theme) {
        console.log("[ThemeSync] Applying theme from DB:", dbTheme)
        setTheme(dbTheme)
        // localStorage wird von setTheme automatisch aktualisiert
      }

      initialSyncDone.current = true
    }
  }, [user, isAuthenticated, themes, themesLoading, theme, setTheme])

  // ═══════════════════════════════════════════════════════════════════════════
  // SYNC VON CLIENT → DB (bei Theme-Wechsel)
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    // Nur wenn eingeloggt und Theme sich geändert hat
    if (!isAuthenticated || !user) return
    if (theme === lastTheme.current) return

    lastTheme.current = theme

    // Warte bis initiales Sync abgeschlossen ist (verhindert Loop)
    if (!initialSyncDone.current) return

    // Speichere in DB
    const saveToDb = async () => {
      const supabase = createClient()

      const { error } = await supabase
        .from("profiles")
        .update({ theme_preference: theme })
        .eq("id", user.id)

      if (error) {
        console.error("[ThemeSync] Failed to save theme to DB:", error.message)
      } else {
        console.log("[ThemeSync] Theme saved to DB:", theme)
      }
    }

    saveToDb()
  }, [theme, user, isAuthenticated])
}

/**
 * Provider-Komponente die den Sync-Hook einbindet.
 * Wird in ClientProviders verwendet.
 */
export function ThemeSyncProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  useThemeSyncWithUser()
  return <>{children}</>
}
