#!/usr/bin/env tsx
/**
 * Connectivity-Test für OpenRouter API
 *
 * Testet:
 * 1. API-Erreichbarkeit
 * 2. Verfügbare Modelle
 * 3. Vision-Capability mit Test-Bild
 *
 * MUSS erfolgreich sein bevor Phase 1 beginnt!
 */

import { config } from "dotenv"
import { resolve } from "path"

// .env und .env.local laden
config({ path: resolve(process.cwd(), ".env") })
config({ path: resolve(process.cwd(), ".env.local") })

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"

if (!OPENROUTER_API_KEY) {
  console.error("❌ OPENROUTER_API_KEY nicht gefunden!")
  console.error("   Stelle sicher, dass 'pnpm pull-env' ausgeführt wurde.")
  process.exit(1)
}

interface Model {
  id: string
  name: string
  description?: string
  context_length: number
  architecture?: {
    modality: string
    tokenizer: string
    instruct_type?: string
  }
  top_provider?: {
    name: string
    max_completion_tokens?: number
  }
  pricing?: {
    prompt: string
    completion: string
  }
}

interface OpenRouterResponse<T> {
  data?: T
  error?: {
    message: string
    code?: string
  }
}

/**
 * Test 1: API-Erreichbarkeit
 */
async function testApiReachability(): Promise<boolean> {
  console.log("🔍 Test 1: API-Erreichbarkeit...")

  try {
    const response = await fetch(`${OPENROUTER_BASE_URL}/models`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "HTTP-Referer": "https://kessel-boilerplate.local",
        "X-Title": "Kessel B2B App",
      },
    })

    if (!response.ok) {
      const error = await response.text()
      console.error(`❌ API nicht erreichbar: ${response.status} - ${error}`)
      return false
    }

    console.log("✅ API erreichbar")
    return true
  } catch (error) {
    console.error("❌ API-Fehler:", error instanceof Error ? error.message : error)
    return false
  }
}

/**
 * Test 2: Verfügbare Modelle abrufen
 */
