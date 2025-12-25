/**
 * Test-Helpers für Tool-Calling Tests
 *
 * Wiederverwendbare Utilities für Integration-Tests:
 * - Authentifizierung und Context-Erstellung
 * - Cleanup nach Tests
 * - Assertions für Tool-Ergebnisse
 */

import { createClient } from "@supabase/supabase-js"
import { afterEach } from "vitest"
import type { ToolExecutionContext, ToolExecutionResult } from "../tool-executor"

/**
 * Service-Role Client für Test-Setup und Cleanup
 *
 * WICHTIG: Nur für Tests verwenden! Bypassed RLS.
 */
export function getServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY müssen in .env.local gesetzt sein"
    )
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

/**
 * Erstellt einen Test-User in Supabase Auth
 *
 * @param email E-Mail-Adresse (muss eindeutig sein)
 * @param password Passwort
 * @param role Rolle ('admin' oder 'user')
 * @returns User-ID und Session-Token
 */
export async function createTestUser(
  email: string,
  password: string,
  role: "admin" | "user" = "user"
): Promise<{ userId: string; sessionToken: string }> {
  const serviceClient = getServiceClient()

  // 1. User in Auth erstellen
  const {
    data: { user },
    error: authError,
  } = await serviceClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (authError || !user) {
    throw new Error(`Fehler beim Erstellen des Test-Users: ${authError?.message}`)
  }

  // 2. Profile mit Rolle erstellen
  const { error: profileError } = await serviceClient.from("profiles").insert({
    id: user.id,
    email,
    display_name: email.split("@")[0],
    role,
  })

  if (profileError) {
    // Falls Profile bereits existiert, aktualisiere es
    await serviceClient.from("profiles").update({ role }).eq("id", user.id)
  }

  // 3. Session-Token für den User erstellen
  const {
    data: { session },
    error: sessionError,
  } = await serviceClient.auth.signInWithPassword({
    email,
    password,
  })

  if (sessionError || !session) {
    throw new Error(`Fehler beim Erstellen der Session: ${sessionError?.message}`)
  }

  return {
    userId: user.id,
    sessionToken: session.access_token,
  }
}

/**
 * Löscht einen Test-User komplett (alle FKs + Auth)
 *
 * WICHTIG: Muss alle FK-Referenzen löschen/nullen bevor auth.users gelöscht wird,
 * da nicht alle FKs ON DELETE CASCADE haben.
 */
export async function deleteTestUser(userId: string): Promise<void> {
  const serviceClient = getServiceClient()

  // 1. ai_tool_calls löschen (kein ON DELETE CASCADE)
  await serviceClient.from("ai_tool_calls").delete().eq("user_id", userId)

  // 2. ai_datasources.created_by auf NULL setzen (kein ON DELETE CASCADE)
  await serviceClient.from("ai_datasources").update({ created_by: null }).eq("created_by", userId)

  // 3. Profile löschen (ON DELETE CASCADE sollte greifen, aber sicherheitshalber)
  await serviceClient.from("profiles").delete().eq("id", userId)

  // 4. Bugs reporter_id auf NULL setzen (ON DELETE SET NULL)
  await serviceClient.from("bugs").update({ reporter_id: null }).eq("reporter_id", userId)

  // 5. Features proposer_id auf NULL setzen (ON DELETE SET NULL)
  await serviceClient.from("features").update({ proposer_id: null }).eq("proposer_id", userId)

  // 6. Auth-User löschen
  const { error } = await serviceClient.auth.admin.deleteUser(userId)

  if (error) {
    console.warn(`Warnung: Fehler beim Löschen des Test-Users ${userId}:`, error.message)
  }
}

/**
 * Erweiterter Context mit Session-Token
 */
export interface TestContext extends ToolExecutionContext {
  accessToken: string
  cleanup: () => Promise<void>
}

/**
 * Erstellt einen Tool-Execution-Context für Tests
 *
 * @param role Rolle des Test-Users ('admin' oder 'user')
 * @param dryRun Ob Tool-Calls nur simuliert werden sollen
 * @returns ToolExecutionContext mit authentifiziertem User und Access-Token
 */
export async function getTestContext(
  role: "admin" | "user" = "user",
  dryRun: boolean = false
): Promise<TestContext> {
  const email = `test-${role}-${Date.now()}@test.local`
  const password = "test-password-123"

  const { userId, sessionToken } = await createTestUser(email, password, role)

  return {
    userId,
    sessionId: `test-session-${Date.now()}`,
    dryRun,
    accessToken: sessionToken,
    cleanup: async () => {
      await deleteTestUser(userId)
    },
  }
}

/**
 * Cleanup-Helper: Löscht Test-Daten aus einer Tabelle
 *
 * @param tableName Tabellenname (oder "auth.users" für Auth-User)
 * @param ids Array von IDs zum Löschen
 */
export async function cleanupTestData(tableName: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return

  const serviceClient = getServiceClient()

  // Spezialfall: auth.users müssen über Admin-API gelöscht werden
  if (tableName === "auth.users") {
    for (const id of ids) {
      await deleteTestUser(id)
    }
    return
  }

  const { error } = await serviceClient.from(tableName).delete().in("id", ids)

  if (error) {
    console.warn(`Warnung: Fehler beim Cleanup von ${tableName}:`, error.message)
  }
}

/**
 * Type-Guard für erfolgreiche Tool-Ergebnisse
 */
export interface SuccessResult extends ToolExecutionResult {
  success: true
  data: unknown
}

/**
 * Assertion: Prüft dass Tool-Call erfolgreich war
 */
export function assertToolSuccess(result: ToolExecutionResult): asserts result is SuccessResult {
  if (!result.success) {
    throw new Error(`Tool-Call fehlgeschlagen: ${result.error ?? "Unbekannter Fehler"}`)
  }

  if (result.data === undefined) {
    throw new Error("Tool-Call erfolgreich, aber keine Daten zurückgegeben")
  }
}

/**
 * Assertion: Prüft dass Tool-Call fehlgeschlagen ist
 */
export function assertToolError(
  result: ToolExecutionResult,
  expectedError?: string
): asserts result is { success: false; error: string } {
  if (result.success) {
    throw new Error(
      `Tool-Call sollte fehlschlagen, war aber erfolgreich: ${JSON.stringify(result.data)}`
    )
  }

  if (expectedError && result.error !== expectedError) {
    throw new Error(`Erwarteter Fehler: "${expectedError}", aber erhalten: "${result.error}"`)
  }
}

/**
 * Sammelt IDs für Cleanup nach Tests
 */
export class CleanupTracker {
  private readonly items: Array<{ table: string; ids: string[] }> = []

  /**
   * Fügt eine ID zum Cleanup hinzu
   */
  track(table: string, id: string): void {
    const existing = this.items.find((item) => item.table === table)
    if (existing) {
      existing.ids.push(id)
    } else {
      this.items.push({ table, ids: [id] })
    }
  }

  /**
   * Führt Cleanup für alle getrackten Items aus
   */
  async cleanup(): Promise<void> {
    for (const { table, ids } of this.items) {
      await cleanupTestData(table, ids)
    }
    this.items.length = 0
  }
}

/**
 * Globaler Cleanup-Tracker für Tests
 * Wird automatisch nach jedem Test geleert
 */
export const globalCleanup = new CleanupTracker()

afterEach(async () => {
  await globalCleanup.cleanup()
})
