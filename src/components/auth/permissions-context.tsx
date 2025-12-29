"use client"

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"
import { createClient } from "@/utils/supabase/client"
import { allNavigationConfig, type NavItem, type NavSection } from "@/config/navigation"
import type { UserRole } from "./auth-context"
import { useAuth } from "./auth-context"

/** Permission für ein Modul - jetzt mit dynamischen Rollen */
interface ModulePermission {
  moduleId: string
  roleAccess: Map<string, boolean> // Map<roleName, hasAccess>
}

/** Permissions Context Interface */
interface PermissionsContextValue {
  /** Prüft ob ein Modul für eine Rolle sichtbar ist */
  canAccess: (moduleId: string, userRole: string) => boolean
  /** Ob Permissions geladen wurden */
  isLoaded: boolean
  /** Permissions neu laden (z.B. nach Änderung im Admin) */
  reload: () => Promise<void>
}

const PermissionsContext = createContext<PermissionsContextValue | null>(null)

/** Hook zum Zugriff auf Permissions */
export function usePermissions(): PermissionsContextValue {
  const context = useContext(PermissionsContext)
  if (!context) {
    throw new Error("usePermissions must be used within PermissionsProvider")
  }
  return context
}

/**
 * Generiert Fallback-Permissions aus der statischen Navigation Config.
 * Nutzt Standard-Rollen: admin, user, superuser
 */
function generateFallbackPermissions(): Map<string, ModulePermission> {
  const perms = new Map<string, ModulePermission>()

  const processItem = (item: NavItem | NavSection) => {
    // "account-login" überspringen, da es nicht in der Permissions-Matrix verwaltet wird
    if (item.id === "account-login") return

    const roles = item.requiredRoles || []
    const roleAccess = new Map<string, boolean>()

    // Standard-Rollen setzen
    roleAccess.set("admin", roles.length === 0 || roles.includes("admin"))
    roleAccess.set("user", roles.length === 0 || roles.includes("user"))
    roleAccess.set(
      "superuser",
      roles.length === 0 || roles.includes("superuser") || roles.includes("admin")
    ) // Superuser bekommt Admin-Rechte als Fallback

    perms.set(item.id, {
      moduleId: item.id,
      roleAccess,
    })

    // Children verarbeiten (nur bei NavItem)
    if ("children" in item && item.children) {
      item.children.forEach(processItem)
    }

    // Items verarbeiten (nur bei NavSection)
    if ("items" in item && item.items) {
      item.items.forEach(processItem)
    }
  }

  allNavigationConfig.forEach(processItem)
  return perms
}

/**
 * PermissionsProvider - Lädt und stellt Modul-Berechtigungen bereit.
 *
 * - Lädt Berechtigungen aus role_permissions Tabelle
 * - Fallback auf statische Navigation Config wenn DB leer
 * - Stellt canAccess() Funktion bereit
 */
