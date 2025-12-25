/**
 * Chat Persistence Hook
 *
 * Speichert und lädt Chat-Nachrichten aus dem LocalStorage.
 * Ermöglicht das Beibehalten der Chat-Historie über Seitenwechsel hinweg.
 */

import { useCallback, useEffect, useState } from "react"

const STORAGE_KEY = "kessel-chat-history"
const MAX_MESSAGES = 50 // Max. Anzahl der gespeicherten Messages

/**
 * Message-Struktur für die Persistenz
 * Vereinfacht gegenüber der internen assistant-ui Struktur
 */
export interface PersistedMessage {
  id: string
  role: "user" | "assistant" | "system"
  content: Array<{ type: "text"; text: string }>
  createdAt: string
}

/**
 * Lädt die Chat-Historie aus dem LocalStorage
 */
function loadMessages(): PersistedMessage[] {
  if (typeof window === "undefined") return []

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return []

    const parsed = JSON.parse(stored) as PersistedMessage[]
    // Validierung: Nur gültige Messages zurückgeben
    return parsed.filter(
      (m) =>
        m.id &&
        m.role &&
        Array.isArray(m.content) &&
        m.content.every((c) => c.type === "text" && typeof c.text === "string")
    )
  } catch (error) {
    console.error("[ChatPersistence] Fehler beim Laden der Messages:", error)
    return []
  }
}

/**
 * Speichert Messages im LocalStorage
 */
function saveMessages(messages: PersistedMessage[]): void {
  if (typeof window === "undefined") return

  try {
    // Nur die letzten MAX_MESSAGES speichern
    const toSave = messages.slice(-MAX_MESSAGES)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave))
  } catch (error) {
    console.error("[ChatPersistence] Fehler beim Speichern der Messages:", error)
  }
}

/**
 * Hook für Chat-Persistenz
 *
 * @returns Object mit Messages und Funktionen zum Verwalten
 */
export function useChatPersistence() {
  const [messages, setMessages] = useState<PersistedMessage[]>([])
  const [isLoaded, setIsLoaded] = useState(false)

  // Beim ersten Mount: Messages aus LocalStorage laden
  useEffect(() => {
    // Prüfe auf clearChat Query-Parameter
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search)
      if (params.get("clearChat") === "1") {
        console.log("[ChatPersistence] clearChat=1 erkannt - lösche Chat-Historie")
        localStorage.removeItem(STORAGE_KEY)
        // Entferne Query-Parameter aus URL ohne Reload
        const newUrl = window.location.pathname
        window.history.replaceState({}, "", newUrl)
        setIsLoaded(true)
        return
      }
    }
    
    const loaded = loadMessages()
    setMessages(loaded)
    setIsLoaded(true)
    console.log("[ChatPersistence] Geladen:", loaded.length, "Messages")
  }, [])

  // Message hinzufügen und speichern
  const addMessage = useCallback((message: PersistedMessage) => {
    setMessages((prev) => {
      const updated = [...prev, message]
      saveMessages(updated)
      return updated
    })
  }, [])

  // Alle Messages auf einmal setzen und speichern
  const setAndSaveMessages = useCallback((newMessages: PersistedMessage[]) => {
    setMessages(newMessages)
    saveMessages(newMessages)
  }, [])

  // Chat-Historie löschen
  const clearHistory = useCallback(() => {
    setMessages([])
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEY)
    }
    console.log("[ChatPersistence] Historie gelöscht")
  }, [])

  // Messages für assistant-ui formatieren (initialMessages Format)
  const getInitialMessages = useCallback(() => {
    return messages.map((m) => ({
      role: m.role,
      content: m.content,
    }))
  }, [messages])

  return {
    messages,
    isLoaded,
    addMessage,
    setMessages: setAndSaveMessages,
    clearHistory,
    getInitialMessages,
  }
}

