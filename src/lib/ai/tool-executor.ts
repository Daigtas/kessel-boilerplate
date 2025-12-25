/**
 * AI Tool Executor
 *
 * Führt Tool-Calls sicher aus mit:
 * - Permission-Validierung
 * - Audit-Logging
 * - Dry-Run Support
 */

import { createClient } from "@/utils/supabase/server"
import { validateToolCall, type DataSource } from "./tool-registry"

// Types
export interface ToolExecutionContext {
  userId: string
  sessionId?: string
  dryRun?: boolean
}

export interface ToolExecutionResult {
  success: boolean
  data?: unknown
  error?: string
  rowCount?: number
  dryRunQuery?: string
}

/**
 * Führt einen Query-Tool-Call aus
 */
async function executeQuery(
  ds: DataSource,
  args: {
    filters?: Record<string, unknown>
    select?: string[]
    limit?: number
    order_by?: string
  }
): Promise<ToolExecutionResult> {
  const supabase = await createClient()

  let query = supabase
    .from(ds.table_name)
    .select(args.select?.join(",") ?? "*")
    .limit(Math.min(args.limit ?? 10, ds.max_rows_per_query))

  // Filter anwenden
  if (args.filters) {
    for (const [key, value] of Object.entries(args.filters)) {
      if (ds.excluded_columns.includes(key)) {
        console.warn(`[ToolExecutor] Excluded column "${key}" in filters, skipping`)
        continue
      }
      query = query.eq(key, value)
    }
  }

  // Sortierung
  if (args.order_by) {
    const [column, direction] = args.order_by.split(" ")
    query = query.order(column, { ascending: direction !== "desc" })
  }

  const { data, error } = await query

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, data, rowCount: data?.length ?? 0 }
}

/**
 * Führt einen Insert-Tool-Call aus
 */
async function executeInsert(
  ds: DataSource,
  args: { data: Record<string, unknown> },
  ctx: ToolExecutionContext
): Promise<ToolExecutionResult> {
  // Excluded columns entfernen
  const cleanData = { ...args.data }
  for (const col of ds.excluded_columns) {
    delete cleanData[col]
  }

  if (ctx.dryRun) {
    const columns = Object.keys(cleanData).join(", ")
    const values = Object.values(cleanData)
      .map((v) => (typeof v === "string" ? `'${v.replace(/'/g, "''")}'` : v))
      .join(", ")

    return {
      success: true,
      dryRunQuery: `INSERT INTO ${ds.table_schema}.${ds.table_name} (${columns}) VALUES (${values})`,
    }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.from(ds.table_name).insert(cleanData).select()

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, data, rowCount: 1 }
}

/**
 * Führt einen Update-Tool-Call aus
 */
async function executeUpdate(
  ds: DataSource,
  args: { filters: Record<string, unknown>; data: Record<string, unknown> },
  ctx: ToolExecutionContext
): Promise<ToolExecutionResult> {
  if (!args.filters || Object.keys(args.filters).length === 0) {
    return { success: false, error: "Update requires at least one filter" }
  }

  const cleanData = { ...args.data }
  for (const col of ds.excluded_columns) {
    delete cleanData[col]
  }

  if (ctx.dryRun) {
    const filterConditions = Object.entries(args.filters)
      .map(([k, v]) => `${k} = ${typeof v === "string" ? `'${String(v).replace(/'/g, "''")}'` : v}`)
      .join(" AND ")
    const setClause = Object.entries(cleanData)
      .map(([k, v]) => `${k} = ${typeof v === "string" ? `'${String(v).replace(/'/g, "''")}'` : v}`)
      .join(", ")

    return {
      success: true,
      dryRunQuery: `UPDATE ${ds.table_schema}.${ds.table_name} SET ${setClause} WHERE ${filterConditions}`,
    }
  }

  const supabase = await createClient()
  let query = supabase.from(ds.table_name).update(cleanData)

  for (const [key, value] of Object.entries(args.filters)) {
    if (ds.excluded_columns.includes(key)) {
      console.warn(`[ToolExecutor] Excluded column "${key}" in filters, skipping`)
      continue
    }
    query = query.eq(key, value)
  }

  const { data, error } = await query.select()

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, data, rowCount: data?.length ?? 0 }
}

