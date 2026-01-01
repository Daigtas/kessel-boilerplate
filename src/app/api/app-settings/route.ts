/**
 * API Route: App Settings
 *
 * Gibt App-Settings zurück (für AppIcon-Komponente)
 */

import { createClient } from "@/utils/supabase/server"
import { NextResponse } from "next/server"

/**
 * GET Handler für App Settings
 */
export async function GET(): Promise<NextResponse> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from("app_settings")
      .select("*")
      .eq("id", "00000000-0000-0000-0000-000000000001")
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("[App Settings API] Error:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
