#!/usr/bin/env node
// scripts/run-migration-018.mjs
// Führt Migration 018 direkt via Supabase aus

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

async function runMigration() {
  console.log("🔐 Führe Migration 018_ai_datasources aus...\n")

  // Prüfe ob Migration bereits ausgeführt wurde
  const supabase = createClient(supabaseUrl, serviceRoleKey)

  try {
    const { data, error } = await supabase.from("ai_datasources").select("id").limit(1)

    if (!error && data) {
      console.log("✅ Migration bereits ausgeführt (ai_datasources existiert)")
      return
    }
  } catch {
    // Tabelle existiert nicht - Migration muss ausgeführt werden
  }

  // Migration SQL laden
  const migrationPath = join(process.cwd(), "supabase/migrations/018_ai_datasources.sql")
  const migrationSQL = readFileSync(migrationPath, "utf-8")

  console.log("📝 Migration SQL geladen, Länge:", migrationSQL.length, "Zeichen")
  console.log("⚠️  Supabase JS Client kann keine direkten SQL-Statements ausführen.")
  console.log("📝 Bitte führe die Migration manuell aus:\n")
  console.log("   Option 1: Supabase Dashboard")
  console.log(
    `   1. Öffne: https://supabase.com/dashboard/project/${supabaseUrl.split("//")[1].split(".")[0]}/sql/new`
  )
  console.log("   2. Kopiere den Inhalt von: supabase/migrations/018_ai_datasources.sql")
  console.log("   3. Führe aus\n")
  console.log("   Option 2: Supabase CLI")
  console.log("   npx supabase db push\n")
  console.log("   Option 3: psql (falls installiert)")
  console.log(
    `   psql "${supabaseUrl.replace("https://", "postgresql://postgres:[PASSWORD]@")}" -f supabase/migrations/018_ai_datasources.sql\n`
  )

  // Versuche via Supabase Management API (falls verfügbar)
  // Leider gibt es keine direkte SQL-Execute API in Supabase REST

  process.exit(1)
}

runMigration().catch((err) => {
  console.error("❌ Fehler:", err)
  process.exit(1)
})
