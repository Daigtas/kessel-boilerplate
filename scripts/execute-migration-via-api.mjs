#!/usr/bin/env node
// scripts/execute-migration-via-api.mjs
// Führt Migration direkt via Supabase Management API aus

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

// Extrahiere Project Ref aus URL
const projectRef = supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/)?.[1]
if (!projectRef) {
  console.error("❌ Konnte Project Ref nicht aus URL extrahieren")
  process.exit(1)
}

async function executeMigration() {
  console.log("🔐 Führe Migration 018_ai_datasources via Supabase Management API aus...\n")

  // Migration SQL laden
  const migrationPath = join(process.cwd(), "supabase/migrations/018_ai_datasources.sql")
  const migrationSQL = readFileSync(migrationPath, "utf-8")

  // Supabase Management API Endpoint
  // Leider gibt es keine öffentliche Management API für SQL-Execution
  // Wir müssen die Migration via Dashboard oder CLI ausführen

  console.log("⚠️  Supabase Management API unterstützt keine direkten SQL-Executes.")
  console.log("📝 Migration muss via Supabase Dashboard ausgeführt werden:\n")
  console.log(`   1. Öffne: https://supabase.com/dashboard/project/${projectRef}/sql/new`)
  console.log("   2. Kopiere den Inhalt von: supabase/migrations/018_ai_datasources.sql")
  console.log("   3. Führe aus\n")

  // Versuche Migration via Supabase REST API (PostgREST)
  // Leider unterstützt PostgREST keine CREATE TYPE, CREATE TABLE, etc.
  // Wir müssen die Migration manuell ausführen

  console.log("❌ Migration muss manuell ausgeführt werden.")
  console.log("   Die Migration ist bereit in: supabase/migrations/018_ai_datasources.sql")

  // Alternative: Versuche Migration via Supabase CLI mit Remote-Link
  console.log("\n💡 Alternative: Supabase CLI mit Remote-Link")
  console.log("   npx supabase link --project-ref " + projectRef)
  console.log("   npx supabase db push")

  process.exit(1)
}

executeMigration().catch((err) => {
  console.error("❌ Fehler:", err)
  process.exit(1)
})
