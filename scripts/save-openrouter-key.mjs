#!/usr/bin/env node
// scripts/save-openrouter-key.mjs
// Speichert den OpenRouter API Key im Supabase Vault

import { createClient } from "@supabase/supabase-js"
import { config } from "dotenv"

// .env laden (Vault-Credentials)
config()

const VAULT_URL = process.env.NEXT_PUBLIC_SUPABASE_URL // Vault-URL
const VAULT_SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY // Vault Service Role Key

// OpenRouter API Key (als Argument übergeben oder aus ENV)
const OPENROUTER_API_KEY = process.argv[2] || process.env.OPENROUTER_API_KEY

if (!VAULT_URL || !VAULT_SERVICE_ROLE_KEY) {
  console.error("❌ NEXT_PUBLIC_SUPABASE_URL und SERVICE_ROLE_KEY müssen in .env gesetzt sein")
  process.exit(1)
}

if (!OPENROUTER_API_KEY) {
  console.error("❌ OPENROUTER_API_KEY muss als Argument übergeben werden oder in ENV gesetzt sein")
  console.error("   Usage: node scripts/save-openrouter-key.mjs <api-key>")
  process.exit(1)
}

async function saveOpenRouterKeyToVault() {
  const vaultClient = createClient(VAULT_URL, VAULT_SERVICE_ROLE_KEY)

  console.log("🔐 Speichere OpenRouter API Key im Supabase Vault...\n")

  try {
    // Prüfe ob Secret bereits existiert
    const { data: existing } = await vaultClient.rpc("read_secret", {
      secret_name: "OPENROUTER_API_KEY",
    })

    if (existing) {
      console.log("⚠️  Secret 'OPENROUTER_API_KEY' existiert bereits. Lösche und erstelle neu...")
      // Altes Secret löschen
      await vaultClient.rpc("delete_secret", {
        secret_name: "OPENROUTER_API_KEY",
      })
    }

    // Secret erstellen (oder neu erstellen)
    const { error } = await vaultClient.rpc("insert_secret", {
      name: "OPENROUTER_API_KEY",
      secret: OPENROUTER_API_KEY,
    })

    if (error) {
      console.error("❌ Fehler beim Speichern:", error.message)
      process.exit(1)
    } else {
      console.log(
        `✅ Secret 'OPENROUTER_API_KEY' erfolgreich ${existing ? "aktualisiert" : "gespeichert"}`
      )
      console.log("\n✨ Fertig! Führe jetzt 'pnpm pull-env' aus, um den Key zu laden.")
    }
  } catch (err) {
    console.error("❌ Fehler:", err.message)
    process.exit(1)
  }
}

saveOpenRouterKeyToVault().catch((err) => {
  console.error("❌ Fehler:", err)
  process.exit(1)
})
