"use client"

import { useState, useEffect } from "react"

import { PageContent, PageHeader } from "@/components/shell"
import { MarkdownViewer } from "@/components/content"

/**
 * Datenschutzerklärung Seite
 *
 * Lädt und rendert den Datenschutz-Content aus src/content/datenschutz.md.
 * Verwendet die gleiche Markdown-Rendering-Technologie wie das App-Wiki.
 */
export default function DatenschutzPage(): React.ReactElement {
  const [content, setContent] = useState<string>("")
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadContent() {
      try {
        const response = await fetch("/api/content/datenschutz", {
          cache: "no-store",
          headers: {
            "Cache-Control": "no-cache",
          },
        })
        if (response.ok) {
          const markdown = await response.text()
          setContent(markdown)
        }
      } catch (error) {
        console.error("Failed to load datenschutz content:", error)
      } finally {
        setIsLoading(false)
      }
    }
    loadContent()
  }, [])

  if (isLoading) {
    return (
      <PageContent>
        <div className="flex h-64 items-center justify-center">
          <div className="text-muted-foreground">Lade Datenschutzerklärung...</div>
        </div>
      </PageContent>
    )
  }

  return (
    <PageContent>
      <PageHeader
        title="Datenschutzerklärung"
        description="Informationen zur Verarbeitung personenbezogener Daten"
        className="mb-8"
      />
      <MarkdownViewer content={content} />
    </PageContent>
  )
}
