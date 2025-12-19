import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

/**
 * API-Route: Liste aller registrierten User (nur Development)
 *
 * WICHTIG: Diese Route funktioniert NUR in Development-Mode mit aktiviertem Bypass.
 * In Production gibt sie 403 Forbidden zurück.
 *
 * Verwendet Service Role Key für Admin-Zugriff auf Supabase Auth.
 */
export async function GET() {
  // Doppelte Absicherung: Nur in Development mit aktiviertem Bypass
  const isDev = process.env.NODE_ENV === "development"
  const bypassEnabled = process.env.NEXT_PUBLIC_AUTH_BYPASS === "true"

  if (!isDev || !bypassEnabled) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: "Supabase credentials not configured" }, { status: 500 })
  }

  try {
    // Erstelle Admin-Client mit Service Role Key
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Lade alle User aus Supabase Auth
    const { data: users, error } = await supabaseAdmin.auth.admin.listUsers()

    if (error) {
      console.error("[DEV API] Fehler beim Laden der User:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Transformiere User-Daten für Frontend
    const userList = users.users.map((user) => ({
      id: user.id,
      email: user.email,
      displayName: user.user_metadata?.display_name || user.email?.split("@")[0] || "Unbekannt",
      role: user.user_metadata?.role || "user",
      createdAt: user.created_at,
      lastSignIn: user.last_sign_in_at,
    }))

    return NextResponse.json({ users: userList })
  } catch (error) {
    console.error("[DEV API] Unerwarteter Fehler:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}
