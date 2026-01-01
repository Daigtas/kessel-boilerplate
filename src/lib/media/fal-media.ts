/**
 * fal.ai MediaService Implementation
 *
 * Nutzt fal.ai API für schnelle Image-Generierung (FLUX Pro, FLUX Schnell, Recraft V3)
 */

import type { GeneratedImage, ImageGenerationOptions, MediaService, ProviderInfo } from "./types"
import { getProvider } from "./config"

/**
 * fal.ai MediaService
 */
export class FalMediaService implements MediaService {
  private apiKey: string
  private baseURL = "https://fal.run"
  private providerInfo: ProviderInfo

  constructor(apiKey?: string) {
    if (!apiKey) {
      throw new Error("FAL_API_KEY is required for FalMediaService")
    }
    this.apiKey = apiKey
    const provider = getProvider("fal")
    if (!provider) {
      throw new Error("fal.ai provider not configured")
    }
    this.providerInfo = provider
  }

  /**
   * Generiert Bilder über fal.ai API
   *
   * fal.ai verwendet REST-API mit speziellen Endpoints pro Modell
   */
  async generateImage(prompt: string, options?: ImageGenerationOptions): Promise<GeneratedImage[]> {
    const requestedModel = options?.model || this.providerInfo.defaultModel
    const variants = options?.variants || 1
    const size = options?.size || { width: 512, height: 512 }

    // Prüfe ob das angeforderte Modell für diesen Provider existiert
    const model = this.providerInfo.models[requestedModel]
      ? requestedModel
      : this.providerInfo.defaultModel

    const modelEndpoint = this.providerInfo.models[model]

    if (!modelEndpoint) {
      throw new Error(
        `Model "${requestedModel}" not found for fal.ai. Available: ${Object.keys(this.providerInfo.models).join(", ")}`
      )
    }

    // Modell-spezifische Parameter erkennen
    const isRecraftModel = modelEndpoint.includes("recraft")

    // Einfacher Ansatz: Prompt so verwenden wie er ist, nur minimale technische Bereinigung
    // Die Modelle sollten selbst in der Lage sein, einfache geometrische Formen zu generieren
    let optimizedPrompt = prompt
      // Nur wirklich störende technische Meta-Anweisungen entfernen
      .replace(/\[.*?\]/g, "") // Entferne [square 1:1] etc.
      .replace(/\s+/g, " ")
      .trim()

    // Für Recraft V3: Noch einfacher - nur das Konzept, keine Style-Anweisungen
    if (isRecraftModel) {
      // Recraft V3 mit digital_illustration Style sollte selbst wissen, wie Icons aussehen
      // Wir vertrauen darauf, dass das Modell den Prompt richtig interpretiert
      optimizedPrompt = optimizedPrompt
        .replace(/,\s*,/g, ",") // Doppelte Kommas entfernen
        .replace(/^\s*,\s*/g, "") // Führende Kommas entfernen
        .trim()
    } else {
      // Andere Modelle: Minimale Stil-Anweisungen für quadratisches Format
      optimizedPrompt = `${optimizedPrompt} [square 1:1]`
    }

    console.log("[FalMediaService] ====== REQUEST DEBUG ======")
    console.log("[FalMediaService] Endpoint:", `${this.baseURL}/${modelEndpoint}`)
    console.log("[FalMediaService] Model:", model, "->", modelEndpoint)
    console.log("[FalMediaService] Is Recraft:", isRecraftModel)
    console.log("[FalMediaService] Variants:", variants)
    console.log("[FalMediaService] Prompt:", optimizedPrompt)
    console.log("[FalMediaService] ===========================")

    // Request-Body erstellen
    let requestBody: Record<string, unknown>

    if (isRecraftModel) {
      // Recraft V3: style + size Parameter
      // digital_illustration für saubere, flache Icons (PNG output)
      // Hinweis: vector_illustration generiert SVGs, die Encoding-Probleme verursachen können
      requestBody = {
        prompt: optimizedPrompt,
        style: "digital_illustration", // Saubere Illustration, PNG-Output
        size: "square_hd",
        output_format: "png",
      }
      console.log("[FalMediaService] Recraft V3 - style: digital_illustration (PNG output)")
    } else {
      // Standard fal.ai Modelle (FLUX etc.)
      const imageSize = size.width === size.height ? "square_hd" : `${size.width}x${size.height}`
      requestBody = {
        prompt: optimizedPrompt,
        image_size: imageSize,
        output_format: "png",
      }
    }

    console.log("[FalMediaService] Request body:", JSON.stringify(requestBody, null, 2))

    // Parallele Requests für mehrere Varianten
    const requests = Array.from({ length: variants }).map(() =>
      fetch(`${this.baseURL}/${modelEndpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Key ${this.apiKey}`,
        },
        body: JSON.stringify(requestBody),
      })
    )

    console.log("[FalMediaService] Sending", requests.length, "parallel requests...")
    const responses = await Promise.all(requests)

    // Sammle alle Bilder
    const allImageData: Array<{ url?: string; content?: string }> = []

    for (let i = 0; i < responses.length; i++) {
      const response = responses[i]
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Unknown error" }))
        console.error(`[FalMediaService] Response ${i + 1} error:`, error)
        continue
      }

      const data = await response.json()

      if (data.images && Array.isArray(data.images)) {
        allImageData.push(...data.images)
      } else if (data.image) {
        allImageData.push(data.image)
      }
    }

    if (allImageData.length === 0) {
      throw new Error("fal.ai: No images generated")
    }

    // Verarbeite alle Bilder
    const images: GeneratedImage[] = []

    // MIME-Type basierend auf angefordertem Output-Format bestimmen
    // fal.ai kann manchmal webp statt png zurückgeben, deshalb erzwingen wir PNG
    const forcedMimeType = isRecraftModel ? "image/png" : undefined

    for (const imageData of allImageData) {
      if (imageData.url) {
        const isSvg = imageData.url.toLowerCase().includes(".svg")

        // Lade Bild und konvertiere zu Base64
        const imageResponse = await fetch(imageData.url)
        const imageBlob = await imageResponse.blob()
        const base64 = await this.blobToBase64(imageBlob, forcedMimeType)

        // MIME-Type: SVG > erzwungen > blob.type > fallback PNG
        const mimeType = isSvg ? "image/svg+xml" : forcedMimeType || imageBlob.type || "image/png"

        images.push({
          base64,
          url: imageData.url,
          mimeType,
          width: size.width,
          height: size.height,
        })
      } else if (imageData.content) {
        images.push({
          base64: imageData.content.startsWith("data:")
            ? imageData.content
            : `data:image/png;base64,${imageData.content}`,
          mimeType: "image/png",
          width: size.width,
          height: size.height,
        })
      }
    }

    if (images.length === 0) {
      throw new Error("No images generated by fal.ai")
    }

    console.log(`[FalMediaService] Generated ${images.length} image(s)`)
    return images
  }

  /**
   * Konvertiert Blob zu Base64 (Server-kompatibel)
   * @param forcedMimeType - Optional: Erzwinge einen bestimmten MIME-Type (z.B. wenn fal.ai webp statt png liefert)
   */
  private async blobToBase64(blob: Blob, forcedMimeType?: string): Promise<string> {
    const arrayBuffer = await blob.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const base64 = buffer.toString("base64")
    const mimeType = forcedMimeType || blob.type || "image/png"
    return `data:${mimeType};base64,${base64}`
  }

  getProviderInfo(): ProviderInfo {
    return this.providerInfo
  }
}
