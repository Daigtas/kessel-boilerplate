import {
  Home,
  FolderOpen,
  FileText,
  User,
  Users,
  Shield,
  LogOut,
  BookOpen,
  Lightbulb,
  Code,
  Bug,
  Mail,
  Palette,
  Layout,
  Table,
  FolderTree,
  Activity,
  Paintbrush,
  Type,
  Shapes,
  Box,
  Database,
  type LucideIcon,
} from "lucide-react"

/**
 * Navigations-Item Interface
 */
export interface NavItem {
  /** Eindeutiger Identifier */
  id: string
  /** Anzeigename */
  label: string
  /** Icon-Komponente */
  icon: LucideIcon
  /** Route-Pfad */
  href?: string
  /** Untermenü-Items */
  children?: NavItem[]
  /** Erforderliche Rollen (RBAC) */
  requiredRoles?: string[]
  /** Ist ein Action-Button (z.B. Logout) */
  isAction?: boolean
}

/**
 * Navigations-Sektion Interface
 */
export interface NavSection {
  /** Eindeutiger Identifier */
  id: string
  /** Sektion-Titel (optional, wird nicht angezeigt wenn leer) */
  title?: string
  /** Items in dieser Sektion */
  items: NavItem[]
  /** Erforderliche Rollen für die gesamte Sektion */
  requiredRoles?: string[]
}

/**
 * App-Content Navigation (Hauptnavigation)
 *
 * Struktur:
 * - Section Title (nicht klickbar, nur Label)
 *   - Modul (Accordion mit Children)
 *     - Sub-Modul (Links)
 *
 * Navigation ist für alle sichtbar, aber geschützte Routen zeigen Login-Screen
 */
const appContentSection: NavSection = {
  id: "app-content",
  title: "App Content", // Section Title - nicht klickbar
  // Keine requiredRoles = für alle sichtbar (Navigation immer sichtbar)
  items: [
    // Modul 1 mit Sub-Modulen
    {
      id: "module-1",
      label: "Modul 1",
      icon: FolderOpen,
      children: [
        { id: "module-1-1", label: "Sub-Modul 1.1", icon: FileText, href: "/module-1/sub-1" },
        { id: "module-1-2", label: "Sub-Modul 1.2", icon: FileText, href: "/module-1/sub-2" },
        { id: "module-1-3", label: "Sub-Modul 1.3", icon: FileText, href: "/module-1/sub-3" },
      ],
    },
    // Modul 2 mit Sub-Modulen
    {
      id: "module-2",
      label: "Modul 2",
      icon: FolderOpen,
      children: [
        { id: "module-2-1", label: "Sub-Modul 2.1", icon: FileText, href: "/module-2/sub-1" },
        { id: "module-2-2", label: "Sub-Modul 2.2", icon: FileText, href: "/module-2/sub-2" },
        { id: "module-2-3", label: "Sub-Modul 2.3", icon: FileText, href: "/module-2/sub-3" },
      ],
    },
    // Modul 3 mit Sub-Modulen
    {
      id: "module-3",
      label: "Modul 3",
      icon: FolderOpen,
      children: [
        { id: "module-3-1", label: "Sub-Modul 3.1", icon: FileText, href: "/module-3/sub-1" },
        { id: "module-3-2", label: "Sub-Modul 3.2", icon: FileText, href: "/module-3/sub-2" },
        { id: "module-3-3", label: "Sub-Modul 3.3", icon: FileText, href: "/module-3/sub-3" },
      ],
    },
  ],
}

/**
 * About the App Navigation (Meta-Information)
 *
 * Oeffentliche Seiten: App-Wiki ist fuer alle sichtbar (NoUser, user, admin)
 * Andere About-Seiten erfordern Login (user, admin)
 */
const aboutSection: NavSection = {
  id: "about",
  title: "About the App", // Section Title - nicht klickbar
  items: [
    // Oeffentlich: App-Wiki fuer alle sichtbar
    {
      id: "about-wiki",
      label: "App-Wiki",
      icon: BookOpen,
      href: "/about/wiki",
      requiredRoles: ["NoUser", "user", "admin"], // Explizit oeffentlich
    },
    // Erfordern Login
    {
      id: "about-features",
      label: "Feature-Wishlist",
      icon: Lightbulb,
      href: "/about/features",
      requiredRoles: ["user", "admin"],
    },
    {
      id: "about-cocoding",
      label: "Co-Coding Request",
      icon: Code,
      href: "/about/co-coding",
      requiredRoles: ["user", "admin"],
    },
    {
      id: "about-bugs",
      label: "Bug-Report",
      icon: Bug,
      href: "/about/bugs",
      requiredRoles: ["user", "admin"],
    },
    {
      id: "about-impressum",
      label: "Impressum / Kontakt",
      icon: Mail,
      href: "/about/impressum",
      requiredRoles: ["NoUser", "user", "admin"], // Oeffentlich
    },
  ],
}

/**
 * Account Navigation (User-bezogen)
 *
 * Für alle sichtbar, damit Login-Button erreichbar ist
 */
