# Tool-Calling Test-Suite

Diese Dokumentation beschreibt die Test-Suite für die Tool-Calling-Funktionalität der AI-Chatbot-Integration.

## Übersicht

Die Test-Suite besteht aus zwei Arten von Tests:

1. **Unit-Tests** (`tool-executor.test.ts`): Schnelle Tests mit Mocks, prüfen Logik ohne DB-Zugriff
2. **Integration-Tests** (`tool-calling-e2e.test.ts`): Realistische Tests gegen echte Supabase-Datenbank

## Voraussetzungen

### Environment-Variablen

Die Integration-Tests benötigen folgende Variablen in `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

### Datenbank-Setup

Die Tests erwarten, dass folgende Tabellen existieren und korrekt konfiguriert sind:

- `profiles` - User-Profile mit Rollen
- `roles` - Rollen-Tabelle
- `bugs` - Bug-Reports
- `features` - Feature-Requests
- `themes` - Themes (optional)

Die Tabellen müssen über `ai_datasources` für Tool-Calling aktiviert sein.

## Test-Struktur

### Test-Helpers (`test-helpers.ts`)

Wiederverwendbare Utilities:

#### `getTestContext(role, dryRun)`

Erstellt einen authentifizierten Test-User und gibt einen `ToolExecutionContext` zurück:

```typescript
const ctx = await getTestContext("admin", false)
// ctx.userId - User-ID
// ctx.sessionId - Session-ID
// ctx.cleanup() - Cleanup-Funktion
```

#### `createTestUser(email, password, role)`

Erstellt einen Test-User in Supabase Auth:

```typescript
const { userId, sessionToken } = await createTestUser("test@example.com", "password123", "admin")
```

#### `cleanupTestData(tableName, ids)`

Löscht Test-Daten aus einer Tabelle:

```typescript
await cleanupTestData("bugs", ["id1", "id2"])
```

#### `assertToolSuccess(result)`

Type-Guard für erfolgreiche Tool-Ergebnisse:

```typescript
const result = await executeTool("query_roles", {}, ctx)
assertToolSuccess(result)
// result.data ist jetzt garantiert definiert
```

#### `assertToolError(result, expectedError?)`

Prüft dass ein Tool-Call fehlgeschlagen ist:

```typescript
const result = await executeTool("invalid_tool", {}, ctx)
assertToolError(result, "Unknown tool action")
```

#### `CleanupTracker`

Sammelt IDs für automatisches Cleanup:

```typescript
const tracker = new CleanupTracker()
tracker.track("bugs", bugId)
tracker.track("profiles", userId)
await tracker.cleanup() // Löscht alle getrackten Items
```

### Test-Fixtures (`test-fixtures.ts`)

Vordefinierte Testdaten:

```typescript
import { TEST_USER, TEST_BUG, TEST_FEATURE } from "./test-fixtures"

// Oder dynamisch generieren:
import { getTestUserData, getTestBugData } from "./test-fixtures"

