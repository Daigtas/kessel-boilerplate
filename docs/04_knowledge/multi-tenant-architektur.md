# Multi-Tenant Architektur

## Übersicht

Die Kessel-Boilerplate verwendet eine **Multi-Tenant-Architektur**, um mehrere Projekte kosteneffizient in einem einzigen Supabase-Projekt zu betreiben.

## Architektur-Prinzipien

### 1. Shared Supabase-Projekt

Alle Kessel-Projekte teilen sich **ein** Supabase-Projekt:

- **Projekt-Ref**: `ufqlocxqizmiaozkashi` (Name: "Kessel")
- **URL**: `https://ufqlocxqizmiaozkashi.supabase.co`
- **Vorteil**: Nur ein kostenloses Supabase-Projekt nötig (Free Tier Limit: 2 Projekte)

### 2. Schema-Isolation

Jedes Kessel-Projekt hat ein **eigenes Postgres-Schema**:

- Projekt "galaxy" → Schema `galaxy`
- Projekt "nova" → Schema `nova`
- Projekt "moon" → Schema `moon`

**Isolation:**

- Tabellen sind vollständig isoliert
- RLS Policies funktionieren pro Schema
- Keine Datenvermischung zwischen Projekten

### 3. Shared Auth

**Auth ist shared** - alle Projekte teilen sich dieselben User:

- Standard-User (`admin@local`, `user@local`) existieren **einmal** für alle Projekte
- Neue User werden im Shared Auth erstellt
- Profile werden **pro Schema** erstellt (Isolation)

## Environment-Variablen

Jedes Projekt benötigt in `.env.local`:

```env
# Shared Supabase-Projekt
NEXT_PUBLIC_SUPABASE_URL=https://ufqlocxqizmiaozkashi.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...

# Projekt-spezifisches Schema
NEXT_PUBLIC_PROJECT_SCHEMA=galaxy
```

## Supabase-Client Konfiguration

Der Supabase-Client wird automatisch mit Schema-Support konfiguriert:

```typescript
// src/utils/supabase/client.ts
const client = createBrowserClient(url, key, {
  db: {
    schema: process.env.NEXT_PUBLIC_PROJECT_SCHEMA || "public",
  },
})
```

**Alle Queries** verwenden automatisch das richtige Schema - keine explizite Schema-Angabe nötig!

## Storage-Isolation

Themes werden in projekt-spezifischen Ordnern gespeichert:

- `themes/galaxy/theme-name.css`
- `themes/nova/theme-name.css`

Der Storage-Pfad wird automatisch basierend auf `NEXT_PUBLIC_PROJECT_SCHEMA` generiert.

## Migrationen

Migrationen werden **pro Schema** ausgeführt:

```bash
# Automatisch bei CLI-Installation
node scripts/apply-migrations-to-schema.mjs galaxy

# Manuell
CREATE SCHEMA IF NOT EXISTS "galaxy";
SET search_path TO "galaxy";
-- Migrationen ausführen...
```

## Vorteile

✅ **Kostenlos**: Nur ein Supabase-Projekt nötig  
✅ **Isolation**: Vollständige Daten-Trennung zwischen Projekten  
✅ **Einfach**: Keine explizite Schema-Angabe in Queries nötig  
✅ **Skalierbar**: Beliebige Anzahl Projekte möglich

## Nachteile

⚠️ **Shared Auth**: User existieren für alle Projekte  
⚠️ **Storage-Limits**: Ein Bucket für alle Projekte (aber Ordner-Isolation)  
⚠️ **Komplexität**: Schema-Management erfordert Disziplin

## Best Practices

1. **Schema-Namen**: Verwende nur Kleinbuchstaben und Unterstriche (Postgres-Limit)
2. **Migrationen**: Immer Schema-aware ausführen
3. **Storage**: Verwende projekt-spezifische Ordner-Prefixe
4. **Testing**: Teste Isolation zwischen Projekten

## Troubleshooting

### Problem: Daten von Projekt A sind in Projekt B sichtbar

**Lösung**: Prüfe `NEXT_PUBLIC_PROJECT_SCHEMA` in `.env.local` - muss unterschiedlich sein!

### Problem: Migrationen funktionieren nicht

**Lösung**: Verwende `scripts/apply-migrations-to-schema.mjs` statt `supabase db push`

### Problem: Storage-Pfade funktionieren nicht

**Lösung**: Prüfe ob `NEXT_PUBLIC_PROJECT_SCHEMA` gesetzt ist - Storage verwendet projekt-spezifische Ordner
