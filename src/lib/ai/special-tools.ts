/**
 * AI Special Tools
 *
 * Spezielle Tools für Operationen, die nicht durch generische CRUD-Tools
 * abgedeckt werden können:
 *
 * - Admin-APIs (auth.admin.createUser)
 * - Multi-Step-Workflows
 * - Externe Services
 * - Komplexe Business-Logik
 *
 * Diese Tools werden zusätzlich zu den generierten CRUD-Tools geladen.
 */

import { tool, type ToolSet } from "ai"
import { z } from "zod"
import { createClient } from "@supabase/supabase-js"
import type { ToolExecutionContext } from "./tool-executor"

/**
 * Prüft ob der aktuelle User Admin ist
 */
async function isAdmin(userId: string): Promise<boolean> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("[SpecialTools] Missing Supabase credentials")
    return false
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data, error } = await supabase.from("profiles").select("role").eq("id", userId).single()

  if (error || !data) {
    console.error("[SpecialTools] Error checking admin status:", error)
    return false
  }

  return data.role === "admin"
}

/**
 * Generiert das create_user Tool
 *
 * Ermöglicht Admins, neue User über die Supabase Admin API anzulegen.
 * Der Trigger erstellt automatisch das Profil.
 */
function createUserTool(ctx: ToolExecutionContext): ToolSet {
  return {
    create_user: tool({
      description: `Erstellt einen neuen Benutzer im System. NUR FÜR ADMINS.
Der Benutzer erhält eine Einladungs-E-Mail mit Passwort-Reset-Link.
Das Profil wird automatisch durch einen DB-Trigger erstellt.

Workflow:
1. User wird in auth.users angelegt
2. DB-Trigger erstellt automatisch Profil in profiles
3. Optional: Profil wird mit display_name und role aktualisiert`,
      inputSchema: z.object({
        email: z.string().email().describe("E-Mail-Adresse des neuen Benutzers"),
        display_name: z.string().optional().describe("Anzeigename (optional, sonst Teil vor @)"),
        role: z
          .enum(["admin", "user"])
          .optional()
          .default("user")
          .describe("Rolle des Benutzers (Standard: user)"),
        send_invite: z
          .boolean()
          .optional()
          .default(true)
          .describe("Einladungs-E-Mail senden? (Standard: ja)"),
      }),
      execute: async (args) => {
        // Admin-Check
        const userIsAdmin = await isAdmin(ctx.userId)
        if (!userIsAdmin) {
          throw new Error("Nur Admins können neue Benutzer anlegen")
        }

        // Service Role Client für Admin-API
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

        if (!supabaseUrl || !serviceRoleKey) {
          throw new Error("Supabase Service Role Key nicht konfiguriert")
        }

        const adminClient = createClient(supabaseUrl, serviceRoleKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        })

        // Dry-Run Modus
        if (ctx.dryRun) {
          return {
            dryRun: true,
            action: "create_user",
            data: {
              email: args.email,
              display_name: args.display_name ?? args.email.split("@")[0],
              role: args.role ?? "user",
              send_invite: args.send_invite ?? true,
            },
          }
        }

        // User anlegen via Admin API
        const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
          email: args.email,
          email_confirm: true, // E-Mail als bestätigt markieren
          user_metadata: {
            display_name: args.display_name ?? args.email.split("@")[0],
            role: args.role ?? "user",
          },
        })

        if (authError || !authData.user) {
          throw new Error(
            `Fehler beim Anlegen des Users: ${authError?.message ?? "Unbekannter Fehler"}`
          )
        }

        // Profil aktualisieren (für display_name und role)
        // Der Trigger hat das Profil bereits erstellt, wir updaten es nur
        const { error: profileError } = await adminClient
          .from("profiles")
          .update({
            display_name: args.display_name ?? args.email.split("@")[0],
            role: args.role ?? "user",
          })
          .eq("id", authData.user.id)

        if (profileError) {
          console.warn("[SpecialTools] Profil-Update fehlgeschlagen:", profileError)
          // Kein throw - User wurde erfolgreich angelegt
        }

        // Optional: Einladungs-E-Mail senden
        if (args.send_invite !== false) {
          const { error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(args.email)
          if (inviteError) {
            console.warn("[SpecialTools] Einladungs-E-Mail fehlgeschlagen:", inviteError)
          }
        }

        // Erfolgsmeldung
        return {
          success: true,
          user: {
            id: authData.user.id,
            email: authData.user.email,
            display_name: args.display_name ?? args.email.split("@")[0],
            role: args.role ?? "user",
            created_at: authData.user.created_at,
          },
          message:
            args.send_invite !== false
              ? `Benutzer "${args.email}" wurde angelegt. Eine Einladungs-E-Mail wurde gesendet.`
              : `Benutzer "${args.email}" wurde angelegt.`,
        }
      },
    }),
  }
}

