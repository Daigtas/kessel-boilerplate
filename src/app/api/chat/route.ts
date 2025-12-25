/**
 * API Route: AI Chat mit OpenRouter + Tool-Calling
 *
 * Streaming Chat-Endpoint mit multimodalem Kontext:
 * - Screenshot (Base64)
 * - HTML-Dump
 * - Wiki-Content
 * - User-Interactions (vom Client als LocalStorage-Daten)
 * - Tool-Calling für Datenbank-Operationen
 *
 * Provider: OpenRouter (Gemini 2.5 Flash, Claude, GPT-4o, etc.)
 */

import { streamText, type CoreMessage, type ImagePart, type TextPart } from "ai"
import { openrouter, DEFAULT_MODEL } from "@/lib/ai/openrouter-provider"
import { generateAllTools } from "@/lib/ai/tool-registry"
import type { ToolExecutionContext } from "@/lib/ai/tool-executor"
import { loadWikiContent } from "@/lib/ai-chat/wiki-content"
import { createClient } from "@/utils/supabase/server"
import type { UserInteraction } from "@/lib/ai-chat/types"

// Streaming-Timeout erhöhen
export const maxDuration = 60

/**
 * Interactions als lesbaren Text formatieren.
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
 */
function buildSystemPrompt(context: {
  wikiContent: string
  interactions: string
  currentRoute: string
  hasScreenshot: boolean
  hasHtmlDump: boolean
  availableTools: string[]
}): string {
  const toolList =
    context.availableTools.length > 0
      ? `\n\n### Verfügbare Tools - RUFE SIE DIREKT AUF!\nDu hast folgende Tools zur Verfügung:\n${context.availableTools.map((t) => `- ${t}`).join("\n")}\n\n**KRITISCH - Tool-Aufruf:**\n- RUFE Tools DIREKT auf - NICHT nur ankündigen!\n- Wenn du sagst "ich frage die Rollen ab", dann RUFE query_roles SOFORT auf\n- query_* Tools: SOFORT ausführen, keine Bestätigung\n- insert_*: IDs werden AUTO-generiert, NIEMALS fragen\n- insert_*: created_at/updated_at werden AUTO-gesetzt\n- delete_*: NUR hier Bestätigung erforderlich\n\n**Fremdschlüssel-Workflow:**\n1. Wenn role_id etc. benötigt: RUFE query_roles auf (nicht fragen!)\n2. Dann: RUFE insert_profiles mit der gefundenen role_id auf`
      : ""

  return `Du bist ein hilfreicher KI-Assistent für eine B2B-Anwendung.

## Deine Rolle
- Du hilfst Nutzern bei Fragen zur Anwendung
- Du kannst Daten abfragen und ändern, wenn der Nutzer darum bittet
- READ-Operationen (query_*) führst du SOFORT aus - keine Bestätigung nötig
- INSERT/UPDATE führst du aus nachdem du kurz gezeigt hast was passiert
- DELETE: Frage IMMER nach Bestätigung bevor du löschst
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
${toolList}

## Antwort-Richtlinien
1. Sei präzise und hilfreich
2. WICHTIG: Wenn Daten benötigt werden, RUFE das passende Tool SOFORT auf - nicht ankündigen!
3. Bei Tool-Aufrufen: Führe sie DIREKT aus, dann erkläre das Ergebnis
4. Bei Unsicherheit frage nach mehr Details
5. Formatiere längere Antworten mit Markdown`
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
 */
interface ChatRequestBody {
  messages: ClientMessage[]
  screenshot?: string
  htmlDump?: string
  route?: string
  interactions?: UserInteraction[]
  model?: string
  dryRun?: boolean
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
    for (let i = converted.length - 1; i >= 0; i--) {
      if (converted[i].role === "user") {
        const textContent = converted[i].content as string

        // Base64 zu Uint8Array konvertieren
        const binaryString = atob(screenshot)
        const bytes = new Uint8Array(binaryString.length)
        for (let j = 0; j < binaryString.length; j++) {
          bytes[j] = binaryString.charCodeAt(j)
        }

        const textPart: TextPart = { type: "text", text: textContent }
        const imagePart: ImagePart = {
          type: "image",
          image: bytes,
          mediaType: "image/jpeg",
        }

        converted[i] = {
          role: "user",
          content: [textPart, imagePart],
        }

        console.log("[Chat API] Screenshot attached, size:", bytes.length, "bytes")
        break
      }
    }
  }

  return converted
}

