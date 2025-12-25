# AI Tool-Calling: Findings & Problemlösungen

> Dokumentation der Erkenntnisse und Fixes aus der AI-Chatbot Implementierung mit Tool-Calling.
> Stand: 25.12.2025

## 1. Architektur-Überblick

### Model-Routing Strategie

Die App verwendet einen **intelligenten Model-Router**, der basierend auf der User-Anfrage das passende Modell wählt:

| Use-Case                          | Modell                          | Grund                                      |
| --------------------------------- | ------------------------------- | ------------------------------------------ |
| Normale Chats, Vision/Screenshots | `google/gemini-3-flash-preview` | Günstig, schnell, gute Vision-Capabilities |
| Tool-Calling, DB-Operationen      | `anthropic/claude-opus-4.5`     | Zuverlässige Tool-Aufrufe                  |

**Routing-Logik** (`src/lib/ai/model-router.ts`):

- Analysiert letzte User-Nachricht auf DB-Entitäten und CRUD-Keywords
- Keywords: "zeige", "erstelle", "lege an", "lösche", "ändere", etc.
- Entitäten: "user", "rolle", "profil", "bug", "feature", etc.

```typescript
// Beispiel: detectToolNeed()
if (hasDbReference) return { model: CLAUDE_OPUS, needsTools: true }
if (hasEntity && hasCrud) return { model: CLAUDE_OPUS, needsTools: true }
return { model: GEMINI_FLASH, needsTools: false }
```

---

## 2. AI SDK v5 Integration

### Frontend: Assistant-UI + AI SDK

**Stack:**

- `@assistant-ui/react` - UI-Komponenten für Chat
- `@assistant-ui/react-ai-sdk` - Bridge zu Vercel AI SDK
- `@ai-sdk/react` - useChat Hook

**Korrekte Integration:**

```typescript
// src/components/shell/AIChatPanel.tsx
const chat = useChat({ api: "/api/chat" })

const runtime = useAISDKRuntime(chat, {
  prepareSendMessagesRequest: async (messages) => {
    // Context hier injizieren
    return {
      messages,
      screenshot: await captureScreenshot(),
      route: getCurrentRoute(),
      interactions: getRecentInteractions(20),
    }
  },
})
```

**WICHTIG:**

- `useAISDKRuntime` statt `useChatRuntime` verwenden
- Context via `prepareSendMessagesRequest` injizieren, nicht über Transport

### Backend: streamText API

**AI SDK v5 Änderungen:**

```typescript
// VORHER (v4)
const result = await streamText({ ... })
return result.toDataStreamResponse()

// NACHHER (v5)
const result = streamText({ ... }) // Kein await!
return result.toUIMessageStreamResponse()
```

**Multi-Step Tool-Calling:**

```typescript
// VORHER
streamText({ maxSteps: 8 })

// NACHHER
import { stepCountIs } from "ai"
streamText({ stopWhen: stepCountIs(8) })
```

---

## 3. Supabase Auth + RLS Probleme

### Problem: User-Erstellung via Tool-Calling

**Symptom:** `insert_profiles` Tool konnte keine neuen User anlegen.

**Ursache:**

- `profiles.id` ist ein **Foreign Key** zu `auth.users.id`
- Ohne Eintrag in `auth.users` kann kein Profil erstellt werden
- Standard-Workflow: User registriert sich → Trigger erstellt Profil

**Lösung:** Spezielle `create_user` und `delete_user` Tools implementiert:

```typescript
// src/lib/ai/special-tools.ts
export const create_user = tool({
  description: "Erstellt einen neuen Benutzer...",
  inputSchema: z.object({
    email: z.string().email(),
    password: z.string().min(6),
    display_name: z.string().optional(),
    role: z.enum(["admin", "user"]).default("user"),
  }),
  execute: async ({ email, password, display_name, role }) => {
    // 1. Auth-User via Admin API erstellen
    const { data } = await serviceClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
    // 2. Profil wird durch Trigger automatisch erstellt
    // 3. Rolle aktualisieren
    await serviceClient.from("profiles").update({ role }).eq("id", data.user.id)
  },
})
```

