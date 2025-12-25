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

import { useEffect } from "react"
import { AssistantRuntimeProvider } from "@assistant-ui/react"
import { useChat } from "@ai-sdk/react"
import { useAISDKRuntime } from "@assistant-ui/react-ai-sdk"
import { cn } from "@/lib/utils"
import { Thread } from "@/components/thread"
import { useInteractionLog } from "@/hooks/use-interaction-log"
import { useScreenshotCache } from "@/hooks/use-screenshot-cache"
import {
  captureHtmlDump,
  getCurrentRoute,
  captureScreenshot,
} from "@/lib/ai-chat/context-collector"

/**
 * AIChatPanel Props
 */
interface AIChatPanelProps {
  /** Zusätzliche CSS-Klassen */
  className?: string
}

/**
 * AIChatPanel Komponente
 */
export function AIChatPanel({ className }: AIChatPanelProps): React.ReactElement {
  // Hooks für Context-Sammlung
  const { logInteraction, getRecentInteractions } = useInteractionLog()
  const { pathname } = useScreenshotCache()

  // AI SDK useChat mit prepareSendMessagesRequest für Context-Injection
  const chat = useChat({
    api: "/api/chat",
    credentials: "include",
    // Context wird bei jedem append() im body mitgeschickt
    onError: (error) => {
      console.error("[AIChatPanel] useChat onError:", error)
    },
  })

  // Assistant-UI Runtime - wrapped den chat mit Context-Injection
  const runtime = useAISDKRuntime(chat, {
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
      const interactions = getRecentInteractions(20)

      // Screenshot IMMER frisch machen bei jeder Nachricht
      console.log("[AIChatPanel] Capturing screenshot...")
      const screenshot = await captureScreenshot()
      console.log("[AIChatPanel] Screenshot:", screenshot ? `${screenshot.length} chars` : "null")

      logInteraction("chat_send", "ai-chat-panel", {
        route,
        hasScreenshot: !!screenshot,
        interactionsCount: interactions.length,
      })

      const requestBody = {
        messages,
        route,
        htmlDump,
        interactions,
        screenshot,
      }

      console.log("[AIChatPanel] Request body keys:", Object.keys(requestBody))
      console.log("[AIChatPanel] ===== END SEND =====")

      return requestBody
    },
  })

  // Debug: log chat state
  useEffect(() => {
    console.log("[AIChatPanel] Chat state:", {
      status: chat.status,
      messagesCount: chat.messages?.length ?? 0,
    })
  }, [chat.status, chat.messages])

  // Log chat open
  useEffect(() => {
    logInteraction("chat_open", "ai-chat-panel")
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Nur beim Mount
  }, [])

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
