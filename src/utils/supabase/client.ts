// src/utils/supabase/client.ts
// Browser-Client mit @supabase/ssr für konsistentes Cookie-Handling
import { createBrowserClient } from "@supabase/ssr"

/**
 * Erstellt einen Supabase-Client für Browser-Umgebung.
 *
 * Verwendet @supabase/ssr für konsistentes Cookie-basiertes Session-Management
 * zwischen Browser und Server (proxy.ts).
 *
 * Multi-Tenant: Unterstützt Schema-Isolation über NEXT_PUBLIC_PROJECT_SCHEMA.
 */
export function createClient() {
  const schema = process.env.NEXT_PUBLIC_PROJECT_SCHEMA || "public"

  const client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      db: {
        schema: schema,
      },
    }
  )

  return client
}
