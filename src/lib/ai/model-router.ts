/**
 * Model Router für AI Chat
 *
 * Entscheidet intelligent, welches Modell für eine Anfrage verwendet wird:
 * - Gemini 3 Flash: Für normale Chats, Vision, Screenshots (günstig, schnell)
 * - Claude Opus 4.5: Für Tool-Calling, DB-Operationen (zuverlässig)
 *
 * Die Entscheidung basiert auf Heuristiken (Keywords, Entities, Patterns).
 */

import type { CoreMessage } from "ai"
import { DEFAULT_CHAT_MODEL, DEFAULT_TOOL_MODEL } from "./openrouter-provider"

/**
 * Router-Entscheidung
 */
export interface RouterDecision {
  /** Ob Tools benötigt werden */
  needsTools: boolean
  /** Grund für die Entscheidung (für Logging) */
  reason: string
  /** Gewähltes Modell */
  model: string
  /** Empfohlene maxSteps */
  maxSteps: number
}

/**
 * Extrahiert Text aus einer CoreMessage (unterstützt String und Content-Array)
 */
function extractTextFromMessage(message: CoreMessage): string {
  if (typeof message.content === "string") {
    return message.content
  }

  if (Array.isArray(message.content)) {
    return message.content
      .filter((part): part is { type: "text"; text: string } => part.type === "text")
      .map((part) => part.text)
      .join(" ")
  }

  return ""
}

/**
 * DB-Entitäten aus ai_datasources (Tabellennamen)
 * Diese werden als Indikatoren für Tool-Bedarf verwendet.
 */
const DB_ENTITIES = [
  // Deutsche Begriffe
  "rolle",
  "rollen",
  "benutzer",
  "nutzer",
  "profil",
  "profile",
  "fehler",
  "bug",
  "bugs",
  "feature",
  "features",
  "theme",
  "themes",
  "thema",
  "themen",
  // Englische Begriffe
  "roles",
  "users",
  "profiles",
  "user",
]

/**
 * CRUD-Keywords die auf Datenbank-Operationen hindeuten
 */
const CRUD_KEYWORDS = {
  read: [
    "zeige",
    "zeig",
    "liste",
    "auflisten",
    "show",
    "list",
    "get",
    "finde",
    "find",
    "suche",
    "search",
    "abfrage",
    "query",
    "hole",
    "fetch",
    "alle",
    "all",
    "wieviele",
    "how many",
  ],
  create: [
    "erstelle",
    "erstellen",
    "create",
    "anlegen",
    "lege an",
    "leg an",
    "lege",
    "neue",
    "neuen",
    "neuer",
    "new",
    "add",
    "hinzufügen",
    "füge hinzu",
    "insert",
    "einfügen",
  ],
  update: [
    "ändere",
    "ändern",
    "update",
    "bearbeite",
    "bearbeiten",
    "edit",
    "setze",
    "set",
    "aktualisiere",
    "aktualisieren",
    "modify",
    "modifiziere",
  ],
  delete: ["lösche", "löschen", "delete", "remove", "entferne", "entfernen", "drop"],
}

/**
 * Explizite Datenbank-Referenzen
 */
const DB_KEYWORDS = [
  "datenbank",
  "database",
  "tabelle",
  "table",
  "eintrag",
  "einträge",
  "record",
  "records",
  "datensatz",
  "datensätze",
  "supabase",
  "db",
]

/**
 * Analysiert ob eine Nachricht Tool-Calling erfordert
 */
function analyzeForToolNeed(text: string): {
  hasEntity: boolean
  hasCrud: boolean
  hasDbRef: boolean
  crudType: string | null
  matchedEntity: string | null
} {
  const lowerText = text.toLowerCase()

  // Entity-Check
  const matchedEntity = DB_ENTITIES.find((e) => lowerText.includes(e)) ?? null
  const hasEntity = matchedEntity !== null

  // CRUD-Check
  let hasCrud = false
  let crudType: string | null = null
  for (const [type, keywords] of Object.entries(CRUD_KEYWORDS)) {
    if (keywords.some((k) => lowerText.includes(k))) {
      hasCrud = true
      crudType = type
      break
    }
  }

  // DB-Reference-Check
  const hasDbRef = DB_KEYWORDS.some((k) => lowerText.includes(k))

  return { hasEntity, hasCrud, hasDbRef, crudType, matchedEntity }
}

/**
 * Hauptfunktion: Entscheidet welches Modell verwendet werden soll
 *
 * Logik:
 * 1. Wenn keine User-Nachricht → Chat-Modell
 * 2. Wenn explizite DB-Referenz → Tool-Modell
 * 3. Wenn Entity + CRUD-Keyword → Tool-Modell
 * 4. Sonst → Chat-Modell
 *
 * @param messages - Nachrichtenverlauf
 * @returns RouterDecision mit Modell und Konfiguration
 */
export function detectToolNeed(messages: CoreMessage[]): RouterDecision {
  // Finde letzte User-Nachricht
  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user")

  if (!lastUserMessage) {
    return {
      needsTools: false,
      reason: "no-user-message",
      model: DEFAULT_CHAT_MODEL,
      maxSteps: 1,
    }
  }

  const text = extractTextFromMessage(lastUserMessage)
  const analysis = analyzeForToolNeed(text)

  // Explizite DB-Referenz → Tool-Modell
  if (analysis.hasDbRef) {
    return {
      needsTools: true,
      reason: `explicit-db-reference`,
      model: DEFAULT_TOOL_MODEL,
      maxSteps: 8,
    }
  }

  // Entity + CRUD → Tool-Modell
  if (analysis.hasEntity && analysis.hasCrud) {
    return {
      needsTools: true,
      reason: `entity-crud:${analysis.matchedEntity}+${analysis.crudType}`,
      model: DEFAULT_TOOL_MODEL,
      maxSteps: 8,
    }
  }

  // Nur Entity ohne CRUD → könnte Info-Frage sein, Chat-Modell
  // Nur CRUD ohne Entity → unspezifisch, Chat-Modell

  return {
    needsTools: false,
    reason: "general-chat",
    model: DEFAULT_CHAT_MODEL,
    maxSteps: 1,
  }
}

/**
 * Modelle mit Tool-Support
 */
const TOOL_SUPPORTED_MODELS = [
  DEFAULT_TOOL_MODEL, // anthropic/claude-opus-4.5
  "openai/gpt-4.1",
  "anthropic/claude-3.5-sonnet", // Legacy
  "openai/gpt-4o", // Legacy
]

/**
 * Hilfsfunktion: Prüft ob das gewählte Modell Tools unterstützt
 */
export function modelSupportsTools(modelId: string): boolean {
  return TOOL_SUPPORTED_MODELS.includes(modelId)
}
