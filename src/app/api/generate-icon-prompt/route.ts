/**
 * API Route: Icon Prompt Generation
 *
 * Generiert einen Prompt für die Icon-Generierung basierend auf dem App-Wiki
 */

import { generateText } from "ai"
import { openrouter } from "@/lib/ai/openrouter-provider"
import { loadWikiContent } from "@/lib/ai-chat/wiki-content"
import { createClient } from "@/utils/supabase/server"
import { NextResponse } from "next/server"

export const maxDuration = 30

/**
 * Nano-Banana-optimierte Prompt-Struktur für App-Logo-Generierung
 *
 * Struktur (Faustregel):
 * 1. Zweck der Grafik (Logo, Web-UI, Icon etc.) - FIX
 * 2. Motiv/Metapher (was dargestellt wird) - DYNAMISCH
 * 3. Stil & Look (minimalistisch, monochrom, flach, 2D etc.) - FIX
 * 4. Komposition & Geometrie (Formen, Anordnung, "fills the frame") - DYNAMISCH
 * 5. Constraints und Negatives (kein Text, kein Schatten, keine Farbverläufe) - FIX
 */

// FIXER TEIL - Anfang (Zweck)
const PROMPT_PREFIX = "Create an abstract, minimalist logo for a web application"

// FIXER TEIL - Mitte (Stil & Look)
const PROMPT_STYLE =
  "Use a monochrome, flat 2D design with a white background and solid black shapes."

// FIXER TEIL - Ende (Constraints)
const PROMPT_CONSTRAINTS = "No text, no gradients, no shadows, no additional colors."

const PROMPT_GENERATION_SYSTEM = `Du bist ein Experte für App-Icon-Design. Deine Aufgabe ist es, den DYNAMISCHEN TEIL eines Bildgenerierungs-Prompts zu erstellen.

Der finale Prompt hat diese Struktur:
1. FIXER ANFANG: "${PROMPT_PREFIX}, representing [DYNAMISCH: Motiv/Metapher]."
2. FIXER STIL: "${PROMPT_STYLE}"
3. DYNAMISCHE GEOMETRIE: "[Beschreibung der geometrischen Formen, Anordnung, 'filling the frame from edge to edge']"
4. FIXE CONSTRAINTS: "${PROMPT_CONSTRAINTS}"

DEINE AUFGABE:
Generiere NUR die zwei dynamischen Teile als JSON:
{
  "motif": "kurze Beschreibung was das Logo repräsentiert (z.B. 'a 4-column layout and modular structure')",
  "geometry": "präzise Beschreibung der geometrischen Formen (z.B. 'Show exactly four vertical rectangles of different widths, aligned side-by-side, touching each other and filling the frame from edge to edge.')"
}

REGELN für die dynamischen Teile:
- Englisch
- Natürlich formulierte, vollständige Sätze
- Basierend auf dem App-Kontext (Name, Beschreibung, Wiki)
- Motiv: Was repräsentiert das Logo? (z.B. CRM → Kundenbeziehungen, Dashboard → Datenübersicht)
- Geometrie: Welche einfachen geometrischen Formen? (rectangles, circles, lines, squares, etc.)
- Betone immer "filling the frame from edge to edge" oder "touching each other"
- Keine komplexen Details, keine Fotos, keine realistischen Objekte

BEISPIELE für verschiedene App-Typen:

CRM-App:
{
  "motif": "customer relationships and connections",
  "geometry": "Show three overlapping circles of different sizes, arranged in a triangular formation, touching each other and filling the frame from edge to edge."
}

Dashboard-App:
{
  "motif": "data visualization and analytics overview", 
  "geometry": "Show a grid of four equal squares with varying internal patterns (horizontal lines, vertical lines, diagonal, dots), filling the frame from edge to edge."
}

Boilerplate/Framework:
{
  "motif": "a modular foundation and building blocks",
  "geometry": "Show exactly four vertical rectangles of different widths, aligned side-by-side, touching each other and filling the frame from edge to edge."
}

Projektmanagement:
{
  "motif": "task organization and workflow",
  "geometry": "Show three horizontal bars of different lengths, stacked vertically with small gaps, filling the frame from edge to edge."
}

Antworte NUR mit dem JSON-Objekt, keine zusätzlichen Erklärungen.`

interface DynamicPromptParts {
  motif: string
  geometry: string
}

/**
 * Baut den finalen Prompt aus fixen und dynamischen Teilen zusammen
 */
function buildFinalPrompt(dynamicParts: DynamicPromptParts): string {
  return [
    `${PROMPT_PREFIX}, representing ${dynamicParts.motif}.`,
    PROMPT_STYLE,
    dynamicParts.geometry,
    PROMPT_CONSTRAINTS,
  ].join(" ")
}

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { appName, description } = (await req.json()) as {
      appName?: string
      description?: string
    }

    // Lade Wiki-Content für Kontext
    const wikiContent = await loadWikiContent()

    // Baue Prompt für AI zusammen
    const contextPrompt = `App-Name: ${appName || "Unbekannt"}
Beschreibung: ${description || "Keine Beschreibung"}

App-Wiki-Kontext:
${wikiContent.substring(0, 2000)}

Generiere die dynamischen Teile für den Logo-Prompt basierend auf diesem Kontext:`

    // Generiere dynamische Teile mit AI
    const { text } = await generateText({
      model: openrouter("google/gemini-2.5-flash"),
      system: PROMPT_GENERATION_SYSTEM,
      prompt: contextPrompt,
      temperature: 0.7,
    })

    console.log("[Generate Icon Prompt] AI Response:", text)

    // Parse JSON-Antwort
    let dynamicParts: DynamicPromptParts
    try {
      // Extrahiere JSON aus der Antwort (falls zusätzlicher Text vorhanden)
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error("Keine JSON-Struktur in der Antwort gefunden")
      }
      dynamicParts = JSON.parse(jsonMatch[0]) as DynamicPromptParts
    } catch (parseError) {
      console.error("[Generate Icon Prompt] JSON Parse Error:", parseError)
      // Fallback: Verwende Standard-Werte für Boilerplate
      dynamicParts = {
        motif: "a modular foundation and building blocks",
        geometry:
          "Show exactly four vertical rectangles of different widths, aligned side-by-side, touching each other and filling the frame from edge to edge.",
      }
    }

    // Baue finalen Prompt zusammen
    const finalPrompt = buildFinalPrompt(dynamicParts)
    console.log("[Generate Icon Prompt] Final Prompt:", finalPrompt)

    return NextResponse.json({
      prompt: finalPrompt,
      parts: {
        prefix: PROMPT_PREFIX,
        motif: dynamicParts.motif,
        style: PROMPT_STYLE,
        geometry: dynamicParts.geometry,
        constraints: PROMPT_CONSTRAINTS,
      },
    })
  } catch (error) {
    console.error("[Generate Icon Prompt] Error:", error)
    return NextResponse.json(
      {
        error: "Fehler bei der Prompt-Generierung",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
