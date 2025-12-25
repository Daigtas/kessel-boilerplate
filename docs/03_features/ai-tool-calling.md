# AI Tool-Calling Feature

## Übersicht

Das AI Tool-Calling Feature ermöglicht es dem KI-Chatbot, direkt mit der Datenbank zu interagieren. Der Chatbot kann Daten abfragen, einfügen, aktualisieren und löschen - basierend auf konfigurierbaren Berechtigungen.

## Architektur

```
User fragt im Chat
        │
        ▼
┌─────────────────────────────────────────────┐
│       AIChatPanel (Client)                  │
├─────────────────────────────────────────────┤
│ 1. Screenshot (modern-screenshot → Base64) │
│ 2. HTML Dump (sanitized innerHTML)          │
│ 3. Current Route (pathname)                 │
│ 4. Interactions (LocalStorage Ring-Buffer)  │
└─────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────┐
│           /api/chat (Server)                 │
├─────────────────────────────────────────────┤
│ 5. Wiki Content (aus src/content/wiki.md)   │
│ 6. Tool Registry (generiert Tools aus DB)   │
│ 7. OpenRouter API (Gemini 3 Flash / Claude Opus 4.5) │
│ 8. Tool Executor (führt Tool-Calls aus)      │
│ 9. Audit Logging (ai_tool_calls Tabelle)     │
└─────────────────────────────────────────────┘
        │
        ▼
   Streaming Response mit Tool-Ergebnissen
```

## Komponenten

| Datei                                           | Beschreibung                                      |
| ----------------------------------------------- | ------------------------------------------------- |
| `src/lib/ai/openrouter-provider.ts`             | OpenRouter Provider für Vercel AI SDK             |
| `src/lib/ai/tool-registry.ts`                   | Generiert dynamisch Tools aus DB-Schema           |
| `src/lib/ai/tool-executor.ts`                   | Führt Tool-Calls sicher aus mit Permission-Checks |
| `src/app/api/chat/route.ts`                     | Chat API Route mit Tool-Calling Support           |
| `src/app/(shell)/admin/ai-datasources/page.tsx` | Admin UI für Datasources-Verwaltung               |
| `supabase/migrations/018_ai_datasources.sql`    | DB-Migration für AI Datasources                   |

## Datenbank-Schema

### ai_datasources

Steuert, welche Tabellen die AI lesen/schreiben darf:

- `table_schema` / `table_name`: Tabellen-Identifikation
- `display_name`: Anzeigename für die AI
- `access_level`: `none` | `read` | `read_write` | `full`
- `is_enabled`: Aktiviert/Deaktiviert
- `excluded_columns`: Spalten, die nie an die AI übergeben werden
- `max_rows_per_query`: Max. Anzahl Zeilen pro Query

### ai_tool_calls

Audit-Log aller Tool-Aufrufe:

- `user_id`: Wer hat den Tool-Call ausgelöst
- `tool_name`: Welches Tool wurde aufgerufen
- `tool_args`: Parameter des Tool-Calls
- `success`: Erfolgreich?
- `result`: Ergebnis (JSONB)
- `is_dry_run`: War es ein Dry-Run?
- `duration_ms`: Ausführungszeit

### ai_models

Verfügbare AI-Modelle:

- `id`: Model-ID (z.B. `google/gemini-3-flash-preview`, `anthropic/claude-opus-4.5`)
- `provider`: `openrouter` | `openai` | `anthropic`
- `supports_vision`: Unterstützt Vision?
- `supports_tools`: Unterstützt Tool-Calling?
- `is_default`: Standard-Modell?

**Aktuelle Modelle:**

- **Gemini 3 Flash** (`google/gemini-3-flash-preview`): Für Chat + Vision (Screenshots)
- **Claude Opus 4.5** (`anthropic/claude-opus-4.5`): Für Tool-Calling / DB-Operationen

## Tool-Typen

### Query Tool (`query_<table>`)

