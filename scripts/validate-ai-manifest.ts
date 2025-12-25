#!/usr/bin/env tsx
/**
 * AI Manifest Validator
 *
 * Validiert ai-manifest.json gegen das Schema und prüft Konsistenz mit Code.
 */

import { glob } from "glob"
import fs from "fs"
import { validateManifest } from "../src/lib/ai/ai-manifest.schema"

const MANIFEST_PATH = "ai-manifest.json"
const COMPONENTS_GLOB = "src/**/*.{tsx,ts}"

interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  stats: {
    totalComponents: number
    usedInCode: number
    unusedInManifest: number
    missingInManifest: number
  }
}

async function validateManifestFile(): Promise<ValidationResult> {
  const errors: string[] = []
  const warnings: string[] = []

  // 1. Manifest laden und validieren
  console.log("📋 Validiere ai-manifest.json...")

  if (!fs.existsSync(MANIFEST_PATH)) {
    return {
      valid: false,
      errors: ["❌ ai-manifest.json nicht gefunden!"],
      warnings: [],
      stats: { totalComponents: 0, usedInCode: 0, unusedInManifest: 0, missingInManifest: 0 },
    }
  }

  const manifestRaw = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf-8"))
  const validationResult = validateManifest(manifestRaw)

  if (!validationResult.success) {
    errors.push("❌ Manifest Schema-Fehler:")
    validationResult.error?.errors.forEach((e) => {
      const path = e.path.join(".")
      errors.push(`  - ${path}: ${e.message}`)
    })
    return {
      valid: false,
      errors,
      warnings: [],
      stats: { totalComponents: 0, usedInCode: 0, unusedInManifest: 0, missingInManifest: 0 },
    }
  }

  const manifest = validationResult.data!
  const manifestIds = new Set(manifest.components.map((c) => c.id))

  // 2. Code scannen für AIInteractable Verwendungen
  console.log("🔍 Scanne Code nach AIInteractable...")

  const files = await glob(COMPONENTS_GLOB)
  const usedIds = new Set<string>()

  for (const file of files) {
    // Test-Dateien überspringen
    if (file.includes("__tests__") || file.includes(".test.") || file.includes(".spec.")) {
      continue
    }

    const content = fs.readFileSync(file, "utf-8")

    // Regex für AIInteractable id Props
    const regex = /<AIInteractable[^>]*id=["']([^"']+)["']/g
    let match
    while ((match = regex.exec(content)) !== null) {
      usedIds.add(match[1])
    }
  }

  // 3. Vergleichen
  const unusedInManifest = [...manifestIds].filter((id) => !usedIds.has(id))
  const missingInManifest = [...usedIds].filter((id) => !manifestIds.has(id))

  // Warnings für unbenutzte Manifest-Einträge
  if (unusedInManifest.length > 0) {
    warnings.push(
      `⚠️  ${unusedInManifest.length} Manifest-Einträge werden nicht im Code verwendet:`
    )
    unusedInManifest.forEach((id) => warnings.push(`    - ${id}`))
  }

  // Errors für fehlende Manifest-Einträge
  if (missingInManifest.length > 0) {
    errors.push(`❌ ${missingInManifest.length} AIInteractable IDs fehlen im Manifest:`)
    missingInManifest.forEach((id) => errors.push(`    - ${id}`))
  }

  // 4. Keyword-Duplikate prüfen
  const keywordMap = new Map<string, string[]>()
  manifest.components.forEach((c) => {
    c.keywords.forEach((kw) => {
      const existing = keywordMap.get(kw.toLowerCase()) || []
      existing.push(c.id)
      keywordMap.set(kw.toLowerCase(), existing)
    })
  })

  keywordMap.forEach((ids, keyword) => {
    if (ids.length > 1) {
      warnings.push(
        `⚠️  Keyword "${keyword}" wird von mehreren Komponenten verwendet: ${ids.join(", ")}`
      )
    }
  })

  // 5. Ergebnis
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    stats: {
      totalComponents: manifest.components.length,
      usedInCode: usedIds.size,
      unusedInManifest: unusedInManifest.length,
      missingInManifest: missingInManifest.length,
    },
  }
}

// Main
async function main() {
  console.log("\n🤖 AI Component Manifest Validator\n")
  console.log("=".repeat(50))

  const result = await validateManifestFile()

  console.log("\n📊 Statistiken:")
  console.log(`   Komponenten im Manifest: ${result.stats.totalComponents}`)
  console.log(`   Im Code verwendet: ${result.stats.usedInCode}`)
  console.log(`   Unbenutzt im Manifest: ${result.stats.unusedInManifest}`)
  console.log(`   Fehlen im Manifest: ${result.stats.missingInManifest}`)

  if (result.warnings.length > 0) {
    console.log("\n⚠️  Warnings:")
    result.warnings.forEach((w) => console.log(w))
  }

  if (result.errors.length > 0) {
    console.log("\n❌ Errors:")
    result.errors.forEach((e) => console.log(e))
    process.exit(1)
  }

  console.log("\n✅ AI Manifest Validation passed!\n")
}

main().catch((error) => {
  console.error("❌ Validator-Fehler:", error)
  process.exit(1)
})
