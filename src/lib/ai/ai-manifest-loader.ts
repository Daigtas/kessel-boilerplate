/**
 * AI Manifest Loader
 *
 * Lädt das ai-manifest.json für Client- und Server-Komponenten.
 *
 * Das Manifest enthält ALLE KI-steuerbaren Komponenten der App,
 * unabhängig davon ob sie aktuell gerendert sind oder nicht.
 * Jede Komponente hat ein 'route' Feld, das angibt auf welcher
 * Seite sie zu finden ist.
 */

import { AIManifestSchema, type AIComponent } from "./ai-manifest.schema"

let cachedManifest: AIComponent[] | null = null

/**
 * Lädt das AI Manifest (Client-seitig via fetch)
 *
 * Cached das Ergebnis für Performance.
 */
export async function loadAIManifest(): Promise<AIComponent[]> {
  if (cachedManifest) {
    return cachedManifest
  }

  try {
    // Manifest liegt im Root, wird von Next.js als statische Datei serviert
    const response = await fetch("/ai-manifest.json", {
      cache: "force-cache",
    })
    if (!response.ok) {
      console.warn("[AIManifestLoader] Manifest nicht gefunden, verwende leeres Array")
      return []
    }
    const data = await response.json()
    const parsed = AIManifestSchema.safeParse(data)
    if (!parsed.success) {
      console.error("[AIManifestLoader] Invalid manifest format:", parsed.error)
      return []
    }
    cachedManifest = parsed.data.components
    return cachedManifest
  } catch (error) {
    console.error("[AIManifestLoader] Fehler beim Laden des Manifests:", error)
    return []
  }
}

/**
 * Lädt das AI Manifest Server-seitig (für API Routes)
 *
 * Importiert das JSON direkt - funktioniert in Node.js/Server-Umgebung.
 */
export async function loadAIManifestServer(): Promise<AIComponent[]> {
  try {
    // Dynamischer Import für Server-seitige Verwendung
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- Server-seitig erforderlich
    const manifest = require("../../../ai-manifest.json")
    const parsed = AIManifestSchema.safeParse(manifest)
    if (!parsed.success) {
      console.error("[AIManifestLoader] Invalid manifest format:", parsed.error)
      return []
    }
    return parsed.data.components
  } catch (error) {
    console.error("[AIManifestLoader] Fehler beim Server-seitigen Laden:", error)
    return []
  }
}

/**
 * Findet eine Komponente im Manifest anhand ihrer ID
 */
export async function findManifestComponent(id: string): Promise<AIComponent | undefined> {
  const manifest = await loadAIManifest()
  return manifest.find((c) => c.id === id)
}

/**
 * Findet eine Komponente Server-seitig
 */
export async function findManifestComponentServer(id: string): Promise<AIComponent | undefined> {
  const manifest = await loadAIManifestServer()
  return manifest.find((c) => c.id === id)
}

/**
 * Gibt alle Aktionen zurück, gruppiert nach Verfügbarkeit
 *
 * @param currentRoute - Die aktuelle Route des Users
 * @returns Objekt mit 'available' (auf aktueller Seite) und 'requiresNavigation' (andere Seiten)
 */
export async function getActionsForRoute(currentRoute: string): Promise<{
  available: AIComponent[]
  requiresNavigation: AIComponent[]
}> {
  const allComponents = await loadAIManifestServer()

  const available: AIComponent[] = []
  const requiresNavigation: AIComponent[] = []

  for (const component of allComponents) {
    const route = component.route ?? "global"

    if (route === "global" || route === currentRoute) {
      available.push(component)
    } else {
      requiresNavigation.push(component)
    }
  }

  return { available, requiresNavigation }
}
