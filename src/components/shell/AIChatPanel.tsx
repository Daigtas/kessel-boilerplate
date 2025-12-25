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
} from "@/lib/ai-chat/context-collector"

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

    const requestBody = {
      messages,
      route,
      htmlDump,
      interactions,
      screenshot,
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

  // Callback für Auto-Reload nach Tool-Calls
  const handleFinish = useCallback(() => {
    // Kurze Verzögerung für DB-Konsistenz, dann Seite refreshen
    setTimeout(() => {
      console.log("[AIChatPanel] Chat finished, refreshing page data...")
      router.refresh()
    }, 300)
  }, [router])

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
