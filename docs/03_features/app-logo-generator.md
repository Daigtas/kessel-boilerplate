# App-Logo Generator

> **Status:** ✅ Implementiert  
> **Kategorie:** App-Verwaltung  
> **Pfad:** `/app-verwaltung/app-logo`

## Übersicht

Der App-Logo Generator ermöglicht die automatische Erstellung thematisch passender, stilkonsistenter App-Icons durch KI-Bildmodelle. Das Feature kombiniert intelligente Prompt-Generierung mit einer Post-Processing-Pipeline für perfekte Theme-Integration.

## Features

### 🎨 KI-gestützte Bildgenerierung

- **Multi-Provider-Support:** OpenRouter (Standard) und fal.ai (optional)
- **OpenRouter-Modelle:** Nano Banana Pro, Nano Banana, FLUX.2 Flex/Pro
- **fal.ai-Modelle:** FLUX Schnell/Dev/Pro, Recraft V3, SD 3.5 Large, Ideogram V2
- **Varianten-Generierung:** 1-4 Varianten pro Request

### 🤖 Intelligente Prompt-Generierung

Der Prompt wird automatisch via Gemini Flash basierend auf dem App-Kontext generiert:

1. **Zweck (fix):** `Create an abstract, minimalist logo for a web application...`
2. **Motiv (dynamisch):** Basierend auf App-Typ (CRM, Dashboard, etc.)
3. **Stil (fix):** `monochrome, flat 2D, white background, solid black shapes`
4. **Geometrie (dynamisch):** Spezifische Formen basierend auf App-Kontext
5. **Constraints (fix):** `No text, no gradients, no shadows, no additional colors`

### 🔄 Post-Processing Pipeline

Die `MonochromeIcon`-Komponente verarbeitet generierte Bilder:

1. **Thresholding:** Graustufen → reines Schwarz/Weiß (Schwellenwert: 128)
2. **Transparenz:** Weiße Pixel → Alpha = 0 (transparent)
3. **Ergebnis:** Schwarze Pixel auf transparentem Hintergrund

### 🌓 CSS-basierte Theme-Anpassung

- **Dark Mode:** `filter: invert(1)` → weißes Icon
- **Light Mode:** `filter: none` → schwarzes Icon
- Automatische Erkennung via MutationObserver auf `<html class="dark">`

## Architektur

### Dateistruktur

```
src/
├── app/
│   ├── (shell)/app-verwaltung/app-logo/
│   │   └── page.tsx              # Admin-Seite
│   └── api/
│       ├── generate-app-icon/    # Icon-Generierungs-API
│       ├── generate-icon-prompt/ # Prompt-Generierungs-API
│       ├── media-providers/      # Provider-Liste-API
│       └── app-settings/         # App-Settings-API
├── components/
│   ├── admin/
│   │   └── AppIconGenerator.tsx  # Generator-UI
│   └── ui/
│       ├── app-icon.tsx          # Icon-Anzeige
│       └── monochrome-icon.tsx   # Post-Processing
└── lib/media/
    ├── types.ts                  # Interfaces
    ├── config.ts                 # Provider-Konfiguration
    ├── factory.ts                # Factory-Pattern
    ├── openrouter-media.ts       # OpenRouter-Service
    ├── fal-media.ts              # fal.ai-Service
    └── index.ts                  # Re-Exports
```

### MediaService-Interface

```typescript
interface MediaService {
  generateImage(prompt: string, options?: ImageGenerationOptions): Promise<GeneratedImage[]>
  getProviderInfo(): ProviderInfo
}

interface GeneratedImage {
  base64: string
  url?: string
  mimeType: string
  width: number
  height: number
}
```

### Datenbank-Schema

```sql
-- Singleton-Tabelle für App-Settings
CREATE TABLE app_settings (
  id UUID PRIMARY KEY DEFAULT '00000000-0000-0000-0000-000000000001',
  app_name TEXT NOT NULL DEFAULT 'Kessel App',
  app_description TEXT,
  icon_url TEXT,
  icon_variants JSONB,
  icon_provider TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT single_row CHECK (id = '00000000-0000-0000-0000-000000000001')
);

-- Storage Bucket für Icons
INSERT INTO storage.buckets (id, name, public)
VALUES ('app-icons', 'app-icons', true);
```

## Verwendung

### In der Admin-UI

1. Navigiere zu **App-Verwaltung → App-Logo**
2. Gib App-Name und Beschreibung ein
3. Klicke **KI-generieren** für automatischen Prompt
4. Wähle Provider und Modell
5. Stelle gewünschte Varianten ein (1-4)
6. Klicke **Neu generieren**
7. Wähle bevorzugte Variante aus
8. Klicke **Speichern**

