// src/env.mjs
import { createEnv } from "@t3-oss/env-nextjs"
import { z } from "zod"

// 1. Server-Schema definieren UND EXPORTIEREN
export const serverSchema = z.object({
  // Beispiel: serverseitiger API-Schlüssel aus dem Vault
  // STRIPE_SECRET_KEY: z.string().min(1),
  // SERVICE_ROLE_KEY: z.string().min(1),
  // OpenRouter API Key für AI Chat
  OPENROUTER_API_KEY: z.string().min(1),
  // Optional: fal.ai API Key für Image-Generierung
  FAL_API_KEY: z.string().optional(),
})

// 2. Client-Schema definieren UND EXPORTIEREN
export const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
})

// 3. Das kombinierte Schema für die Validierung im Skript
export const combinedSchema = serverSchema.merge(clientSchema)

// 4. Die 'env'-Variable wie gewohnt erstellen
export const env = createEnv({
  server: serverSchema.shape,
  client: clientSchema.shape,

  // Umgebungsvariablen für Next.js zur Laufzeit
  runtimeEnv: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    // STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    FAL_API_KEY: process.env.FAL_API_KEY,
  },

  // Validierung überspringen, falls in Build-Umgebungen (z.B. Vercel)
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
})
