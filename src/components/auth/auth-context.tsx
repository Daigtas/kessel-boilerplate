"use client"

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"
import { createClient } from "@/utils/supabase/client"
import type { User as SupabaseUser } from "@supabase/supabase-js"

/** User-Rollen */
// System-Rollen sind immer verfügbar, zusätzliche Rollen können dynamisch hinzugefügt werden
export type UserRole = "admin" | "user" | "superuser" | "NoUser" | string

/** User Interface */
export interface User {
  id: string
  email: string
  name: string
  avatar?: string
  avatarSeed?: string // Seed für DiceBear Avatar-Generierung
  role: UserRole
  roleId?: string // UUID der Rolle aus roles Tabelle
  createdAt?: string // ISO timestamp string
  themePreference?: string // Bevorzugtes Theme des Users
}

/** Auth Context Interface */
interface AuthContextValue {
  user: User | null
  isAuthenticated: boolean
  role: UserRole
  isLoading: boolean
  hasRole: (roles: UserRole | UserRole[]) => boolean
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

/** Hook zum Zugriff auf Auth-State */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error("useAuth must be used within AuthProvider")
  return context
}

/** Lädt User-Profile aus Supabase profiles-Tabelle mit Rolle aus roles Tabelle */
async function loadUserProfile(supabaseUser: SupabaseUser): Promise<User> {
  const supabase = createClient()

  // Lade Profile mit Rolle (JOIN über role_id)
  const { data: profile } = await supabase
    .from("profiles")
    .select(
      `
      id, 
      email, 
      display_name, 
      avatar_url,
      avatar_seed,
      created_at,
      role,
      role_id,
      theme_preference,
      roles:role_id (
        name,
        display_name
      )
    `
    )
    .eq("id", supabaseUser.id)
    .single()

  // Fallback: Wenn keine role_id, versuche alte role Spalte (für Migration)
  let roleName: string = "user"
  let roleId: string | undefined = undefined

  if (profile?.role_id && profile?.roles) {
    // Neue Struktur: Rolle aus roles Tabelle
    roleId = profile.role_id
    // roles kann ein Array oder ein einzelnes Objekt sein (je nach JOIN)
    const rolesData = Array.isArray(profile.roles) ? profile.roles[0] : profile.roles
    roleName = (rolesData as { name: string })?.name || "user"
  } else if (profile?.role) {
    // Fallback: Verwende role Spalte direkt (wenn JOIN fehlgeschlagen ist)
    roleName = profile.role
    // Versuche role_id zu finden, wenn role gesetzt ist
    if (profile.role_id) {
      roleId = profile.role_id
    } else {
      // Versuche role_id basierend auf role Name zu finden
      const { data: roleData } = await supabase
        .from("roles")
        .select("id")
        .eq("name", profile.role)
        .single()
      if (roleData?.id) {
        roleId = roleData.id
      }
    }
  } else {
    // Letzter Fallback: Lade role direkt aus profiles
    const { data: oldProfile } = await supabase
      .from("profiles")
      .select("role, role_id")
      .eq("id", supabaseUser.id)
      .single()

    if (oldProfile?.role) {
      roleName = oldProfile.role
      if (oldProfile.role_id) {
        roleId = oldProfile.role_id
      }
    }
  }

  return {
    id: supabaseUser.id,
    email: profile?.email || supabaseUser.email || "",
    name: profile?.display_name || supabaseUser.email?.split("@")[0] || "User",
    avatar: profile?.avatar_url || undefined,
    avatarSeed: profile?.avatar_seed || undefined,
    role: roleName as UserRole,
    roleId: roleId,
    createdAt: profile?.created_at || undefined,
    themePreference: profile?.theme_preference || undefined,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// LOCAL DEV AUTO-LOGIN - Automatischer Admin-Login für Entwicklung
// ═══════════════════════════════════════════════════════════════════════════
function isDevAutoLoginEnabled(): boolean {
  // Nur im Browser prüfen (nicht während SSR)
  if (typeof window === "undefined") return false
  // Doppelte Absicherung: Nur in Development UND wenn explizit aktiviert
  const isDev = process.env.NODE_ENV === "development"
  const autoLoginEnabled = process.env.NEXT_PUBLIC_AUTH_BYPASS === "true"
  const hasCredentials =
    !!process.env.NEXT_PUBLIC_DEV_ADMIN_EMAIL && !!process.env.NEXT_PUBLIC_DEV_ADMIN_PASSWORD
  return isDev && autoLoginEnabled && hasCredentials
}

function getDevCredentials(): { email: string; password: string } | null {
  const email = process.env.NEXT_PUBLIC_DEV_ADMIN_EMAIL
  const password = process.env.NEXT_PUBLIC_DEV_ADMIN_PASSWORD
  if (!email || !password) return null
  return { email, password }
}
// ═══════════════════════════════════════════════════════════════════════════

/** Auth Provider - stellt Auth-State für die App bereit */
export function AuthProvider({ children }: { children: ReactNode }): React.ReactElement {
  // WICHTIG: Immer mit isLoading=true starten für konsistente SSR/Client Hydration
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()

  // Initial Load + Auth State Listener
  useEffect(() => {
    // Async IIFE um ESLint-Regel zu erfüllen (kein synchrones setState im Effect-Body)
    const initializeAuth = async () => {
      // Prüfe ob bereits eingeloggt
      const { data: existingUser } = await supabase.auth.getUser()

      if (existingUser.user) {
        // Bereits eingeloggt - Profil laden
        const profile = await loadUserProfile(existingUser.user)
        setUser(profile)
        setIsLoading(false)
        return
      }

      // Nicht eingeloggt - prüfe Dev Auto-Login
      if (isDevAutoLoginEnabled()) {
        const credentials = getDevCredentials()
        if (credentials) {
          console.log("[AUTH] Dev Auto-Login aktiv - logge ein als:", credentials.email)

          const { data: loginData, error } = await supabase.auth.signInWithPassword({
            email: credentials.email,
            password: credentials.password,
          })

          if (error) {
            console.error("[AUTH] Dev Auto-Login fehlgeschlagen:", error.message)
            // Fallback: Kein User, zeige Login-Screen
          } else if (loginData.user) {
            console.log("[AUTH] Dev Auto-Login erfolgreich!")
            const profile = await loadUserProfile(loginData.user)
            setUser(profile)
            setIsLoading(false)
            return
          }
        }
      }

      // Kein User eingeloggt
      setIsLoading(false)
    }

    let subscription: { unsubscribe: () => void } | null = null

    initializeAuth().then(() => {
      // Auth State Listener für Login/Logout
      const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === "SIGNED_IN" && session?.user) {
          setUser(await loadUserProfile(session.user))
        } else if (event === "SIGNED_OUT") {
          setUser(null)
        }
      })
      subscription = data.subscription
    })

    return () => {
      subscription?.unsubscribe()
    }
  }, [supabase])

  const logout = useCallback(async () => {
    await supabase.auth.signOut()
    setUser(null)
  }, [supabase])

  const hasRole = useCallback(
    (roles: UserRole | UserRole[]) => {
      const arr = Array.isArray(roles) ? roles : [roles]
      if (arr.includes("NoUser") && !user) return true
      return arr.includes(user?.role ?? "NoUser")
    },
    [user]
  )

  const refreshUser = useCallback(async () => {
    const { data } = await supabase.auth.getUser()
    if (data.user) {
      setUser(await loadUserProfile(data.user))
    } else {
      setUser(null)
    }
  }, [supabase])

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        role: user?.role ?? "NoUser",
        isLoading,
        hasRole,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
