# Feature: AI Theme Token Editing

> **Status:** 📋 Geplant  
> **Priorität:** Medium  
> **Abhängigkeiten:** AI Tool-Calling System, Theme-Preference Persistence (Phase 0)

## Übersicht

Der AI-Chatbot soll in der Lage sein, Design-Tokens (Farben, Radii, Spacing, etc.) von Themes direkt zu bearbeiten. Benutzer können natürlichsprachliche Anfragen stellen wie:

- "Mach die Primary-Farbe von Ocean etwas dunkler"
- "Ändere den Hintergrund des Dark-Modes zu einem warmen Grau"
- "Setze den Border-Radius auf 8px"

---

## Phase 0: Theme-Preference Persistence ✅

> **Status:** ✅ Implementiert  
> **Implementiert am:** 2024-12-25

### Problem

Bevor Themes vom AI-Chatbot bearbeitet werden können, muss das **aktive Theme** des Users persistent gespeichert werden. Ohne diese Grundlage wäre unklar, welches Theme der AI bearbeiten soll.

### Architektur-Entscheidung: Warum Hybrid (localStorage + DB)?

**Das Timing-Problem bei DB-only:**

```
1. HTML rendert (Server) → Theme unbekannt
2. React hydrates
3. Auth passiert → User bekannt
4. DB-Query → Theme laden
5. Theme setzen → FLASH! ⚡
```

**Lösung: localStorage als Cache, DB als Source of Truth**

```
1. FOUC-Script (im <head>) → localStorage lesen → Theme sofort setzen
2. React hydrates → Kein Flash!
3. Auth passiert → DB-Preference laden
4. localStorage synchronisieren (falls anders)
```

### Implementierung

| Datei                         | Änderung                                      |
| ----------------------------- | --------------------------------------------- |
| `auth-context.tsx`            | `theme_preference` im Profile-Select          |
| `auth-context.tsx`            | User-Interface um `themePreference` erweitert |
| `use-theme-sync-with-user.ts` | Neuer Hook für bidirektionale Sync            |
| `ClientProviders.tsx`         | `ThemeSyncProvider` integriert                |

### Sync-Flow

```
┌─────────────────────────────────────────────────────────────┐
│                        LOGIN                                 │
├─────────────────────────────────────────────────────────────┤
│ 1. Auth lädt Profile inkl. theme_preference                 │
│ 2. ThemeSyncProvider erkennt User-Änderung                  │
│ 3. Wenn DB-Theme ≠ aktuelles Theme → setTheme()            │
│ 4. localStorage wird automatisch aktualisiert               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    THEME-WECHSEL                            │
├─────────────────────────────────────────────────────────────┤
│ 1. User wählt neues Theme (UI oder AI)                      │
│ 2. setTheme() setzt localStorage + data-theme              │
│ 3. ThemeSyncProvider erkennt Theme-Änderung                 │
│ 4. UPDATE profiles SET theme_preference = '...'            │
└─────────────────────────────────────────────────────────────┘
```

### Datenbank

Das Feld `theme_preference` existiert bereits in der `profiles`-Tabelle:

```sql
-- Migration 021_profiles_theme_preference.sql
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS theme_preference TEXT DEFAULT 'default';

COMMENT ON COLUMN public.profiles.theme_preference IS
  'Bevorzugtes Theme des Users (Theme-ID aus themes Tabelle)';
```

---

## Phase 1: Aktueller Stand (CSS in Storage)

Design-Tokens sind aktuell als **CSS-String** im Supabase Storage gespeichert:

```
Supabase Storage: themes/{theme-id}.css
```

```css
[data-theme="ocean"] {
  --primary: oklch(0.55 0.2 230);
  --background: oklch(0.98 0.01 230);
  --radius: 0.5rem;
}
.dark[data-theme="ocean"] {
  --primary: oklch(0.65 0.18 230);
  --background: oklch(0.12 0.02 230);
}
```

