"use client"

import Link from "next/link"

import { PageContent } from "@/components/shell"
import { useAuth } from "@/components/auth"
import { appConfig } from "@/config/navigation"

/**
 * Welcome-Seite (Home)
 *
 * Begrüßt den angemeldeten User und gibt Orientierung.
 */
export default function HomePage(): React.ReactElement {
  const { user, isLoading } = useAuth()

  // User-Name für die Begrüßung (Vorname oder Display-Name)
  // WICHTIG: Während isLoading immer "User" verwenden für konsistente SSR/Client Hydration
  const userName = isLoading
    ? "User"
    : user?.name?.split(" ")[0] || user?.email?.split("@")[0] || "User"

  return (
    <PageContent showBreadcrumbs={false}>
      {/* Zentrierungs-Container: vertikal + horizontal zentriert */}
      {/* suppressHydrationWarning: Browser MCP fügt data-cursor-ref Attribute hinzu */}
      <div
        className="flex min-h-full flex-col items-center justify-center py-16"
        suppressHydrationWarning
      >
        {/* Content-Block: linksbündiger Text mit begrenzter Breite */}
        <div className="w-full space-y-8 md:w-3/4 lg:w-2/3 xl:w-1/2">
          {/* Header Bereich */}
          <div className="space-y-2">
            <h2 className="text-foreground text-3xl font-bold tracking-tight">Lieber {userName}</h2>
            <p className="text-muted-foreground text-xl">Willkommen auf der B2B-App:</p>
          </div>

          {/* APP NAME - Riesig */}
          <h1 className="text-foreground text-6xl font-black tracking-tighter uppercase sm:text-8xl md:text-9xl">
            {appConfig.name.toUpperCase()}
          </h1>

          {/* Text Content */}
          <div className="prose prose-lg prose-gray dark:prose-invert">
            <p>
              Wenn du mehr über diese App wissen möchtest, dann klicke{" "}
              <Link
                href="/about/wiki"
                className="decoration-primary hover:text-primary font-medium underline underline-offset-4 transition-colors"
              >
                hier
              </Link>
              , um direkt zum App-Wiki zu gelangen.
            </p>

            <p>Oder nutze den App-Chat über den Floating Button unten rechts!</p>
            <p>
              Der App-Chat weiß ebenfalls alles und kann dir sogar die eine oder andere Aufgabe
              abnehmen.
            </p>
          </div>
        </div>
      </div>
    </PageContent>
  )
}
