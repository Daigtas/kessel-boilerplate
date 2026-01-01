/**
 * API Route: Available Media Providers
 *
 * Gibt verfügbare Media-Provider zurück (für Frontend-Dropdown)
 */

import { getAvailableProviders } from "@/lib/media"
import { NextResponse } from "next/server"

/**
 * GET Handler für verfügbare Provider
 */
export async function GET(): Promise<NextResponse> {
  try {
    const providers = getAvailableProviders()

    return NextResponse.json({
      providers: providers.map((p) => ({
        id: p.id,
        name: p.name,
        models: Object.keys(p.models),
        defaultModel: p.defaultModel,
      })),
    })
  } catch (error) {
    console.error("[Media Providers API] Error:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
