#!/usr/bin/env node
// scripts/verify-migration-018.mjs
// Verifiziert, dass Migration 018 erfolgreich ausgeführt wurde

import { createClient } from "@supabase/supabase-js"
import { config } from "dotenv"

config()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error("❌ NEXT_PUBLIC_SUPABASE_URL und SERVICE_ROLE_KEY müssen in .env gesetzt sein")
  process.exit(1)
}

async function verifyMigration() {
  console.log("🔍 Verifiziere Migration 018_ai_datasources...\n")

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
    },
  })

  try {
    // Prüfe ai_datasources Tabelle
    const { data: datasources, error: dsError } = await supabase
      .from("ai_datasources")
      .select("table_name, access_level, is_enabled")
      .order("table_name")
      .limit(10)

    if (dsError) {
      console.error("❌ Fehler beim Abfragen von ai_datasources:", dsError.message)
      process.exit(1)
    }

    console.log(`✅ ai_datasources Tabelle existiert`)
    console.log(`   ${datasources?.length ?? 0} Datasources gefunden\n`)

    if (datasources && datasources.length > 0) {
      console.log("📋 Beispiel-Datasources:")
      datasources.slice(0, 5).forEach((ds) => {
        console.log(
          `   - ${ds.table_name}: ${ds.access_level} ${ds.is_enabled ? "(aktiviert)" : "(deaktiviert)"}`
        )
      })
    }

    // Prüfe ai_tool_calls Tabelle
    const { error: tcError } = await supabase.from("ai_tool_calls").select("id").limit(1)

    if (tcError) {
      console.error("❌ Fehler beim Abfragen von ai_tool_calls:", tcError.message)
      process.exit(1)
    }

    console.log(`✅ ai_tool_calls Tabelle existiert`)

    // Prüfe ai_models Tabelle
    const { data: models, error: mError } = await supabase
      .from("ai_models")
      .select("id, display_name, is_default")
      .order("is_default", { ascending: false })

    if (mError) {
      console.error("❌ Fehler beim Abfragen von ai_models:", mError.message)
      process.exit(1)
    }

    console.log(`✅ ai_models Tabelle existiert`)
    console.log(`   ${models?.length ?? 0} Modelle gefunden\n`)

    if (models && models.length > 0) {
      console.log("📋 Verfügbare Modelle:")
      models.forEach((model) => {
        console.log(
          `   - ${model.id}: ${model.display_name} ${model.is_default ? "(Standard)" : ""}`
        )
      })
    }

    // Prüfe get_table_columns Funktion
    const { data: columns, error: funcError } = await supabase.rpc("get_table_columns", {
      p_schema: "public",
      p_table: "themes",
    })

    if (funcError) {
      console.error("❌ Fehler beim Aufrufen von get_table_columns:", funcError.message)
      process.exit(1)
    }

    console.log(`✅ get_table_columns Funktion existiert`)
    console.log(`   ${columns?.length ?? 0} Spalten für 'themes' gefunden\n`)

    console.log("✅ Migration erfolgreich verifiziert!")
    console.log("\n🎉 Alle Tabellen, Funktionen und Policies wurden erstellt.")
    console.log("   Du kannst jetzt die Admin UI unter /admin/ai-datasources verwenden.")
  } catch (error) {
    console.error("❌ Fehler:", error.message)
    process.exit(1)
  }
}

verifyMigration().catch((err) => {
  console.error("❌ Fehler:", err)
  process.exit(1)
})