Der AI-Chatbot kann diese CSS-Dateien nicht strukturiert bearbeiten, da:

1. Kein Tool für Storage-Zugriff existiert
2. CSS-Parsing fehleranfällig ist
3. Keine Validierung der Werte möglich ist

### Aktuelle Architektur

```
┌─────────────────┐         ┌─────────────────┐
│   themes        │         │  Supabase       │
│   (Tabelle)     │         │  Storage        │
│                 │         │                 │
│ - id            │         │ themes/         │
│ - name          │         │   ocean.css     │
│ - description   │         │   forest.css    │
│ - dynamic_fonts │         │   ...           │
└─────────────────┘         └─────────────────┘
        │                           │
        │  Metadaten                │  CSS (Design-Tokens)
        │                           │
        ▼                           ▼
┌─────────────────────────────────────────────┐
│              Theme Provider                  │
│  (lädt CSS via <link> in Head)              │
└─────────────────────────────────────────────┘
```

---

## Phase 2: `theme_tokens` Tabelle (Geplant)

### Konzept

Design-Tokens werden als **strukturierte Daten** in einer neuen Tabelle gespeichert. Ein Trigger oder Background-Job generiert das CSS automatisch.

### Neue Architektur

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   themes        │    │  theme_tokens   │    │  Supabase       │
│   (Tabelle)     │◄───│  (Tabelle)      │───►│  Storage        │
│                 │    │                 │    │                 │
│ - id            │    │ - theme_id (FK) │    │ themes/         │
│ - name          │    │ - token_name    │    │   ocean.css     │
│ - description   │    │ - light_value   │    │   (generiert)   │
└─────────────────┘    │ - dark_value    │    └─────────────────┘
                       │ - category      │            ▲
                       └─────────────────┘            │
                               │                      │
                               │  Trigger/Job         │
                               └──────────────────────┘
```

### Datenbank-Schema

```sql
-- Migration: theme_tokens Tabelle
CREATE TABLE public.theme_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  theme_id TEXT NOT NULL REFERENCES themes(id) ON DELETE CASCADE,

  -- Token-Definition
  token_name TEXT NOT NULL,           -- z.B. "--primary", "--radius"
  category TEXT NOT NULL DEFAULT 'color', -- 'color', 'radius', 'spacing', 'font'

  -- Werte für Light/Dark Mode
  light_value TEXT,                   -- z.B. "oklch(0.55 0.2 230)"
  dark_value TEXT,                    -- z.B. "oklch(0.65 0.18 230)"

  -- Metadaten
  description TEXT,                   -- z.B. "Primäre Akzentfarbe"
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  UNIQUE(theme_id, token_name)
);

-- Index für schnelle Abfragen
CREATE INDEX idx_theme_tokens_theme_id ON theme_tokens(theme_id);
CREATE INDEX idx_theme_tokens_category ON theme_tokens(category);

-- RLS
ALTER TABLE theme_tokens ENABLE ROW LEVEL SECURITY;

-- Policies (analog zu themes)
CREATE POLICY "Theme-Tokens sind öffentlich lesbar"
  ON theme_tokens FOR SELECT USING (true);

CREATE POLICY "Authentifizierte User können Tokens erstellen"
  ON theme_tokens FOR INSERT WITH CHECK (true);

CREATE POLICY "Authentifizierte User können Tokens aktualisieren"
  ON theme_tokens FOR UPDATE USING (
    EXISTS (SELECT 1 FROM themes WHERE id = theme_id AND is_builtin = false)
  );

CREATE POLICY "Authentifizierte User können Tokens löschen"
  ON theme_tokens FOR DELETE USING (
    EXISTS (SELECT 1 FROM themes WHERE id = theme_id AND is_builtin = false)
  );
