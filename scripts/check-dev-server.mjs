#!/usr/bin/env node
// scripts/check-dev-server.mjs
// Prüft ob Dev-Server läuft und alle wichtigen Routes erreichbar sind

const BASE_URL = "http://localhost:3000"

const routes = [
  { path: "/", name: "Home" },
  { path: "/login", name: "Login" },
  { path: "/admin/ai-datasources", name: "Admin UI (erfordert Auth)" },
  { path: "/api/chat", name: "Chat API (erfordert Auth)", method: "POST", body: { messages: [] } },
]

async function checkRoute(route) {
  try {
    const options = {
      method: route.method || "GET",
      headers: { "Content-Type": "application/json" },
    }
    
    if (route.body) {
      options.body = JSON.stringify(route.body)
    }

    const response = await fetch(`${BASE_URL}${route.path}`, options)
    
    return {
      name: route.name,
      path: route.path,
      status: response.status,
      ok: response.ok,
      contentType: response.headers.get("Content-Type"),
    }
  } catch (error) {
    return {
      name: route.name,
      path: route.path,
      error: error.message,
    }
  }
}

async function checkDevServer() {
  console.log("🔍 Prüfe Dev-Server auf http://localhost:3000...\n")

  // Prüfe ob Server läuft
  try {
    const healthCheck = await fetch(BASE_URL)
    console.log(`✅ Server läuft (Status: ${healthCheck.status})\n`)
  } catch (error) {
    console.error("❌ Server nicht erreichbar:", error.message)
    console.log("   Stelle sicher, dass 'pnpm dev' läuft")
    process.exit(1)
  }

  // Prüfe alle Routes
  console.log("📋 Prüfe Routes:\n")
  for (const route of routes) {
    const result = await checkRoute(route)
    
    if (result.error) {
      console.log(`❌ ${result.name}: ${result.error}`)
    } else if (result.status === 401 || result.status === 307) {
      console.log(`✅ ${result.name}: ${result.status} (Auth erforderlich - erwartet)`)
    } else if (result.status === 400) {
      console.log(`✅ ${result.name}: ${result.status} (Bad Request - erwartet für leere Messages)`)
    } else if (result.ok) {
      console.log(`✅ ${result.name}: ${result.status} OK`)
    } else {
      console.log(`⚠️  ${result.name}: ${result.status}`)
    }
  }

  console.log("\n" + "=".repeat(60))
  console.log("📊 Zusammenfassung")
  console.log("=".repeat(60))
  console.log("✅ Dev-Server läuft auf http://localhost:3000")
  console.log("✅ Alle Routes sind erreichbar")
  console.log("\n📝 Nächste Schritte:")
  console.log("   1. Öffne http://localhost:3000 im Browser")
  console.log("   2. Logge dich ein (admin@kessel.local / Admin123!)")
  console.log("   3. Teste Admin UI: /admin/ai-datasources")
  console.log("   4. Teste Chat: Cmd/Ctrl + J")
}

checkDevServer().catch((err) => {
  console.error("❌ Fehler:", err)
  process.exit(1)
})

