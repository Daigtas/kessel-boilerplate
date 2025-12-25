# AI Chat Assist Panel

KI-gestützter Chat-Assistent im Assist-Panel (Spalte 4) mit multimodalem Kontext.

## Übersicht

Das AI Chat Assist Panel bietet kontextbezogene Hilfe für User. Der Assistent kennt:

- Die App-Dokumentation (Wiki)
- Die aktuelle Route des Users
- Die letzten User-Aktionen (Klicks, Navigation)
- Screenshot der aktuellen Ansicht (bei jeder Nachricht automatisch)

## Architektur

```
User fragt im Chat
        │
        ▼
┌─────────────────────────────────────────────┐
│       Context Collector (Client)            │
├─────────────────────────────────────────────┤
│ 1. Screenshot (modern-screenshot → Base64)  │
│ 2. HTML Dump (sanitized innerHTML)          │
│ 3. Current Route (pathname)                 │
│ 4. Interactions (LocalStorage Ring-Buffer)  │
└─────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────┐
│           /api/chat (Server)                │
├─────────────────────────────────────────────┤
│ 5. Wiki Content (aus src/content/wiki.md)   │
│ 6. LLM Call via OpenRouter (Gemini 3 Flash + Vision) │
└─────────────────────────────────────────────┘
        │
        ▼
   Streaming Response
```

## Komponenten

| Datei                                  | Beschreibung                          |
| -------------------------------------- | ------------------------------------- |
| `src/components/shell/AIChatPanel.tsx` | Chat-UI mit assistant-ui              |
| `src/components/thread.tsx`            | Thread-Komponente (assistant-ui)      |
| `src/hooks/use-interaction-log.ts`     | Interaction-Tracking (Local-First)    |
| `src/app/api/chat/route.ts`            | Chat-API mit Streaming                |
| `src/lib/ai-chat/context-collector.ts` | Screenshot & HTML-Dump                |
| `src/lib/ai-chat/wiki-content.ts`      | Wiki-Content-Loader                   |
| `src/content/wiki.md`                  | Wiki-Content (Single Source of Truth) |

## Screenshot-Funktionalität

### Technische Details

- **Library**: `modern-screenshot` (ersetzt `html2canvas` wegen OKLCH-Kompatibilität)
- **Format**: JPEG mit 80% Qualität
- **Ziel**: Gesamtes Browser-Fenster (`document.body`)
- **Übertragung**: Base64 → `Uint8Array` mit explizitem `mimeType: "image/jpeg"`

### Verhalten

- Bei **jeder Chat-Nachricht** wird ein neuer Screenshot gemacht
- Der Screenshot wird als multimodaler Content an Gemini gesendet
- Das Modell kann visuelle Elemente erkennen und beschreiben

### Warum modern-screenshot?

Das Projekt verwendet OKLCH-Farben (`oklch(...)`) im Design-System. Die ursprüngliche Library `html2canvas` unterstützt diese CSS-Farbfunktion nicht und wirft Parsing-Fehler. `modern-screenshot` ist eine moderne Alternative mit voller CSS-Unterstützung.

## Interaction-Tracking (Local-First)

Das Tracking speichert User-Aktionen **lokal** im Browser:

```typescript
// LocalStorage-Struktur
{
  "ai-chat-interactions": [
    { "actionType": "navigate", "target": "/dashboard", "timestamp": "..." },
    { "actionType": "click", "target": "#submit-btn", "timestamp": "..." }
  ]
}
```

**Warum Local-First?**

- **Performance**: ~0.1ms vs ~50-200ms bei Supabase
- **Offline-fähig**: Funktioniert ohne Netzwerk
- **Keine Kosten**: Kein Supabase-Traffic
- **Ring-Buffer**: Automatisch auf 20 Einträge begrenzt

## LLM-Provider (via OpenRouter)

| Model           | ID                              | Rolle                         |
| --------------- | ------------------------------- | ----------------------------- |
| Gemini 3 Flash  | `google/gemini-3-flash-preview` | Chat + Vision (Screenshots)   |
| Claude Opus 4.5 | `anthropic/claude-opus-4.5`     | Tool-Calling / DB-Operationen |
| GPT-4.1         | `openai/gpt-4.1`                | Fallback für Tool-Calling     |

**Model-Routing:**

- Der Chat analysiert automatisch, ob Tools benötigt werden
- Bei normalen Fragen: Gemini 3 Flash (günstig, schnell, hervorragend für Vision)
- Bei DB-Operationen: Claude Opus 4.5 (zuverlässiges Tool-Calling)

API-Key muss in `.env.local` gesetzt sein:

```
OPENROUTER_API_KEY=...
```

## Chat-UI (assistant-ui)

Die Chat-UI verwendet `@assistant-ui/react` für:

- Professionelle Chat-Oberfläche
- Streaming-Support
- Markdown-Rendering
- Message-History

### Custom Model Adapter

Ein `ChatModelAdapter` wird verwendet, um bei jedem Request automatisch den Kontext mitzusenden:

- Screenshot
- HTML-Dump
- Aktuelle Route
- Letzte Interaktionen

## Wiki-Content

Der Wiki-Content liegt in `src/content/wiki.md` und wird:

- Von der Wiki-Seite (`/about/wiki`) gerendert
- Vom Chat-API in den LLM-Kontext geladen

Änderungen am Wiki werden automatisch vom Chat berücksichtigt.

## Verwendung

### Chat öffnen

1. Klick auf Chat-Icon in den FloatingAssistActions (oben rechts)
2. Oder Tastenkürzel `Cmd/Ctrl + J`

### Screenshot

- Screenshots werden **automatisch** bei jeder Nachricht gemacht
- Kein manuelles Aktivieren nötig
- Der Assistent kann visuelle Elemente erkennen und darauf eingehen

## API

### POST /api/chat

**Request:**

```typescript
{
  messages: Message[],
  screenshot?: string,      // Base64 JPEG
  htmlDump?: string,        // Sanitized HTML
  route?: string,           // Aktuelle Route
  interactions?: UserInteraction[]  // Letzte Aktionen
}
```

**Response:**

- Streaming Text Response
- Multimodaler Content Support (Text + Image)

## Dependencies

```bash
pnpm add modern-screenshot ai @ai-sdk/react @assistant-ui/react @assistant-ui/react-ai-sdk @openrouter/ai-sdk-provider
```

| Package                       | Zweck                                 |
| ----------------------------- | ------------------------------------- |
| `modern-screenshot`           | Screenshot-Capture (OKLCH-kompatibel) |
| `ai`                          | Vercel AI SDK Core                    |
| `@ai-sdk/react`               | React Integration                     |
| `@assistant-ui/react`         | Chat-UI-Komponenten                   |
| `@assistant-ui/react-ai-sdk`  | AI SDK Integration für assistant-ui   |
| `@openrouter/ai-sdk-provider` | OpenRouter Provider für Multi-Model   |

## Debugging

### Console-Logs

Die wichtigsten Debug-Logs:

- `[captureScreenshot]` - Screenshot-Capture-Status
- `[AIChatPanel]` - Route, Screenshot-Größe
- `[Chat API]` - Server-seitige Verarbeitung

## Tests

```bash
# Unit Tests
pnpm test:run src/hooks/__tests__/use-interaction-log.test.ts
pnpm test:run src/lib/ai-chat/__tests__/
pnpm test:run src/app/api/chat/__tests__/
pnpm test:run src/components/shell/__tests__/AIChatPanel.test.tsx
```
