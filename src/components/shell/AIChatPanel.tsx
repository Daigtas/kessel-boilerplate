"use client"

import { useEffect } from "react"
import {
  AssistantRuntimeProvider,
  useLocalRuntime,
  type ChatModelAdapter,
} from "@assistant-ui/react"

import { cn } from "@/lib/utils"
import { Thread } from "@/components/thread"
import { useInteractionLog } from "@/hooks/use-interaction-log"
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
 *
 * KI-Chat-Interface für das Assist-Panel (Spalte 4).
 * Verwendet assistant-ui für die Chat-UI und einen Custom Adapter für das Backend.
 *
 * Features:
 * - Streaming-Responses von Gemini
 * - Markdown-Rendering
 * - User-Interaction-Logging (Local-First)
 * - Wiki-Content als Wissensquelle
 * - Aktuelle Route, HTML-Dump und Interactions im Kontext
 * - Screenshot bei Chat-Start und Route-Änderung (Performance-optimiert)
 */
export function AIChatPanel({ className }: AIChatPanelProps): React.ReactElement {
  // Interaction-Log Hook (Local-First)
  const { logInteraction, getRecentInteractions } = useInteractionLog()

  // Screenshot wird bei JEDER Nachricht neu gemacht
  // Das garantiert immer aktuelle Ansicht (etwas mehr Overhead, aber zuverlässig)

  // Custom Model Adapter mit Kontext und Screenshot
  const modelAdapter: ChatModelAdapter = {
    async *run({ messages, abortSignal }) {
      // Kontext sammeln bei jedem Request
      const interactions = getRecentInteractions(20)
      const htmlDump = captureHtmlDump()
      const route = getCurrentRoute()

      // Screenshot-Logik: IMMER neuen Screenshot bei jeder Nachricht
      // Das garantiert, dass die AI immer die aktuelle Ansicht sieht
      console.log("[AIChatPanel] Taking fresh screenshot for route:", route)
      const screenshot = await captureScreenshot()
      console.log(
        "[AIChatPanel] Screenshot taken:",
        screenshot ? `${screenshot.length} chars` : "FAILED"
      )
      logInteraction("screenshot_taken", "ai-chat-panel", { route })

      console.log("[AIChatPanel] Sending to API with screenshot:", !!screenshot)
      logInteraction("chat_send", "ai-chat-panel", { hasScreenshot: !!screenshot })

      // Request an die API senden (mit Screenshot wenn vorhanden)
      const startTime = Date.now()
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: messages.map((m) => ({
            id: m.id,
            role: m.role,
            content: (m.content || []).map((c) => {
              if (c.type === "text") return { type: "text", text: c.text }
              return c
            }),
          })),
          route,
          htmlDump,
          interactions,
          screenshot, // Screenshot nur bei Chat-Start oder Route-Änderung
        }),
        signal: abortSignal,
      })

      if (!response.ok) {
        let errorText = "Unknown error"
        let errorCode: string | undefined
        try {
          const errorData = await response.json()
          errorText = errorData.error || errorText
          errorCode = errorData.code
        } catch {
          errorText = await response.text().catch(() => `HTTP ${response.status}`)
        }

        // Spezielle Behandlung für nicht konfigurierten AI-Service
        if (errorCode === "AI_SERVICE_NOT_CONFIGURED" || response.status === 503) {
          throw new Error(
            "AI-Service ist nicht konfiguriert. Bitte setze GOOGLE_GENERATIVE_AI_API_KEY in .env.local"
          )
        }

        throw new Error(`API error: ${errorText}`)
      }

      // Streaming Response verarbeiten
      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error("No response body - Stream nicht verfügbar")
      }

      const decoder = new TextDecoder("utf-8")
      let fullText = ""
      let chunkCount = 0

      const contentType = response.headers.get("Content-Type")
      console.log("[AIChatPanel] Starting stream read, Content-Type:", contentType)

      try {
        while (true) {
          // Prüfe ob Request abgebrochen wurde
          if (abortSignal?.aborted) {
            console.log("[AIChatPanel] Request aborted by signal")
            break
          }

          // Timeout für jeden Chunk (60 Sekunden für Production)
          const readPromise = reader.read()
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Stream timeout after 60s")), 60000)
          )

          let done: boolean
          let value: Uint8Array | undefined
          try {
            const readResult = await Promise.race([readPromise, timeoutPromise])
            done = readResult.done
            value = readResult.value
          } catch (timeoutError) {
            console.error("[AIChatPanel] Stream timeout:", timeoutError)
            // Wenn bereits Text vorhanden, yield ihn
            if (fullText) {
              yield { content: [{ type: "text" as const, text: fullText }] }
            }
            throw timeoutError
          }

          if (done) {
            // Stream beendet - final decode für verbleibende Bytes im Buffer
            // decoder.decode() ohne Parameter gibt verbleibende Bytes zurück
            try {
              const finalChunk = decoder.decode()
              if (finalChunk) {
                fullText += finalChunk
              }
            } catch {
              // Ignore - kein final chunk nötig
            }
            // Final yield mit vollständigem Text (nur wenn Text vorhanden)
            if (fullText.trim()) {
              yield { content: [{ type: "text" as const, text: fullText }] }
            }
            break
          }

          if (value && value.length > 0) {
            // Decode Chunk (stream: true für partielle UTF-8 Sequenzen)
            try {
              const chunk = decoder.decode(value, { stream: true })
              if (chunk) {
                chunkCount++
                fullText += chunk
                // Yield mit akkumuliertem Text (assistant-ui erwartet vollständigen Text)
                yield { content: [{ type: "text" as const, text: fullText }] }

                // Log alle 10 Chunks für Debugging
                if (chunkCount % 10 === 0) {
                  console.log(
                    `[AIChatPanel] Received ${chunkCount} chunks, text length: ${fullText.length}`
                  )
                }
              }
            } catch (decodeError) {
              console.error("[AIChatPanel] Decode error:", decodeError)
              // Versuche es ohne stream flag
              try {
                const chunk = decoder.decode(value, { stream: false })
                if (chunk) {
                  chunkCount++
                  fullText += chunk
                  yield { content: [{ type: "text" as const, text: fullText }] }
                }
              } catch {
                // Ignore decode errors - skip this chunk
                console.warn("[AIChatPanel] Could not decode chunk, skipping")
              }
            }
          }
        }
      } catch (streamError) {
        console.error("[AIChatPanel] Stream error:", streamError)
        // Wenn ein Fehler auftritt, aber wir bereits Text haben, yield den bisherigen Text
        if (fullText) {
          yield {
            content: [
              {
                type: "text" as const,
                text: fullText + "\n\n[Fehler: Stream unterbrochen]",
              },
            ],
          }
        } else {
          throw streamError
        }
      } finally {
        // Cleanup: Reader freigeben
        try {
          reader.releaseLock()
        } catch {
          // Ignore - bereits freigegeben
        }
      }

      const duration = Date.now() - startTime
      console.log(
        `[AIChatPanel] Stream completed: ${chunkCount} chunks, ${fullText.length} chars, ${duration}ms`
      )
      logInteraction("chat_response", "ai-chat-panel", { chunkCount, duration })
      // Final yield with complete text (no return - generator must return void)
    },
  }

  // Local Runtime mit Custom Adapter
  const runtime = useLocalRuntime(modelAdapter)

  // Log chat open
  useEffect(() => {
    logInteraction("chat_open", "ai-chat-panel")
  }, [logInteraction])

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className={cn("flex h-full flex-col", className)}>
        <Thread />
      </div>
    </AssistantRuntimeProvider>
  )
}
