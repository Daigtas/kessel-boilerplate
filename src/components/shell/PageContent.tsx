"use client"

import { type ReactNode } from "react"
import { MainScrollArea } from "@/components/ui/scroll-area"

import { FloatingBreadcrumbs } from "./FloatingBreadcrumbs"
import { FloatingPagination, FloatingNavigation } from "./FloatingPagination"
import { PageHeader } from "./PageHeader"

/**
 * PageContent Props
 */
interface PageContentProps {
  /** Hauptinhalt */
  children: ReactNode

  // === Legacy Props (Rückwärtskompatibilität) ===

  /** Seiten-Titel (optional, wird als H1 gerendert) */
  title?: string
  /** Seiten-Beschreibung (optional, wird unter Titel gerendert) */
  description?: string

  // === Header-Bereich (oben) ===

  /** Breadcrumbs anzeigen */
  showBreadcrumbs?: boolean

  // === Footer-Bereich (unten) ===

  /** Pagination anzeigen */
  pagination?: {
    currentPage: number
    totalPages: number
    onPageChange: (page: number) => void
    showFirstLast?: boolean
    showPageNumbers?: boolean
    position?: "left" | "center" | "right"
  }

  /** Einfache Navigation (Vor/Zurück) */
  navigation?: {
    onPrev?: () => void
    onNext?: () => void
    prevDisabled?: boolean
    nextDisabled?: boolean
    prevLabel?: string
    nextLabel?: string
    position?: "left" | "center" | "right"
  }

  /** Custom Footer-Content (schwebend unten links) */
  floatingFooterLeft?: ReactNode
  /** Custom Footer-Content (schwebend unten rechts) */
  floatingFooterRight?: ReactNode

  // === Layout ===

  /** Maximale Content-Breite (default: max-w-6xl) */
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "4xl" | "6xl" | "full"
  /** Padding für den Content */
  padding?: "none" | "sm" | "md" | "lg"
  /** Zusätzliche CSS-Klassen für den Content-Container */
  className?: string
}

/**
 * PageContent Komponente
 *
 * Wrapper für Seiten-Content mit schwebenden UI-Elementen.
 * Der Content scrollt frei, während Breadcrumbs, Actions und
 * Pagination als schwebende Pills darüber liegen.
 *
 * Layout-Konzept:
 * - Oben links: FloatingBreadcrumbs (Pill)
 * - Unten: FloatingPagination oder FloatingNavigation (Pill)
 * - Content: Scrollt darunter durch
 *
 * @example
 * ```tsx
 * // Standard-Seite mit Breadcrumbs und Assist-Actions
 * <PageContent>
 *   <h1>Meine Seite</h1>
 *   <p>Inhalt...</p>
 * </PageContent>
 *
 * // Mit Pagination
 * <PageContent
 *   pagination={{
 *     currentPage: 3,
 *     totalPages: 10,
 *     onPageChange: setPage
 *   }}
 * >
 *   <ArticleList />
 * </PageContent>
 *
 * // Mit Kapitel-Navigation
 * <PageContent
 *   navigation={{
 *     onPrev: () => router.push('/chapter/1'),
 *     onNext: () => router.push('/chapter/3'),
 *     prevLabel: "Kapitel 1",
 *     nextLabel: "Kapitel 3"
 *   }}
 * >
 *   <ChapterContent />
 * </PageContent>
 * ```
 */
export function PageContent({
  children,
  title,
  description,
  showBreadcrumbs = true,
  pagination,
  navigation,
  floatingFooterLeft,
  floatingFooterRight,
  maxWidth = "6xl",
  padding = "lg",
  className,
}: PageContentProps): React.ReactElement {
  const maxWidthClasses = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
    "4xl": "max-w-4xl",
    "6xl": "max-w-6xl",
    full: "max-w-full",
  }

  const paddingClasses = {
    none: "",
    sm: "p-4",
    md: "p-6",
    lg: "p-8",
  }

  // Top-Padding für schwebende Elemente (erhöht, um Kollisionen zu vermeiden)
  const topPadding = showBreadcrumbs ? "pt-24" : ""
  // Bottom-Padding für schwebende Elemente
  const bottomPadding =
    pagination || navigation || floatingFooterLeft || floatingFooterRight ? "pb-16" : ""

  return (
    <div className="relative flex h-full flex-col">
      {/* Schwebende Elemente - Oben */}
      {showBreadcrumbs && <FloatingBreadcrumbs />}

      {/* Scrollbarer Content */}
      <MainScrollArea className="flex-1">
        <main
          className={`mx-auto ${maxWidthClasses[maxWidth]} ${paddingClasses[padding]} ${topPadding} ${bottomPadding} ${className ?? ""}`}
        >
          {/* Legacy: Titel und Beschreibung */}
          {title && <PageHeader title={title} description={description} className="mb-8" />}

          {/* Content */}
          {children}
        </main>
      </MainScrollArea>

      {/* Schwebende Elemente - Unten */}
      {pagination && (
        <FloatingPagination
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          onPageChange={pagination.onPageChange}
          showFirstLast={pagination.showFirstLast}
          showPageNumbers={pagination.showPageNumbers}
          position={pagination.position}
        />
      )}

      {navigation && !pagination && (
        <FloatingNavigation
          onPrev={navigation.onPrev}
          onNext={navigation.onNext}
          prevDisabled={navigation.prevDisabled}
          nextDisabled={navigation.nextDisabled}
          prevLabel={navigation.prevLabel}
          nextLabel={navigation.nextLabel}
          position={navigation.position}
        />
      )}

      {/* Custom Footer Elements */}
      {floatingFooterLeft && (
        <div className="bg-foreground text-background absolute bottom-4 left-4 z-20 rounded-full px-3 py-1 text-xs">
          {floatingFooterLeft}
        </div>
      )}
      {floatingFooterRight && (
        <div className="bg-foreground text-background absolute right-4 bottom-4 z-20 rounded-full px-3 py-1 text-xs">
          {floatingFooterRight}
        </div>
      )}
    </div>
  )
}

/**
 * Legacy PageContent für Rückwärtskompatibilität
 *
 * @deprecated Verwende stattdessen PageContent ohne title/description Props.
 * Der Seitentitel sollte direkt im children-Bereich definiert werden.
 */
export function LegacyPageContent({
  title,
  description,
  children,
  footerLeft,
  footerRight,
  hideFooter = false,
}: {
  title: string
  description?: string
  children: ReactNode
  footerLeft?: ReactNode
  footerRight?: ReactNode
  hideFooter?: boolean
}): React.ReactElement {
  return (
    <PageContent
      floatingFooterLeft={!hideFooter ? footerLeft : undefined}
      floatingFooterRight={!hideFooter ? footerRight : undefined}
    >
      {/* Page Header */}
      <PageHeader title={title} description={description} className="mb-8" />

      {/* Page Content */}
      {children}
    </PageContent>
  )
}
