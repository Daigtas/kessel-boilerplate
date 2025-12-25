/**
 * OpenRouter Provider für Vercel AI SDK
 *
 * Verwendet das offizielle @openrouter/ai-sdk-provider Package.
 * Unterstützt alle OpenRouter-Modelle (Gemini, Claude, GPT-4o, etc.)
 */

import { createOpenRouter } from "@openrouter/ai-sdk-provider"

/**
 * OpenRouter Provider-Instanz
 *
 * Konfiguriert mit:
 * - API Key aus Environment Variable
 * - Standard-Headers für OpenRouter (HTTP-Referer, X-Title)
 * - Kompatibilitätsmodus: 'compatible' (Standard)
 */
export const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1", // Optional, Standard ist bereits korrekt
  compatibility: "compatible", // 'strict' oder 'compatible'
  headers: {
    "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "https://kessel-boilerplate.local",
    "X-Title": process.env.NEXT_PUBLIC_APP_NAME || "Kessel B2B App",
  },
})

/**
 * Verfügbare Modelle auf OpenRouter
 *
 * Strategie:
 * - Gemini 3 Flash: Günstig, schnell, gut für Vision/Screenshots
 * - Claude Opus 4.5: Zuverlässig für Tool-Calling/Agent-Workflows
 * - GPT-4.1: Fallback für Tool-Calling
 */
export const OPENROUTER_MODELS = {
  // === PRIMARY: Chat + Vision (günstig, schnell) ===
  "google/gemini-3-flash-preview": {
    id: "google/gemini-3-flash-preview",
    name: "Gemini 3 Flash",
    supportsVision: true,
    supportsTools: false, // Nicht zuverlässig genug via OpenRouter
    costTier: "low" as const,
    useCase: "chat-vision",
  },

  // === PRIMARY: Tool-Calling (zuverlässig) ===
  "anthropic/claude-opus-4.5": {
    id: "anthropic/claude-opus-4.5",
    name: "Claude Opus 4.5",
    supportsVision: true,
    supportsTools: true,
    costTier: "high" as const,
    useCase: "tools-agent",
  },

  // === FALLBACK: Tool-Calling Alternative ===
  "openai/gpt-4.1": {
    id: "openai/gpt-4.1",
    name: "GPT-4.1",
    supportsVision: true,
    supportsTools: true,
    costTier: "medium" as const,
    useCase: "tools-agent",
  },

  // === LEGACY: Alte Modelle für Kompatibilität ===
  "google/gemini-2.0-flash-001": {
    id: "google/gemini-2.0-flash-001",
    name: "Gemini 2.0 Flash (Legacy)",
    supportsVision: true,
    supportsTools: false,
    costTier: "low" as const,
    useCase: "chat-vision",
  },
  "google/gemini-2.5-flash": {
    id: "google/gemini-2.5-flash",
    name: "Gemini 2.5 Flash (Legacy)",
    supportsVision: true,
    supportsTools: false,
    costTier: "low" as const,
    useCase: "chat-vision",
  },
  "anthropic/claude-3.5-sonnet": {
    id: "anthropic/claude-3.5-sonnet",
    name: "Claude 3.5 Sonnet (Legacy)",
    supportsVision: true,
    supportsTools: true,
    costTier: "medium" as const,
    useCase: "tools-agent",
  },
  "openai/gpt-4o": {
    id: "openai/gpt-4o",
    name: "GPT-4o (Legacy)",
    supportsVision: true,
    supportsTools: true,
    costTier: "medium" as const,
    useCase: "tools-agent",
  },
} as const

/**
 * Standard-Modell für Chat/Vision (ohne Tools)
 * Gemini 3 Flash: günstig, schnell, hervorragend für Screenshots
 */
export const DEFAULT_CHAT_MODEL = "google/gemini-3-flash-preview"

/**
 * Standard-Modell für Tool-Calling
 * Claude Opus 4.5: zuverlässige Tool-Aufrufe, Agent-Workflows
 */
export const DEFAULT_TOOL_MODEL = "anthropic/claude-opus-4.5"

/**
 * Fallback für Tool-Calling (falls Claude nicht verfügbar)
 */
export const FALLBACK_TOOL_MODEL = "openai/gpt-4.1"

/**
 * Legacy Export für Abwärtskompatibilität
 * @deprecated Verwende DEFAULT_CHAT_MODEL oder DEFAULT_TOOL_MODEL
 */
export const DEFAULT_MODEL = DEFAULT_TOOL_MODEL

/**
 * Prüft ob ein Modell Vision unterstützt
 */
export function modelSupportsVision(modelId: string): boolean {
  return OPENROUTER_MODELS[modelId as keyof typeof OPENROUTER_MODELS]?.supportsVision ?? false
}

/**
 * Prüft ob ein Modell Tool-Calling unterstützt
 */
export function modelSupportsTools(modelId: string): boolean {
  return OPENROUTER_MODELS[modelId as keyof typeof OPENROUTER_MODELS]?.supportsTools ?? true
}