### Programmatisch

```typescript
// Icon generieren
const response = await fetch("/api/generate-app-icon", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    appName: "Meine App",
    description: "Eine CRM-Anwendung",
    prompt: "Create an abstract, minimalist logo...",
    variants: 4,
    provider: "openrouter",
    model: "nano-banana-pro",
  }),
})

const { images } = await response.json()
// images: Array<{ url: string, base64: string }>
```

### MonochromeIcon-Komponente

```tsx
// Automatische Theme-Anpassung
<MonochromeIcon
  src="/path/to/icon.png"
  size={64}
  threshold={128} // Optional: Schwellenwert für Thresholding
  invert={false} // Optional: Manuell invertieren
/>
```

## Key Learnings & Findings

### Nano Banana Pro Prompt-Guidelines

1. **Natürliche Sprache:** Vollständige Sätze funktionieren besser als Keyword-Listen
2. **Struktur:** Zweck → Motiv → Stil → Geometrie → Constraints
3. **Weißer Hintergrund:** `white background` statt `transparent background` (vermeidet Schachbrettmuster)
4. **Explizite Constraints:** `No text, no gradients` sind essentiell

### Warum Post-Processing notwendig ist

- **Problem:** KI-Modelle können keine echte Transparenz generieren
- **"Transparent background"** wird oft als Schachbrettmuster interpretiert
- **Lösung:** Monochrome Bilder (schwarz auf weiß) generieren, dann per Canvas weißen Hintergrund transparent machen

### Canvas-Rendering-Timing

- `useRef` Canvas muss im DOM sein, bevor Pixel gelesen werden können
- **Lösung:** Callback-Ref-Pattern mit `setCanvasRef` + `canvasReady` State
- useEffect wartet auf `canvasReady` bevor Bildverarbeitung startet

### CORS bei Supabase Storage

- Canvas `getImageData()` wirft CORS-Fehler bei externen Bildern
- **Lösung:** `img.crossOrigin = "anonymous"` + Fallback bei CORS-Fehler
- Supabase public buckets unterstützen CORS standardmäßig

## Konfiguration

### Environment Variables

```env
# OpenRouter (immer verfügbar)
OPENROUTER_API_KEY=sk-or-...

# fal.ai (optional)
FAL_API_KEY=key_...
# oder
FAL_KEY=key_...
```

### Provider-Konfiguration

```typescript
// src/lib/media/config.ts
export const mediaProviders: Record<string, ProviderInfo> = {
  openrouter: {
    id: "openrouter",
    name: "OpenRouter",
    enabled: true,
    models: {
      "nano-banana-pro": "google/gemini-3-pro-image-preview",
      "nano-banana": "google/gemini-2.5-flash-image",
      "flux-2": "black-forest-labs/flux.2-flex",
      "flux-2-pro": "black-forest-labs/flux.2-pro",
    },
    defaultModel: "nano-banana-pro",
  },
  fal: {
    id: "fal",
    name: "fal.ai",
    enabled: !!(process.env.FAL_API_KEY || process.env.FAL_KEY),
    models: {
      "flux-schnell": "fal-ai/flux/schnell",
      "recraft-v3": "fal-ai/recraft/v3/text-to-image",
      // ...
    },
    defaultModel: "flux-schnell",
  },
}
```

## Bekannte Einschränkungen

1. **Generierte Icons:** Nicht immer perfekt, manuelle Anpassung kann nötig sein
2. **API-Kosten:** Bildgenerierung verursacht Kosten bei OpenRouter/fal.ai
3. **Generierungsdauer:** 5-30 Sekunden je nach Modell und Varianten
4. **Monochrom-Fokus:** Optimiert für schwarz/weiß Icons, nicht für farbige Logos

## Zukunft

- [ ] Farbige Icons mit Theme-Palette-Integration
- [ ] SVG-Export für verlustfreie Skalierung
- [ ] Icon-Editor für manuelle Anpassungen
- [ ] Automatische Favicon-Generierung (16x16, 32x32, etc.)
- [ ] AI-basiertes Icon-Refinement

## Changelog

- **v1.0.0** (2026-01-01): Initiale Implementierung
  - Multi-Provider-Support (OpenRouter, fal.ai)
  - Nano-Banana-optimierte Prompt-Struktur
  - Post-Processing-Pipeline mit Canvas
  - CSS-basierte Theme-Anpassung