const accountSection: NavSection = {
  id: "account",
  title: "Account", // Section Title - nicht klickbar
  // Keine requiredRoles = für alle sichtbar
  items: [
    {
      id: "account-profile",
      label: "User Details",
      icon: User,
      href: "/account/profile",
      requiredRoles: ["user", "admin"],
    },
    {
      id: "account-design-system",
      label: "Design System",
      icon: Palette,
      requiredRoles: ["admin"],
      children: [
        {
          id: "ds-theme",
          label: "Theme Management",
          icon: Palette,
          href: "/account/design-system/theme-management",
        },
        {
          id: "ds-colors",
          label: "Farben",
          icon: Paintbrush,
          href: "/account/design-system/colors",
        },
        {
          id: "ds-fonts",
          label: "Schriften",
          icon: Type,
          href: "/account/design-system/fonts",
        },
        {
          id: "ds-geometry",
          label: "Geometrie",
          icon: Shapes,
          href: "/account/design-system/geometry",
        },
        {
          id: "ds-components",
          label: "Komponenten",
          icon: Box,
          href: "/account/design-system/components",
        },
      ],
    },
    {
      id: "account-layout-templates",
      label: "Layout Templates",
      icon: Layout,
      requiredRoles: ["admin"],
      children: [
        {
          id: "lt-dashboard",
          label: "Dashboard",
          icon: Layout,
          href: "/account/layout-templates/dashboard",
        },
        {
          id: "lt-table",
          label: "Tabelle / Data",
          icon: Table,
          href: "/account/layout-templates/table-data",
        },
        {
          id: "lt-filebrowser",
          label: "File-Browser",
          icon: FolderTree,
          href: "/account/layout-templates/file-browser",
        },
        {
          id: "lt-blog",
          label: "Blog",
          icon: FileText,
          href: "/account/layout-templates/blog",
        },
      ],
    },
    {
      id: "account-app-status",
      label: "App-Status",
      icon: Activity,
      href: "/account/app-status",
      requiredRoles: ["admin"],
    },
    {
      id: "account-users",
      label: "Users",
      icon: Users,
      href: "/account/users",
      requiredRoles: ["admin"],
    },
    {
      id: "account-roles",
      label: "Rollen",
      icon: Shield,
      href: "/account/roles",
      requiredRoles: ["admin"],
    },
    {
      id: "admin-ai-datasources",
      label: "AI Datasources",
      icon: Database,
      href: "/admin/ai-datasources",
      requiredRoles: ["admin"],
    },
    {
      id: "account-logout",
      label: "Log out",
      icon: LogOut,
      isAction: true,
      requiredRoles: ["user", "admin"], // Nur sichtbar wenn eingeloggt
    },
  ],
}

/**
 * Vollständige Navigations-Konfiguration
 */
export const navigationConfig: NavSection[] = [appContentSection, aboutSection, accountSection]

/**
 * App-Metadata
 *
 * Der App-Name wird aus NEXT_PUBLIC_APP_NAME geladen oder aus dem Projektnamen abgeleitet.
 * Wird immer in Großbuchstaben angezeigt.
 */
function getAppName(): string {
  // NEXT_PUBLIC_* Variablen werden beim Build eingebettet und sind client-seitig verfügbar
  if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_APP_NAME) {
    return process.env.NEXT_PUBLIC_APP_NAME.toUpperCase()
  }

  // Fallback: Für lokale Entwicklung ohne gesetzte Variable
  // Versuche aus dem Verzeichnisnamen oder einem Standard abzuleiten
  // In Production sollte NEXT_PUBLIC_APP_NAME immer gesetzt sein
  return "KESSEL APP"
}

export const appConfig = {
  name: getAppName(),
  logo: Home,
} as const

/**
 * Hilfsfunktion: Findet ein Nav-Item anhand seiner ID
 */
export function findNavItem(sections: NavSection[], id: string): NavItem | undefined {
  for (const section of sections) {
    for (const item of section.items) {
      if (item.id === id) return item
      if (item.children) {
        const found = item.children.find((child) => child.id === id)
        if (found) return found
      }
    }
  }
  return undefined
}

/**
 * Hilfsfunktion: Findet ein Nav-Item anhand des Pfads
 */
export function findNavItemByHref(sections: NavSection[], href: string): NavItem | undefined {
  for (const section of sections) {
    for (const item of section.items) {
      if (item.href === href) return item
      if (item.children) {
        const found = item.children.find((child) => child.href === href)
        if (found) return found
      }
    }
  }
  return undefined
}

/**
 * Hilfsfunktion: Prüft ob ein Item für eine Rolle sichtbar ist
 */
export function isVisibleForRole(item: NavItem | NavSection, userRoles: string[]): boolean {
  // Spezialfall: Logout ist IMMER für eingeloggte User sichtbar (unabhängig von DB-Berechtigungen)
  // Logout ist eine grundlegende Funktion und sollte nicht durch Rollen-Berechtigungen blockiert werden
  if ("id" in item && item.id === "account-logout") {
    // Logout ist sichtbar wenn User eingeloggt ist (nicht "NoUser")
    return !userRoles.includes("NoUser")
  }

  // Wenn keine requiredRoles definiert sind, ist das Item immer sichtbar
  if (!item.requiredRoles || item.requiredRoles.length === 0) {
    return true
  }

  // Prüfe ob eine der erlaubten Rollen in userRoles enthalten ist
  const isVisible = item.requiredRoles.some((role) => userRoles.includes(role))

  // Debug-Log für Entwicklung
  if (process.env.NODE_ENV === "development" && !isVisible) {
    console.log(`[isVisibleForRole] Item "${item.id || "unknown"}" nicht sichtbar:`, {
      requiredRoles: item.requiredRoles,
      userRoles: userRoles,
      match: item.requiredRoles.some((role) => userRoles.includes(role)),
    })
  }

  return isVisible
}