/**
 * Generiert das delete_user Tool
 *
 * Ermöglicht Admins, User über die Admin API zu löschen.
 * Löscht sowohl auth.users als auch profiles (CASCADE).
 */
function deleteUserTool(ctx: ToolExecutionContext): ToolSet {
  return {
    delete_user: tool({
      description: `Löscht einen Benutzer komplett aus dem System. NUR FÜR ADMINS.
VORSICHT: Diese Aktion ist nicht rückgängig machbar!
Das Profil wird automatisch durch CASCADE-Delete entfernt.`,
      inputSchema: z.object({
        user_id: z.string().uuid().describe("Die UUID des zu löschenden Benutzers"),
        confirm: z.boolean().describe("Muss true sein, um das Löschen zu bestätigen"),
      }),
      execute: async (args) => {
        // Confirm-Check
        if (args.confirm !== true) {
          throw new Error("Löschen erfordert confirm: true")
        }

        // Admin-Check
        const userIsAdmin = await isAdmin(ctx.userId)
        if (!userIsAdmin) {
          throw new Error("Nur Admins können Benutzer löschen")
        }

        // Selbst-Löschung verhindern
        if (args.user_id === ctx.userId) {
          throw new Error("Du kannst dich nicht selbst löschen")
        }

        // Service Role Client für Admin-API
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

        if (!supabaseUrl || !serviceRoleKey) {
          throw new Error("Supabase Service Role Key nicht konfiguriert")
        }

        const adminClient = createClient(supabaseUrl, serviceRoleKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        })

        // Dry-Run Modus
        if (ctx.dryRun) {
          return {
            dryRun: true,
            action: "delete_user",
            user_id: args.user_id,
          }
        }

        // User-Info laden für Bestätigung
        const { data: userData } = await adminClient
          .from("profiles")
          .select("email, display_name")
          .eq("id", args.user_id)
          .single()

        // User löschen via Admin API
        const { error } = await adminClient.auth.admin.deleteUser(args.user_id)

        if (error) {
          throw new Error(`Fehler beim Löschen des Users: ${error.message}`)
        }

        return {
          success: true,
          deleted_user: {
            id: args.user_id,
            email: userData?.email ?? "Unbekannt",
            display_name: userData?.display_name ?? "Unbekannt",
          },
          message: `Benutzer "${userData?.email ?? args.user_id}" wurde gelöscht.`,
        }
      },
    }),
  }
}

/**
 * Generiert alle speziellen Tools
 *
 * @param ctx - Execution Context (userId, sessionId, dryRun)
 */
export function generateSpecialTools(ctx: ToolExecutionContext): ToolSet {
  return {
    ...createUserTool(ctx),
    ...deleteUserTool(ctx),
    // Weitere Special Tools hier hinzufügen:
    // ...sendEmailTool(ctx),
    // ...uploadFileTool(ctx),
    // ...generateReportTool(ctx),
  }
}

/**
 * Liste aller verfügbaren Special Tools (für Dokumentation/System Prompt)
 */
export const SPECIAL_TOOL_NAMES = ["create_user", "delete_user"] as const
export type SpecialToolName = (typeof SPECIAL_TOOL_NAMES)[number]