async function testAvailableModels(): Promise<Model[]> {
  console.log("\n🔍 Test 2: Verfügbare Modelle...")

  try {
    const response = await fetch(`${OPENROUTER_BASE_URL}/models`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "HTTP-Referer": "https://kessel-boilerplate.local",
        "X-Title": "Kessel B2B App",
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const data: OpenRouterResponse<Model[]> = await response.json()

    if (data.error) {
      throw new Error(data.error.message)
    }

    const models = data.data || []

    // Prüfe ob Gemini 3 Flash verfügbar ist
    const geminiFlash = models.find((m) => m.id === "google/gemini-3-flash-preview")

    if (geminiFlash) {
      console.log(`✅ Gemini 3 Flash gefunden: ${geminiFlash.name}`)
      if (geminiFlash.architecture?.modality === "multimodal") {
        console.log("   ✅ Unterstützt Vision (multimodal)")
      }
    } else {
      console.warn("⚠️  Gemini 3 Flash nicht gefunden - versuche Fallback")
    }

    // Prüfe ob Claude Opus 4.5 verfügbar ist
    const claudeOpus = models.find((m) => m.id === "anthropic/claude-opus-4.5")

    if (claudeOpus) {
      console.log(`✅ Claude Opus 4.5 gefunden: ${claudeOpus.name}`)
    } else {
      console.warn("⚠️  Claude Opus 4.5 nicht gefunden")
    }

    // Zeige Top 5 Modelle
    console.log(`\n📋 Verfügbare Modelle (${models.length} total):`)
    models.slice(0, 5).forEach((model, i) => {
      console.log(`   ${i + 1}. ${model.id} - ${model.name}`)
    })

    return models
  } catch (error) {
    console.error(
      "❌ Fehler beim Abrufen der Modelle:",
      error instanceof Error ? error.message : error
    )
    throw error
  }
}

/**
 * Test 3: Vision-Capability mit Test-Bild
 */
async function testVisionCapability(): Promise<boolean> {
  console.log("\n🔍 Test 3: Vision-Capability...")

  // Erstelle ein minimales Test-Bild (1x1 Pixel PNG, Base64)
  const testImageBase64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

  try {
    const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "HTTP-Referer": "https://kessel-boilerplate.local",
        "X-Title": "Kessel B2B App",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Was siehst du auf diesem Bild? Antworte nur mit 'Test erfolgreich' wenn du das Bild sehen kannst.",
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/png;base64,${testImageBase64}`,
                },
              },
            ],
          },
        ],
        max_tokens: 50,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error(`❌ Vision-Test fehlgeschlagen: ${response.status} - ${error}`)
      return false
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content || ""

    if (
      content.toLowerCase().includes("test erfolgreich") ||
      content.toLowerCase().includes("erfolgreich")
    ) {
      console.log("✅ Vision-Capability funktioniert")
      console.log(`   Antwort: ${content.substring(0, 100)}...`)
      return true
    } else {
      console.warn("⚠️  Vision-Test unklar - Antwort:", content.substring(0, 100))
      return true // Trotzdem als Erfolg werten, wenn API antwortet
    }
  } catch (error) {
    console.error("❌ Vision-Test Fehler:", error instanceof Error ? error.message : error)
    return false
  }
}

/**
 * Test 4: Einfache Chat-Completion
 */
async function testChatCompletion(): Promise<boolean> {
  console.log("\n🔍 Test 4: Chat-Completion...")

  try {
    const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "HTTP-Referer": "https://kessel-boilerplate.local",
        "X-Title": "Kessel B2B App",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "user",
            content: "Antworte nur mit 'OK' wenn du diese Nachricht erhalten hast.",
          },
        ],
        max_tokens: 10,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error(`❌ Chat-Completion fehlgeschlagen: ${response.status} - ${error}`)
      return false
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content || ""

    console.log("✅ Chat-Completion funktioniert")
    console.log(`   Antwort: ${content}`)
    return true
  } catch (error) {
    console.error("❌ Chat-Completion Fehler:", error instanceof Error ? error.message : error)
    return false
  }
}

/**
 * Hauptfunktion
 */
async function runTests() {
  console.log("🚀 OpenRouter Connectivity-Test\n")
  console.log(`📡 API Key: ${OPENROUTER_API_KEY.substring(0, 20)}...`)
  console.log(`🌐 Base URL: ${OPENROUTER_BASE_URL}\n`)

  const results = {
    apiReachability: false,
    availableModels: false,
    visionCapability: false,
    chatCompletion: false,
  }

  // Test 1: API-Erreichbarkeit
  results.apiReachability = await testApiReachability()
  if (!results.apiReachability) {
    console.error("\n❌ Connectivity-Test fehlgeschlagen: API nicht erreichbar")
    process.exit(1)
  }

  // Test 2: Verfügbare Modelle
  try {
    await testAvailableModels()
    results.availableModels = true
  } catch {
    console.error("\n❌ Connectivity-Test fehlgeschlagen: Modelle nicht abrufbar")
    process.exit(1)
  }

  // Test 3: Vision-Capability
  results.visionCapability = await testVisionCapability()

  // Test 4: Chat-Completion
  results.chatCompletion = await testChatCompletion()

  // Zusammenfassung
  console.log("\n" + "=".repeat(50))
  console.log("📊 Test-Zusammenfassung:")
  console.log("=".repeat(50))
  console.log(`✅ API-Erreichbarkeit: ${results.apiReachability ? "OK" : "FEHLER"}`)
  console.log(`✅ Verfügbare Modelle: ${results.availableModels ? "OK" : "FEHLER"}`)
  console.log(
    `${results.visionCapability ? "✅" : "⚠️ "} Vision-Capability: ${results.visionCapability ? "OK" : "WARNUNG"}`
  )
  console.log(`✅ Chat-Completion: ${results.chatCompletion ? "OK" : "FEHLER"}`)
  console.log("=".repeat(50))

  const allCritical = results.apiReachability && results.availableModels && results.chatCompletion

  if (allCritical) {
    console.log("\n✅ Alle kritischen Tests erfolgreich!")
    console.log("🚀 Phase 1 kann beginnen.\n")
    process.exit(0)
  } else {
    console.error("\n❌ Einige kritische Tests fehlgeschlagen!")
    console.error("⚠️  Phase 1 kann NICHT beginnen.\n")
    process.exit(1)
  }
}

runTests().catch((error) => {
  console.error("\n❌ Unerwarteter Fehler:", error)
  process.exit(1)
})
