/**
 * Konvertiert einen Label-String zu einem URL-Slug
 *
 * @example
 * labelToSlug("Design System") // "design-system"
 * labelToSlug("UI-Komponenten") // "ui-komponenten"
 */
export function labelToSlug(label: string): string {
  return label
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

/**
 * Findet einen Navigation-Item basierend auf der aktuellen Route
 *
 * @param pathname - Aktuelle Route (z.B. "/account/design-system/design-system")
 * @param navSections - Array von NavSection-Objekten
 * @returns NavItem | null
 */
import type { NavItem, NavSection } from "@/config/navigation"

export function findNavItemByPath(pathname: string, navSections: NavSection[]): NavItem | null {
  for (const section of navSections) {
    for (const item of section.items) {
      if (item.href === pathname) {
        return item
      }
      // Rekursiv in children suchen
      if (item.children) {
        const found = findNavItemByPath(pathname, [
          { id: `${item.id}-children`, items: item.children },
        ])
        if (found) return found
      }
    }
  }
  return null
}

/**
 * Generiert automatisch eine Route basierend auf einem Label und einem Base-Path
 *
 * @example
 * generateRouteFromLabel("Design System", "/account/design-system") // "/account/design-system/design-system"
 */
export function generateRouteFromLabel(label: string, basePath: string): string {
  const slug = labelToSlug(label)
  return `${basePath}/${slug}`
}

/**
 * Generiert einen Basis-Pfad aus einem Section-Titel
 *
 * @example
 * getSectionBasePath("APP-VERWALTUNG") // "/app-verwaltung"
 * getSectionBasePath("ÜBER DIE APP") // "/ueber-die-app"
 */
export function getSectionBasePath(sectionTitle: string): string {
  return `/${labelToSlug(sectionTitle)}`
}

/**
 * Baut eine Navigation-URL aus einem Section-Titel und einem Item-Label
 *
 * @example
 * buildNavHref("APP-VERWALTUNG", "Design System") // "/app-verwaltung/design-system"
 * buildNavHref("ÜBER DIE APP", "App-Wiki") // "/ueber-die-app/app-wiki"
 */
export function buildNavHref(sectionTitle: string, label: string): string {
  const basePath = getSectionBasePath(sectionTitle)
  return `${basePath}/${labelToSlug(label)}`
}

/**
 * Findet ein Navigation-Item anhand eines Slugs (letztes Segment der URL)
 *
 * @param slug - URL-Segment (z.B. "design-system", "rollen")
 * @param navSections - Array von NavSection-Objekten
 * @returns NavItem | null
 *
 * @example
 * findNavItemBySlug("rollen", navigationConfig) // NavItem mit label "Rollen"
 */
export function findNavItemBySlug(slug: string, navSections: NavSection[]): NavItem | null {
  for (const section of navSections) {
    for (const item of section.items) {
      // Prüfe direktes Item
      if (item.href) {
        const itemSlug = item.href.split("/").filter(Boolean).pop()
        if (itemSlug === slug) {
          return item
        }
      }
      // Prüfe children rekursiv
      if (item.children) {
        const found = findNavItemBySlug(slug, [{ id: `${item.id}-children`, items: item.children }])
        if (found) return found
      }
    }
  }
  return null
}

/**
 * Findet das Label für einen gegebenen Slug (Reverse-Lookup)
 *
 * @param slug - URL-Segment (z.B. "design-system", "rollen")
 * @param navSections - Array von NavSection-Objekten
 * @returns string | null - Das Label oder null wenn nicht gefunden
 *
 * @example
 * findLabelBySlug("rollen", navigationConfig) // "Rollen"
 */
export function findLabelBySlug(slug: string, navSections: NavSection[]): string | null {
  const item = findNavItemBySlug(slug, navSections)
  return item?.label ?? null
}
