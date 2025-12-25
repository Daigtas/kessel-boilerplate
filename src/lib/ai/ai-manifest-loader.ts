/**
 * AI Manifest Loader
 *
 * Lädt und cached das ai-manifest.json für Client-Komponenten.
 */

import { AIManifestSchema, type AIComponent } from "./ai-manifest.schema"

let cachedManifest: AIComponent[] | null = null

/**
 * Lädt das AI Manifest
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
 * Findet eine Komponente im Manifest anhand ihrer ID
 */
export async function findManifestComponent(id: string): Promise<AIComponent | undefined> {
  const manifest = await loadAIManifest()
  return manifest.find((c) => c.id === id)
}
