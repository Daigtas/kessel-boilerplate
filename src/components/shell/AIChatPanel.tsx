"use client"

import { useEffect, useRef, useMemo } from "react"
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
 * Parsed Data Stream Line Types
 */
type ParsedLine =
  | { type: "text"; text: string }
  | { type: "tool-call"; toolCallId: string; toolName: string; args?: Record<string, unknown> }
  | { type: "tool-result"; toolCallId: string; result: unknown }
  | { type: "finish"; finishReason: string }
  | null

/**
 * Parst eine Zeile aus dem Vercel AI SDK Data Stream Protocol
 * 
 * Format:
 * - 0:"text" - Text content
 * - 9:{"toolCallId":"...","toolName":"...","args":{}} - Tool call
 * - a:{"toolCallId":"...","argsTextDelta":"..."} - Tool args delta
 * - b:{"toolCallId":"...","result":...} - Tool result
 * - d:{"finishReason":"..."} - Finish
 * - e:{"finishReason":"...","usage":{}} - Final finish
 */
function parseDataStreamLine(line: string): ParsedLine {
  // Format: TYPE:CONTENT (z.B. "0:\"text\"" oder "9:{...}")
  const colonIndex = line.indexOf(":")
  if (colonIndex === -1) return null

  const typeStr = line.substring(0, colonIndex)
  const content = line.substring(colonIndex + 1)

  try {
    switch (typeStr) {
      case "0": {
        // Text content - JSON string
        const text = JSON.parse(content)
        return typeof text === "string" ? { type: "text", text } : null
      }
      case "9": {
        // Tool call start
        const data = JSON.parse(content)
        return {
          type: "tool-call",
          toolCallId: data.toolCallId,
          toolName: data.toolName,
          args: data.args,
        }
      }
      case "a": {
        // Tool args delta - ignorieren wir für jetzt
        return null
      }
      case "b": {
        // Tool result
        const data = JSON.parse(content)
        return {
          type: "tool-result",
          toolCallId: data.toolCallId,
          result: data.result,
        }
      }
      case "d":
      case "e": {
        // Finish
        const data = JSON.parse(content)
        return {
          type: "finish",
          finishReason: data.finishReason || "unknown",
        }
      }
      default:
        return null
    }
  } catch {
    // JSON parse error - ignorieren
    return null
  }
}

/**
 * Formatiert ein Tool-Ergebnis für die Anzeige im Chat
 */
function formatToolResult(toolName: string, result: unknown): string {
  if (result === null || result === undefined) {
    return "_Keine Daten gefunden._"
  }

  // Arrays als Tabelle oder Liste formatieren
  if (Array.isArray(result)) {
    if (result.length === 0) {
      return "_Keine Einträge gefunden._"
    }

    // Für kleine Arrays: Als Liste formatieren
    if (result.length <= 5) {
      return result
        .map((item, index) => {
          if (typeof item === "object" && item !== null) {
            // Wichtige Felder extrahieren
            const name = item.name || item.title || item.email || item.display_name
            const id = item.id ? ` (ID: ${String(item.id).substring(0, 8)}...)` : ""
            const status = item.status ? ` - ${item.status}` : ""
            return `${index + 1}. **${name || "Eintrag"}**${id}${status}`
          }
          return `${index + 1}. ${String(item)}`
        })
        .join("\n")
    }

    // Für größere Arrays: Zusammenfassung
    return `_${result.length} Einträge gefunden._\n\nErste 3:\n${result
      .slice(0, 3)
      .map((item, index) => {
        const name = typeof item === "object" && item !== null 
          ? (item.name || item.title || item.email || "Eintrag")
          : String(item)
        return `${index + 1}. ${name}`
      })
      .join("\n")}\n...`
  }

  // Einzelne Objekte
  if (typeof result === "object") {
    const obj = result as Record<string, unknown>
    const name = obj.name || obj.title || obj.email || obj.display_name
    if (name) {
      return `**${name}** erfolgreich.`
    }
    return `_Aktion erfolgreich ausgeführt._`
  }

  // Primitive Werte
  return String(result)
}

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
 * - Streaming-Responses von OpenRouter (Gemini, Claude, GPT-4o, etc.)
 * - Markdown-Rendering
 * - User-Interaction-Logging (Local-First)
 * - Tool-Calling für Datenbank-Operationen
 * - Aktuelle Route, HTML-Dump und Interactions im Kontext
 * - Screenshot bei Chat-Start und Route-Änderung (Performance-optimiert)
 */