```

### Standard-Tokens (Seed-Daten)

```sql
-- Beispiel: Default Theme Tokens
INSERT INTO theme_tokens (theme_id, token_name, category, light_value, dark_value, description)
VALUES
  -- Farben
  ('default', '--background', 'color', 'oklch(1 0 0)', 'oklch(0.145 0 0)', 'Hintergrundfarbe'),
  ('default', '--foreground', 'color', 'oklch(0.145 0 0)', 'oklch(0.985 0 0)', 'Textfarbe'),
  ('default', '--primary', 'color', 'oklch(0.205 0 0)', 'oklch(0.922 0 0)', 'Primäre Akzentfarbe'),
  ('default', '--secondary', 'color', 'oklch(0.97 0 0)', 'oklch(0.269 0 0)', 'Sekundäre Farbe'),
  ('default', '--muted', 'color', 'oklch(0.97 0 0)', 'oklch(0.269 0 0)', 'Gedämpfte Farbe'),
  ('default', '--accent', 'color', 'oklch(0.97 0 0)', 'oklch(0.269 0 0)', 'Akzentfarbe'),
  ('default', '--destructive', 'color', 'oklch(0.577 0.245 27.325)', 'oklch(0.704 0.191 22.216)', 'Fehler/Löschen'),

  -- Radii
  ('default', '--radius', 'radius', '0.625rem', '0.625rem', 'Standard Border-Radius'),

  -- Borders
  ('default', '--border', 'color', 'oklch(0.922 0 0)', 'oklch(1 0 0 / 10%)', 'Rahmenfarbe');
```

### CSS-Generierung (Trigger oder Edge Function)

```typescript
// Beispiel: Edge Function zur CSS-Generierung
async function generateThemeCSS(themeId: string): Promise<string> {
  const supabase = createServiceClient()

  // Tokens laden
  const { data: tokens } = await supabase
    .from("theme_tokens")
    .select("token_name, light_value, dark_value")
    .eq("theme_id", themeId)

  if (!tokens?.length) return ""

  // Light Mode CSS
  const lightCSS = tokens
    .filter((t) => t.light_value)
    .map((t) => `  ${t.token_name}: ${t.light_value};`)
    .join("\n")

  // Dark Mode CSS
  const darkCSS = tokens
    .filter((t) => t.dark_value)
    .map((t) => `  ${t.token_name}: ${t.dark_value};`)
    .join("\n")

  return `/* Auto-generated from theme_tokens */
[data-theme="${themeId}"] {
${lightCSS}
}

.dark[data-theme="${themeId}"] {
${darkCSS}
}`
}
```

---

## AI Tool Integration

### AI Datasource Konfiguration

```sql
-- theme_tokens für AI aktivieren
INSERT INTO ai_datasources (table_schema, table_name, display_name, access_level, is_enabled, description)
VALUES (
  'public',
  'theme_tokens',
  'Theme Design-Tokens',
  'write',  -- Vollzugriff!
  true,
  'Design-Tokens (Farben, Radii, Spacing) für App-Themes'
);
```

### Generierte Tools

Der AI-Chatbot erhält automatisch folgende Tools:

| Tool                  | Beschreibung                   |
| --------------------- | ------------------------------ |
| `query_theme_tokens`  | Liest alle Tokens eines Themes |
| `insert_theme_tokens` | Erstellt neue Tokens           |
| `update_theme_tokens` | Ändert bestehende Tokens       |
| `delete_theme_tokens` | Entfernt Tokens                |

### Beispiel-Interaktionen

**User:** "Zeig mir alle Farben des Ocean Themes"

```typescript
// AI ruft auf:
query_theme_tokens({
  filters: { theme_id: "ocean", category: "color" },
})
```

**User:** "Mach die Primary-Farbe dunkler"

```typescript
// AI ruft auf:
update_theme_tokens({
  id: "token-uuid",
  light_value: "oklch(0.45 0.2 230)", // Vorher: 0.55
  dark_value: "oklch(0.55 0.18 230)", // Vorher: 0.65
})
```

**User:** "Füge eine Success-Farbe hinzu"

```typescript
// AI ruft auf:
insert_theme_tokens({
  theme_id: "ocean",
  token_name: "--success",
  category: "color",
  light_value: "oklch(0.7 0.2 145)",
  dark_value: "oklch(0.75 0.18 145)",
  description: "Erfolgs-/Bestätigungsfarbe",
})
```

---

## Validierung

### Token-Werte validieren

```typescript
// Zod-Schema für Token-Validierung
const tokenValueSchema = z
  .object({
    token_name: z.string().regex(/^--[a-z-]+$/, "Muss mit -- beginnen"),
    category: z.enum(["color", "radius", "spacing", "font"]),
    light_value: z.string().optional(),
    dark_value: z.string().optional(),
  })
  .refine(
    (data) => data.light_value || data.dark_value,
    "Mindestens ein Wert (light oder dark) erforderlich"
  )

