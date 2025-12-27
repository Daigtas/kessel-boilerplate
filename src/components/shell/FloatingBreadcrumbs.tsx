"use client"

import { Fragment } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronRight, Home } from "lucide-react"

import { cn } from "@/lib/utils"
import { navigationConfig, findNavItemByHref } from "@/config/navigation"

/**
 * Fallback Label Mappings für Segmente ohne Navigation-Eintrag
 */
const fallbackMappings: Record<string, string> = {
  about: "About the App",
  account: "Account",
  content: "Content",
}

/**
 * Extrahiert den Parent-Pfad aus einem Child-Pfad.
 * z.B. "/content/3/1" -> "/content/3"
 */
function getParentPath(childHref: string): string {
  const segments = childHref.split("/").filter(Boolean)
  segments.pop() // Entferne letztes Segment
  return "/" + segments.join("/")
}

/**
 * Findet das Label für einen Pfad aus der Navigation-Konfiguration.
 * Sucht sowohl direkte Matches als auch Parent-Elemente (Accordions).
 */
function findLabelFromNavigation(href: string): string | undefined {
  // Direkter Match für Items mit href
  const navItem = findNavItemByHref(navigationConfig, href)
  if (navItem?.label) return navItem.label

  // Suche Parent-Element (Accordion), dessen Children diesen Pfad als DIREKTEN Parent haben
  // z.B. href="/content/3" sollte "Menüpunkt 3" finden, wenn Children "/content/3/1" haben
  for (const section of navigationConfig) {
    for (const item of section.items) {
      if (item.children) {
        // Prüfe ob eines der Children diesen Pfad als direkten Parent hat
        const matchingChild = item.children.find((child) => {
          if (!child.href) return false
          // Der Parent-Pfad des Children muss exakt dem href entsprechen
          return getParentPath(child.href) === href
        })
        if (matchingChild) {
          return item.label
        }
      }
    }
  }

  return undefined
}

/**
 * Formatiert ein Route-Segment zu einem lesbaren Label.
 * Priorität:
 * 1. Navigation-Konfiguration (exakter Pfad-Match)
 * 2. Fallback-Mapping (für Parent-Segmente wie "about", "account")
 * 3. Automatische Formatierung (Capitalize, Bindestriche zu Leerzeichen)
 */
function formatSegment(segment: string, fullHref: string): string {
  // 1. Versuche Navigation-Konfiguration
  const navLabel = findLabelFromNavigation(fullHref)
  if (navLabel) return navLabel

  // 2. Versuche Fallback-Mapping
  const fallback = fallbackMappings[segment.toLowerCase()]
  if (fallback) return fallback

  // 3. Automatische Formatierung
  return segment
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

/**
 * Breadcrumb Item Interface
 */
interface BreadcrumbItem {
  label: string
  href: string
  isLast: boolean
}

/**
 * Generiert Breadcrumb-Items aus dem aktuellen Pfad.
 * Verwendet die Navigation-Konfiguration für korrekte Labels.
 */
function generateBreadcrumbs(pathname: string): BreadcrumbItem[] {
  if (pathname === "/") {
    return [{ label: "Home", href: "/", isLast: true }]
  }

  const segments = pathname.split("/").filter(Boolean)
  const items: BreadcrumbItem[] = [{ label: "Home", href: "/", isLast: false }]

  segments.forEach((segment, index) => {
    const href = "/" + segments.slice(0, index + 1).join("/")
    const isLast = index === segments.length - 1

    items.push({
      label: formatSegment(segment, href),
      href,
      isLast,
    })
  })

  if (items.length > 0) {
    items[items.length - 1].isLast = true
  }

  return items
}

/**
 * FloatingBreadcrumbs Props
 */
interface FloatingBreadcrumbsProps {
  /** Zusätzliche CSS-Klassen */
  className?: string
  /** Home-Icon anzeigen */
  showHomeIcon?: boolean
  /** Maximale Anzahl sichtbarer Items */
  maxItems?: number
}

/**
 * FloatingBreadcrumbs Komponente
 *
 * Schwebende Breadcrumbs für die Main Area mit Glassmorphism-Effekt.
 * Positioniert sich oben links und schwebt über dem Content.
 *
 * Features:
 * - Pill-Form mit Glassmorphism-Effekt
 * - Optional: Navbar-Toggle Button integriert
 * - Schwebt über scrollbarem Content
 *
 * @example
 * ```tsx
 * <FloatingBreadcrumbs showNavbarToggle />
 * ```
 */
export function FloatingBreadcrumbs({
  className,
  showHomeIcon = true,
  maxItems = 5,
}: FloatingBreadcrumbsProps): React.ReactElement {
  const pathname = usePathname()
  const items = generateBreadcrumbs(pathname)

  // Kürzen wenn zu viele Items
  let displayItems = items
  if (items.length > maxItems) {
    displayItems = [items[0], { label: "...", href: "#", isLast: false }, ...items.slice(-2)]
  }

  return (
    <div
      className={cn(
        // Position: Schwebt oben links
        "absolute top-4 left-4 z-20",
        // Glassmorphism: Semi-transparenter Hintergrund mit Blur, Pillenform (invertiert)
        "bg-foreground/80 text-background flex h-8 items-center gap-1 rounded-full px-3 backdrop-blur-sm",
        className
      )}
    >
      {/* Breadcrumbs */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm">
        <ol className="flex items-center gap-1">
          {displayItems.map((item, index) => (
            <Fragment key={item.href + index}>
              {index > 0 && (
                <li aria-hidden="true">
                  <ChevronRight className="size-3 opacity-70" />
                </li>
              )}
              <li>
                {item.isLast ? (
                  <span className="font-medium" aria-current="page">
                    {index === 0 && showHomeIcon ? <Home className="size-3" /> : item.label}
                  </span>
                ) : item.label === "..." ? (
                  <span className="opacity-70">...</span>
                ) : (
                  <Link
                    href={item.href}
                    className="opacity-70 transition-opacity hover:opacity-100"
                  >
                    {index === 0 && showHomeIcon ? <Home className="size-3" /> : item.label}
                  </Link>
                )}
              </li>
            </Fragment>
          ))}
        </ol>
      </nav>
    </div>
  )
}