export function PermissionsProvider({ children }: { children: ReactNode }): React.ReactElement {
  const [permissions, setPermissions] = useState<Map<string, ModulePermission>>(
    generateFallbackPermissions
  )
  const [isLoaded, setIsLoaded] = useState(false)
  const supabase = createClient()

  // WICHTIG: Wir hören auf Auth-Änderungen um Permissions neu zu laden
  const { user, isAuthenticated } = useAuth()

  const loadPermissions = useCallback(async () => {
    try {
      // Lade Berechtigungen aus Junction-Tabelle mit JOIN zu roles
      const { data: accessData, error: accessError } = await supabase.from("module_role_access")
        .select(`
          module_id,
          has_access,
          roles:role_id (
            name
          )
        `)

      if (accessError) {
        // Bei Fehler: Fallback auf statische Config
        console.warn("[PermissionsProvider] DB-Fehler, nutze Fallback:", accessError.message)
        setPermissions(generateFallbackPermissions())
        return
      }

      // Starte mit Fallback (alle Module aus Navigation)
      const fallbackPerms = generateFallbackPermissions()
      const mergedPerms = new Map<string, ModulePermission>()

      // Initialisiere alle Module aus Fallback
      fallbackPerms.forEach((perm, moduleId) => {
        mergedPerms.set(moduleId, {
          moduleId,
          roleAccess: new Map(perm.roleAccess),
        })
      })

      // Wenn DB Daten hat, überschreibe mit DB-Werten
      if (accessData && accessData.length > 0) {
        accessData.forEach((row) => {
          const moduleId = row.module_id
          // roles kann ein Array oder ein einzelnes Objekt sein (je nach JOIN)
          const rolesData = Array.isArray(row.roles) ? row.roles[0] : row.roles
          const roleName = (rolesData as { name: string })?.name
          const hasAccess = row.has_access ?? true

          if (!moduleId || !roleName) return

          // Hole oder erstelle Permission für dieses Modul
          let perm = mergedPerms.get(moduleId)
          if (!perm) {
            perm = {
              moduleId,
              roleAccess: new Map(),
            }
            mergedPerms.set(moduleId, perm)
          }

          // Setze Berechtigung für diese Rolle
          perm.roleAccess.set(roleName, hasAccess)
        })
      }

      setPermissions(mergedPerms)
    } catch (err) {
      console.error("[PermissionsProvider] Fehler:", err)
      setPermissions(generateFallbackPermissions())
    } finally {
      setIsLoaded(true)
    }
  }, [supabase])

  // Laden bei Mount UND bei User-Wechsel (z.B. Logout → Login als anderer User)
  useEffect(() => {
    // Reset isLoaded bei User-Wechsel für korrektes Loading-Feedback
    setIsLoaded(false)
    loadPermissions()
  }, [loadPermissions, user?.id, isAuthenticated])

  /**
   * Prüft ob ein Modul 'alwaysVisible' ist (kann nicht über Rollen deaktiviert werden)
   */
  const isAlwaysVisible = useCallback((moduleId: string): boolean => {
    // Durchsuche alle Sections und Items nach dem Modul
    for (const section of allNavigationConfig) {
      for (const item of section.items) {
        if (item.id === moduleId && item.alwaysVisible) {
          return true
        }
        // Prüfe auch Children
        if (item.children) {
          for (const child of item.children) {
            if (child.id === moduleId && child.alwaysVisible) {
              return true
            }
          }
        }
      }
    }
    return false
  }, [])

  /**
   * Prüft ob ein Modul für eine Rolle sichtbar ist.
   *
   * Spezialfälle:
   * - Admin: Hat IMMER Zugriff auf alles (Sicherheitsnetz)
   * - NoUser: Navigation ist nicht sichtbar (werden zu Login redirected) → immer false
   * - alwaysVisible: Immer sichtbar für alle eingeloggten User (z.B. Impressum, Logout, Profil)
   * - Unbekannte Module: Fallback auf statische Config
   */
  const canAccess = useCallback(
    (moduleId: string, userRole: UserRole): boolean => {
      // WICHTIG: Admins haben IMMER Zugriff auf alles (Sicherheitsnetz)
      // Verhindert, dass sich Admins selbst aussperren
      if (userRole === "admin") {
        return true
      }

      // NoUser sehen keine Navigation (werden zu Login redirected)
      if (userRole === "NoUser") {
        return false
      }

      // Spezialfall: alwaysVisible Items sind IMMER für eingeloggte User sichtbar
      if (isAlwaysVisible(moduleId)) {
        return true
      }

      const perm = permissions.get(moduleId)

      // Modul sollte immer in permissions sein (durch Merge mit Fallback)
      if (!perm) {
        // Sollte nicht passieren, aber Fallback für Sicherheit
        console.warn(`[PermissionsProvider] Modul "${moduleId}" nicht gefunden, nutze Fallback`)
        const fallback = generateFallbackPermissions().get(moduleId)
        if (!fallback) {
          // Komplett unbekanntes Modul: für alle erlaubt (permissiv)
          return true
        }
        // Nutze Fallback
        return fallback.roleAccess.get(userRole) ?? false
      }

      // Normale Prüfung: Hole Berechtigung für diese Rolle
      const hasAccess = perm.roleAccess.get(userRole) ?? false

      // Debug-Log für Entwicklung
      if (process.env.NODE_ENV === "development" && !hasAccess) {
        console.log(`[PermissionsProvider] Modul "${moduleId}" nicht sichtbar für ${userRole}:`, {
          roleAccess: Object.fromEntries(perm.roleAccess),
          userRole,
        })
      }

      return hasAccess
    },
    [permissions, isAlwaysVisible]
  )

  return (
    <PermissionsContext.Provider value={{ canAccess, isLoaded, reload: loadPermissions }}>
      {children}
    </PermissionsContext.Provider>
  )
}
