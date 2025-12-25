# AI Component Governance

KI-First Component System, bei dem React-Komponenten sich selbst als KI-steuerbar registrieren.

## Übersicht

Das AI Component Governance System ermöglicht es, React-Komponenten automatisch für die KI steuerbar zu machen. Komponenten beschreiben sich selbst über ein zentrales Manifest (`ai-manifest.json`) und registrieren sich zur Laufzeit in einer Registry.

## Architektur

```
┌─────────────────────────────────────────────────────────────┐
│                    React Components                          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  <AIInteractable id="nav-users" ...>                │   │
│  │    <Link href="/users">Users</Link>                 │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              AIRegistryProvider (Context)                   │
│  - actions: Map<string, AIAction>                          │
│  - register(action) → unregister()                         │
│  - executeAction(id) → { success, message }                │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              Context Collector                              │
│  - collectAvailableActions()                               │
│  - Liest data-ai-id aus DOM                                │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              Chat API                                       │
│  - Generiert execute_ui_action Tool dynamisch               │
│  - Tool-Result: { __ui_action: "execute", id: "..." }      │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              AIChatPanel                                    │
│  - onFinish Handler                                         │
│  - executeAction(id) aufrufen                              │
└─────────────────────────────────────────────────────────────┘
```

## Komponenten

### AIInteractable Wrapper

Wrapper-Komponente die eine beliebige Komponente KI-steuerbar macht:

```tsx
<AIInteractable
  id="nav-users"
  action="navigate"
  target="/account/users"
  description="Öffnet die Benutzer-Verwaltung"
  keywords={["users", "benutzer", "user-verwaltung"]}
  category="navigation"
>
  <Link href="/account/users">Users</Link>
</AIInteractable>
```

**Props:**

| Prop            | Typ                   | Beschreibung                                                  |
| --------------- | --------------------- | ------------------------------------------------------------- |
| `id`            | `string`              | Eindeutige Komponenten-ID (muss im Manifest registriert sein) |
| `action`        | `AIActionType`        | Aktion-Typ (navigate, toggle, submit, etc.)                   |
| `target`        | `string?`             | Ziel der Aktion (Route, Panel-Name, etc.)                     |
| `description`   | `string`              | Menschenlesbare Beschreibung                                  |
| `keywords`      | `string[]`            | Suchbegriffe für KI-Erkennung (min 2)                         |
| `category`      | `AIComponentCategory` | Kategorie (navigation, layout, form, etc.)                    |
| `availableWhen` | `() => boolean`       | Optional: Verfügbarkeits-Prüfung                              |

### AIRegistryProvider

Provider der die zentrale Registry verwaltet:

```tsx
<AIRegistryProvider>
  <App />
</AIRegistryProvider>
```

**Hook:** `useAIRegistry()`

```tsx
const { register, executeAction, getAvailableActions } = useAIRegistry()
```

## Manifest-Schema

### ai-manifest.json

Zentrale Manifest-Datei im Projekt-Root:

```json
{
  "version": "1.0.0",
  "components": [
    {
      "id": "nav-users",
      "description": "Öffnet die Benutzer-Verwaltung",
      "action": "navigate",
      "target": "/account/users",
      "category": "navigation",
      "keywords": ["users", "benutzer", "user-verwaltung"],
      "requiredRole": "admin"
    }
  ]
}
```

### Schema-Validierung

Das Manifest wird gegen ein Zod-Schema validiert:

- **id**: kebab-case, min 3 Zeichen
- **description**: 10-200 Zeichen
- **action**: Enum (navigate, toggle, submit, etc.)
- **keywords**: Array, min 2 Einträge
- **requiredRole**: Enum (public, user, admin)

## Naming Conventions

### IDs

- **Format**: kebab-case (`nav-users`, `toggle-sidebar`)
- **Präfix nach Kategorie**: `nav-*`, `toggle-*`, `form-*`, `modal-*`
- **Beispiele**:
  - `nav-account-users` - Navigation zu Users
  - `toggle-navbar` - Navbar Toggle
  - `form-submit-login` - Login-Formular Submit

### Keywords

- **Mindestens 2 Keywords** pro Komponente
- **DE + EN** für bessere Erkennung
- **Beispiele**:
  - `["users", "benutzer", "user-verwaltung"]`
  - `["sidebar", "seitenleiste", "navigation"]`

## Verwendung

