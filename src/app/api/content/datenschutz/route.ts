/**
 * API Route: Datenschutzerklärung Content
 *
 * Liefert den Datenschutz-Content als Plain-Text (Markdown).
 */

import { NextResponse } from "next/server"

import { loadMarkdownContent } from "@/lib/content"

// Dynamische Route - kein Caching
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const content = await loadMarkdownContent("datenschutz")

    if (!content) {
      return NextResponse.json({ error: "Datenschutz content not found" }, { status: 404 })
    }

    // Rückgabe als Plain-Text für einfaches Laden
    return new NextResponse(content, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        // Kein Cache in Development, Cache in Production
        "Cache-Control":
          process.env.NODE_ENV === "production"
            ? "public, max-age=300, stale-while-revalidate=60"
            : "no-cache, no-store, must-revalidate",
      },
    })
  } catch (error) {
    console.error("Failed to load datenschutz content:", error)
    return NextResponse.json({ error: "Failed to load datenschutz content" }, { status: 500 })
  }
}
