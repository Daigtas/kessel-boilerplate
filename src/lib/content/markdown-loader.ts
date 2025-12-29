/**
 * Generischer Markdown Content Loader
 *
 * Lädt Markdown-Content dynamisch aus dem src/content Verzeichnis.
 * Single Source of Truth für Markdown-basierte Seiten.
 */

import { readFile } from "fs/promises"
import { join } from "path"

/**
 * Verfügbare Content-Typen
 */
export type ContentType = "wiki" | "impressum" | "datenschutz"

/**
 * Content-Datei-Mapping
 */
const CONTENT_FILES: Record<ContentType, string> = {
  wiki: "wiki.md",
  impressum: "impressum.md",
  datenschutz: "datenschutz.md",
}

/**
 * Lädt Markdown-Content als String (Server-seitig)
 *
 * @param contentType - Der Typ des zu ladenden Contents
 * @returns Markdown-Content als String
 *
 * @example
 * ```ts
 * const content = await loadMarkdownContent("impressum")
 * ```
 */
export async function loadMarkdownContent(contentType: ContentType): Promise<string> {
  try {
    const fileName = CONTENT_FILES[contentType]
    if (!fileName) {
      console.error(`Unknown content type: ${contentType}`)
      return ""
    }

    const contentPath = join(process.cwd(), "src/content", fileName)
    const content = await readFile(contentPath, "utf-8")
    return content
  } catch (error) {
    console.error(`Failed to load ${contentType} content:`, error)
    return ""
  }
}

/**
 * Content mit Metadaten
 */
export interface ContentResult {
  content: string
  characterCount: number
  wordCount: number
  contentType: ContentType
}

/**
 * Lädt Markdown-Content mit zusätzlichen Metadaten
 *
 * @param contentType - Der Typ des zu ladenden Contents
 * @returns Content mit Metadaten
 */
export async function loadMarkdownContentWithMeta(
  contentType: ContentType
): Promise<ContentResult> {
  const content = await loadMarkdownContent(contentType)
  return {
    content,
    characterCount: content.length,
    wordCount: content.split(/\s+/).filter(Boolean).length,
    contentType,
  }
}
