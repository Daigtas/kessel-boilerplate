/**
 * API Route: Impressum Content
 *
 * Liefert den Impressum-Content als Plain-Text (Markdown).
 */

import { NextResponse } from "next/server"

import { loadMarkdownContent } from "@/lib/content"

// Dynamische Route - kein Caching
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const content = await loadMarkdownContent("impressum")

    if (!content) {
      return NextResponse.json({ error: "Impressum content not found" }, { status: 404 })
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
    console.error("Failed to load impressum content:", error)
    return NextResponse.json({ error: "Failed to load impressum content" }, { status: 500 })
  }
}
