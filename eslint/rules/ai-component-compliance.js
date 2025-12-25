/**
 * ESLint Rule: AI Component Compliance
 *
 * Prüft dass AIInteractable Komponenten:
 * - Eine id Prop haben
 * - Eine description Prop haben
 * - Die id im ai-manifest.json registriert ist
 * - Die id kebab-case Format hat
 */

const fs = require("fs")
const path = require("path")

// Manifest laden
const manifestPath = path.resolve(__dirname, "../../ai-manifest.json")
let manifestData = null
let registeredIds = new Set()

try {
  if (fs.existsSync(manifestPath)) {
    const manifestContent = fs.readFileSync(manifestPath, "utf-8")
    manifestData = JSON.parse(manifestContent)
    registeredIds = new Set(manifestData.components?.map((c) => c.id) || [])
  }
} catch (error) {
  // Manifest nicht gefunden oder ungültig - Regel wird deaktiviert
  console.warn("[ESLint] ai-manifest.json nicht gefunden oder ungültig:", error.message)
}

module.exports = {
  meta: {
    type: "problem",
    docs: {
      description: "Ensures AIInteractable components are registered in ai-manifest.json",
      category: "AI Compliance",
    },
    schema: [],
    messages: {
      unregisteredComponent:
        "AIInteractable with id '{{id}}' is not registered in ai-manifest.json",
      missingId: "AIInteractable must have an 'id' prop",
      missingDescription: "AIInteractable must have a 'description' prop",
      invalidIdFormat: "AIInteractable id '{{id}}' must be kebab-case (lowercase with hyphens)",
    },
  },

  create(context) {
    // Wenn Manifest nicht geladen werden konnte, Regel deaktivieren
    if (!manifestData) {
      return {}
    }

    return {
      JSXOpeningElement(node) {
        if (node.name.name !== "AIInteractable") return

        const idProp = node.attributes.find(
          (attr) => attr.type === "JSXAttribute" && attr.name.name === "id"
        )
        const descProp = node.attributes.find(
          (attr) => attr.type === "JSXAttribute" && attr.name.name === "description"
        )

        // Prüfe ob id vorhanden
        if (!idProp) {
          context.report({ node, messageId: "missingId" })
          return
        }

        // Prüfe ob description vorhanden
        if (!descProp) {
          context.report({ node, messageId: "missingDescription" })
          return
        }

        // ID extrahieren (nur Literale)
        if (idProp.value?.type === "Literal") {
          const id = idProp.value.value

          // Prüfe kebab-case Format
          if (!/^[a-z][a-z0-9-]*$/.test(id)) {
            context.report({ node, messageId: "invalidIdFormat", data: { id } })
            return
          }

          // Prüfe ob im Manifest registriert
          if (!registeredIds.has(id)) {
            context.report({ node, messageId: "unregisteredComponent", data: { id } })
          }
        }
      },
    }
  },
}
