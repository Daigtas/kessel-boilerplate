/**
 * API Route: AI Chat
 *
 * Streaming Chat-Endpoint mit multimodalem Kontext:
 * - Screenshot (Base64)
 * - HTML-Dump
 * - Wiki-Content
 * - User-Interactions (vom Client als LocalStorage-Daten)
 *
 * Provider: Gemini 2.0 Flash (Primary), OpenAI GPT-4 (Fallback)
 */

import { streamText, type CoreMessage, type ImagePart, type TextPart } from "ai"
import { google } from "@ai-sdk/google"

import { loadWikiContent } from "@/lib/ai-chat/wiki-content"
import type { UserInteraction } from "@/lib/ai-chat/types"

// Streaming-Timeout erhöhen
export const maxDuration = 60

/**
 * Interactions als lesbaren Text formatieren.
 *
 * @param interactions - Array von UserInteraction Objekten
 * @returns Formatierter String für den System-Prompt
 */
function formatInteractions(interactions: UserInteraction[]): string {
  if (interactions.length === 0) {
    return "Keine kürzlichen Interaktionen."
  }

  const formatted = interactions
    .slice(-20) // Nur die letzten 20 für den Kontext
    .map((i) => {
      const time = new Date(i.createdAt).toLocaleTimeString("de-DE", {
        hour: "2-digit",
        minute: "2-digit",
      })
      const meta = i.metadata
      const text = typeof meta?.text === "string" ? ` "${meta.text}"` : ""
      return `[${time}] ${i.actionType}: ${i.target ?? "unknown"}${text}`
    })
    .join("\n")

  return formatted
}

/**
 * System-Prompt mit vollem Kontext aufbauen.
 *
 * @param context - Kontext-Daten für den Prompt
 * @returns Vollständiger System-Prompt als String
 */
function buildSystemPrompt(context: {
  wikiContent: string
  interactions: string
  currentRoute: string
  hasScreenshot: boolean
  hasHtmlDump: boolean
}): string {
  return `Du bist ein hilfreicher KI-Assistent für eine B2B-Anwendung.

## Deine Rolle
- Du hilfst Nutzern bei Fragen zur Anwendung
- Du erklärst Features und Navigation
- Du gibst konkrete, umsetzbare Tipps
- Du antwortest auf Deutsch, es sei denn der User schreibt auf Englisch

## Kontext über die Anwendung

### Wiki-Dokumentation
${context.wikiContent}

### Aktuelle Route des Users
${context.currentRoute || "Unbekannt"}

### Letzte User-Aktionen (chronologisch)
${context.interactions}

${context.hasScreenshot ? "### Screenshot\nDu hast einen Screenshot der aktuellen Ansicht erhalten. Nutze diesen, um kontextbezogene Hilfe zu geben." : ""}

${context.hasHtmlDump ? "### HTML-Struktur\nDu hast die HTML-Struktur der aktuellen Seite erhalten. Nutze diese für technische Fragen zur Seitenstruktur." : ""}

## Antwort-Richtlinien
1. Sei präzise und hilfreich
2. Verweise auf konkrete UI-Elemente wenn möglich
3. Nutze den Kontext (Route, Interaktionen, Screenshot) für relevante Antworten
4. Bei Unsicherheit frage nach mehr Details
5. Formatiere längere Antworten mit Markdown (Listen, Überschriften)`
}

/**
 * Nachricht vom Client
 */
interface ClientMessage {
  id: string
  role: "user" | "assistant" | "system"
  content: Array<{ type: string; text?: string }>
}

/**
 * Request-Body für Chat-Requests.
 * Interactions werden vom Client als LocalStorage-Daten mitgesendet.
 */
interface ChatRequestBody {
  /** Chat-Nachrichten */
  messages: ClientMessage[]
  /** Optional: Screenshot als Base64 */
  screenshot?: string
  /** Optional: HTML-Dump der aktuellen Seite */
  htmlDump?: string
  /** Aktuelle Route */
  route?: string
  /** User-Interactions aus LocalStorage */
  interactions?: UserInteraction[]
}

/**
 * Konvertiert Client-Nachrichten zu CoreMessage Format.
 * Unterstützt multimodale Inhalte (Text + Bilder).
 */