### Problem: RLS Policy für Admin-Inserts fehlte

**Symptom:** Admins konnten keine Profile erstellen (RLS-Fehler).

**Lösung:** Migration `019_fix_profiles_insert_rls.sql`:

```sql
CREATE POLICY "admins_can_insert_profiles"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );
```

---

## 4. Test-Cleanup Problem (FK-Constraints)

### Problem: 146+ verwaiste Test-User

**Symptom:** Tests erstellten User, aber Cleanup schlug fehl mit "Database error deleting user".

**Ursache:** Fehlende `ON DELETE CASCADE` auf einigen FK-Constraints:

- `ai_tool_calls.user_id` → kein CASCADE
- `ai_datasources.created_by` → kein CASCADE

**Lösung:** `deleteTestUser` erweitert:

```typescript
// src/lib/ai/__tests__/test-helpers.ts
export async function deleteTestUser(userId: string): Promise<void> {
  const supabase = getServiceClient()

  // 1. ai_tool_calls löschen (kein CASCADE)
  await supabase.from("ai_tool_calls").delete().eq("user_id", userId)

  // 2. ai_datasources.created_by auf NULL setzen
  await supabase.from("ai_datasources").update({ created_by: null }).eq("created_by", userId)

  // 3. Profile löschen
  await supabase.from("profiles").delete().eq("id", userId)

  // 4. Bugs/Features FK nullen
  await supabase.from("bugs").update({ reporter_id: null }).eq("reporter_id", userId)
  await supabase.from("features").update({ proposer_id: null }).eq("proposer_id", userId)

  // 5. Auth-User löschen
  await supabase.auth.admin.deleteUser(userId)
}
```

**Cleanup-Script:** `scripts/TEMP_cleanup-test-users.ts` für manuelle Bereinigung.

---

## 5. Message-Parsing Problem

### Problem: Chat gab immer gleiche Antwort

**Symptom:** Model-Router erkannte keine Tool-Intents.

**Ursache:** AI SDK v5 sendet Messages mit `parts` Array statt `content` String:

```typescript
// AI SDK v5 Format
{ role: "user", parts: [{ type: "text", text: "Erstelle User" }] }

// Backend erwartete
{ role: "user", content: "Erstelle User" }
```

**Lösung:** `convertMessages` angepasst:

```typescript
function convertMessages(messages: ClientMessage[]): CoreMessage[] {
  return messages.map((m) => {
    let textContent = ""

    // Priorisiere 'parts' (AI SDK v5)
    if (Array.isArray(m.parts)) {
      textContent = m.parts
        .filter((p) => p.type === "text")
        .map((p) => p.text)
        .join("\n")
    } else if (typeof m.content === "string") {
      textContent = m.content
    }

    return { role: m.role, content: textContent }
  })
}
```

---

## 6. CRUD-Keywords Ergänzung

### Problem: "lege einen neuen User an" wurde nicht erkannt

**Ursache:** "lege" und "legen" fehlten in CRUD_KEYWORDS.

**Lösung:**

```typescript
// src/lib/ai/model-router.ts
const CRUD_KEYWORDS = {
  create: [
    "erstelle",
    "erstellen",
    "create",
    "anlegen",
    "leg an",
    "neue",
    "neuen",
    "new",
    "add",
    "hinzufügen",
    "insert",
    "lege",
    "legen", // NEU
  ],
  // ...
}
```

---

## 7. Best Practices

### Tool-Design

1. **READ-Operationen** (`query_*`): Sofort ausführen, keine Bestätigung
2. **INSERT/UPDATE**: Kurze Vorschau zeigen, dann ausführen
3. **DELETE**: Immer Bestätigung anfordern (`confirm: true`)

