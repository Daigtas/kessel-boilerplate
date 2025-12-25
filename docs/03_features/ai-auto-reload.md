# Feature: Auto-Reload nach AI Tool-Calls

> **Status:** 📋 Geplant  
> **Priorität:** Hoch  
> **Geschätzter Aufwand:** 1-2h  
> **Abhängigkeiten:** AI Tool-Calling System

## Problem

Wenn der AI-Chatbot eine Datenbank-Änderung durchführt (z.B. User anlegen, Rolle ändern), wird die aktuelle Seite nicht automatisch aktualisiert. Der User muss manuell refreshen, um die Änderungen zu sehen.

**Beispiel:**

1. User ist auf `/account/users`
2. User schreibt im Chat: "Lege einen neuen User Carmen an"
3. AI führt `insert_profiles` aus ✅
4. User-Liste zeigt Carmen **nicht** an ❌
5. User muss F5 drücken

---

## Lösung: Tool-Result Event + Router Refresh

### Architektur

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   AI Chat API   │     │  AIChatPanel    │     │   Next.js App   │
│                 │     │                 │     │                 │
│  Tool-Call      │────►│  onToolResult   │────►│  router.refresh │
│  erfolgreich    │     │  Event          │     │  ()             │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### Implementierung

#### 1. Backend: Tool-Result im Stream markieren

```typescript
// src/app/api/chat/route.ts
const result = streamText({
  // ...
  onStepFinish: async (step) => {
    if (step.type === "tool-result") {
      // Prüfe ob es ein Write-Tool war
      const writeTools = ["insert_", "update_", "delete_", "create_user", "delete_user"]
      const wasWriteOperation = step.toolCalls.some((tc) =>
        writeTools.some((prefix) => tc.name.startsWith(prefix))
      )

      if (wasWriteOperation) {
        // Markiere im Stream, dass ein Refresh nötig ist
        // Das passiert automatisch durch das Tool-Result
        console.log("[Chat API] Write-Operation completed, refresh recommended")
      }
    }
  },
})
```

#### 2. Frontend: Tool-Completion Handler

```typescript
// src/components/shell/AIChatPanel.tsx
import { useRouter } from "next/navigation"

export function AIChatPanel({ className }: AIChatPanelProps) {
  const router = useRouter()

  // useChatRuntime mit onToolCall Handler
  const runtime = useChatRuntime({
    transport: chatTransport,
    onToolCall: async ({ toolCall }) => {
      // Write-Tools identifizieren
      const writeTools = ["insert_", "update_", "delete_", "create_user", "delete_user"]
      const isWriteOperation = writeTools.some((prefix) => toolCall.toolName.startsWith(prefix))

      if (isWriteOperation) {
        console.log("[AIChatPanel] Write-Tool detected:", toolCall.toolName)
      }
    },
    onFinish: async (message) => {
      // Prüfe ob Tool-Calls im Message waren
      const hasToolCalls = message.parts?.some((p) => p.type === "tool-call")

      if (hasToolCalls) {
        // Kurze Verzögerung für DB-Konsistenz
        await new Promise((resolve) => setTimeout(resolve, 500))

        // Seite refreshen
        router.refresh()
        console.log("[AIChatPanel] Page refreshed after tool completion")
      }
    },
  })

  // ...
}
```

#### 3. Alternative: Custom Event System

```typescript
// src/lib/events/data-change.ts
type DataChangeEvent = {
  table: string
  operation: "insert" | "update" | "delete"
  id?: string
}

// Event Bus für Datenänderungen
export const dataChangeEmitter = new EventTarget()

export function emitDataChange(event: DataChangeEvent) {
  dataChangeEmitter.dispatchEvent(new CustomEvent("data-change", { detail: event }))
}

// Hook zum Abonnieren
export function useDataChangeListener(tables: string[], callback: () => void) {
  useEffect(() => {
    const handler = (e: CustomEvent<DataChangeEvent>) => {
      if (tables.includes(e.detail.table)) {
        callback()
      }
    }

    dataChangeEmitter.addEventListener("data-change", handler as EventListener)
    return () => {
      dataChangeEmitter.removeEventListener("data-change", handler as EventListener)
    }
  }, [tables, callback])
}
```

```typescript
// Verwendung in einer Seite
function UsersPage() {
  const [users, setUsers] = useState([])

  const loadUsers = useCallback(async () => {
    const { data } = await supabase.from("profiles").select("*")
    setUsers(data ?? [])
  }, [])

  // Auto-Reload wenn profiles geändert wird
  useDataChangeListener(["profiles"], loadUsers)

  // ...
}
```

---

## Alternative: Supabase Realtime

Für echte Live-Updates ohne Polling:

```typescript
// src/hooks/use-realtime-table.ts
import { useEffect, useState } from "react"
import { createClient } from "@/utils/supabase/client"

export function useRealtimeTable<T>(tableName: string, initialData: T[]): T[] {
  const [data, setData] = useState<T[]>(initialData)
  const supabase = createClient()

  useEffect(() => {
    const channel = supabase
      .channel(`${tableName}-changes`)
      .on("postgres_changes", { event: "*", schema: "public", table: tableName }, (payload) => {
        console.log(`[Realtime] ${tableName} changed:`, payload.eventType)

        switch (payload.eventType) {
          case "INSERT":
            setData((prev) => [...prev, payload.new as T])
            break
          case "UPDATE":
            setData((prev) =>
              prev.map((item) => ((item as any).id === payload.new.id ? (payload.new as T) : item))
            )
            break
          case "DELETE":
            setData((prev) => prev.filter((item) => (item as any).id !== payload.old.id))
            break
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [tableName, supabase])

  return data
}
```

```typescript
// Verwendung
function UsersPage() {
  const initialUsers = await fetchUsers() // Server Component
  const users = useRealtimeTable("profiles", initialUsers)

  return <UserList users={users} />
}
```

**Hinweis:** Supabase Realtime muss in der Supabase-Konsole aktiviert sein!

---

## Empfohlene Implementierung

### Phase 1: Quick Win (30 Min)

Einfacher `router.refresh()` nach Tool-Completion:

```typescript
// AIChatPanel.tsx - Minimal-Lösung
const runtime = useChatRuntime({
  transport: chatTransport,
  onFinish: () => {
    // Immer refreshen nach Chat-Completion
    // (könnte optimiert werden, nur bei Tool-Calls)
    router.refresh()
  },
})
```

### Phase 2: Optimiert (1h)

Nur bei Write-Operations refreshen:

```typescript
onFinish: (message) => {
  const hasWriteToolCall = message.parts?.some(
    (p) =>
      p.type === "tool-call" &&
      ["insert_", "update_", "delete_"].some((op) => p.toolName.startsWith(op))
  )

  if (hasWriteToolCall) {
    setTimeout(() => router.refresh(), 300)
  }
}
```

### Phase 3: Live-Updates (2h)

Supabase Realtime für kritische Tabellen (`profiles`, `roles`, `themes`).

---

## Implementierungsplan

### Sofort umsetzbar

- [ ] `router.refresh()` nach Tool-Completion in `AIChatPanel.tsx`
- [ ] 300ms Delay für DB-Konsistenz

### Später

- [ ] Event-System für granulare Updates
- [ ] Supabase Realtime für Live-Updates
- [ ] Toast-Notification: "Daten wurden aktualisiert"

---

## Referenzen

- [Next.js router.refresh()](https://nextjs.org/docs/app/api-reference/functions/use-router#routerrefresh)
- [Supabase Realtime](https://supabase.com/docs/guides/realtime)
- [AI Tool-Calling Dokumentation](./ai-tool-calling.md)
