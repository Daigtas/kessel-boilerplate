import {
  Home,
  FolderOpen,
  FileText,
  User,
  Users,
  Shield,
  ShieldCheck,
  LogOut,
  BookOpen,
  Lightbulb,
  Bug,
  Mail,
  Palette,
  Activity,
  Paintbrush,
  Box,
  Database,
  MessageSquare,
  ShoppingCart,
  Languages,
  type LucideIcon,
} from "lucide-react"

import { buildNavHref } from "@/lib/navigation/utils"

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
  /** Immer sichtbar - kann nicht über Rollen deaktiviert werden (z.B. Impressum, Logout) */
  alwaysVisible?: boolean
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
 * Section-Titel als Konstanten (für dynamische Route-Generierung)
 */
const SECTION_TITLES = {
  APP_CONTENT: "App Content",
  ABOUT: "ÜBER DIE APP",
  ADMIN: "APP-VERWALTUNG",
  USER_MENU: "BENUTZER-MENÜ",
} as const

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
  title: SECTION_TITLES.APP_CONTENT, // Section Title - nicht klickbar
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
 * Über die App Navigation (Meta-Information)
 *
 * Oeffentliche Seiten: App-Wiki ist fuer alle sichtbar (NoUser, user, admin)
 * Andere About-Seiten erfordern Login (user, admin)
 */
const aboutSection: NavSection = {
  id: "about",
  title: SECTION_TITLES.ABOUT, // Section Title - nicht klickbar
  items: [
    // Oeffentlich: App-Wiki fuer alle sichtbar
    {
      id: "about-wiki",
      label: "App-Wiki",
      icon: BookOpen,
      href: buildNavHref(SECTION_TITLES.ABOUT, "App-Wiki"),
      requiredRoles: ["NoUser", "user", "admin"], // Explizit oeffentlich
    },
    // Erfordern Login
    {
      id: "about-features",
      label: "Feature-Wishlist",
      icon: Lightbulb,
      href: buildNavHref(SECTION_TITLES.ABOUT, "Feature-Wishlist"),
      requiredRoles: ["user", "admin"],
    },
    {
      id: "about-bugs",
      label: "Bug-Report",
      icon: Bug,
      href: buildNavHref(SECTION_TITLES.ABOUT, "Bug-Report"),
      requiredRoles: ["user", "admin"],
    },
    {
      id: "about-impressum",
      label: "Impressum",
      icon: Mail,
      href: buildNavHref(SECTION_TITLES.ABOUT, "Impressum"),
      requiredRoles: ["NoUser", "user", "admin"], // Oeffentlich
      alwaysVisible: true, // Rechtlich erforderlich - kann nicht deaktiviert werden
    },
    {
      id: "about-datenschutz",
      label: "Datenschutzerklärung",
      icon: ShieldCheck,
      href: buildNavHref(SECTION_TITLES.ABOUT, "Datenschutzerklärung"),
      requiredRoles: ["NoUser", "user", "admin"], // Oeffentlich
      alwaysVisible: true, // Rechtlich erforderlich - kann nicht deaktiviert werden
    },
  ],
}

/**
 * App-Verwaltung Navigation (Admin-only)
 *
 * Verwaltungsfunktionen für Administratoren
 */
const adminSection: NavSection = {
  id: "admin",
  title: SECTION_TITLES.ADMIN, // Section Title - nicht klickbar
  requiredRoles: ["admin"], // Nur für Admin sichtbar
  items: [
    {
      id: "admin-dashboard",
      label: "App-Dashboard",
      icon: Activity,
      href: buildNavHref(SECTION_TITLES.ADMIN, "App-Dashboard"),
      requiredRoles: ["admin"],
    },
    {
      id: "admin-datasources",
      label: "Datenquellen",
      icon: Database,
      href: buildNavHref(SECTION_TITLES.ADMIN, "Datenquellen"),
      requiredRoles: ["admin"],
    },
    {
      id: "admin-roles",
      label: "Rollen",
      icon: Shield,
      href: buildNavHref(SECTION_TITLES.ADMIN, "Rollen"),
      requiredRoles: ["admin"],
    },
    {
      id: "admin-users",
      label: "Benutzer",
      icon: Users,
      href: buildNavHref(SECTION_TITLES.ADMIN, "Benutzer"),
      requiredRoles: ["admin"],
    },
    {
      id: "admin-chat-logs",
      label: "KI-Chat-Logs",
      icon: MessageSquare,
      href: buildNavHref(SECTION_TITLES.ADMIN, "KI-Chat-Logs"),
      requiredRoles: ["admin"],
    },
    {
      id: "admin-theme-manager",
      label: "Theme Manager",
      icon: Palette,
      href: buildNavHref(SECTION_TITLES.ADMIN, "Theme Manager"),
      requiredRoles: ["admin"],
    },
    {
      id: "admin-design-settings",
      label: "Design System",
      icon: Paintbrush,
      href: buildNavHref(SECTION_TITLES.ADMIN, "Design System"),
      requiredRoles: ["admin"],
    },
    {
      id: "admin-components",
      label: "UI-Komponenten",
      icon: Box,
      href: buildNavHref(SECTION_TITLES.ADMIN, "UI-Komponenten"),
      requiredRoles: ["admin"],
    },
  ],
}

/**
 * User-Menü Navigation (Avatar-Dropdown)
 *
 * Wird separat vom Hauptmenü verwendet, aber über dieselbe Rollen-Verwaltung gesteuert.
 */
const userMenuSection: NavSection = {
  id: "user-menu",
  title: SECTION_TITLES.USER_MENU,
  items: [
    {
      id: "user-profile",
      label: "Profil",
      icon: User,
      href: buildNavHref(SECTION_TITLES.USER_MENU, "Profil"),
      requiredRoles: ["user", "admin"], // Alle eingeloggten User
      alwaysVisible: true, // Immer sichtbar - Grundfunktion
    },
    {
      id: "user-cart",
      label: "Warenkorb",
      icon: ShoppingCart,
      href: buildNavHref(SECTION_TITLES.USER_MENU, "Warenkorb"),
      requiredRoles: ["user", "admin"], // Kann für bestimmte Rollen deaktiviert werden
    },
    {
      id: "user-display-settings",
      label: "Anzeige-Einstellungen",
      icon: Palette,
      href: buildNavHref(SECTION_TITLES.ADMIN, "Theme Manager"), // Link zu Admin Theme Manager
      requiredRoles: ["user", "admin"], // Alle können Theme wechseln
    },
    {
      id: "user-language",
      label: "Sprache",
      icon: Languages,
      href: buildNavHref(SECTION_TITLES.USER_MENU, "Sprache"),
      requiredRoles: ["user", "admin"], // Alle können Sprache wechseln
    },
    {
      id: "user-logout",
      label: "Abmelden",
      icon: LogOut,
      isAction: true,
      requiredRoles: ["user", "admin"], // Immer erlaubt für eingeloggte User
      alwaysVisible: true, // Immer sichtbar - User muss sich ausloggen können
    },
  ],
}

/**
 * Vollständige Navigations-Konfiguration (Sidebar)
 */
export const navigationConfig: NavSection[] = [appContentSection, aboutSection, adminSection]

/**
 * User-Menü Konfiguration (Avatar-Dropdown)
 */
export const userMenuConfig: NavSection = userMenuSection

/**
 * Alle Konfigurationen für Rollen-Verwaltung
 * Enthält sowohl Sidebar als auch User-Menü
 */
export const allNavigationConfig: NavSection[] = [
  appContentSection,
  aboutSection,
  adminSection,
  userMenuSection,
]

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