### System-Prompt Struktur

```typescript
const systemPrompt = `
## Deine Rolle
- READ: SOFORT ausführen
- INSERT/UPDATE: Kurz zeigen was passiert, dann ausführen
- DELETE: IMMER Bestätigung anfordern

## Verfügbare Tools
${availableTools.map((t) => `- ${t}`).join("\n")}

## KRITISCH - Tool-Aufruf
- RUFE Tools DIREKT auf - NICHT nur ankündigen!
- Fremdschlüssel: Erst query_roles, dann insert_profiles mit role_id
`
```

### Model-Signatur am Ende jeder Antwort

```typescript
// Im System-Prompt
"Füge am ENDE jeder Antwort hinzu: `<sub>— ${modelName}</sub>`"
```

---

## 8. Dateien-Referenz

| Datei                                  | Zweck                               |
| -------------------------------------- | ----------------------------------- |
| `src/app/api/chat/route.ts`            | Chat-Endpoint mit Model-Router      |
| `src/lib/ai/model-router.ts`           | Intelligente Modell-Auswahl         |
| `src/lib/ai/special-tools.ts`          | create_user, delete_user Tools      |
| `src/lib/ai/tool-registry.ts`          | Dynamische CRUD-Tool-Generierung    |
| `src/lib/ai/__tests__/test-helpers.ts` | Test-Utilities mit FK-aware Cleanup |
| `src/components/shell/AIChatPanel.tsx` | Frontend Chat-Integration           |

---

## 9. Bekannte Limitierungen

1. **Tool-Args Streaming Bug**: Assistant-UI zeigt manchmal `Runtime Error: Tool call argsText can only be appended` - Frontend-Issue beim Streamen von Tool-Arguments
2. **1 Test-User pro Testlauf**: Cleanup funktioniert nicht 100%, minimal 1 User bleibt übrig
3. **Gemini Tool-Calling**: Via OpenRouter nicht zuverlässig genug, daher Claude für Tools

---

## 10. UI-Action Tools

### execute_ui_action Tool

Das Tool wird dynamisch aus verfügbaren UI-Actions generiert:

```typescript
// In special-tools.ts
export function generateUIActionTool(availableActions: UIAction[]): ToolSet {
  // Generiert execute_ui_action Tool mit Enum der Action-IDs
}
```

### Action-Handler Pattern

AIChatPanel erkennt UI-Actions über `__ui_action` Marker:

```typescript
// In AIChatPanel.tsx
if (result.__ui_action === "execute" && result.id) {
  await executeAction(result.id)
}
```

### Registry-Integration

Actions werden zur Laufzeit registriert:

```typescript
// Komponente registriert sich automatisch
<AIInteractable id="nav-users" ...>
  <Link>Users</Link>
</AIInteractable>

// Registry kann Action ausführen
registry.executeAction("nav-users") // Klickt Link
```

Siehe auch: [AI Component Governance Dokumentation](./ai-component-governance.md)

## 11. Troubleshooting

### "result.toDataStreamResponse is not a function"

→ AI SDK v5: `streamText` ist synchron, kein `await`. Verwende `toUIMessageStreamResponse()`.

### "Database error deleting user"

→ FK-Constraints blockieren. Lösche erst abhängige Daten (ai_tool_calls, etc.).

### Model-Router wählt immer Chat-Model

→ Prüfe ob `parts` statt `content` in Messages. Logging in route.ts aktivieren.

### Tool wird angekündigt aber nicht aufgerufen

→ System-Prompt expliziter machen: "RUFE das Tool SOFORT auf"

### UI-Action wird nicht ausgeführt

→ Prüfe ob AIInteractable gerendert wird (data-ai-id im DOM)
→ Prüfe ob AIRegistryProvider vorhanden ist
→ Prüfe ob id im Manifest registriert ist