export function AIChatPanel({ className }: AIChatPanelProps): React.ReactElement {
  // Interaction-Log Hook (Local-First)
  const { logInteraction, getRecentInteractions } = useInteractionLog()
  
  // Refs für stabile Callbacks
  const logInteractionRef = useRef(logInteraction)
  const getRecentInteractionsRef = useRef(getRecentInteractions)
  
  useEffect(() => {
    logInteractionRef.current = logInteraction
    getRecentInteractionsRef.current = getRecentInteractions
  })

  // Custom Model Adapter mit Kontext und Screenshot
  // WICHTIG: useMemo damit der Adapter stabil bleibt und useLocalRuntime
  // den Composer korrekt mit dem Adapter verbinden kann
  const modelAdapter: ChatModelAdapter = useMemo(() => ({
    async *run({ messages, abortSignal }) {
      console.log("[AIChatPanel] run() called with messages:", messages.length)
      
      // Kontext sammeln bei jedem Request
      const interactions = getRecentInteractionsRef.current(20)
      const htmlDump = captureHtmlDump()
      const route = getCurrentRoute()

      // Screenshot bei jeder Nachricht
      console.log("[AIChatPanel] Taking fresh screenshot for route:", route)
      const screenshot = await captureScreenshot()
      console.log(
        "[AIChatPanel] Screenshot taken:",
        screenshot ? `${screenshot.length} chars` : "FAILED"
      )
      logInteractionRef.current("screenshot_taken", "ai-chat-panel", { route })

      console.log("[AIChatPanel] Sending to API with screenshot:", !!screenshot)
      logInteractionRef.current("chat_send", "ai-chat-panel", { hasScreenshot: !!screenshot })

      // Request an die API senden
      const startTime = Date.now()
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // Wichtig für Supabase Auth Cookies
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
          screenshot,
        }),
        signal: abortSignal,
      })

      console.log("[AIChatPanel] Response status:", response.status)

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
            "AI-Service ist nicht konfiguriert. Bitte setze OPENROUTER_API_KEY in den Supabase Vault."
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
      let buffer = "" // Buffer für unvollständige Zeilen
      const toolCalls: Map<string, { toolName: string; args: Record<string, unknown> }> = new Map()

      const contentType = response.headers.get("Content-Type")
      console.log("[AIChatPanel] Starting stream read, Content-Type:", contentType)

      try {
        while (true) {
          // Prüfe ob Request abgebrochen wurde
          if (abortSignal?.aborted) {
            console.log("[AIChatPanel] Request aborted by signal")
            break
          }

          // Timeout für jeden Chunk (60 Sekunden)
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
            if (fullText) {
              yield { content: [{ type: "text" as const, text: fullText }] }
            }
            throw timeoutError
          }

          if (done) {
            // Stream beendet - verarbeite verbleibenden Buffer
            if (buffer.trim()) {
              const lines = buffer.split('\n')
              for (const line of lines) {
                if (!line.trim()) continue
                const parsed = parseDataStreamLine(line)
                if (parsed?.type === "text") {
                  fullText += parsed.text
                }
              }
            }
            // Final yield mit vollständigem Text
            if (fullText.trim()) {
              yield { content: [{ type: "text" as const, text: fullText }] }
            }
            break
          }

          if (value && value.length > 0) {
            try {
              const chunk = decoder.decode(value, { stream: true })
              if (chunk) {
                chunkCount++
                buffer += chunk
                
                // Verarbeite vollständige Zeilen
                const lines = buffer.split('\n')
                buffer = lines.pop() || "" // Letzte (möglicherweise unvollständige) Zeile behalten
                
                for (const line of lines) {
                  if (!line.trim()) continue
                  
                  const parsed = parseDataStreamLine(line)
                  if (!parsed) continue
                  
                  switch (parsed.type) {
                    case "text":
                      fullText += parsed.text
                      break
                    case "tool-call":
                      // Tool-Call beginnt
                      toolCalls.set(parsed.toolCallId, {
                        toolName: parsed.toolName,
                        args: parsed.args || {},
                      })
                      console.log("[AIChatPanel] Tool call started:", parsed.toolName)
                      // Zeige dem User, dass ein Tool aufgerufen wird
                      fullText += `\n\n🔧 *Rufe ${parsed.toolName} auf...*\n`
                      break
                    case "tool-result":
                      // Tool-Result erhalten
                      console.log("[AIChatPanel] Tool result received:", parsed.toolCallId)
                      const toolCall = toolCalls.get(parsed.toolCallId)
                      if (toolCall) {
                        // Formatiere das Ergebnis für den User
                        const resultStr = formatToolResult(toolCall.toolName, parsed.result)
                        fullText += `\n📊 **Ergebnis von ${toolCall.toolName}:**\n${resultStr}\n`
                      }
                      break
                    case "finish":
                      // Stream beendet
                      console.log("[AIChatPanel] Stream finished, reason:", parsed.finishReason)
                      break
                  }
                }
                
                // Yield mit akkumuliertem Text
                if (fullText) {
                  yield { content: [{ type: "text" as const, text: fullText }] }
                }

                if (chunkCount % 10 === 0) {
                  console.log(
                    `[AIChatPanel] Received ${chunkCount} chunks, text length: ${fullText.length}`
                  )
                }
              }
            } catch (decodeError) {
              console.error("[AIChatPanel] Decode error:", decodeError)
            }
          }
        }
      } catch (streamError) {
        console.error("[AIChatPanel] Stream error:", streamError)
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
        try {
          reader.releaseLock()
        } catch {
          // Ignore
        }
      }

      const duration = Date.now() - startTime
      console.log(
        `[AIChatPanel] Stream completed: ${chunkCount} chunks, ${fullText.length} chars, ${duration}ms`
      )
      logInteractionRef.current("chat_response", "ai-chat-panel", { chunkCount, duration })
    },
  }), []) // Empty deps - Adapter nutzt Refs für aktuelle Werte

  // Local Runtime mit Custom Adapter
  const runtime = useLocalRuntime(modelAdapter)

  // Log chat open
  useEffect(() => {
    logInteractionRef.current("chat_open", "ai-chat-panel")
  }, [])

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className={cn("flex h-full flex-col", className)}>
        <Thread />
      </div>
    </AssistantRuntimeProvider>
  )
}
