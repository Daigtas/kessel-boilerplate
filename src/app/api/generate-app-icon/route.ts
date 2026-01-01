/**
 * API Route: App Icon Generation
 *
 * Generiert App-Icons über MediaService (OpenRouter/fal.ai)
 * und speichert sie in Supabase Storage
 */

import { createMediaService } from "@/lib/media"
import { createClient } from "@/utils/supabase/server"
import { NextResponse } from "next/server"

// Timeout erhöhen für Image-Generierung (kann länger dauern)
export const maxDuration = 60

/**
 * Request Body Interface
 */
interface GenerateIconRequest {
  appName: string
  description: string
  prompt: string // KI-generierter oder manueller Prompt
  variants?: number // 1-4, default 1
  provider?: "openrouter" | "fal" // default: openrouter
  model?: string // Optional: spezifisches Modell
}

/**
 * Response Interface
 */
interface GenerateIconResponse {
  images: Array<{
    url: string // Supabase Storage URL
    base64?: string // Optional für Preview
  }>
  provider: string
  model: string
}

/**
 * Konvertiert Base64 Data URL zu Buffer
 */
function base64ToBuffer(base64: string): Buffer {
  // Entferne Data URL Prefix falls vorhanden
  const base64Data = base64.replace(/^data:image\/\w+;base64,/, "")
  return Buffer.from(base64Data, "base64")
}

/**
 * POST Handler für Icon-Generierung
 */
export async function POST(req: Request): Promise<NextResponse> {
  try {
    // 1. Auth prüfen
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // 2. Prüfe Admin-Rolle
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 })
    }

    // 3. Request Body parsen
    const body: GenerateIconRequest = await req.json()
    const { appName, description, prompt, variants = 1, provider = "openrouter", model } = body

    if (!appName || !description || !prompt) {
      return NextResponse.json(
        { error: "appName, description and prompt are required" },
        { status: 400 }
      )
    }

    if (variants < 1 || variants > 4) {
      return NextResponse.json({ error: "variants must be between 1 and 4" }, { status: 400 })
    }

    // 5. MediaService erstellen und Bilder generieren
    console.log("[Generate Icon API] Generating", variants, "variants with provider:", provider)
    const mediaService = createMediaService(provider)
    const generatedImages = await mediaService.generateImage(prompt, {
      model,
      variants,
      size: { width: 512, height: 512 },
    })
    console.log("[Generate Icon API] Generated", generatedImages.length, "images")

    // 6. Bilder in Supabase Storage hochladen
    const uploadedImages: Array<{ url: string; base64?: string }> = []
    const timestamp = Date.now()

    for (let i = 0; i < generatedImages.length; i++) {
      const image = generatedImages[i]

      // Dateiendung basierend auf MIME-Type bestimmen
      const isSvg = image.mimeType === "image/svg+xml"
      const fileExtension = isSvg ? "svg" : "png"
      const filename = `icon-${timestamp}-${i + 1}.${fileExtension}`
      const filePath = filename

      console.log(`[Generate Icon API] Uploading ${filename} (MIME: ${image.mimeType})`)

      // Base64 zu Buffer konvertieren
      const buffer = base64ToBuffer(image.base64)

      // Upload zu Supabase Storage mit korrektem MIME-Type
      const { error: uploadError } = await supabase.storage
        .from("app-icons")
        .upload(filePath, buffer, {
          contentType: image.mimeType,
          upsert: true,
        })

      if (uploadError) {
        console.error(`Error uploading icon variant ${i + 1}:`, uploadError)
        continue
      }

      // Public URL generieren
      const {
        data: { publicUrl },
      } = supabase.storage.from("app-icons").getPublicUrl(filePath)

      uploadedImages.push({
        url: publicUrl,
        base64: image.base64, // Für Preview im Frontend
      })
    }

    if (uploadedImages.length === 0) {
      return NextResponse.json(
        { error: "Failed to upload generated images to storage" },
        { status: 500 }
      )
    }

    // 7. app_settings aktualisieren
    const providerInfo = mediaService.getProviderInfo()
    const { error: updateError } = await supabase
      .from("app_settings")
      .update({
        app_name: appName,
        app_description: description,
        icon_url: uploadedImages[0].url, // Erstes Bild als Standard
        icon_variants: uploadedImages.map((img) => ({ url: img.url })),
        icon_provider: provider,
      })
      .eq("id", "00000000-0000-0000-0000-000000000001")

    if (updateError) {
      console.error("Error updating app_settings:", updateError)
      // Icons wurden hochgeladen, aber DB-Update fehlgeschlagen
      // Das ist nicht kritisch, aber wir loggen es
    }

    // 8. Response zurückgeben
    const response: GenerateIconResponse = {
      images: uploadedImages,
      provider,
      model: model || providerInfo.defaultModel,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error("[Generate Icon API] Error:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
