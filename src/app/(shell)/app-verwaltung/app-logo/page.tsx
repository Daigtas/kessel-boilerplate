"use client"

import { PageContent, PageHeader } from "@/components/shell"
import { useCurrentNavItem } from "@/lib/navigation/use-current-nav-item"
import { AppIconGenerator } from "@/components/admin/AppIconGenerator"

/**
 * App-Logo Generator Seite
 *
 * Ermöglicht das Erstellen und Verwalten von App-Logos.
 */
export default function AppLogoPage(): React.ReactElement {
  const currentNavItem = useCurrentNavItem()
  const pageTitle = currentNavItem?.label ?? "App-Logo"

  return (
    <PageContent>
      <PageHeader
        title={pageTitle}
        description="Erstelle und verwalte App-Logos für verschiedene Plattformen und Größen."
      />
      <div className="space-y-6">
        <AppIconGenerator />
      </div>
    </PageContent>
  )
}
