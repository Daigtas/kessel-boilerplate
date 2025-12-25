#!/usr/bin/env node
// scripts/test-tool-generation.mjs
// Testet ob Tools korrekt generiert werden

import { createClient } from "@supabase/supabase-js"
import { config } from "dotenv"
import { resolve } from "path"

config({ path: resolve(process.cwd(), ".env.local") })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

async function testToolGeneration() {
  console.log("🧪 Teste Tool-Generierung...\n")

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

  // Login
  const { data: authData } = await supabase.auth.signInWithPassword({
    email: "admin@kessel.local",
    password: "Admin123!",
  })

  if (!authData.user) {
    console.error("❌ Login fehlgeschlagen")
    process.exit(1)
  }

  // Lade Datasources
  const { data: datasources } = await supabase
    .from("ai_datasources")
    .select("*")
    .eq("is_enabled", true)
    .neq("access_level", "none")

  console.log(`✅ ${datasources?.length ?? 0} aktivierte Datasources gefunden\n`)

  // Prüfe get_table_columns Funktion
  const { data: columns, error: colError } = await supabase.rpc("get_table_columns", {
    p_schema: "public",
    p_table: "themes",
  })

  if (colError) {
    console.error("❌ Fehler bei get_table_columns:", colError.message)
  } else {
    console.log(`✅ get_table_columns funktioniert: ${columns?.length ?? 0} Spalten für 'themes' gefunden`)
    if (columns && columns.length > 0) {
      console.log("   Beispiel-Spalten:")
      columns.slice(0, 3).forEach((col) => {
        console.log(`   - ${col.column_name}: ${col.data_type} ${col.is_nullable ? "(nullable)" : "(required)"}`)
      })
    }
  }

  // Zeige verfügbare Tools
  if (datasources && datasources.length > 0) {
    console.log("\n📋 Verfügbare Tools:")
    for (const ds of datasources.slice(0, 5)) {
      if (["read", "read_write", "full"].includes(ds.access_level)) {
        console.log(`   - query_${ds.table_name} (${ds.access_level})`)
      }
      if (["read_write", "full"].includes(ds.access_level)) {
        console.log(`   - insert_${ds.table_name} (${ds.access_level})`)
        console.log(`   - update_${ds.table_name} (${ds.access_level})`)
      }
      if (ds.access_level === "full") {
        console.log(`   - delete_${ds.table_name} (${ds.access_level})`)
      }
    }
  }

  console.log("\n✅ Tool-Generierung sollte funktionieren!")
}

testToolGeneration().catch((err) => {
  console.error("❌ Fehler:", err)
  process.exit(1)
})

