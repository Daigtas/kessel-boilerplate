/**
 * TEMP: Cleanup Test-Users
 *
 * Löscht alle Test-User aus der Datenbank (email LIKE 'test-%@test.local')
 *
 * Usage: pnpm tsx scripts/TEMP_cleanup-test-users.ts
 */

import { createClient } from "@supabase/supabase-js"
import { config } from "dotenv"
import { resolve } from "path"

// Lade .env.local
config({ path: resolve(process.cwd(), ".env.local") })

async function cleanupTestUsers() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("❌ NEXT_PUBLIC_SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY müssen gesetzt sein")
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  console.log("🔍 Suche Test-User...")

  // Alle User mit test-* E-Mails finden
  const { data: users, error: listError } = await supabase.auth.admin.listUsers({
    perPage: 1000,
  })

  if (listError) {
    console.error("❌ Fehler beim Laden der User:", listError.message)
    process.exit(1)
  }

  const testUsers = users.users.filter(
    (u) => u.email?.startsWith("test-") && u.email?.endsWith("@test.local")
  )

  console.log(`📊 Gefunden: ${testUsers.length} Test-User von ${users.users.length} gesamt`)

  if (testUsers.length === 0) {
    console.log("✅ Keine Test-User zum Löschen gefunden")
    return
  }

  console.log("\n🗑️  Lösche Test-User (alle FKs zuerst, dann Auth)...")

  let deleted = 0
  let failed = 0

  for (const user of testUsers) {
    // 1. ai_tool_calls löschen (kein ON DELETE CASCADE)
    await supabase.from("ai_tool_calls").delete().eq("user_id", user.id)

    // 2. ai_datasources.created_by auf NULL setzen (kein ON DELETE CASCADE)
    await supabase.from("ai_datasources").update({ created_by: null }).eq("created_by", user.id)

    // 3. Profile löschen (sollte CASCADE sein, aber sicherheitshalber)
    await supabase.from("profiles").delete().eq("id", user.id)

    // 4. Bugs reporter_id auf NULL setzen (ON DELETE SET NULL sollte das machen)
    await supabase.from("bugs").update({ reporter_id: null }).eq("reporter_id", user.id)

    // 5. Features proposer_id auf NULL setzen
    await supabase.from("features").update({ proposer_id: null }).eq("proposer_id", user.id)

    // 6. Dann Auth-User löschen
    const { error } = await supabase.auth.admin.deleteUser(user.id)
    if (error) {
      console.log(`  ❌ ${user.email}: ${error.message}`)
      failed++
    } else {
      console.log(`  ✅ ${user.email}`)
      deleted++
    }
  }

  console.log(`\n📊 Ergebnis: ${deleted} gelöscht, ${failed} fehlgeschlagen`)
}

cleanupTestUsers().catch(console.error)
