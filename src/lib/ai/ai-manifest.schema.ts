/**
 * AI Component Manifest Schema
 *
 * Zod-Schema für die Validierung von ai-manifest.json
 * Definiert die Struktur für KI-steuerbare UI-Komponenten.
 */

import { z } from "zod"

/**
 * AI Action Types
 *
 * Definiert welche Aktionen eine Komponente ausführen kann.
 */
export const AIActionType = z.enum([
  "navigate", // Route-Navigation
  "toggle", // Panel/State umschalten
  "submit", // Formular absenden
  "open-modal", // Modal öffnen
  "close-modal", // Modal schließen
  "select", // Auswahl treffen
  "input", // Eingabe machen
  "trigger", // Generische Aktion auslösen
])

export type AIActionType = z.infer<typeof AIActionType>

/**
 * AI Component Category
 *
 * Kategorisiert Komponenten für bessere Gruppierung und Suche.
 */
export const AIComponentCategory = z.enum([
  "navigation", // Navigations-Links
  "layout", // Layout-Panels, Sidebars
  "form", // Formulare, Inputs
  "modal", // Modals, Dialogs
  "data", // Datentabellen, Listen
  "settings", // Einstellungen, Theme-Switcher
])

export type AIComponentCategory = z.infer<typeof AIComponentCategory>

/**
 * Required Role
 *
 * Definiert welche Rolle ein User haben muss, um diese Aktion ausführen zu können.
 */
export const RequiredRole = z.enum(["public", "user", "admin"])

export type RequiredRole = z.infer<typeof RequiredRole>

/**
 * AI Component Schema
 *
 * Beschreibt eine einzelne KI-steuerbare Komponente.
 */
export const AIComponentSchema = z.object({
  /** Eindeutige, beschreibende ID (kebab-case) */
  id: z
    .string()
    .regex(/^[a-z][a-z0-9-]*$/, "ID muss kebab-case sein (lowercase, Bindestriche erlaubt)")
    .min(3, "ID muss mindestens 3 Zeichen haben")
    .describe("Eindeutige Komponenten-ID im kebab-case Format"),

  /** Menschenlesbare Beschreibung (DE oder EN) */
  description: z
    .string()
    .min(10, "Beschreibung muss mindestens 10 Zeichen haben")
    .max(200, "Beschreibung darf max 200 Zeichen haben")
    .describe("Kurze Beschreibung was diese Aktion macht"),

  /** Aktion die ausgeführt wird */
  action: AIActionType.describe("Typ der Aktion"),

  /** Ziel der Aktion (optional je nach Action-Type) */
  target: z.string().optional().describe("Ziel der Aktion (z.B. Route-Pfad, Panel-Name, Modal-ID)"),

  /** Kategorie für Gruppierung */
  category: AIComponentCategory.describe("Kategorie der Komponente"),

  /** Keywords für KI-Erkennung (min 2) */
  keywords: z
    .array(z.string())
    .min(2, "Mindestens 2 Keywords erforderlich")
    .describe("Suchbegriffe für die KI (DE und/oder EN)"),

  /** Erforderliche Rolle (optional, Standard: public) */
  requiredRole: RequiredRole.optional()
    .default("public")
    .describe("Minimale Rolle für diese Aktion"),

  /**
   * Route/Seite wo diese Komponente zu finden ist.
   * - "global" = auf allen Seiten verfügbar (z.B. Navbar-Items)
   * - "/path/to/page" = nur auf dieser spezifischen Seite
   * - undefined = Legacy-Komponente (wird als "global" behandelt)
   */
  route: z
    .string()
    .optional()
    .describe("Route wo die Komponente zu finden ist ('global' oder '/path/to/page')"),
})

export type AIComponent = z.infer<typeof AIComponentSchema>

/**
 * Vollständiges AI Manifest Schema
 */
export const AIManifestSchema = z.object({
  /** Manifest-Version */
  version: z.string().describe("Semantic Version des Manifest-Formats"),

  /** Liste aller registrierten Komponenten */
  components: z.array(AIComponentSchema).describe("Alle KI-steuerbaren Komponenten"),
})

export type AIManifest = z.infer<typeof AIManifestSchema>

/**
 * Validiert ein Manifest gegen das Schema
 */
export function validateManifest(manifest: unknown): {
  success: boolean
  data?: AIManifest
  error?: z.ZodError
} {
  const result = AIManifestSchema.safeParse(manifest)
  if (result.success) {
    return { success: true, data: result.data }
  }
  return { success: false, error: result.error }
}
