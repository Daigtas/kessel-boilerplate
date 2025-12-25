#!/usr/bin/env node
// scripts/execute-migration-018.mjs
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

async function executeMigration() {
  console.log("🔐 Führe Migration 018_ai_datasources aus...\n")

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
    },
  })

  // Prüfe ob Migration bereits ausgeführt wurde
  try {
    const { data, error } = await supabase.from("ai_datasources").select("id").limit(1)

    if (!error && data) {
      console.log("✅ Migration bereits ausgeführt (ai_datasources existiert)")
      const { count } = await supabase
        .from("ai_datasources")
        .select("*", { count: "exact", head: true })
      console.log(`   ${count} Datasources gefunden`)
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

  // Extrahiere Project Ref aus URL
  const projectRef = supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/)?.[1]

  if (projectRef) {
    console.log("   Option 1: Supabase Dashboard (Empfohlen)")
    console.log(`   1. Öffne: https://supabase.com/dashboard/project/${projectRef}/sql/new`)
    console.log("   2. Kopiere den Inhalt von: supabase/migrations/018_ai_datasources.sql")
    console.log("   3. Führe aus\n")
  }

  console.log("   Option 2: Supabase CLI")
  console.log("   npx supabase db push\n")

  console.log("   Option 3: psql (falls DB-Passwort verfügbar)")
  console.log(
    `   psql "postgresql://postgres:[PASSWORD]@db.${projectRef}.supabase.co:5432/postgres?sslmode=require" -f supabase/migrations/018_ai_datasources.sql\n`
  )

  // Versuche Migration via Supabase Management API
  // Leider unterstützt Supabase keine direkten SQL-Executes via REST API
  // Wir müssen die Migration manuell ausführen

  console.log("❌ Migration muss manuell ausgeführt werden.")
  console.log("   Die Migration ist bereit in: supabase/migrations/018_ai_datasources.sql")

  process.exit(1)
}

executeMigration().catch((err) => {
  console.error("❌ Fehler:", err)
  process.exit(1)
})
