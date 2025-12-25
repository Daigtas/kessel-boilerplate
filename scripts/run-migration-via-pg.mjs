#!/usr/bin/env node
// scripts/run-migration-via-pg.mjs
// Führt Migration direkt via PostgreSQL Client aus

import pg from "pg"
import { readFileSync } from "fs"
import { join } from "path"
import { config } from "dotenv"

// .env laden
config()

const { Client } = pg

// Supabase Connection String konstruieren
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

// Versuche DB-Passwort aus Environment zu holen
const dbPassword = process.env.SUPABASE_DB_PASSWORD

if (!dbPassword) {
  console.error("❌ SUPABASE_DB_PASSWORD nicht gesetzt")
  console.log("\n📝 Um die Migration auszuführen, benötigst du das DB-Passwort.")
  console.log("   Du findest es im Supabase Dashboard:")
  console.log(`   https://supabase.com/dashboard/project/${projectRef}/settings/database`)
  console.log("\n   Setze es dann in .env:")
  console.log("   SUPABASE_DB_PASSWORD=dein-passwort")
  console.log("\n   ODER führe die Migration manuell aus:")
  console.log(`   1. Öffne: https://supabase.com/dashboard/project/${projectRef}/sql/new`)
  console.log("   2. Kopiere den Inhalt von: supabase/migrations/018_ai_datasources.sql")
  console.log("   3. Führe aus")
  process.exit(1)
}

// Connection String konstruieren
// Format: postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres
const connectionString = `postgresql://postgres.${projectRef}:${encodeURIComponent(dbPassword)}@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?sslmode=require`

async function executeMigration() {
  console.log("🔐 Führe Migration 018_ai_datasources aus...\n")

  const client = new Client({
    connectionString,
    ssl: {
      rejectUnauthorized: false,
    },
  })

  try {
    await client.connect()
    console.log("✅ Verbindung zur Datenbank hergestellt\n")

    // Prüfe ob Migration bereits ausgeführt wurde
    try {
      const result = await client.query("SELECT id FROM ai_datasources LIMIT 1")
      if (result.rows.length > 0) {
        const { rows: countRows } = await client.query(
          "SELECT COUNT(*) as count FROM ai_datasources"
        )
        console.log("✅ Migration bereits ausgeführt (ai_datasources existiert)")
        console.log(`   ${countRows[0].count} Datasources gefunden`)
        await client.end()
        return
      }
    } catch {
      // Tabelle existiert nicht - Migration muss ausgeführt werden
    }

    // Migration SQL laden
    const migrationPath = join(process.cwd(), "supabase/migrations/018_ai_datasources.sql")
    const migrationSQL = readFileSync(migrationPath, "utf-8")

    console.log("📝 Führe Migration aus...")
    await client.query(migrationSQL)

    console.log("✅ Migration erfolgreich ausgeführt!")

    // Verifiziere
    const { rows } = await client.query("SELECT COUNT(*) as count FROM ai_datasources")
    console.log(`✅ ${rows[0].count} Datasources erstellt`)

    // Zeige einige Beispiele
    const { rows: examples } = await client.query(
      "SELECT table_name, access_level, is_enabled FROM ai_datasources ORDER BY table_name LIMIT 5"
    )
    if (examples.length > 0) {
      console.log("\n📋 Beispiel-Datasources:")
      examples.forEach((row) => {
        console.log(
          `   - ${row.table_name}: ${row.access_level} ${row.is_enabled ? "(aktiviert)" : "(deaktiviert)"}`
        )
      })
    }

    await client.end()
  } catch (error) {
    console.error("❌ Fehler:", error.message)
    if (error.code === "42P07") {
      console.log("ℹ️  Tabelle existiert bereits - Migration möglicherweise bereits ausgeführt")
    } else if (error.code === "28P01") {
      console.log("ℹ️  Authentifizierungsfehler - Prüfe SUPABASE_DB_PASSWORD")
    }
    await client.end()
    process.exit(1)
  }
}

executeMigration().catch((err) => {
  console.error("❌ Fehler:", err)
  process.exit(1)
})
