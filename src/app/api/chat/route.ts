/**
 * API Route: AI Chat mit OpenRouter + Intelligentem Model-Router
 *
 * Streaming Chat-Endpoint mit:
 * - Intelligentes Model-Routing:
 *   - Gemini 3 Flash: Für normale Chats + Vision/Screenshots (günstig, schnell)
 *   - Claude Opus 4.5: Für Tool-Calling/DB-Operationen (zuverlässig)
 * - Multimodaler Kontext (Screenshot, HTML-Dump, Route, Interactions)
 * - Wiki-Content als Wissensbasis
 * - Dynamisches Tool-Loading basierend auf ai_datasources
 *
 * Provider: OpenRouter
 */

import { streamText, stepCountIs, type CoreMessage, type ImagePart, type TextPart } from "ai"
import { openrouter } from "@/lib/ai/openrouter-provider"
import { detectToolNeed, type RouterDecision } from "@/lib/ai/model-router"
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
  modelName: string
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
5. Formatiere längere Antworten mit Markdown
6. Füge am ENDE jeder Antwort eine neue Zeile hinzu mit: \`<sub>— ${context.modelName}</sub>\``
}

/**
 * Nachricht vom Client
 * AI SDK v5 verwendet "parts", ältere Versionen "content"
 */
interface ClientMessage {
  id: string
  role: "user" | "assistant" | "system"
  content?: string | Array<{ type: string; text?: string }>
  parts?: Array<{ type: string; text?: string }>
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
 * AI SDK v5 verwendet "parts", ältere Versionen "content".
 */
function convertMessages(messages: ClientMessage[], screenshot?: string | null): CoreMessage[] {
  const converted: CoreMessage[] = messages
    .filter((m) => m && m.role)
    .map((m) => {
      // Support sowohl String-Content als auch Array-Content
      // AI SDK v5 verwendet "parts", ältere Versionen "content"
      let textContent = ""

      // Prüfe zuerst "parts" (AI SDK v5 Format)
      if (Array.isArray(m.parts)) {
        textContent =
          m.parts
            .filter((p) => p.type === "text" && p.text)
            .map((p) => p.text)
            .join("\n") || ""
      } else if (typeof m.content === "string") {
        // AI SDK / assistant-ui sendet Content oft als String
        textContent = m.content
      } else if (Array.isArray(m.content)) {
        // Multimodales Format: Array von Parts
        textContent =
          m.content
            .filter((c) => c.type === "text" && c.text)
            .map((c) => c.text)
            .join("\n") || ""
      }

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

    // 4. Messages konvertieren (für Router-Analyse)
    const modelMessages = convertMessages(messages, screenshot)

    // DEBUG: Log incoming messages - vollständig
    console.log("[Chat API] RAW messages:", JSON.stringify(messages, null, 2).substring(0, 2000))
    console.log(
      "[Chat API] Converted messages:",
      modelMessages.map((m) => ({
        role: m.role,
        content:
          typeof m.content === "string"
            ? m.content.substring(0, 100)
            : Array.isArray(m.content)
              ? m.content.map((c) => c.type).join(", ")
              : "(unknown)",
      }))
    )

    // 5. INTELLIGENTER MODEL-ROUTER
    // Entscheidet ob Tools benötigt werden und wählt passendes Modell
    const routerDecision: RouterDecision = detectToolNeed(modelMessages)

    console.log("[Chat API] Router decision:", {
      needsTools: routerDecision.needsTools,
      reason: routerDecision.reason,
      model: routerDecision.model,
      maxSteps: routerDecision.maxSteps,
    })

    // 6. Tools NUR laden wenn Router entscheidet dass sie gebraucht werden
    // Das spart DB-Calls bei einfachen Chat-Anfragen
    let tools: Awaited<ReturnType<typeof generateAllTools>> | undefined
    let availableToolNames: string[] = []

    if (routerDecision.needsTools) {
      const toolContext: ToolExecutionContext = {
        userId: user.id,
        sessionId: crypto.randomUUID(),
        dryRun: dryRun ?? false,
      }
      tools = await generateAllTools(toolContext)
      availableToolNames = Object.keys(tools)
      console.log("[Chat API] Tools loaded:", availableToolNames.join(", ") || "none")
    }

    // 7. Modell aus Router-Decision verwenden (oder explizit überschrieben)
    const selectedModel = model ?? routerDecision.model
    const maxSteps = routerDecision.maxSteps

    // 8. Kontext und System-Prompt aufbauen
    const wikiContent = await loadWikiContent()
    const systemPrompt = buildSystemPrompt({
      wikiContent: wikiContent || "Wiki-Content nicht verfügbar.",
      interactions: formatInteractions(interactions ?? []),
      currentRoute: route ?? "",
      hasScreenshot: !!screenshot,
      hasHtmlDump: !!htmlDump,
      availableTools: availableToolNames,
      modelName: selectedModel,
    })

    console.log("[Chat API] Starting streamText:", {
      model: selectedModel,
      toolCount: availableToolNames.length,
      maxSteps,
      hasScreenshot: !!screenshot,
    })

    // 9. OpenRouter aufrufen (vorher Schritt 9, jetzt nach Modell-Auswahl)
    // Hinweis: streamText in AI SDK v5 gibt ein StreamTextResult zurück
    const result = streamText({
      model: openrouter(selectedModel),
      system: systemPrompt,
      messages: modelMessages,
      tools: tools && Object.keys(tools).length > 0 ? tools : undefined,
      // stopWhen ersetzt maxSteps in AI SDK v5
      stopWhen: stepCountIs(maxSteps),
    })

    console.log("[Chat API] StreamText started")

    // 10. UI Message Stream Response zurückgeben (vorher Schritt 10)
    // Streamt Text UND Tool-Calls/Results im UI Message Protocol Format
    return result.toUIMessageStreamResponse({
      headers: {
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
        // Custom Headers für Debugging/Monitoring
        "X-Model-Used": selectedModel,
        "X-Router-Reason": routerDecision.reason,
        "X-Tools-Enabled": String(routerDecision.needsTools),
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
