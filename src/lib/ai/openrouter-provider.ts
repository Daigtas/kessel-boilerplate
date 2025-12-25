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
 * Diese Liste kann dynamisch aus der OpenRouter API geladen werden,
 * aber für Performance werden die wichtigsten hier hardcodiert.
 */
export const OPENROUTER_MODELS = {
  // Google Models
  "google/gemini-2.5-flash": {
    id: "google/gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    supportsVision: true,
    supportsTools: true,
    isDefault: true,
  },
  "google/gemini-2.0-flash-exp": {
    id: "google/gemini-2.0-flash-exp",
    name: "Gemini 2.0 Flash Experimental",
    supportsVision: true,
    supportsTools: true,
  },

  // Anthropic Models
  "anthropic/claude-3.5-sonnet": {
    id: "anthropic/claude-3.5-sonnet",
    name: "Claude 3.5 Sonnet",
    supportsVision: true,
    supportsTools: true,
  },
  "anthropic/claude-3-opus": {
    id: "anthropic/claude-3-opus",
    name: "Claude 3 Opus",
    supportsVision: true,
    supportsTools: true,
  },

  // OpenAI Models
  "openai/gpt-4o": {
    id: "openai/gpt-4o",
    name: "GPT-4o",
    supportsVision: true,
    supportsTools: true,
  },
  "openai/gpt-4-turbo": {
    id: "openai/gpt-4-turbo",
    name: "GPT-4 Turbo",
    supportsVision: true,
    supportsTools: true,
  },
} as const

/**
 * Standard-Model für Chat
 * 
 * Claude 3.5 Sonnet wird empfohlen für Tool-Calling, da es
 * zuverlässiger Tools aufruft als Gemini über OpenRouter.
 * Gemini über OpenRouter hat bekannte Probleme mit Tool-Calling.
 */
export const DEFAULT_MODEL = "anthropic/claude-3.5-sonnet"

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