/**
 * POST Handler für Chat-Requests mit Tool-Calling Support.
 */
export async function POST(req: Request) {
  try {
    // 1. Auth prüfen
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 })
    }

    // 2. Prüfe Environment Variable
    if (!process.env.OPENROUTER_API_KEY) {
      console.warn("[Chat API] OPENROUTER_API_KEY fehlt - AI Chat ist deaktiviert")
      return Response.json(
        {
          error: "AI Service nicht konfiguriert. Bitte setze OPENROUTER_API_KEY in .env.local",
          code: "AI_SERVICE_NOT_CONFIGURED",
        },
        { status: 503 }
      )
    }

    // 3. Request parsen
    const body: ChatRequestBody = await req.json()
    const { messages, screenshot, htmlDump, route, interactions, model, dryRun } = body

    if (!messages || messages.length === 0) {
      return Response.json({ error: "No messages provided" }, { status: 400 })
    }

    // 4. Kontext aufbauen
    const wikiContent = await loadWikiContent()

    // Execution Context für Tools
    const toolContext: ToolExecutionContext = {
      userId: user.id,
      sessionId: crypto.randomUUID(),
      dryRun: dryRun ?? false,
    }

    const tools = await generateAllTools(toolContext)
    const availableToolNames = Object.keys(tools)

    // 5. System-Prompt
    const systemPrompt = buildSystemPrompt({
      wikiContent: wikiContent || "Wiki-Content nicht verfügbar.",
      interactions: formatInteractions(interactions ?? []),
      currentRoute: route ?? "",
      hasScreenshot: !!screenshot,
      hasHtmlDump: !!htmlDump,
      availableTools: availableToolNames,
    })

    // 6. Messages konvertieren
    const modelMessages = convertMessages(messages, screenshot)

    // 7. OpenRouter aufrufen mit Tool-Calling
    const selectedModel = model ?? DEFAULT_MODEL
    const toolCount = Object.keys(tools).length

    console.log("[Chat API] Starting streamText with model:", selectedModel)
    console.log("[Chat API] Tools available:", toolCount > 0 ? Object.keys(tools).join(", ") : "none")

    const result = await streamText({
      model: openrouter(selectedModel),
      system: systemPrompt,
      messages: modelMessages,
      tools: toolCount > 0 ? tools : undefined,
      maxSteps: 5, // Max. 5 Tool-Call Iterationen
      onStepFinish: (step) => {
        // Logging für jeden Schritt (inkl. Tool-Calls)
        const textPreview = step.text 
          ? step.text.substring(0, 100) + (step.text.length > 100 ? "..." : "")
          : "(no text)"
        
        console.log("[Chat API] Step finished:", {
          stepType: step.stepType,
          text: textPreview,
          toolCalls: step.toolCalls?.map((tc) => ({
            toolName: tc.toolName,
            args: tc.args ? String(JSON.stringify(tc.args)).substring(0, 100) : "(no args)",
          })),
          toolResults: step.toolResults?.map((tr) => ({
            toolName: tr.toolName,
            result: tr.result ? String(JSON.stringify(tr.result)).substring(0, 100) : "(no result)",
          })),
        })
      },
    })

    console.log("[Chat API] StreamText started, returning response")

    // Für Streaming mit Tool-Calling: Data Stream Response verwenden
    // Das streamt Text UND Tool-Calls/Results im Data Stream Protocol Format
    return result.toDataStreamResponse({
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
        "X-Model-Used": selectedModel,
      },
    })
  } catch (error) {
    console.error("[Chat API] Error:", error)

    if (error instanceof Error) {
      console.error("[Chat API] Error details:", {
        message: error.message,
        stack: error.stack,
        name: error.name,
      })
    }

    const errorMessage =
      error instanceof Error ? error.message : typeof error === "string" ? error : "Unknown error"

    return Response.json({ error: errorMessage }, { status: 500 })
  }
}
