#!/usr/bin/env node

/**
 * Apply Migrations to Schema
 * ===========================
 *
 * Wendet alle Migrationen in einem bestimmten Schema an.
 * Wird von der CLI verwendet, um Tabellen im Projekt-Schema zu erstellen.
 *
 * Usage: node scripts/apply-migrations-to-schema.mjs <schema-name>
 */

import { createClient } from "@supabase/supabase-js"
import { readFileSync, readdirSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
import * as dotenv from "dotenv"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Lade .env.local
dotenv.config({ path: join(__dirname, "..", ".env.local") })
dotenv.config({ path: join(__dirname, "..", ".env") })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
const SCHEMA_NAME = process.argv[2] || process.env.NEXT_PUBLIC_PROJECT_SCHEMA || "public"

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("❌ Fehler: NEXT_PUBLIC_SUPABASE_URL und SERVICE_ROLE_KEY müssen gesetzt sein")
  process.exit(1)
}

if (!SCHEMA_NAME || SCHEMA_NAME === "public") {
  console.error("❌ Fehler: Schema-Name muss angegeben werden (nicht 'public')")
  process.exit(1)
}

// Extrahiere project_ref aus URL
const projectRefMatch = SUPABASE_URL.match(/https?:\/\/([^.]+)\.supabase\.co/)
if (!projectRefMatch || !projectRefMatch[1]) {
  console.error("❌ Fehler: Konnte project_ref nicht aus SUPABASE_URL extrahieren")
  process.exit(1)
}
const PROJECT_REF = projectRefMatch[1]

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

async function applyMigration(migrationSQL, schemaName) {
  // Ersetze {{SCHEMA_NAME}} Platzhalter
  let sql = migrationSQL.replace(/\{\{SCHEMA_NAME\}\}/g, schemaName)

  // Wenn kein search_path gesetzt ist, füge ihn hinzu
  if (!sql.includes("SET search_path") && !sql.includes("search_path TO")) {
    sql = `SET search_path TO "${schemaName}";\n\n${sql}`
  }

  // Ersetze alle "public." Referenzen mit Schema-Namen (außer auth.users, storage.*)
  sql = sql.replace(
    /CREATE TABLE IF NOT EXISTS public\./g,
    `CREATE TABLE IF NOT EXISTS ${schemaName}.`
  )
  sql = sql.replace(/CREATE TABLE public\./g, `CREATE TABLE ${schemaName}.`)
  sql = sql.replace(/ALTER TABLE public\./g, `ALTER TABLE ${schemaName}.`)
  sql = sql.replace(/CREATE INDEX.*ON public\./g, (match) =>
    match.replace("ON public.", `ON ${schemaName}.`)
  )
  sql = sql.replace(/CREATE POLICY.*ON public\./g, (match) =>
    match.replace("ON public.", `ON ${schemaName}.`)
  )
  sql = sql.replace(/FROM public\./g, (match) => {
    // Überspringe auth.users und storage.*
    if (match.includes("auth.users") || match.includes("storage.")) {
      return match
    }
    return match.replace("FROM public.", `FROM ${schemaName}.`)
  })
  sql = sql.replace(/JOIN public\./g, (match) => {
    if (match.includes("auth.users") || match.includes("storage.")) {
      return match
    }
    return match.replace("JOIN public.", `JOIN ${schemaName}.`)
  })

  return sql
}