const userData = getTestUserData() // Eindeutige E-Mail
```

## Test-Szenarien

### 1. Neuer User anlegen

```typescript
it("sollte neuen User anlegen können", async () => {
  // 1. Rolle abfragen
  const rolesResult = await executeTool("query_roles", { filters: { name: "User" } }, ctx)
  const roleId = rolesResult.data[0].id

  // 2. User anlegen
  const result = await executeTool(
    "insert_profiles",
    {
      data: { email: "test@example.com", display_name: "Test User", role: "user" },
    },
    ctx
  )

  assertToolSuccess(result)
})
```

### 2. Bug Report erstellen

```typescript
it("sollte Bug Report erstellen können", async () => {
  const bugData = getTestBugData()

  const result = await executeTool(
    "insert_bugs",
    {
      data: {
        title: bugData.title,
        description: bugData.description,
        severity: bugData.severity,
      },
    },
    ctx
  )

  assertToolSuccess(result)
  expect(result.data.title).toBe(bugData.title)
})
```

### 3. Bug als gelöst markieren

```typescript
it("sollte Bug als gelöst markieren können - als Admin", async () => {
  const adminContext = await getTestContext("admin")

  // Bug erstellen
  const createResult = await executeTool("insert_bugs", { data: bugData }, adminContext)
  const bugId = createResult.data.id

  // Bug updaten
  const updateResult = await executeTool(
    "update_bugs",
    {
      filters: { id: bugId },
      data: { status: "fixed" },
    },
    adminContext
  )

  assertToolSuccess(updateResult)
  expect(updateResult.data.status).toBe("fixed")
})
```

### 4. Feature Request erstellen

```typescript
it("sollte Feature Request erstellen können", async () => {
  const featureData = getTestFeatureData()

  const result = await executeTool(
    "insert_features",
    {
      data: {
        title: featureData.title,
        description: featureData.description,
        status: "planned",
      },
    },
    ctx
  )

  assertToolSuccess(result)
})
```

### 5. Theme wechseln

```typescript
it("sollte Theme abfragen können", async () => {
  const result = await executeTool("query_themes", { limit: 10 }, ctx)

  assertToolSuccess(result)
  expect(Array.isArray(result.data)).toBe(true)
})
```

## Tests ausführen

### Alle Tool-Tests

```bash
pnpm test:tools
```

### Watch-Modus

```bash
pnpm test:tools:watch
```

### Einzelner Test

```bash
pnpm vitest run src/lib/ai/__tests__/tool-calling-e2e.test.ts -t "sollte neuen User anlegen"
```

## Test-Isolation

Jeder Test:

1. **Erstellt eigene Test-Daten** mit eindeutigen IDs (Timestamp-basiert)
2. **Räumt nach sich auf** (`afterEach` Hook)
3. **Verwendet `globalCleanup`** für automatisches Cleanup

```typescript
afterEach(async () => {
  await globalCleanup.cleanup() // Löscht alle getrackten Items
})
```

## Erweiterung der Test-Suite

### Neues Tool hinzufügen

1. **Fixture erstellen** in `test-fixtures.ts`:

```typescript
export const TEST_NEW_TOOL = {
  field1: "value1",
  field2: "value2",
}

export function getTestNewToolData() {
  return {
    field1: generateTestName("Test"),
    field2: "value2",
  }
}
```

2. **Test-Case hinzufügen** in `tool-calling-e2e.test.ts`:

```typescript
describe("New Tool", () => {
  it("sollte New Tool verwenden können", async () => {
    const data = getTestNewToolData()

    const result = await executeTool(
      "insert_new_table",
      {
        data: data,
      },
      testContext
    )

    assertToolSuccess(result)

    // Cleanup
    const inserted = Array.isArray(result.data) ? result.data[0] : result.data
    globalCleanup.track("new_table", inserted.id)
  })
})
```

3. **Helper-Funktion hinzufügen** (falls nötig) in `test-helpers.ts`:

```typescript
export async function setupNewToolTest(): Promise<{ id: string; cleanup: () => Promise<void> }> {
  // Setup-Logik
  return {
    id: "test-id",
    cleanup: async () => {
      /* cleanup */
    },
  }
}
```

## Troubleshooting

### "NEXT_PUBLIC_SUPABASE_URL nicht gesetzt"

Stelle sicher, dass `.env.local` existiert und die Variablen korrekt gesetzt sind.

### "Fehler beim Erstellen des Test-Users"

- Prüfe dass `SUPABASE_SERVICE_ROLE_KEY` gesetzt ist
- Prüfe dass die Supabase-Instanz läuft
- Prüfe dass die `profiles` Tabelle existiert

### "RLS Policy blockiert Operation"

- Prüfe dass der Test-User die richtige Rolle hat
- Prüfe die RLS Policies in Supabase
- Für Admin-Operationen: Verwende `getTestContext("admin")`

### "Tool nicht gefunden"

- Prüfe dass die Tabelle in `ai_datasources` aktiviert ist
- Prüfe dass `access_level` korrekt gesetzt ist (read, read_write, full)
- Prüfe dass `is_enabled = true` ist

## Best Practices

1. **Immer Cleanup verwenden**: Tracke alle erstellten IDs mit `globalCleanup.track()`
2. **Eindeutige Test-Daten**: Verwende `generateTestEmail()` oder `generateTestName()`
3. **Assertions**: Verwende `assertToolSuccess()` und `assertToolError()` für Type-Safety
4. **Isolation**: Jeder Test sollte unabhängig laufen können
5. **Realistische Daten**: Verwende sinnvolle Test-Daten, die echten Use-Cases entsprechen

## CI/CD Integration

Für CI/CD-Pipelines:

```yaml
# Beispiel GitHub Actions
- name: Run Tool-Calling Tests
  env:
    NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
    NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
    SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
  run: pnpm test:tools
```

## Weitere Ressourcen

- [Tool-Executor Dokumentation](../tool-executor.md)
- [Tool-Registry Dokumentation](../tool-registry.md)
- [Supabase RLS Testing Guide](../rls-testing-guide.md)
