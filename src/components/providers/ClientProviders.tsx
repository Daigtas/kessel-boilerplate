"use client"

import { type ReactNode } from "react"
import { AuthProvider, PermissionsProvider } from "@/components/auth"
import { AIRegistryProvider } from "@/lib/ai/ai-registry-context"
import { ThemeSyncProvider } from "@/hooks/use-theme-sync-with-user"

/**
 * Client-seitige Provider für die gesamte App.
 *
 * Kombiniert alle Client-Provider an einem Ort:
 * - AuthProvider für Authentifizierung
 * - PermissionsProvider für Modul-Berechtigungen (aus DB)
 * - ThemeSyncProvider für Theme-Persistenz (localStorage ↔ DB)
 * - AIRegistryProvider für KI-steuerbare Komponenten
 */
export function ClientProviders({ children }: { children: ReactNode }): React.ReactElement {
  return (
    <AuthProvider>
      <PermissionsProvider>
        <ThemeSyncProvider>
          <AIRegistryProvider>{children}</AIRegistryProvider>
        </ThemeSyncProvider>
      </PermissionsProvider>
    </AuthProvider>
  )
}