function convertMessages(messages: ClientMessage[], screenshot?: string | null): CoreMessage[] {
  const converted: CoreMessage[] = messages
    .filter((m) => m && m.role)
    .map((m) => {
      const content = Array.isArray(m.content) ? m.content : []
      const textContent =
        content
          .filter((c) => c.type === "text" && c.text)
          .map((c) => c.text)
          .join("\n") || ""

      return {
        role: m.role as "user" | "assistant" | "system",
        content: textContent,
      }
    })

  // Screenshot an die letzte User-Nachricht anhängen (multimodal)
  if (screenshot && converted.length > 0) {
    // Letzte User-Nachricht finden
    for (let i = converted.length - 1; i >= 0; i--) {
      if (converted[i].role === "user") {
        const textContent = converted[i].content as string

        // Base64 zu Uint8Array konvertieren für bessere Kompatibilität
        const binaryString = atob(screenshot)
        const bytes = new Uint8Array(binaryString.length)
        for (let j = 0; j < binaryString.length; j++) {
          bytes[j] = binaryString.charCodeAt(j)
        }

        // Multimodales Content-Array mit korrekten AI SDK Types
        const textPart: TextPart = { type: "text", text: textContent }
        const imagePart: ImagePart = {
          type: "image",
          image: bytes,
          mediaType: "image/jpeg",
        }

        // User-Nachricht mit multimodalem Content ersetzen
        converted[i] = {
          role: "user",
          content: [textPart, imagePart],
        }

        console.log("[Chat API] Screenshot attached as Uint8Array, size:", bytes.length, "bytes")
        break
      }
    }
  }

  return converted
}

/**
 * POST Handler für Chat-Requests.
 *
 * Empfängt Chat-Nachrichten und optionalen Kontext (Screenshot, HTML, Interactions).
 * Streamt die Antwort vom LLM zurück.
 */
export async function POST(req: Request) {
  try {
    // Prüfe Environment Variable
    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      console.warn("[Chat API] GOOGLE_GENERATIVE_AI_API_KEY fehlt - AI Chat ist deaktiviert")
      return new Response(
        JSON.stringify({
          error:
            "AI Service nicht konfiguriert. Bitte setze GOOGLE_GENERATIVE_AI_API_KEY in .env.local",
          code: "AI_SERVICE_NOT_CONFIGURED",
        }),
        {
          status: 503, // Service Unavailable statt 500 (Internal Server Error)
          headers: { "Content-Type": "application/json" },
        }
      )
    }

    const body: ChatRequestBody = await req.json()
    const { messages, screenshot, htmlDump, route, interactions = [] } = body

    if (!messages || messages.length === 0) {
      return new Response(JSON.stringify({ error: "No messages provided" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    // Wiki-Content laden
    const wikiContent = await loadWikiContent()

    // System-Prompt aufbauen
    const systemPrompt = buildSystemPrompt({
      wikiContent: wikiContent || "Wiki-Content nicht verfügbar.",
      interactions: formatInteractions(interactions),
      currentRoute: route ?? "",
      hasScreenshot: !!screenshot,
      hasHtmlDump: !!htmlDump,
    })

    // Messages für das Model vorbereiten (mit Screenshot falls vorhanden)
    const modelMessages = convertMessages(messages, screenshot)

    // Stream starten mit Gemini 2.5 Flash (unterstützt Images!)
    const result = streamText({
      model: google("gemini-2.5-flash"),
      system: systemPrompt,
      messages: modelMessages,
    })

    // Response als Text Stream (für Custom Adapter)
    // WICHTIG: toTextStreamResponse() gibt einen einfachen Text-Stream zurück
    // Jeder Chunk enthält einen Text-Delta als UTF-8
    // Headers für bessere Kompatibilität in Production hinzufügen
    return result.toTextStreamResponse({
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no", // Nginx: Disable buffering
      },
    })
  } catch (error) {
    console.error("[Chat API] Error:", error)

    // Detailliertes Error-Logging für Debugging
    if (error instanceof Error) {
      console.error("[Chat API] Error details:", {
        message: error.message,
        stack: error.stack,
        name: error.name,
      })
    }

    const errorMessage =
      error instanceof Error ? error.message : typeof error === "string" ? error : "Unknown error"

    // Stelle sicher, dass der Fehler als JSON zurückgegeben wird
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
}
