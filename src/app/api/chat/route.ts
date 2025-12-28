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
import { detectToolNeedWithAI, type RouterDecision } from "@/lib/ai/model-router"
import { generateAllTools } from "@/lib/ai/tool-registry"
import type { ToolExecutionContext } from "@/lib/ai/tool-executor"
import { generateUIActionTool, type UIAction } from "@/lib/ai/special-tools"
import { loadWikiContent } from "@/lib/ai-chat/wiki-content"
import { createClient } from "@/utils/supabase/server"
import type { UserInteraction } from "@/lib/ai-chat/types"
import { loadAIManifestServer } from "@/lib/ai/ai-manifest-loader"

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
${context.wikiContent}

## Aktuelle Route
${context.currentRoute || "/"}

## Kürzliche Interaktionen
${context.interactions}

${context.hasScreenshot ? "\n## Screenshot verfügbar\nDu hast Zugriff auf einen Screenshot der aktuellen Seite. Nutze ihn um visuelle Fragen zu beantworten." : ""}
${context.hasHtmlDump ? "\n## HTML-Dump verfügbar\nDu hast Zugriff auf einen HTML-Dump der Seite für strukturelle Analysen." : ""}${toolList}

## Antwort-Stil
- Sei präzise und hilfreich
- Verwende Tools wenn nötig - keine unnötigen Fragen
- Bei Fehlern: Erkläre was schiefgelaufen ist und wie man es behebt
- Bei UI-Aktionen: Führe sie direkt aus mit execute_ui_action Tool

## UI-Element-Suche (WICHTIG!)
Wenn der User nach UI-Elementen fragt (z.B. "Wo ist der Dark Mode Switch?", "Finde den Theme Toggle", "Wie schalte ich X ein?"):
1. Verwende IMMER zuerst **search_ui_components** mit relevanten Keywords
2. Das Tool durchsucht alle registrierten UI-Komponenten nach Keywords
3. Wähle aus den Ergebnissen das passendste Element
4. Führe dann **execute_ui_action** mit der gefundenen action_id aus

Beispiel-Workflow:
- User: "Wo ist der Dark Mode?"
- Du: search_ui_components(query: "dark mode theme")
- Ergebnis zeigt: theme-toggle [Keywords: dark mode, light mode, theme]
- Du: execute_ui_action(action_id: "theme-toggle")
- Du: "Ich habe den Theme-Toggle gefunden und aktiviert!"

## KRITISCH: Nach Tool-Aufrufen
**IMMER** nachdem du ein Tool aufgerufen hast und das Ergebnis erhältst, musst du:
1. Eine kurze Zusammenfassung für den User schreiben
2. Bei query_*: Zeige die wichtigsten Daten in lesbarer Form
3. Bei execute_ui_action: Bestätige was du getan hast (z.B. "Ich habe dich zu X navigiert")
4. NIEMALS nur Tool-Ergebnisse ohne Text-Antwort zurückgeben!

