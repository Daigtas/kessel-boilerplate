/**
 * AIChatPanel Komponente
 *
 * KI-Chat-Interface für das Assist-Panel (Spalte 4).
 * Verwendet assistant-ui mit Vercel AI SDK Integration.
 *
 * Features:
 * - Intelligentes Model-Routing (Gemini 3 Flash für Chat, Claude Opus für Tools)
 * - Screenshot bei jeder Nachricht (Vision-Support)
 * - Tool-Calling für Datenbank-Operationen
 * - Streaming-Responses
 * - Context-Injection (Route, Interactions, HTML-Dump)
 */

"use client"

import { useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { AssistantRuntimeProvider } from "@assistant-ui/react"
import { useChatRuntime, AssistantChatTransport } from "@assistant-ui/react-ai-sdk"
import { cn } from "@/lib/utils"
import { Thread } from "@/components/thread"
import { useScreenshotCache } from "@/hooks/use-screenshot-cache"
import {
  captureHtmlDump,
  getCurrentRoute,
  captureScreenshot,
  collectAvailableActions,
} from "@/lib/ai-chat/context-collector"
import { useAIRegistry } from "@/lib/ai/ai-registry-context"

/**
 * AIChatPanel Props
 */
interface AIChatPanelProps {
  /** Zusätzliche CSS-Klassen */
  className?: string
}

// Transport-Instanz außerhalb der Komponente erstellen
// (wird nur einmal erstellt, keine Refs nötig)
const chatTransport = new AssistantChatTransport({
  api: "/api/chat",
  credentials: "include",
  prepareSendMessagesRequest: async ({ messages }) => {
    console.log("[AIChatPanel] ===== SEND REQUEST =====")
    console.log("[AIChatPanel] Messages count:", messages.length)

    // Log ALLE Messages mit Content - mit null-safety
    messages.forEach((m, i) => {
      console.log(`[AIChatPanel] Message ${i}: role=${m.role}`)
      console.log(`[AIChatPanel] Message ${i} raw:`, JSON.stringify(m).substring(0, 500))
    })

    // Context sammeln
    const route = getCurrentRoute()
    const htmlDump = captureHtmlDump()
    // Interactions können wir nicht direkt vom Hook holen,
    // da wir außerhalb der Komponente sind
    const interactions: unknown[] = []

    // Screenshot IMMER frisch machen bei jeder Nachricht
    console.log("[AIChatPanel] Capturing screenshot...")
    const screenshot = await captureScreenshot()
    console.log("[AIChatPanel] Screenshot:", screenshot ? `${screenshot.length} chars` : "null")

    // Verfügbare UI-Actions sammeln
    const availableActions = collectAvailableActions()
    console.log("[AIChatPanel] Available actions:", availableActions.length)

    const requestBody = {
      messages,
      route,
      htmlDump,
      interactions,
      screenshot,
      availableActions,
    }

    console.log("[AIChatPanel] Request body keys:", Object.keys(requestBody))
    console.log("[AIChatPanel] ===== END SEND =====")

    return { body: requestBody }
  },
})

/**
 * AIChatPanel Komponente
 */
export function AIChatPanel({ className }: AIChatPanelProps): React.ReactElement {
  const { pathname } = useScreenshotCache()
  const router = useRouter()
  const { executeAction } = useAIRegistry()

  // Write-Tool Prefixes die DB-Änderungen auslösen
  const WRITE_TOOL_PREFIXES = ["insert_", "update_", "delete_", "create_user", "delete_user"]

  // Callback für Auto-Reload nach Write-Tool-Calls und UI-Actions
  const handleFinish = useCallback(
    async ({
      message,
    }: {
      message: { parts?: Array<{ type: string; toolName?: string; result?: unknown }> }
    }) => {
      // Prüfe auf UI-Actions in Tool-Results
      message.parts?.forEach(async (part) => {
        if (part.type === "tool-result" && part.result && typeof part.result === "object") {
          const result = part.result as {
            __ui_action?: string
            id?: string
            [key: string]: unknown
          }

          if (result.__ui_action === "execute" && result.id) {
            console.log("[AIChatPanel] UI-Action detected:", result.id)
            const actionResult = await executeAction(result.id)
            if (actionResult.success) {
              console.log("[AIChatPanel] UI-Action executed:", actionResult.message)
            } else {
              console.error("[AIChatPanel] UI-Action failed:", actionResult.message)
            }
          }
        }
      })

      // Prüfe ob Write-Tools aufgerufen wurden
      const hasWriteToolCall = message.parts?.some(
        (part) =>
          part.type === "tool-call" &&
          WRITE_TOOL_PREFIXES.some((prefix) => part.toolName?.startsWith(prefix))
      )

      if (hasWriteToolCall) {
        // Kurze Verzögerung für DB-Konsistenz, dann Seite refreshen
        setTimeout(() => {
          console.log("[AIChatPanel] Write-Tool detected, refreshing page data...")
          router.refresh()
        }, 300)
      }
    },
    [router, executeAction]
  )

  // useChatRuntime mit Transport
  const runtime = useChatRuntime({
    transport: chatTransport,
    onError: (error) => {
      console.error("[AIChatPanel] Chat onError:", error)
    },
    onFinish: handleFinish,
  })

  // Log route changes
  useEffect(() => {
    console.log("[AIChatPanel] Route changed to:", pathname)
  }, [pathname])

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className={cn("flex h-full flex-col", className)}>
        <Thread />
      </div>
    </AssistantRuntimeProvider>
  )
}
