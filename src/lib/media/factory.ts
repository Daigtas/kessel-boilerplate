/**
 * MediaService Factory
 *
 * Erstellt MediaService-Instanzen basierend auf Provider-ID
 */

import { FalMediaService } from "./fal-media"
import { OpenRouterMediaService } from "./openrouter-media"
import { isProviderAvailable } from "./config"
import type { MediaService } from "./types"

/**
 * Erstellt eine MediaService-Instanz für den angegebenen Provider
 *
 * @param providerId - Provider-ID ("openrouter" oder "fal")
 * @returns MediaService-Instanz
 * @throws Error wenn Provider nicht verfügbar oder nicht konfiguriert
 */
export function createMediaService(providerId: string): MediaService {
  if (!isProviderAvailable(providerId)) {
    throw new Error(`Provider "${providerId}" is not available or not enabled`)
  }

  switch (providerId) {
    case "openrouter": {
      const apiKey = process.env.OPENROUTER_API_KEY
      if (!apiKey) {
        throw new Error("OPENROUTER_API_KEY environment variable is required")
      }
      return new OpenRouterMediaService(apiKey)
    }

    case "fal": {
      const apiKey = process.env.FAL_API_KEY || process.env.FAL_KEY
      if (!apiKey) {
        throw new Error("FAL_API_KEY or FAL_KEY environment variable is required")
      }
      return new FalMediaService(apiKey)
    }

    default:
      throw new Error(`Unknown provider: ${providerId}`)
  }
}

/**
 * Re-export für bessere API
 */
export { getAvailableProviders, getProvider, isProviderAvailable } from "./config"