\`\`\`
<sub>— ${context.modelName}</sub>\``
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
  screenshot?: string | null
  htmlDump?: string
  route?: string
  interactions?: UserInteraction[]
  availableActions?: UIAction[]
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
    const lastUserMessageIndex = converted.map((m) => m.role).lastIndexOf("user")
    if (lastUserMessageIndex >= 0) {
      const lastUserMessage = converted[lastUserMessageIndex]
      if (typeof lastUserMessage.content === "string") {
        // Konvertiere zu multimodalem Format
        const multimodalContent: Array<TextPart | ImagePart> = [
          { type: "text", text: lastUserMessage.content },
          {
            type: "image",
            image: Buffer.from(screenshot, "base64"),
          } as ImagePart,
        ]
        converted[lastUserMessageIndex] = {
          role: "user",
          content: multimodalContent,
        } as CoreMessage
      } else if (Array.isArray(lastUserMessage.content)) {
        // Füge Screenshot zu bestehendem multimodalem Content hinzu
        const multimodalContent: Array<TextPart | ImagePart> = [
          ...lastUserMessage.content.filter((c): c is TextPart => c.type === "text"),
          {
            type: "image",
            image: Buffer.from(screenshot, "base64"),
          } as ImagePart,
        ]
        converted[lastUserMessageIndex] = {
          role: "user",
          content: multimodalContent,
        } as CoreMessage
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
    const { messages, screenshot, htmlDump, route, interactions, availableActions, model, dryRun } =
      body

    if (!messages || messages.length === 0) {
      return Response.json({ error: "No messages provided" }, { status: 400 })
    }

    // 4. Messages konvertieren (für Router-Analyse)
    // WICHTIG: Screenshot erstmal NICHT mitkonvertieren, da Router entscheidet ob benötigt
    const modelMessages = convertMessages(messages, null)

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

    // 5. AI-GESTÜTZTER MODEL-ROUTER
    // Entscheidet ob Tools/Screenshot benötigt werden und wählt passendes Modell
    const routerDecision: RouterDecision = await detectToolNeedWithAI(modelMessages)

    console.log("[Chat API] Router decision:", {
      needsTools: routerDecision.needsTools,
      needsScreenshot: routerDecision.needsScreenshot,
      reason: routerDecision.reason,
      model: routerDecision.model,
      maxSteps: routerDecision.maxSteps,
    })

    // 6. Screenshot nur verwenden wenn Router es als notwendig erachtet
    // UND wenn Screenshot tatsächlich vorhanden ist
    const shouldUseScreenshot =
      routerDecision.needsScreenshot === true && screenshot !== null && screenshot !== undefined

    // 7. Messages mit Screenshot konvertieren (nur wenn benötigt)
    const finalMessages = shouldUseScreenshot
      ? convertMessages(messages, screenshot)
      : modelMessages

    // 8. Tools NUR laden wenn Router entscheidet dass sie gebraucht werden
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

    // 8.5. UI-Action Tool: Alle Aktionen aus Manifest laden
    // Das Manifest enthält ALLE Komponenten der App, nicht nur die aktuell gerenderten
    const allManifestActions = await loadAIManifestServer()
    const currentRoute = route ?? "/"

    // Aktionen nach Verfügbarkeit gruppieren
    const availableOnCurrentPage: UIAction[] = []
    const requiresNavigation: UIAction[] = []

    for (const action of allManifestActions) {
      const actionRoute = action.route ?? "global"
      const uiAction: UIAction = {
        id: action.id,
        action: action.action,
        target: action.target,
        description: action.description,
        keywords: action.keywords,
        category: action.category,
        route: actionRoute, // WICHTIG: Route für Navigation mitgeben
      }

      if (actionRoute === "global" || actionRoute === currentRoute) {
        availableOnCurrentPage.push(uiAction)
      } else {
        // Erweitere Beschreibung mit Route-Info für Navigation
        requiresNavigation.push({
          ...uiAction,
          description: `${action.description} [Seite: ${actionRoute}]`,
        })
      }
    }

    // Alle Aktionen zusammenführen für das Tool
    const allUIActions = [...availableOnCurrentPage, ...requiresNavigation]

    if (allUIActions.length > 0) {
      const uiActionTool = generateUIActionTool(allUIActions)
      if (tools) {
        Object.assign(tools, uiActionTool)
      } else {
        tools = uiActionTool
      }
      availableToolNames.push(...Object.keys(uiActionTool))
      console.log(
        "[Chat API] UI-Action Tool loaded:",
        availableOnCurrentPage.length,
        "on current page,",
        requiresNavigation.length,
        "require navigation"
      )
    }

    // 9. Modell aus Router-Decision verwenden (oder explizit überschrieben)
    const selectedModel = model ?? routerDecision.model
    const maxSteps = routerDecision.maxSteps

    // 10. Kontext und System-Prompt aufbauen
    const wikiContent = await loadWikiContent()
    const systemPrompt = buildSystemPrompt({
      wikiContent: wikiContent || "Wiki-Content nicht verfügbar.",
      interactions: formatInteractions(interactions ?? []),
      currentRoute: route ?? "",
      hasScreenshot: shouldUseScreenshot,
      hasHtmlDump: !!htmlDump,
      availableTools: availableToolNames,
      modelName: selectedModel,
    })

    // 11. Stream-Text mit gewähltem Modell und Tools
    const result = streamText({
      model: openrouter(selectedModel),
      system: systemPrompt,
      messages: finalMessages,
      ...(tools && Object.keys(tools).length > 0 ? { tools, stopWhen: stepCountIs(maxSteps) } : {}),
      experimental_telemetry: { isEnabled: true },
    })

    // 12. Streaming-Response zurückgeben
    // assistant-ui benötigt toUIMessageStreamResponse() für korrektes Streaming
    return result.toUIMessageStreamResponse({
      headers: {
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
        "X-Model-Used": selectedModel,
        "X-Router-Reason": routerDecision.reason,
        "X-Tools-Enabled": String(routerDecision.needsTools),
      },
    })
  } catch (error) {
    console.error("[Chat API] Error:", error)
    return Response.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
