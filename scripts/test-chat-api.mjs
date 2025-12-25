#!/usr/bin/env node
// scripts/test-chat-api.mjs
// Testet die Chat API mit Tool-Calling

import { config } from "dotenv"
import { resolve } from "path"

// .env.local laden
config({ path: resolve(process.cwd(), ".env.local") })

const API_URL = process.env.APP_URL || "http://localhost:3000"

async function testChatAPI() {
  console.log("🧪 Teste Chat API mit Tool-Calling...\n")

  // 1. Prüfe ob Server läuft
  try {
    const healthCheck = await fetch(`${API_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [] }),
    })

    if (healthCheck.status === 401) {
      console.log("✅ Server läuft (401 Unauthorized erwartet ohne Auth)")
    } else if (healthCheck.status === 400) {
      console.log("✅ Server läuft (400 Bad Request für leere Messages)")
    } else {
      console.log(`⚠️  Server antwortet mit Status: ${healthCheck.status}`)
    }
  } catch (error) {
    console.error("❌ Server nicht erreichbar:", error.message)
    console.log("   Stelle sicher, dass 'pnpm dev' läuft")
    process.exit(1)
  }

  // 2. Prüfe Environment Variables
  if (!process.env.OPENROUTER_API_KEY) {
    console.error("❌ OPENROUTER_API_KEY nicht gesetzt")
    console.log("   Führe 'pnpm pull-env' aus")
    process.exit(1)
  }

  console.log("✅ OPENROUTER_API_KEY gefunden")
  console.log("✅ Server ist erreichbar")
  console.log("\n📝 Chat API ist bereit für Tests")
  console.log("   Öffne http://localhost:3000 und teste den Chat im Assist Panel")
}

testChatAPI().catch((err) => {
  console.error("❌ Fehler:", err)
  process.exit(1)
})

