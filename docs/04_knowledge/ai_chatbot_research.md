# AI Chatbot Architektur für B2B-Web-Apps

> **Blueprint für Next.js 16, React 19, Supabase und Vercel AI SDK**

---

## Inhaltsverzeichnis

1. [Executive Summary](#1-executive-summary)
2. [Paradigmenwechsel: Vom Befehl zur Absicht](#2-paradigmenwechsel)
3. [Architektonisches Fundament](#3-architektonisches-fundament)
4. [Sicherheitsarchitektur & Supabase RLS](#4-sicherheitsarchitektur)
5. [Tool Calling: Der kognitive Motor](#5-tool-calling)
6. [Generative UI](#6-generative-ui)
7. [Implementierungsleitfaden](#7-implementierungsleitfaden)
8. [Observability und Produktion](#8-observability)
9. [Bekannte Fallstricke](#9-fallstricke)
10. [Anhang: Code-Muster](#anhang-code-muster)

---

## 1. Executive Summary

Die Entwicklung moderner B2B-SaaS-Anwendungen befindet sich an einem entscheidenden Wendepunkt. Der traditionelle Ansatz imperativer Benutzeroberflächen weicht zunehmend **agentischen Schnittstellen**.

In diesem neuen Paradigma fungiert die Software als **aktiver Agent**, der komplexe Benutzerabsichten (Intents) in konkrete Datenbankoperationen und UI-Veränderungen übersetzt.

### Kernprinzipien

| Prinzip                  | Beschreibung                                         |
| ------------------------ | ---------------------------------------------------- |
| **Intent-basiert**       | User sagt _was_, System entscheidet _wie_            |
| **Sicherheit durch RLS** | KI handelt im Kontext des authentifizierten Users    |
| **Trennung**             | Absicht (KI) vs. Ausführung (Server) strikt getrennt |
| **Human-in-the-Loop**    | Kritische Aktionen erfordern Bestätigung             |

---

## 2. Paradigmenwechsel

### 2.1 Vom Befehl zur Absicht

**Klassisch:**

> "Navigiere zu Einstellungen → Benutzer → Neu → Formular ausfüllen"

**Intent-basiert:**

> "Füge Dr. Müller als Admin hinzu."

Das System übersetzt unstrukturierten Text in strukturierte API-Aufrufe unter Berücksichtigung von:

- Benutzeridentität
- Berechtigungen (Rolle)
- Mandantenkontext (Multi-Tenancy)

### 2.2 Technologie-Stack Synergien

| Technologie       | Rolle im System                                 |
| ----------------- | ----------------------------------------------- |
| **React 19**      | Actions, Optimistic Updates für responsive UI   |
| **Next.js 16**    | Async Request APIs, Streaming, Edge-Rendering   |
| **Vercel AI SDK** | LLM-Stream-Verarbeitung, Tool-Calling Protokoll |
| **Supabase**      | Datenbank + Sicherheitsanker (RLS)              |
| **OpenRouter**    | Multi-Provider Gateway für LLM-Auswahl          |

---

## 3. Architektonisches Fundament

### 3.1 Asynchrone APIs in Next.js 16

> ⚠️ **Breaking Change**: `cookies()`, `headers()`, `searchParams` sind jetzt **async**!

```typescript
// ✅ Korrekt in Next.js 15+
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"

export async function createClient() {
  const cookieStore = await cookies() // Zwingendes await!

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        },
      },
    }
  )
}
```

### 3.2 AI SDK: UI vs. RSC

| Ansatz                      | Status        | Empfehlung              |
| --------------------------- | ------------- | ----------------------- |
| **AI SDK RSC** (`streamUI`) | Experimentell | ❌ Nicht für Produktion |
| **AI SDK UI** (`useChat`)   | Stabil        | ✅ Empfohlen            |

**AI SDK UI** streamt strukturierte Daten (JSON). Der Client entscheidet, welche Komponente gerendert wird → "Generative UI".

### 3.3 OpenRouter als Gateway

**Vorteile:**

- **Modell-Agnostik**: Model per Config wechselbar
- **Fallback**: Automatisches Load Balancing bei API-Ausfällen
- **Kosten**: Pay-per-Token über alle Provider

---

## 4. Sicherheitsarchitektur

### 4.1 Goldene Regel

> 🔴 **NIEMALS den `service_role` Key in KI-Kontexten verwenden!**

Die KI muss IMMER als der authentifizierte User agieren, nicht als Admin.

### 4.2 Sicherheitsfluss

```
1. User sendet: "Zeige alle Rechnungen"
2. API Route empfängt Request
3. Supabase Client mit User-Token initialisiert
4. KI ruft Tool getInvoices() auf
5. Tool führt supabase.from('invoices').select() aus
6. → RLS Policy prüft automatisch Berechtigung
7. → Nur erlaubte Zeilen werden zurückgegeben
```

Selbst bei "Prompt Injection" schützt RLS die Daten!

### 4.3 RLS Policy Beispiele

| Tabelle      | Operation | Policy                                | Effekt                        |
| ------------ | --------- | ------------------------------------- | ----------------------------- |
| `profiles`   | SELECT    | `auth.uid() == user_id`               | User sieht nur eigenes Profil |
| `org_data`   | SELECT    | `auth.uid() IN (SELECT member_id...)` | Nur Org-Mitglieder            |
| `audit_logs` | INSERT    | `auth.role() == 'authenticated'`      | Jeder kann schreiben          |

### 4.4 Defensive Policies

```sql
-- System-Prompts vor Exfiltration schützen
CREATE POLICY "system_prompts_no_access"
ON system_prompts FOR ALL
USING (false);
```

---

## 5. Tool Calling

> 🎯 **Der kognitive Motor der Anwendung**

### 5.1 Tool-Definition mit Zod

```typescript
import { tool } from "ai"
import { z } from "zod"

export const updateUserRole = tool({
  description: "Aktualisiert die Rolle eines Benutzers.",
  parameters: z.object({
    targetUserId: z.string().uuid().describe("User-ID"),
    newRole: z.enum(["admin", "editor", "viewer"]),
  }),
  execute: async ({ targetUserId, newRole }) => {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from("organization_members")
      .update({ role: newRole })
      .eq("user_id", targetUserId)
      .select()

    if (error) {
      return { success: false, error: error.message }
    }
    return { success: true, data }
  },
})
```

### 5.2 Best Practices

| ✅ Gut                       | ❌ Schlecht            |
| ---------------------------- | ---------------------- |
| `userId: z.string().uuid()`  | `schema: z.object({})` |
| Granulare, kontextlose Tools | Ein Tool für alles     |
| Explizite Parameter          | KI soll "raten"        |

### 5.3 Human-in-the-Loop Pattern

Für **kritische Operationen** (DELETE, Kosten, Einladungen):

```
Phase 1: KI ruft requestDelete() auf → { requiresConfirmation: true }
Phase 2: Client zeigt AlertDialog
Phase 3: User bestätigt → Client sendet "Confirmed"
Phase 4: KI ruft executeDelete() auf
```

### 5.4 Modell-Empfehlung für Tool-Calling

> ⚠️ **Wichtig**: Nicht alle Modelle unterstützen Tool-Calling gleich gut!

| Modell              | ID                              | Tool-Calling | Empfehlung                               |
| ------------------- | ------------------------------- | ------------ | ---------------------------------------- |
| **Claude Opus 4.5** | `anthropic/claude-opus-4.5`     | ✅ Exzellent | ✅ **Standard für Tool-Calling**         |
| **GPT-4.1**         | `openai/gpt-4.1`                | ✅ Sehr gut  | ✅ Alternative                           |
| **Gemini 3 Flash**  | `google/gemini-3-flash-preview` | ⚠️ Variabel  | ✅ Für Chat + Vision (kein Tool-Calling) |

---

## 6. Generative UI

### 6.1 State Machine

```
toolInvocation.state === 'call'   → Spinner/Skeleton
toolInvocation.state === 'result' → Komponente rendern
```

### 6.2 UI-Mapping

```typescript
{message.toolInvocations?.map((toolInvocation) => {
  const { toolName, toolCallId, state, result } = toolInvocation

  if (state === 'call') {
    return <Skeleton key={toolCallId} />
  }

  if (state === 'result') {
    switch (toolName) {
      case 'getWeather':
        return <WeatherCard key={toolCallId} data={result} />
      case 'listUsers':
        return <UserList key={toolCallId} users={result} />
      case 'requestDelete':
        return <ConfirmationDialog key={toolCallId} intent={result} />
    }
  }
})}
```

---

## 7. Implementierungsleitfaden

### 7.1 Ordnerstruktur

```
src/
├── app/
│   ├── api/chat/route.ts      # KI-Endpunkt
│   └── (dashboard)/page.tsx   # Geschützte Seiten
├── components/
│   ├── ui/                    # Shadcn Basis
│   ├── ai-elements/           # Chat-Wrapper
│   └── features/
│       ├── chat/
│       │   ├── chat-interface.tsx
│       │   └── tool-renderer.tsx
│       └── users/
│           └── user-card.tsx
├── lib/
│   ├── ai/
│   │   ├── tools/             # Tool-Definitionen
│   │   │   ├── user-management.ts
│   │   │   └── analytics.ts
│   │   └── prompts/           # System Prompts
│   └── supabase/
│       ├── client.ts          # Browser Client
│       ├── server.ts          # Server Client
│       └── middleware.ts      # Auth Refresh
└── utils/
    └── logger.ts
```

### 7.2 Dynamischer System-Prompt

```typescript
const systemPrompt = `
Du bist ein B2B-Assistent für ${orgName}.
User: ${user.email} (${user.role})
Datum: ${new Date().toLocaleDateString()}

Regeln:
- Führe keine destruktiven Aktionen ohne Bestätigung aus
- Nutze Tools, um Daten abzurufen - rate niemals IDs
- Formatiere Antworten in Markdown
`
```

---

## 8. Observability

### 8.1 OpenTelemetry Integration

```typescript
const result = streamText({
  model: openrouter("anthropic/claude-opus-4.5"),
  experimental_telemetry: {
    isEnabled: true,
    functionId: "chat-main",
  },
  // ...
})
```

### 8.2 Kosten-Monitoring

```typescript
async onFinish({ usage }) {
  await supabase.from('ai_usage').insert({
    user_id: user.id,
    tokens_in: usage.promptTokens,
    tokens_out: usage.completionTokens,
    model: 'anthropic/claude-opus-4.5',
    cost_usd: calculateCost(usage),
  })
}
```

---

## 9. Bekannte Fallstricke

### 9.1 Kontext-Fenster-Falle

**Problem**: Chat-History übersteigt Kontext-Limit

**Lösung**: Sliding Window oder automatische Zusammenfassung

### 9.2 Tool-Looping

**Problem**: KI ruft Tool in Endlosschleife auf

**Lösung**: `maxSteps: 5` + Abbruchbedingung bei identischen Fehlern

### 9.3 Modell ignoriert Tools

**Problem**: KI beschreibt was sie tun will, ruft aber kein Tool auf

**Lösungen**:

1. **Modell wechseln**: Claude Opus 4.5 (`anthropic/claude-opus-4.5`) statt Gemini für Tool-Calling
2. **Prompt verstärken**: "RUFE Tools DIREKT auf - nicht ankündigen!"
3. **Format prüfen**: Tools müssen korrekt als Zod-Schemas definiert sein
4. **Model-Routing**: Nutze Gemini 3 Flash für Chat/Vision, Claude für Tool-Calling

### 9.4 Next.js Caching

**Problem**: Auth-Requests werden gecached

**Lösung**: `cache: 'no-store'` für Auth-Fetch-Aufrufe

---

## Anhang: Code-Muster

### A.1 Route Handler

```typescript
// app/api/chat/route.ts
import { openrouter } from "@/lib/ai/provider"
import { streamText } from "ai"
import { createClient } from "@/utils/supabase/server"
import { tools } from "@/lib/ai/tools"

export const maxDuration = 60

export async function POST(req: Request) {
  // 1. Auth prüfen
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return new Response("Unauthorized", { status: 401 })
  }

  // 2. Request parsen
  const { messages } = await req.json()

  // 3. System-Prompt mit Kontext
  const systemPrompt = `
    Du bist ein B2B-Assistent.
    User: ${user.email} (ID: ${user.id})
    Datum: ${new Date().toLocaleDateString()}
    
    WICHTIG: Rufe Tools DIREKT auf wenn Daten benötigt werden!
  `

  // 4. Stream mit Tools
  const result = streamText({
    model: openrouter("anthropic/claude-opus-4.5"),
    messages,
    system: systemPrompt,
    tools,
    maxSteps: 5,
  })

  return result.toDataStreamResponse()
}
```

### A.2 Client Chat-Interface

```typescript
'use client'

import { useChat } from '@ai-sdk/react'

export function ChatInterface() {
  const { messages, input, handleInputChange, handleSubmit, addToolResult } = useChat({
    api: '/api/chat',
    maxSteps: 5,
  })

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        {messages.map((m) => (
          <div key={m.id}>
            {m.content && <div>{m.content}</div>}

            {m.toolInvocations?.map((ti) => {
              if (ti.state === 'call') {
                return <div key={ti.toolCallId}>Lade...</div>
              }
              if (ti.state === 'result') {
                return <ToolResultRenderer key={ti.toolCallId} result={ti} />
              }
            })}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit}>
        <input value={input} onChange={handleInputChange} />
      </form>
    </div>
  )
}
```

---

## Referenzen

1. [Tool Use | Vercel Academy](https://vercel.com/academy/ai-sdk/tool-use)
2. [Call Tools - AI SDK](https://ai-sdk.dev/cookbook/next/call-tools)
3. [Mastering Supabase RLS](https://dev.to/asheeshh/mastering-supabase-rls-row-level-security-as-a-beginner-5175)
4. [Multi-Step & Generative UI | Vercel Academy](https://vercel.com/academy/ai-sdk/multi-step-and-generative-ui)
5. [Next.js 15 - Async APIs](https://nextjs.org/blog/next-15)
6. [OpenRouter Documentation](https://openrouter.ai/docs)
7. [Chatbot Tool Usage - AI SDK UI](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-tool-usage)
8. [Observability with OpenTelemetry - Langfuse](https://langfuse.com/integrations/frameworks/vercel-ai-sdk)

---

_Zuletzt aktualisiert: 25. Dezember 2025_
