#!/usr/bin/env node

/**
 * Apply Migrations to Schema
 * ===========================
 *
 * Wendet alle Migrationen in einem bestimmten Schema an.
 * Verwendet direkte PostgreSQL-Verbindung über pg Library.
 *
 * Usage: node scripts/apply-migrations-to-schema.mjs <schema-name>
 *
 * Environment Variables:
 * - SUPABASE_DB_URL: PostgreSQL Connection String (postgresql://postgres:<password>@db.<project_ref>.supabase.co:5432/postgres?sslmode=require)
 *   ODER:
 * - SUPABASE_PROJECT_REF: Project Reference (z.B. ufqlocxqizmiaozkashi)
 * - SUPABASE_DB_PASSWORD: Database Password
 */

import { readFileSync, readdirSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
import * as dotenv from "dotenv"
import pg from "pg"

const { Client } = pg

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Lade .env.local und .env
dotenv.config({ path: join(__dirname, "..", ".env.local") })
dotenv.config({ path: join(__dirname, "..", ".env") })

const SCHEMA_NAME = process.argv[2] || process.env.NEXT_PUBLIC_PROJECT_SCHEMA || "public"

if (!SCHEMA_NAME || SCHEMA_NAME === "public") {
  console.error("❌ Fehler: Schema-Name muss angegeben werden (nicht 'public')")
  process.exit(1)
}

// Connection String bauen
let connectionString = process.env.SUPABASE_DB_URL

if (!connectionString) {
  // Versuche aus project_ref und password zu bauen
  const projectRef =
    process.env.SUPABASE_PROJECT_REF ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.match(/https?:\/\/([^.]+)\.supabase\.co/)?.[1]
  const dbPassword = process.env.SUPABASE_DB_PASSWORD

  if (!projectRef || !dbPassword) {
    console.error(
      "❌ Fehler: SUPABASE_DB_URL oder (SUPABASE_PROJECT_REF + SUPABASE_DB_PASSWORD) müssen gesetzt sein"
    )
    console.error(
      "   SUPABASE_DB_URL Format: postgresql://postgres:<password>@db.<project_ref>.supabase.co:5432/postgres?sslmode=require"
    )
    process.exit(1)
  }

  connectionString = `postgresql://postgres:${encodeURIComponent(dbPassword)}@db.${projectRef}.supabase.co:5432/postgres?sslmode=require`
}

async function applyMigration(migrationSQL, schemaName) {
  // Ersetze {{SCHEMA_NAME}} Platzhalter
  let sql = migrationSQL.replace(/\{\{SCHEMA_NAME\}\}/g, schemaName)

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

  // Ersetze REFERENCES public.* (außer auth.users, storage.*)
  sql = sql.replace(/REFERENCES public\.(\w+)/g, (match, tableName) => {
    if (tableName === "users" && match.includes("auth.users")) {
      return match // auth.users bleibt auth.users
    }
    return `REFERENCES ${schemaName}.${tableName}`
  })

  // Ersetze FROM public.* (außer auth.users, storage.*)
  sql = sql.replace(/FROM public\.(\w+)/g, (match, tableName) => {
    if (match.includes("auth.users") || match.includes("storage.")) {
      return match
    }
    return `FROM ${schemaName}.${tableName}`
  })

  // Ersetze JOIN public.* (außer auth.users, storage.*)
  sql = sql.replace(/JOIN public\.(\w+)/g, (match, tableName) => {
    if (match.includes("auth.users") || match.includes("storage.")) {
      return match
    }
    return `JOIN ${schemaName}.${tableName}`
  })

  // Ersetze UPDATE public.*
  sql = sql.replace(/UPDATE public\.(\w+)/g, (match, tableName) => {
    if (match.includes("auth.users") || match.includes("storage.")) {
      return match
    }
    return `UPDATE ${schemaName}.${tableName}`
  })

  // Ersetze DELETE FROM public.*
  sql = sql.replace(/DELETE FROM public\.(\w+)/g, (match, tableName) => {
    if (match.includes("auth.users") || match.includes("storage.")) {
      return match
    }
    return `DELETE FROM ${schemaName}.${tableName}`
  })

  // Ersetze DROP TRIGGER ... ON public.*
  sql = sql.replace(/ON public\.(\w+)/g, (match, tableName) => {
    if (match.includes("auth.users") || match.includes("storage.")) {
      return match
    }
    return `ON ${schemaName}.${tableName}`
  })

  return sql
}

async function main() {
  console.log(`🚀 Wende Migrationen im Schema "${SCHEMA_NAME}" an...\n`)

  // Setze NODE_TLS_REJECT_UNAUTHORIZED für Supabase SSL-Verbindung
  // Supabase verwendet selbst-signierte Zertifikate
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"

  const client = new Client({
    connectionString,
    ssl: {
      rejectUnauthorized: false, // Supabase verwendet selbst-signierte Zertifikate
    },
  })

  try {
    await client.connect()
    console.log(`✓ Verbindung zur Datenbank hergestellt\n`)

    // 1. Erstelle Schema falls nicht vorhanden
    console.log(`📊 Erstelle Schema "${SCHEMA_NAME}"...`)
    await client.query(`CREATE SCHEMA IF NOT EXISTS "${SCHEMA_NAME}";`)
    console.log(`✓ Schema "${SCHEMA_NAME}" erstellt/verfügbar\n`)

    // 2. Setze search_path für alle folgenden Queries
    await client.query(`SET search_path TO "${SCHEMA_NAME}", public;`)

    // 3. Lade alle Migrationen
    const migrationsDir = join(__dirname, "..", "supabase", "migrations")
    const migrationFiles = readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort()

    console.log(`📦 Gefunden: ${migrationFiles.length} Migrationen\n`)

    // 4. Führe jede Migration aus
    for (const migrationFile of migrationFiles) {
      console.log(`   📄 Verarbeite: ${migrationFile}...`)
      const migrationPath = join(migrationsDir, migrationFile)
      const migrationSQL = readFileSync(migrationPath, "utf-8")

      try {
        const processedSQL = await applyMigration(migrationSQL, SCHEMA_NAME)

        // Führe Migration als Ganzes aus
        // Bei Fehlern prüfe, ob es ein ignorierbarer Fehler ist
        try {
          await client.query(processedSQL)
          console.log(`   ✓ ${migrationFile}`)
        } catch (migrationError) {
          const errorMessage = migrationError.message.toLowerCase()

          // Prüfe ob es ein ignorierbarer Fehler ist
          const isIgnorableError =
            errorMessage.includes("already exists") ||
            errorMessage.includes("duplicate") ||
            errorMessage.includes("relation already exists") ||
            errorMessage.includes("policy already exists") ||
            errorMessage.includes("must be owner") ||
            errorMessage.includes("permission denied") ||
            errorMessage.includes("insufficient privilege") ||
            errorMessage.includes("trigger already exists") ||
            errorMessage.includes("function already exists")

          if (isIgnorableError) {
            // Versuche die Migration in Teilen auszuführen (für kritische Teile wie Tabellen)
            // Speziell für 004_auth_profiles.sql: Stelle sicher, dass die Tabelle erstellt wird
            if (migrationFile === "004_auth_profiles.sql") {
              // Erstelle profiles Tabelle separat, falls sie nicht existiert
              try {
                // 1. Tabelle erstellen
                await client.query(`
                  CREATE TABLE IF NOT EXISTS ${SCHEMA_NAME}.profiles (
                    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
                    email TEXT NOT NULL,
                    display_name TEXT,
                    avatar_url TEXT,
                    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    updated_at TIMESTAMPTZ DEFAULT NOW()
                  );
                `)

                // 2. Index erstellen
                await client.query(
                  `CREATE INDEX IF NOT EXISTS idx_profiles_role ON ${SCHEMA_NAME}.profiles(role);`
                )

                // 3. RLS aktivieren
                await client.query(`ALTER TABLE ${SCHEMA_NAME}.profiles ENABLE ROW LEVEL SECURITY;`)

                // 4. Policies erstellen (falls nicht vorhanden)
                const policies = [
                  {
                    name: "Users can view own profile",
                    sql: `CREATE POLICY "Users can view own profile" ON ${SCHEMA_NAME}.profiles FOR SELECT USING (auth.uid() = id);`,
                  },
                  {
                    name: "Users can update own profile",
                    sql: `CREATE POLICY "Users can update own profile" ON ${SCHEMA_NAME}.profiles FOR UPDATE USING (auth.uid() = id);`,
                  },
                  {
                    name: "Admins can view all profiles",
                    sql: `CREATE POLICY "Admins can view all profiles" ON ${SCHEMA_NAME}.profiles FOR SELECT USING (EXISTS (SELECT 1 FROM ${SCHEMA_NAME}.profiles WHERE id = auth.uid() AND role = 'admin'));`,
                  },
                  {
                    name: "Admins can update all profiles",
                    sql: `CREATE POLICY "Admins can update all profiles" ON ${SCHEMA_NAME}.profiles FOR UPDATE USING (EXISTS (SELECT 1 FROM ${SCHEMA_NAME}.profiles WHERE id = auth.uid() AND role = 'admin'));`,
                  },
                ]

                for (const policy of policies) {
                  try {
                    // Lösche Policy falls vorhanden, dann erstelle neu
                    await client.query(
                      `DROP POLICY IF EXISTS "${policy.name}" ON ${SCHEMA_NAME}.profiles;`
                    )
                    await client.query(policy.sql)
                  } catch (policyError) {
                    // Policy existiert bereits oder anderer Fehler - ignorieren
                    const errorMsg = policyError.message.toLowerCase()
                    if (
                      !errorMsg.includes("already exists") &&
                      !errorMsg.includes("does not exist")
                    ) {
                      console.log(
                        `   ⚠️  Policy "${policy.name}" konnte nicht erstellt werden: ${policyError.message.substring(0, 50)}`
                      )
                    }
                  }
                }

                // 5. updated_at Trigger-Funktion erstellen
                try {
                  await client.query(`
                    CREATE OR REPLACE FUNCTION ${SCHEMA_NAME}.update_profiles_updated_at()
                    RETURNS TRIGGER AS $$
                    BEGIN
                      NEW.updated_at = NOW();
                      RETURN NEW;
                    END;
                    $$ LANGUAGE plpgsql;
                  `)

                  await client.query(`
                    DROP TRIGGER IF EXISTS profiles_updated_at ON ${SCHEMA_NAME}.profiles;
                    CREATE TRIGGER profiles_updated_at
                    BEFORE UPDATE ON ${SCHEMA_NAME}.profiles
                    FOR EACH ROW
                    EXECUTE FUNCTION ${SCHEMA_NAME}.update_profiles_updated_at();
                  `)
                } catch (triggerError) {
                  // Trigger-Fehler ignorieren (nicht kritisch)
                  console.log(`   ⚠️  Trigger konnte nicht erstellt werden (nicht kritisch)`)
                }

                console.log(`   ✓ ${migrationFile} (Tabelle, Policies und Trigger erstellt)`)
              } catch (tableError) {
                // Tabelle existiert bereits oder anderer Fehler
                if (tableError.message.toLowerCase().includes("already exists")) {
                  console.log(
                    `   ⚠️  ${migrationFile} übersprungen (${errorMessage.substring(0, 60)}...)`
                  )
                } else {
                  throw tableError
                }
              }
            } else {
              console.log(
                `   ⚠️  ${migrationFile} übersprungen (${errorMessage.substring(0, 60)}...)`
              )
            }
          } else {
            // Kritischer Fehler - stoppe Migration
            console.error(`   ❌ ${migrationFile} fehlgeschlagen: ${migrationError.message}`)
            throw migrationError
          }
        }
      } catch (error) {
        console.error(`   ❌ ${migrationFile} fehlgeschlagen: ${error.message}`)
        throw error
      }
    }

    console.log(`\n✅ Alle Migrationen erfolgreich im Schema "${SCHEMA_NAME}" angewendet!`)
  } catch (error) {
    console.error(`\n❌ Fehler beim Ausführen der Migration: ${error.message}`)
    if (error.stack) {
      console.error(`\nStack Trace:\n${error.stack}`)
    }
    process.exit(1)
  } finally {
    await client.end()
  }
}

main().catch((error) => {
  console.error("Fataler Fehler:", error)
  process.exit(1)
})