/**
 * Führt einen Delete-Tool-Call aus
 */
async function executeDelete(
  ds: DataSource,
  args: { filters: Record<string, unknown>; confirm: boolean },
  ctx: ToolExecutionContext
): Promise<ToolExecutionResult> {
  if (!args.confirm) {
    return { success: false, error: "Delete requires confirm: true" }
  }

  if (!args.filters || Object.keys(args.filters).length === 0) {
    return { success: false, error: "Delete requires at least one filter" }
  }

  if (ctx.dryRun) {
    const filterConditions = Object.entries(args.filters)
      .map(([k, v]) => `${k} = ${typeof v === "string" ? `'${String(v).replace(/'/g, "''")}'` : v}`)
      .join(" AND ")

    return {
      success: true,
      dryRunQuery: `DELETE FROM ${ds.table_schema}.${ds.table_name} WHERE ${filterConditions}`,
    }
  }

  const supabase = await createClient()
  let query = supabase.from(ds.table_name).delete()

  for (const [key, value] of Object.entries(args.filters)) {
    if (ds.excluded_columns.includes(key)) {
      console.warn(`[ToolExecutor] Excluded column "${key}" in filters, skipping`)
      continue
    }
    query = query.eq(key, value)
  }

  const { error, count } = await query

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, rowCount: count ?? 0 }
}

/**
 * Haupt-Executor: Führt ein Tool aus und loggt das Ergebnis
 */
export async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  ctx: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const startTime = Date.now()

  // 1. Validierung
  const validation = await validateToolCall(toolName, args)
  if (!validation.valid || !validation.dataSource) {
    await logToolCall(
      toolName,
      args,
      ctx,
      {
        success: false,
        error: validation.error,
      },
      Date.now() - startTime
    )
    return { success: false, error: validation.error }
  }

  const ds = validation.dataSource
  let result: ToolExecutionResult

  // 2. Ausführung basierend auf Tool-Typ
  try {
    if (toolName.startsWith("query_")) {
      result = await executeQuery(ds, args as Parameters<typeof executeQuery>[1])
    } else if (toolName.startsWith("insert_")) {
      result = await executeInsert(ds, args as Parameters<typeof executeInsert>[1], ctx)
    } else if (toolName.startsWith("update_")) {
      result = await executeUpdate(ds, args as Parameters<typeof executeUpdate>[1], ctx)
    } else if (toolName.startsWith("delete_")) {
      result = await executeDelete(ds, args as Parameters<typeof executeDelete>[1], ctx)
    } else {
      result = { success: false, error: `Unknown tool action: ${toolName}` }
    }
  } catch (error) {
    result = {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }

  // 3. Audit-Log
  await logToolCall(toolName, args, ctx, result, Date.now() - startTime)

  return result
}

/**
 * Loggt einen Tool-Call in die Audit-Tabelle
 */
async function logToolCall(
  toolName: string,
  args: Record<string, unknown>,
  ctx: ToolExecutionContext,
  result: ToolExecutionResult,
  durationMs: number
): Promise<void> {
  try {
    const supabase = await createClient()
    await supabase.from("ai_tool_calls").insert({
      user_id: ctx.userId,
      session_id: ctx.sessionId,
      tool_name: toolName,
      tool_args: args,
      success: result.success,
      result: result.success
        ? { data: result.data, rowCount: result.rowCount, dryRunQuery: result.dryRunQuery }
        : null,
      error_message: result.error,
      is_dry_run: ctx.dryRun ?? false,
      duration_ms: durationMs,
    })
  } catch (error) {
    console.error("[ToolExecutor] Failed to log tool call:", error)
    // Nicht werfen - Logging-Fehler sollten die Ausführung nicht blockieren
  }
}
