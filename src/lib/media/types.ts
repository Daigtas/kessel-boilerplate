/**
 * MediaService Types und Interfaces
 *
 * Abstraktion für Image-Generierungs-Provider (OpenRouter, fal.ai)
 */

/**
 * Generiertes Bild mit Metadaten
 */
export interface GeneratedImage {
  /** Base64-encoded Bilddaten (PNG) */
  base64: string
  /** Optional: URL falls bereits hochgeladen */
  url?: string
  /** MIME-Type (z.B. "image/png") */
  mimeType: string
  /** Bild-Dimensionen */
  width: number
  height: number
}

/**
 * Provider-Informationen
 */
export interface ProviderInfo {
  /** Provider-ID (z.B. "openrouter", "fal") */
  id: string
  /** Anzeigename */
  name: string
  /** Ist Provider aktiviert/verfügbar */
  enabled: boolean
  /** Verfügbare Modelle */
  models: Record<string, string>
  /** Standard-Modell */
  defaultModel: string
}

/**
 * Image-Generierungs-Optionen
 */
export interface ImageGenerationOptions {
  /** Modell-ID (z.B. "flux-2", "flux-pro") */
  model?: string
  /** Bildgröße (default: 512x512) */
  size?: {
    width: number
    height: number
  }
  /** Anzahl der Varianten (1-4, default: 1) */
  variants?: number
  /** Zusätzliche Prompt-Parameter */
  parameters?: Record<string, unknown>
}

/**
 * MediaService Interface
 *
 * Abstraktion für Image-Generierungs-Provider
 */
export interface MediaService {
  /**
   * Generiert ein oder mehrere Bilder basierend auf einem Prompt
   *
   * @param prompt - Text-Prompt für Bildgenerierung
   * @param options - Optionale Generierungs-Parameter
   * @returns Array von generierten Bildern
   */
  generateImage(prompt: string, options?: ImageGenerationOptions): Promise<GeneratedImage[]>

  /**
   * Gibt Provider-Informationen zurück
   *
   * @returns ProviderInfo mit verfügbaren Modellen
   */
  getProviderInfo(): ProviderInfo
}
