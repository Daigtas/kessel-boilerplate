/**
 * Media Provider Konfiguration
 *
 * Definiert verfügbare Image-Generierungs-Provider und deren Modelle
 */

import type { ProviderInfo } from "./types"

/**
 * Provider-Konfigurationen
 */
export const mediaProviders: Record<string, ProviderInfo> = {
  openrouter: {
    id: "openrouter",
    name: "OpenRouter",
    enabled: true, // Always enabled (default)
    models: {
      "flux-2": "black-forest-labs/flux.2-flex",
      "flux-2-pro": "black-forest-labs/flux.2-pro",
      "nano-banana-pro": "google/gemini-3-pro-image-preview", // Nano Banana Pro (aktuellstes)
      "nano-banana": "google/gemini-2.5-flash-image", // Nano Banana (vorherige Generation)
    },
    defaultModel: "nano-banana-pro", // Nano Banana Pro als Standard für Icons
  },
  fal: {
    id: "fal",
    name: "fal.ai",
    enabled: !!(process.env.FAL_API_KEY || process.env.FAL_KEY), // Enabled if API key present
    models: {
      // FLUX Modelle (Black Forest Labs)
      "flux-schnell": "fal-ai/flux/schnell", // Schnellstes, gut für Prototyping
      "flux-dev": "fal-ai/flux/dev", // 12B Parameter, hochqualitativ
      "flux-pro": "fal-ai/flux-pro", // Professionelle Qualität
      // Recraft V3 - SOTA für Vector Art und Brand Styles
      // WICHTIG: Korrekter Endpoint mit /v3/text-to-image
      "recraft-v3": "fal-ai/recraft/v3/text-to-image",
      // Stable Diffusion 3.5
      "sd-35-large": "fal-ai/stable-diffusion-v35-large",
      // Ideogram (wenn verfügbar)
      "ideogram-v2": "fal-ai/ideogram/v2",
    },
    defaultModel: "flux-schnell",
  },
}

/**
 * Gibt alle verfügbaren Provider zurück
 */
export function getAvailableProviders(): ProviderInfo[] {
  return Object.values(mediaProviders).filter((provider) => provider.enabled)
}

/**
 * Gibt einen Provider anhand seiner ID zurück
 */
export function getProvider(providerId: string): ProviderInfo | undefined {
  return mediaProviders[providerId]
}

/**
 * Prüft ob ein Provider verfügbar ist
 */
export function isProviderAvailable(providerId: string): boolean {
  const provider = mediaProviders[providerId]
  return provider !== undefined && provider.enabled
}
