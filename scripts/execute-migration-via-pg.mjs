#!/usr/bin/env node
// scripts/execute-migration-via-pg.mjs
// Führt Migration direkt via PostgreSQL Client aus

import pg from "pg"
import { readFileSync } from "fs"
import { join } from "path"
import { config } from "dotenv"

// .env laden
config()

const { Client } = pg

// Supabase Connection String konstruieren
// Format: postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error("❌ NEXT_PUBLIC_SUPABASE_URL und SERVICE_ROLE_KEY müssen in .env gesetzt sein")
  process.exit(1)
}

// Extrahiere Host aus URL
const host = supabaseUrl.replace("https://", "").replace(".supabase.co", "")
const connectionString = `postgresql://postgres.${host}:${serviceRoleKey}@aws-0-eu-central-1.pooler.supabase.com:6543/postgres`

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
        console.log("✅ Migration bereits ausgeführt (ai_datasources existiert)")
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

    await client.end()
  } catch (error) {
    console.error("❌ Fehler:", error.message)
    if (error.code === "42P07") {
      console.log("ℹ️  Tabelle existiert bereits - Migration möglicherweise bereits ausgeführt")
    }
    await client.end()
    process.exit(1)
  }
}

executeMigration().catch((err) => {
  console.error("❌ Fehler:", err)
  process.exit(1)
})