### 1. Komponente wrappen

```tsx
import { AIInteractable } from "@/components/ai/AIInteractable"
;<AIInteractable
  id="nav-about-wiki"
  action="navigate"
  target="/about/wiki"
  description="Öffnet die App-Wiki Dokumentation"
  keywords={["wiki", "dokumentation", "help"]}
  category="navigation"
>
  <Link href="/about/wiki">Wiki</Link>
</AIInteractable>
```

### 2. Im Manifest registrieren

```json
{
  "id": "nav-about-wiki",
  "description": "Öffnet die App-Wiki Dokumentation",
  "action": "navigate",
  "target": "/about/wiki",
  "category": "navigation",
  "keywords": ["wiki", "dokumentation", "help"],
  "requiredRole": "public"
}
```

### 3. KI kann jetzt steuern

```
User: "Öffne die Wiki"
KI: [Ruft execute_ui_action({ action_id: "nav-about-wiki" }) auf]
    → Navigiert zu /about/wiki
```

## Validierung

### ESLint-Regel

Die Regel `local/ai-component-compliance` prüft:

- ✅ AIInteractable hat `id` Prop
- ✅ AIInteractable hat `description` Prop
- ✅ `id` ist kebab-case Format
- ✅ `id` ist im Manifest registriert

### Manifest-Validator

```bash
pnpm validate:ai
```

Prüft:

- ✅ Manifest-Schema valide (Zod)
- ✅ Alle AIInteractable IDs im Code sind im Manifest
- ✅ Keine Keyword-Duplikate (Warning)
- ✅ Alle Manifest-Einträge werden verwendet (Warning)

### Build-Gate

Der Build schlägt fehl wenn:

- ❌ Manifest ungültig ist
- ❌ AIInteractable ohne Manifest-Eintrag verwendet wird

```json
{
  "scripts": {
    "build": "pnpm validate:ai && next build"
  }
}
```

## Chat-Integration

### Flow

1. **Context Collector** sammelt alle verfügbaren Actions aus dem DOM
2. **Chat API** generiert dynamisch `execute_ui_action` Tool
3. **KI** ruft Tool mit `action_id` auf
4. **AIChatPanel** erkennt `__ui_action` Marker
5. **Registry** führt `executeAction(id)` aus

### Beispiel-Interaktion

```
User: "Navigiere zur User-Liste"

KI: [Analysiert verfügbare Actions]
    [Ruft execute_ui_action({ action_id: "nav-account-users" }) auf]

AIChatPanel: [Erkennt __ui_action Marker]
            [Ruft registry.executeAction("nav-account-users") auf]

Registry: [Führt execute() Callback aus]
         [Klickt Link-Element]

→ Navigation zu /account/users
```

## Troubleshooting

### "AIInteractable id 'xyz' is not registered"

**Problem:** ID fehlt im Manifest

**Lösung:** Eintrag in `ai-manifest.json` hinzufügen

### "Manifest Schema-Fehler"

**Problem:** Manifest-Struktur ungültig

**Lösung:** Prüfe Schema-Validierung:

- `id` ist kebab-case?
- `description` hat 10-200 Zeichen?
- `keywords` hat min 2 Einträge?

### "Action nicht gefunden"

**Problem:** ID existiert nicht in Registry

**Lösung:**

- Prüfe ob AIInteractable gerendert wird
- Prüfe ob AIRegistryProvider vorhanden ist
- Prüfe ob `id` korrekt ist

### Build schlägt fehl

**Problem:** Validierung fehlgeschlagen

**Lösung:**

```bash
pnpm validate:ai  # Zeigt detaillierte Fehler
```

## Best Practices

1. **Immer im Manifest registrieren** - Build schlägt sonst fehl
2. **Sinnvolle Keywords** - DE + EN für bessere Erkennung
3. **Konsistente IDs** - Präfix nach Kategorie (`nav-*`, `toggle-*`)
4. **Klare Beschreibungen** - Was macht die Aktion?
5. **availableWhen nutzen** - Nur verfügbare Actions anbieten

## Referenzen

- [AI Tool-Calling Dokumentation](./ai-tool-calling.md)
- [AI Chat Assist Dokumentation](./ai-chat-assist.md)
- [Model Router Dokumentation](../04_knowledge/LLM-Architektur_%20Multi-Modell-Routing%20&%20Tool-Calling.md)
