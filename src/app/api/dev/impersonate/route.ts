import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createServerClient } from "@supabase/ssr"

/**
 * API-Route: User-Impersonation für Development
 *
 * WICHTIG: Diese Route funktioniert NUR in Development-Mode mit aktiviertem Bypass.
 * Erstellt eine echte Supabase-Session für den gewählten User.
 *
 * Verwendet Magic Link Token für sichere Session-Erstellung.
 */
export async function POST(request: NextRequest) {
  // Doppelte Absicherung: Nur in Development mit aktiviertem Bypass
  const isDev = process.env.NODE_ENV === "development"
  const bypassEnabled = process.env.NEXT_PUBLIC_AUTH_BYPASS === "true"

  if (!isDev || !bypassEnabled) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { userId, email } = body

    if (!userId || !email) {
      return NextResponse.json({ error: "userId and email are required" }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const anonKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return NextResponse.json({ error: "Supabase credentials not configured" }, { status: 500 })
    }

    // Erstelle Admin-Client für Token-Generierung
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Generiere Magic Link Token für den User
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: email,
    })

    if (linkError || !linkData) {
      console.error("[DEV API] Fehler beim Generieren des Magic Links:", linkError)
      return NextResponse.json(
        { error: linkError?.message || "Failed to generate magic link" },
        { status: 500 }
      )
    }

    // Extrahiere Token-Hash (direkt aus Properties oder aus Magic Link URL)
    let tokenHash = linkData.properties.token_hash

    // Fallback: Extrahiere Token aus Magic Link URL falls token_hash nicht verfügbar
    if (!tokenHash) {
      const magicLink = linkData.properties.action_link
      const tokenMatch = magicLink?.match(/token=([^&]+)/)
      tokenHash = tokenMatch ? decodeURIComponent(tokenMatch[1]) : null
    }

    if (!tokenHash) {
      return NextResponse.json(
        { error: "Failed to extract token from magic link" },
        { status: 500 }
      )
    }

    // Erstelle Response mit Cookie-Setup
    const response = NextResponse.json({ success: true, userId, email })

    // Erstelle Server-Client für Cookie-Management
    const supabaseServer = createServerClient(supabaseUrl, anonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    })

    // Verifiziere den Token und erstelle Session
    const { data: verifyData, error: verifyError } = await supabaseServer.auth.verifyOtp({
      token_hash: tokenHash,
      type: "magiclink",
    })

    if (verifyError || !verifyData.user) {
      console.error("[DEV API] Fehler beim Verifizieren des Tokens:", verifyError)
      return NextResponse.json(
        { error: verifyError?.message || "Failed to verify token" },
        { status: 500 }
      )
    }

    // Session wurde automatisch in Cookies gesetzt
    return response
  } catch (error) {
    console.error("[DEV API] Unerwarteter Fehler:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}
