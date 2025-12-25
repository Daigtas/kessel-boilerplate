#!/usr/bin/env node
// scripts/execute-migration-direct.mjs
// Führt eine Migration direkt via Supabase Client aus

import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "fs"
import { join } from "path"
import { config } from "dotenv"

// .env laden
config()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error("❌ NEXT_PUBLIC_SUPABASE_URL und SERVICE_ROLE_KEY müssen in .env gesetzt sein")
  process.exit(1)
}

async function executeMigration() {
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
    },
  })

  console.log("🔐 Führe Migration 018_ai_datasources aus...\n")

  // Migration SQL laden
  const migrationPath = join(process.cwd(), "supabase/migrations/018_ai_datasources.sql")
  const migrationSQL = readFileSync(migrationPath, "utf-8")

  // SQL in einzelne Statements aufteilen (bei Semikolon)
  // Aber VORSICHT: DO $$ Blocks müssen als Ganzes bleiben!
  const statements = migrationSQL
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("--"))

  console.log(`📝 Gefunden: ${statements.length} SQL-Statements\n`)

  // Versuche Migration via Supabase Management API
  // Leider unterstützt Supabase JS Client keine direkten SQL-Executes
  // Wir müssen die Migration anders ausführen

  console.log("⚠️  Supabase JS Client unterstützt keine direkten SQL-Executes.")
  console.log("📝 Migration muss via Supabase Dashboard oder CLI ausgeführt werden:\n")
  console.log("   Option 1: Supabase Dashboard")
  console.log("   1. Öffne: https://supabase.com/dashboard/project/ufqlocxqizmiaozkashi/sql/new")
  console.log("   2. Kopiere den Inhalt von: supabase/migrations/018_ai_datasources.sql")
  console.log("   3. Führe aus\n")
  console.log("   Option 2: Supabase CLI")
  console.log("   npx supabase db push\n")

  // Versuche trotzdem via REST API (falls möglich)
  try {
    // Prüfe ob Tabellen bereits existieren
    const { data: existingTables, error: checkError } = await supabase
      .from("ai_datasources")
      .select("id")
      .limit(1)

    if (!checkError && existingTables) {
      console.log("✅ Migration scheint bereits ausgeführt zu sein (ai_datasources existiert)")
      return
    }
  } catch {
    // Tabelle existiert nicht - Migration muss ausgeführt werden
  }

  console.log("❌ Migration noch nicht ausgeführt. Bitte manuell ausführen.")
  process.exit(1)
}

executeMigration().catch((err) => {
  console.error("❌ Fehler:", err)
  process.exit(1)
})
