"use client"

import { Fragment } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronRight, Home } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Breadcrumb Label Mappings
 *
 * Definiert lesbare Labels für Route-Segmente.
 * Kann erweitert werden für projektspezifische Pfade.
 */
const labelMappings: Record<string, string> = {
  // About
  about: "About the App",
  wiki: "App-Wiki",
  features: "Feature-Wishlist",
  "co-coding": "Co-Coding Request",
  bugs: "Bug-Report",
  impressum: "Impressum / Kontakt",
  // Account
  account: "Account",
  profile: "User Details",
  theme: "Personalisierung",
  payment: "Payment-Options",
  users: "Users",
  roles: "Rollen",
  // Content (Beispiel)
  content: "Content",
}

/**
 * Formatiert ein Route-Segment zu einem lesbaren Label.
 */
function formatSegment(segment: string): string {
  // Prüfe auf bekannte Mappings
  const mapped = labelMappings[segment.toLowerCase()]
  if (mapped) return mapped

  // Formatiere: kebab-case → Title Case
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
 */
function generateBreadcrumbs(pathname: string): BreadcrumbItem[] {
  // Root-Pfad
  if (pathname === "/") {
    return [{ label: "Home", href: "/", isLast: true }]
  }

  // Segmente extrahieren (ohne leere Strings)
  const segments = pathname.split("/").filter(Boolean)

  // Breadcrumb-Items generieren
  const items: BreadcrumbItem[] = [{ label: "Home", href: "/", isLast: false }]

  segments.forEach((segment, index) => {
    const href = "/" + segments.slice(0, index + 1).join("/")
    const isLast = index === segments.length - 1

    items.push({
      label: formatSegment(segment),
      href,
      isLast,
    })
  })

  // Letztes Item als "isLast" markieren
  if (items.length > 0) {
    items[items.length - 1].isLast = true
  }

  return items
}

/**
 * Breadcrumbs Props
 */
interface BreadcrumbsProps {
  /** Zusätzliche CSS-Klassen */
  className?: string
  /** Home-Icon anzeigen */
  showHomeIcon?: boolean
  /** Maximale Anzahl sichtbarer Items (Rest wird gekürzt) */
  maxItems?: number
}

/**
 * Breadcrumbs Komponente
 *
 * Generiert automatisch Breadcrumbs aus der aktuellen Route.
 * Spalte 2 (Explorer) ist transparent - nicht in Breadcrumbs abgebildet.
 *
 * @example
 * ```tsx
 * <Breadcrumbs />
 * // /account/theme → Home > Account > Personalisierung
 * ```
 */
export function Breadcrumbs({
  className,
  showHomeIcon = true,
  maxItems = 5,
}: BreadcrumbsProps): React.ReactElement {
  const pathname = usePathname()
  const items = generateBreadcrumbs(pathname)

  // Kürzen wenn zu viele Items
  let displayItems = items
  if (items.length > maxItems) {
    displayItems = [
      items[0], // Home
      { label: "...", href: "#", isLast: false },
      ...items.slice(-2), // Letzte 2 Items
    ]
  }

  return (
    <nav
      aria-label="Breadcrumb"
      className={cn(
        "bg-foreground text-background flex items-center gap-1 rounded-full px-3 py-1.5 text-sm",
        className
      )}
    >
      <ol className="flex items-center gap-1">
        {displayItems.map((item, index) => (
          <Fragment key={item.href + index}>
            {index > 0 && (
              <li aria-hidden="true">
                <ChevronRight className="text-background/70 size-4" />
              </li>
            )}
            <li>
              {item.isLast ? (
                <span className="text-background font-medium" aria-current="page">
                  {index === 0 && showHomeIcon ? <Home className="size-4" /> : item.label}
                </span>
              ) : item.label === "..." ? (
                <span className="text-background/70">...</span>
              ) : (
                <Link
                  href={item.href}
                  className="text-background/70 hover:text-background transition-colors"
                >
                  {index === 0 && showHomeIcon ? <Home className="size-4" /> : item.label}
                </Link>
              )}
            </li>
          </Fragment>
        ))}
      </ol>
    </nav>
  )
}