async function main() {
  console.log(`🚀 Wende Migrationen im Schema "${SCHEMA_NAME}" an...\n`)

  // 1. Erstelle Schema falls nicht vorhanden (über Supabase MCP apply_migration)
  console.log(`📊 Erstelle Schema "${SCHEMA_NAME}"...`)

  try {
    // Verwende Supabase MCP apply_migration für Schema-Erstellung
    // Das erstellt eine Migration-Datei und führt sie aus
    const schemaSQL = `CREATE SCHEMA IF NOT EXISTS "${SCHEMA_NAME}";`

    // Da wir keine direkte MCP-Verbindung haben, verwenden wir einen Workaround:
    // Erstelle Schema über Supabase Client mit Service Role
    // Versuche es über die REST API mit einem einfachen SQL-Request
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        Prefer: "return=representation",
      },
      body: JSON.stringify({ sql: schemaSQL }),
    })

    if (!response.ok) {
      // Fallback: Schema wird beim ersten Migration-Lauf erstellt
      console.log(`   ⚠️  Schema-Erstellung über REST API fehlgeschlagen`)
      console.log(`   → Schema wird beim ersten Migration-Lauf erstellt\n`)
    } else {
      console.log(`✓ Schema "${SCHEMA_NAME}" erstellt/verfügbar\n`)
    }
  } catch (schemaError) {
    // Schema wird beim ersten Migration-Lauf erstellt (nicht kritisch)
    console.log(`   ⚠️  Schema-Erstellung fehlgeschlagen: ${schemaError.message}`)
    console.log(`   → Schema wird beim ersten Migration-Lauf erstellt\n`)
  }

  // 2. Lade alle Migrationen
  const migrationsDir = join(__dirname, "..", "supabase", "migrations")
  const migrationFiles = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort()

  console.log(`📦 Gefunden: ${migrationFiles.length} Migrationen\n`)

  // 3. Kombiniere alle Migrationen zu einer großen Migration
  console.log(`📝 Kombiniere Migrationen für Schema "${SCHEMA_NAME}"...`)

  let combinedSQL = `-- Combined Migration for Schema: ${SCHEMA_NAME}\n`
  combinedSQL += `-- Generated: ${new Date().toISOString()}\n\n`
  combinedSQL += `-- Erstelle Schema falls nicht vorhanden\n`
  combinedSQL += `CREATE SCHEMA IF NOT EXISTS "${SCHEMA_NAME}";\n\n`
  combinedSQL += `-- Setze search_path\n`
  combinedSQL += `SET search_path TO "${SCHEMA_NAME}";\n\n`

  // Verarbeite jede Migration
  for (const migrationFile of migrationFiles) {
    console.log(`   📄 Verarbeite: ${migrationFile}...`)
    const migrationPath = join(migrationsDir, migrationFile)
    const migrationSQL = readFileSync(migrationPath, "utf-8")

    try {
      const processedSQL = await applyMigration(migrationSQL, SCHEMA_NAME)
      combinedSQL += `-- Migration: ${migrationFile}\n`
      combinedSQL += processedSQL
      combinedSQL += `\n\n`
      console.log(`   ✓ ${migrationFile}`)
    } catch (error) {
      console.error(`   ❌ ${migrationFile} fehlgeschlagen: ${error.message}`)
      process.exit(1)
    }
  }

  console.log(`\n📤 Generiere Migration-SQL-Datei...`)

  // Speichere SQL in Datei für manuelle Ausführung im Supabase Dashboard
  // Da supabase db push ein verlinktes Projekt benötigt und exec_sql RPC nicht existiert,
  // generieren wir eine SQL-Datei, die der User im Supabase Dashboard ausführen kann
  const { writeFileSync } = await import("fs")
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5)
  const outputFile = join(__dirname, "..", `migration_${SCHEMA_NAME}_${timestamp}.sql`)

  writeFileSync(outputFile, combinedSQL)
  console.log(`   📄 Migration-SQL gespeichert in: ${outputFile}`)
  console.log(`\n📋 Führe diese SQL im Supabase Dashboard aus:`)
  console.log(`   → SQL Editor: https://supabase.com/dashboard/project/${PROJECT_REF}/sql/new`)
  console.log(`\n${"=".repeat(60)}`)
  console.log(combinedSQL.substring(0, 500) + "...")
  console.log(`${"=".repeat(60)}\n`)
  console.log(`💡 Tipp: Kopiere den Inhalt von ${outputFile} in den Supabase SQL Editor`)
  console.log(`   → Die Migration wird dann automatisch im Schema "${SCHEMA_NAME}" ausgeführt\n`)

  // Exit mit Erfolg (nicht Fehler), da SQL-Datei erstellt wurde
  console.log(`✅ Migration-SQL erfolgreich generiert!`)
  console.log(`   → Führe die SQL-Datei im Supabase Dashboard aus, um die Migration anzuwenden.\n`)
}

main().catch((error) => {
  console.error("Fataler Fehler:", error)
  process.exit(1)
})
