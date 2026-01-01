/**
 * OpenRouter MediaService Implementation
 *
 * Nutzt OpenRouter API für Image-Generierung (FLUX.2, Nano Banana, etc.)
 */

import type { GeneratedImage, ImageGenerationOptions, MediaService, ProviderInfo } from "./types"
import { getProvider } from "./config"

/**
 * OpenRouter MediaService
 */
export class OpenRouterMediaService implements MediaService {
  private apiKey: string
  private baseURL = "https://openrouter.ai/api/v1"
  private providerInfo: ProviderInfo

  constructor(apiKey?: string) {
    if (!apiKey) {
      throw new Error("OPENROUTER_API_KEY is required for OpenRouterMediaService")
    }
    this.apiKey = apiKey
    const provider = getProvider("openrouter")
    if (!provider) {
      throw new Error("OpenRouter provider not configured")
    }
    this.providerInfo = provider
  }

  /**
   * Generiert Bilder über OpenRouter API
   *
   * OpenRouter unterstützt Image-Modelle über /chat/completions Endpoint
   * mit speziellen Modellen wie black-forest-labs/flux-2
   */
  async generateImage(prompt: string, options?: ImageGenerationOptions): Promise<GeneratedImage[]> {
    const model = options?.model || this.providerInfo.defaultModel
    const variants = options?.variants || 1
    const size = options?.size || { width: 512, height: 512 }

    // Berechne Aspect Ratio String aus Size
    const aspectRatio = size.width === size.height ? "1:1" : `${size.width}:${size.height}`

    // Modell-ID auflösen
    const modelId = this.providerInfo.models[model] || model
    const isNanoBanana = modelId.includes("gemini") && modelId.includes("image")

    console.log("[OpenRouterMediaService] Model key:", model)
    console.log("[OpenRouterMediaService] Resolved model ID:", modelId)
    console.log("[OpenRouterMediaService] Is Nano Banana:", isNanoBanana)
    console.log("[OpenRouterMediaService] Available models:", Object.keys(this.providerInfo.models))

    // Der Prompt ist bereits nach Nano-Banana-Guidelines strukturiert:
    // 1. Zweck (Create an abstract, minimalist logo...)
    // 2. Motiv (representing...)
    // 3. Stil (monochrome, flat 2D, white background, solid black shapes)
    // 4. Geometrie (filling the frame from edge to edge)
    // 5. Constraints (No text, no gradients, no shadows)
    //
    // Wir fügen nur technische Output-Parameter hinzu
    const enhancedPrompt = isNanoBanana
      ? `${prompt} [Output: PNG format, square 1:1 aspect ratio, ${size.width}x${size.height} pixels]`
      : `${prompt} [Output: square format, 1:1 aspect ratio, ${size.width}x${size.height} pixels, PNG format]`

    console.log("[OpenRouterMediaService] Enhanced Prompt:", enhancedPrompt)

    // Request Body zusammenstellen
    const requestBody: Record<string, unknown> = {
      model: modelId,
      messages: [
        {
          role: "user",
          content: enhancedPrompt,
        },
      ],
      modalities: ["image"],
      stream: false,
    }

    // Bildkonfiguration für Gemini Image Models
    if (isNanoBanana) {
      requestBody.image_config = {
        aspect_ratio: aspectRatio,
        // Explizit PNG-Format anfordern (falls unterstützt)
        output_format: "png",
      }
    } else {
      // Für FLUX.2 und andere Modelle
      requestBody.image_config = {
        aspect_ratio: aspectRatio,
      }
    }

    // Zusätzliche Parameter aus options übernehmen
    if (options?.parameters) {
      Object.assign(requestBody, options.parameters)
    }

    // Für mehrere Varianten: Parallele Requests
    const requests = Array.from({ length: variants }, () =>
      fetch(`${this.baseURL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
          "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "https://kessel-boilerplate.local",
          "X-Title": process.env.NEXT_PUBLIC_APP_NAME || "Kessel B2B App",
        },
        body: JSON.stringify(requestBody),
      })
    )

    // Alle Requests parallel ausführen
    const responses = await Promise.all(requests)

    // Alle Responses verarbeiten
    const allImages: GeneratedImage[] = []

    for (const response of responses) {
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Unknown error" }))
        console.error(
          `OpenRouter API error: ${error.error?.message || error.message || response.statusText}`
        )
        continue // Skip failed requests, aber versuche andere
      }

      const data = await response.json()

      // OpenRouter gibt Bilder in choices[].message.images[] zurück
      // Format: { type: "image_url", image_url: { url: "data:image/png;base64,..." } }
      if (data.choices && Array.isArray(data.choices)) {
        for (const choice of data.choices) {
          if (choice.message?.images && Array.isArray(choice.message.images)) {
            // Bilder sind im images-Array
            for (const imageObj of choice.message.images) {
              if (imageObj.image_url?.url) {
                const imageUrl = imageObj.image_url.url

                // MIME-Type aus Data URL extrahieren (falls vorhanden)
                let mimeType = "image/png" // Default
                if (imageUrl.startsWith("data:")) {
                  const mimeMatch = imageUrl.match(/data:([^;]+)/)
                  if (mimeMatch) {
                    mimeType = mimeMatch[1]
                  }
                }

                // Sicherstellen, dass es PNG ist (für Transparenz)
                const base64Data = imageUrl.startsWith("data:")
                  ? imageUrl
                  : `data:image/png;base64,${imageUrl}`

                allImages.push({
                  base64: base64Data,
                  mimeType: mimeType === "image/png" ? "image/png" : "image/png", // Immer PNG erzwingen
                  width: size.width,
                  height: size.height,
                })
              }
            }
          }
        }
      }
    }

    if (allImages.length === 0) {
      throw new Error("No images generated by OpenRouter")
    }

    return allImages
  }

  getProviderInfo(): ProviderInfo {
    return this.providerInfo
  }
}
