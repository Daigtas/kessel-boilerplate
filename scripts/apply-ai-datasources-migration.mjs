#!/usr/bin/env node
// scripts/apply-ai-datasources-migration.mjs
// Führt die AI Datasources Migration direkt aus

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

async function applyMigration() {
  const supabase = createClient(supabaseUrl, serviceRoleKey)

  console.log("🔐 Führe AI Datasources Migration aus...\n")

  // Migration SQL laden
  const migrationPath = join(process.cwd(), "supabase/migrations/018_ai_datasources.sql")
  const migrationSQL = readFileSync(migrationPath, "utf-8")

  // Migration in Teile aufteilen (PostgreSQL erlaubt nur eine Statement pro RPC)
  // Wir müssen die Migration als einzelnes Statement ausführen
  const { error } = await supabase.rpc("exec_sql", { sql: migrationSQL })

  if (error) {
    // Fallback: Direkt via REST API (wenn RPC nicht verfügbar)
    console.log("⚠️  RPC exec_sql nicht verfügbar, versuche direkten SQL-Execute...")

    // Alternative: SQL direkt ausführen via REST API
    // Supabase REST API unterstützt keine direkten SQL-Statements
    // Wir müssen die Migration manuell ausführen oder Supabase CLI nutzen

    console.log("📝 Migration muss manuell ausgeführt werden:")
    console.log("   1. Öffne Supabase Dashboard → SQL Editor")
    console.log("   2. Kopiere den Inhalt von supabase/migrations/018_ai_datasources.sql")
    console.log("   3. Führe das SQL aus")
    console.log("\n   ODER:")
    console.log("   npx supabase db push")

    process.exit(1)
  }

  console.log("✅ Migration erfolgreich ausgeführt!")
}

applyMigration().catch((err) => {
  console.error("❌ Fehler:", err)
  process.exit(1)
})
