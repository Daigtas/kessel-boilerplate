# Zwei Supabase-Projekte - Architektur

## 🎯 Übersicht

Jedes neue Projekt benötigt **zwei verschiedene Supabase-Projekte**:

### 1. Zentrales Supabase-Projekt (Secrets-Vault)

**Zweck:** Zentrale Verwaltung aller Secrets für alle Projekte

**Eigenschaften:**
- **Immer dasselbe Projekt** für alle neuen Projekte
- **URL:** `https://zedhieyjlfhygsfxzbze.supabase.co` (Standardwert)
- **Account:** koenig@megabrain.com (dedizierter Account für Vault)
- **Verwendung:** Nur für `pull-env.mjs` Skript
- **Enthält:** Alle Secrets im Vault (API-Keys, Stripe-Keys, etc.)
- **Zugriff:** Via `SERVICE_ROLE_KEY` aus `.env`
- **Warum separater Account:** Um Kosten zu sparen (Free-Tier statt Pro-Version für einfachen Vault)

**Datei: `.env`**
```bash
# Zentrale Supabase URL für Vault-Zugriff
NEXT_PUBLIC_SUPABASE_URL=https://zedhieyjlfhygsfxzbze.supabase.co
SERVICE_ROLE_KEY=eyJ...  # Service Role Key des ZENTRALEN Projekts
```

### 2. Projekt-spezifisches Supabase-Projekt (App-Backend)

**Zweck:** Datenbank, Auth, Storage für die eigentliche App

**Eigenschaften:**
- **Jedes Projekt hat sein eigenes Supabase-Projekt**
- **URL:** Projekt-spezifisch (z.B. `https://abc123xyz.supabase.co`)
- **Verwendung:** Von der App verwendet (Client + Server Components)
- **Enthält:** Datenbank-Tabellen, Auth-User, Storage-Buckets
- **Zugriff:** Via `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` aus `.env.local`

**Datei: `.env.local`**
```bash
# Projekt-spezifische Supabase URL für die App
NEXT_PUBLIC_SUPABASE_URL=https://abc123xyz.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=eyJ...  # Anon Key des PROJEKT-SPEZIFISCHEN Projekts
```

## 🔄 Workflow

### Schritt 1: Neues Supabase-Projekt erstellen

**Manuell im Supabase Dashboard:**
1. Gehe zu https://supabase.com/dashboard
2. Klicke "New Project"
3. Gib Projektname ein (z.B. `mein-neues-projekt`)
4. Warte bis Projekt erstellt ist
5. Kopiere:
   - Project URL (z.B. `https://abc123xyz.supabase.co`)
   - Anon/Public Key (Publishable Key)

### Schritt 2: CLI-Tool ausführen

```bash
kessel mein-neues-projekt
```

**Eingaben:**
1. Projektname: `mein-neues-projekt`
2. GitHub Token: [dein Token]
3. **Zentrale Supabase URL:** `https://zedhieyjlfhygsfxzbze.supabase.co` (Standardwert, Enter)
4. **Zentraler Service Role Key:** [Service Role Key des ZENTRALEN Projekts]
5. **Projekt-spezifische Supabase URL:** `https://abc123xyz.supabase.co` (NEU!)
6. **Projekt-spezifischer Publishable Key:** [Anon Key des NEUEN Projekts]
7. Dependencies installieren: Ja

### Schritt 3: Was passiert

**`.env` wird erstellt:**
```bash
# Zentrale Supabase (für Vault)
NEXT_PUBLIC_SUPABASE_URL=https://zedhieyjlfhygsfxzbze.supabase.co
SERVICE_ROLE_KEY=eyJ...  # Vom zentralen Projekt
```

**`.env.local` wird erstellt:**
```bash
# Projekt-spezifische Supabase (für App)
NEXT_PUBLIC_SUPABASE_URL=https://abc123xyz.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=eyJ...  # Vom neuen Projekt
```

### Schritt 4: Secrets abrufen

```bash
pnpm pull-env
```

**Was passiert:**
- `pull-env.mjs` liest `.env` (zentrale URL + SERVICE_ROLE_KEY)
- Ruft Secrets aus dem **zentralen** Vault ab
- Schreibt Secrets in `.env.local` (zusätzlich zu den projekt-spezifischen Keys)

## ⚠️ Wichtig: Warum zwei URLs?

**Problem:** `pull-env.mjs` und die App verwenden beide `NEXT_PUBLIC_SUPABASE_URL`

**Lösung:** 
- `.env` enthält die **zentrale** URL (für Vault-Zugriff)
- `.env.local` enthält die **projekt-spezifische** URL (für die App)
- `.env.local` überschreibt `.env` für Next.js

**Aber:** `pull-env.mjs` liest `.env` direkt, nicht `.env.local`!

## ✅ CLI-Tool bereits angepasst

Das CLI-Tool fragt jetzt **zwei verschiedene URLs** ab:

1. **Zentrale Supabase URL** (für Vault) → `.env` ✅
2. **Projekt-spezifische Supabase URL** (für App) → `.env.local` ✅

**Status:** Tool fragt nach beiden URLs und erstellt beide Dateien korrekt!