// Farb-Validierung
const colorValueSchema = z.string().regex(/^(oklch|hsl|rgb|#)[^;]+$/, "Ungültiges Farbformat")
```

### AI System-Prompt Erweiterung

```
## Theme-Token Bearbeitung

Beim Ändern von Design-Tokens beachte:
1. **Farbformat:** Verwende OKLCH für beste Ergebnisse: `oklch(lightness chroma hue)`
   - lightness: 0-1 (0 = schwarz, 1 = weiß)
   - chroma: 0-0.4 (Sättigung)
   - hue: 0-360 (Farbton)

2. **Kontrast:** Stelle sicher, dass Text auf Hintergründen lesbar bleibt
   - Light Mode: Dunkler Text auf hellem Hintergrund
   - Dark Mode: Heller Text auf dunklem Hintergrund

3. **Konsistenz:** Verwende ähnliche Chroma/Hue-Werte für harmonische Paletten

4. **Vorschau:** Nach Änderungen wird das Theme automatisch neu generiert
```

---

## Implementierungsplan

### Phase 0: Theme-Preference Persistence ✅

- [x] Migration für `theme_preference` Spalte
- [x] `auth-context.tsx`: Lade theme_preference mit Profil
- [x] `use-theme-sync-with-user.ts`: Bidirektionaler Sync-Hook
- [x] `ClientProviders.tsx`: ThemeSyncProvider integriert

### Phase 2a: Datenbank (1-2h)

- [ ] Migration für `theme_tokens` Tabelle
- [ ] RLS Policies
- [ ] Seed-Daten für Default-Theme

### Phase 2b: CSS-Generierung (2-3h)

- [ ] Edge Function oder Trigger für CSS-Generierung
- [ ] Storage-Upload nach Token-Änderung
- [ ] Cache-Invalidierung

### Phase 2c: AI Integration (1h)

- [ ] `theme_tokens` als AI Datasource aktivieren
- [ ] System-Prompt erweitern
- [ ] Validierung für Token-Werte

### Phase 3: UI (Optional, 2-3h)

- [ ] Token-Editor im Theme-Manager
- [ ] Live-Vorschau beim Bearbeiten
- [ ] Color-Picker mit OKLCH-Support

---

## Offene Fragen

1. **Cache-Strategie:** Wie oft soll CSS neu generiert werden?
   - Bei jeder Token-Änderung (einfach, aber langsam)
   - Debounced nach letzter Änderung (besser für Batch-Updates)
   - Manuell via "Publish" Button (explizite Kontrolle)

2. **Builtin-Themes:** Sollen die Tokens von Builtin-Themes auch in der Tabelle sein?
   - Pro: Einheitliche Datenstruktur
   - Contra: Duplizierung, Sync-Probleme

3. **Versionierung:** Sollen Token-Änderungen historisiert werden?
   - Für Undo/Redo Funktionalität
   - Audit-Log für Änderungen

---

## Referenzen

- [OKLCH Color Space](https://oklch.com/)
- [Design Tokens W3C Spec](https://design-tokens.github.io/community-group/format/)
- [AI Tool-Calling Dokumentation](./ai-tool-calling.md)