Liest Daten aus einer Tabelle:

- `filters`: Filter-Bedingungen (optional)
- `select`: Welche Spalten zurückgegeben werden (optional)
- `limit`: Max. Anzahl Zeilen (optional)
- `order_by`: Sortierung (optional)

### Insert Tool (`insert_<table>`)

Erstellt einen neuen Eintrag:

- `data`: Die einzufügenden Daten

### Update Tool (`update_<table>`)

Aktualisiert Einträge:

- `filters`: Filter für die zu ändernden Zeilen (PFLICHT)
- `data`: Die neuen Werte

### Delete Tool (`delete_<table>`)

Löscht Einträge:

- `filters`: Filter für die zu löschenden Zeilen (PFLICHT)
- `confirm`: Muss `true` sein

## Sicherheit

### Permission-Checks

- Jeder Tool-Call wird gegen `ai_datasources` validiert
- `access_level` bestimmt, welche Aktionen erlaubt sind
- Excluded Columns werden nie an die AI übergeben

### Audit-Logging

- Alle Tool-Calls werden in `ai_tool_calls` geloggt
- User kann eigene Tool-Calls sehen
- Admins sehen alle Tool-Calls

### Dry-Run Support

- Tool-Calls können im Dry-Run-Modus ausgeführt werden
- Generiert SQL ohne Ausführung
- Nützlich für Preview vor Änderungen

## Admin UI

Die Admin UI (`/admin/ai-datasources`) ermöglicht:

- Übersicht aller Tabellen
- Zugriffslevel pro Tabelle ändern
- Tabellen aktivieren/deaktivieren
- Excluded Columns konfigurieren

## Verwendung

### Migration ausführen

```bash
# Option 1: Supabase Dashboard
# 1. Öffne Supabase Dashboard → SQL Editor
# 2. Kopiere Inhalt von supabase/migrations/018_ai_datasources.sql
# 3. Führe aus

# Option 2: Supabase CLI
npx supabase db push
```

### Datasources konfigurieren

1. Öffne `/admin/ai-datasources`
2. Wähle Zugriffslevel pro Tabelle
3. Aktiviere/Deaktiviere Tabellen nach Bedarf

### Im Chat verwenden

Der Chatbot kann automatisch Tools verwenden:

```
User: "Zeige mir alle Themes"
AI: [Ruft query_themes auf]
    "Hier sind die verfügbaren Themes: ..."

User: "Erstelle ein neues Theme mit dem Namen 'Dark Mode'"
AI: [Ruft insert_themes auf]
    "Ich habe ein neues Theme 'Dark Mode' erstellt."
```

## Tests

### Unit & Integration Tests

- ✅ `scripts/test-openrouter.ts`: Testet OpenRouter Connectivity
- ✅ `src/lib/ai/__tests__/openrouter-provider.test.ts`: Provider Tests (8 Tests)
- ✅ `src/lib/ai/__tests__/tool-registry.test.ts`: Tool Registry Tests (10 Tests)
- ✅ `src/lib/ai/__tests__/tool-executor.test.ts`: Executor Tests (9 Tests)
- ✅ `src/app/api/chat/__tests__/chat-api.test.ts`: Chat API Tests (19 Tests)
- ✅ `supabase/migrations/__tests__/018_ai_datasources.test.ts`: Migration Tests

### E2E Tests

- ✅ `e2e/ai-chat-tool-calling.spec.ts`: E2E Chat Flow & Admin UI Tests

**Gesamt: 46 Unit/Integration Tests, alle bestanden ✅**

## Status

✅ **Feature vollständig implementiert und getestet**

Alle Phasen abgeschlossen:

- ✅ OpenRouter Integration
- ✅ Datenbank-Migration
- ✅ Tool Registry
- ✅ Tool Executor
- ✅ Chat API mit Tool-Calling
- ✅ Admin UI
- ✅ Tests (Unit, Integration, E2E)
