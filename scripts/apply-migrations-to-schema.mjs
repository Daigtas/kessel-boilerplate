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

async function applyMigration(migrationSQL, schemaName, projectRef) {
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

  // Verwende Supabase CLI für SQL-Ausführung (zuverlässiger als RPC)
  const { execSync } = await import("child_process")
  const { writeFileSync, unlinkSync } = await import("fs")
  const { join } = await import("path")
  const { fileURLToPath } = await import("url")
  const { dirname } = await import("path")

  const __filename = fileURLToPath(import.meta.url)
  const __dirname = dirname(__filename)

  // Temporäre SQL-Datei erstellen
  const tempSqlFile = join(__dirname, "..", `.temp_migration_${Date.now()}.sql`)
  writeFileSync(tempSqlFile, sql)

  try {
    // Führe SQL über Supabase CLI aus
    execSync(`supabase db execute --file "${tempSqlFile}" --project-ref ${projectRef}`, {
      stdio: "pipe",
      cwd: join(__dirname, ".."),
    })
    return true
  } catch (error) {
    console.error(`SQL-Ausführung fehlgeschlagen: ${error.message}`)
    throw error
  } finally {
    // Cleanup
    try {
      unlinkSync(tempSqlFile)
    } catch {
      // Ignoriere Cleanup-Fehler
    }
  }
}

async function main() {
  console.log(`🚀 Wende Migrationen im Schema "${SCHEMA_NAME}" an...\n`)

  // 1. Erstelle Schema falls nicht vorhanden (über Supabase CLI)
  console.log(`📊 Erstelle Schema "${SCHEMA_NAME}"...`)
  const { execSync } = await import("child_process")
  const { writeFileSync, unlinkSync } = await import("fs")
  const { join } = await import("path")
  const { fileURLToPath } = await import("url")
  const { dirname } = await import("path")

  const __filename = fileURLToPath(import.meta.url)
  const __dirname = dirname(__filename)

  const tempSchemaFile = join(__dirname, "..", `.temp_schema_${Date.now()}.sql`)
  writeFileSync(tempSchemaFile, `CREATE SCHEMA IF NOT EXISTS "${SCHEMA_NAME}";`)

  try {
    execSync(`supabase db execute --file "${tempSchemaFile}" --project-ref ${PROJECT_REF}`, {
      stdio: "pipe",
      cwd: join(__dirname, ".."),
    })
    console.log(`✓ Schema "${SCHEMA_NAME}" erstellt/verfügbar\n`)
  } catch (schemaError) {
    console.error(`❌ Schema-Erstellung fehlgeschlagen: ${schemaError.message}`)
    unlinkSync(tempSchemaFile)
    process.exit(1)
  } finally {
    try {
      unlinkSync(tempSchemaFile)
    } catch {
      // Ignoriere Cleanup-Fehler
    }
  }

  // 2. Lade alle Migrationen
  const migrationsDir = join(__dirname, "..", "supabase", "migrations")
  const migrationFiles = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort()

  console.log(`📦 Gefunden: ${migrationFiles.length} Migrationen\n`)

  // 3. Wende jede Migration an
  for (const migrationFile of migrationFiles) {
    console.log(`📝 Verarbeite: ${migrationFile}...`)
    const migrationPath = join(migrationsDir, migrationFile)
    const migrationSQL = readFileSync(migrationPath, "utf-8")

    try {
      await applyMigration(migrationSQL, SCHEMA_NAME, PROJECT_REF)
      console.log(`   ✓ ${migrationFile}\n`)
    } catch (error) {
      console.error(`   ❌ ${migrationFile} fehlgeschlagen: ${error.message}\n`)
      process.exit(1)
    }
  }

  console.log(`✅ Alle Migrationen erfolgreich im Schema "${SCHEMA_NAME}" angewendet!`)
}

main().catch((error) => {
  console.error("Fataler Fehler:", error)
  process.exit(1)
})
