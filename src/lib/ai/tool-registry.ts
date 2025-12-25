/**
 * AI Tool Registry
 *
 * Generiert dynamisch Tools basierend auf:
 * 1. Tabellen-Berechtigungen aus ai_datasources
 * 2. DB-Schema (Spaltentypen via get_table_columns)
 *
 * Verwendet die AI SDK `tool()` Funktion mit execute Callbacks.
 */

import { createClient } from "@/utils/supabase/server"
import { tool, type ToolSet } from "ai"
import { z } from "zod"
import { executeTool, type ToolExecutionContext } from "./tool-executor"
import { generateSpecialTools, SPECIAL_TOOL_NAMES } from "./special-tools"

// Types
export type AccessLevel = "none" | "read" | "read_write" | "full"

export interface DataSource {
  id: string
  table_schema: string
  table_name: string
  display_name: string
  description: string | null
  access_level: AccessLevel
  is_enabled: boolean
  allowed_columns: string[]
  excluded_columns: string[]
  max_rows_per_query: number
}

export interface TableColumn {
  column_name: string
  data_type: string
  is_nullable: boolean
  column_default: string | null
}

/**
 * Lädt alle aktivierten Datasources
 */
export async function loadDataSources(): Promise<DataSource[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("ai_datasources")
    .select("*")
    .eq("is_enabled", true)
    .neq("access_level", "none")

  if (error) {
    console.error("[ToolRegistry] Fehler beim Laden der Datasources:", error)
    throw error
  }

  return data ?? []
}

/**
 * Lädt Spalten-Informationen für eine Tabelle
 */
async function getTableColumns(schema: string, table: string): Promise<TableColumn[]> {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc("get_table_columns", {
    p_schema: schema,
    p_table: table,
  })

  if (error) {
    console.error(`[ToolRegistry] Fehler beim Laden der Spalten für ${schema}.${table}:`, error)
    return []
  }

  return (data ?? []) as TableColumn[]
}

/**
 * Konvertiert PostgreSQL-Typ zu Zod-Schema
 */
function postgresTypeToZod(postgresType: string): z.ZodTypeAny {
  const normalized = postgresType.toLowerCase().replace(/\[\]$/, "")

  switch (normalized) {
    case "integer":
    case "bigint":
    case "smallint":
    case "serial":
    case "bigserial":
      return z.number().int()

    case "numeric":
    case "decimal":
    case "real":
    case "double precision":
    case "float":
      return z.number()

    case "boolean":
      return z.boolean()

    case "json":
    case "jsonb":
      return z.record(z.unknown())

    case "array":
    case "text[]":
    case "integer[]":
      return z.array(z.string())

    case "date":
      return z.string() // Zod v3: .date() nicht verfügbar

    case "timestamp":
    case "timestamptz":
      return z.string() // Zod v3: .datetime() nicht verfügbar

    case "uuid":
      return z.string().uuid()

    default:
      return z.string()
  }
}

/**
 * Generiert Zod-Schema Properties aus Spalten
 *
 * @param columns - Spalten-Informationen
 * @param excludedColumns - Ausgeschlossene Spalten
 * @param makeOptional - Wenn true, werden alle Properties optional gemacht
 */
function columnsToZodSchema(
  columns: TableColumn[],
  excludedColumns: string[],
  makeOptional = true
): Record<string, z.ZodTypeAny> {
  const properties: Record<string, z.ZodTypeAny> = {}

  for (const col of columns) {
    if (excludedColumns.includes(col.column_name)) continue

    const baseType = postgresTypeToZod(col.data_type)
    properties[col.column_name] = makeOptional ? baseType.optional() : baseType
  }

  return properties
}

/**
 * Generiert Tools für eine DataSource
 *
 * @param ds - DataSource Konfiguration
 * @param ctx - Execution Context (userId, sessionId, dryRun)
 */
async function generateToolsForDataSource(
  ds: DataSource,
  ctx: ToolExecutionContext
): Promise<ToolSet> {
  const tools: ToolSet = {}
  const columns = await getTableColumns(ds.table_schema, ds.table_name)
  const filteredColumns = columns.filter((c) => !ds.excluded_columns.includes(c.column_name))
  const columnProperties = columnsToZodSchema(filteredColumns, ds.excluded_columns)

  // READ Tool (für read, read_write, full)
  if (["read", "read_write", "full"].includes(ds.access_level)) {
    tools[`query_${ds.table_name}`] = tool({
      description: `Liest Daten aus "${ds.display_name}". ${ds.description ?? ""}`,
      inputSchema: z.object({
        filters: z
          .record(z.unknown())
          .optional()
          .describe("Filter-Bedingungen als Key-Value Paare (optional)"),
        select: z
          .array(z.string())
          .optional()
          .describe("Welche Spalten zurückgegeben werden sollen (optional, Standard: alle)"),
        limit: z
          .number()
          .int()
          .min(1)
          .max(ds.max_rows_per_query)
          .optional()
          .describe(`Max. Anzahl Zeilen (Standard: 10, Max: ${ds.max_rows_per_query})`),
        order_by: z.string().optional().describe("Sortierung (z.B. 'created_at desc')"),
      }),
      execute: async (args) => {
        const result = await executeTool(`query_${ds.table_name}`, args, ctx)
        if (!result.success) {
          throw new Error(result.error ?? "Query failed")
        }
        return result.data ?? []
      },
    })
  }

  // INSERT Tool (für read_write, full)
  if (["read_write", "full"].includes(ds.access_level)) {
    // Auto-generierte Spalten ausschließen (id, created_at, updated_at)
    const autoGeneratedColumns = ["id", "created_at", "updated_at"]
    const insertableColumns = filteredColumns.filter(
      (c) => !autoGeneratedColumns.includes(c.column_name)
    )

    // Bestimme required fields (nicht nullable ohne default)
    const requiredFields = insertableColumns
      .filter((c) => !c.is_nullable && !c.column_default)
      .map((c) => c.column_name)

    // Erstelle Schema: required fields sind nicht optional, rest optional
    const dataSchemaShape: Record<string, z.ZodTypeAny> = {}
    for (const col of insertableColumns) {
      const baseType = postgresTypeToZod(col.data_type)
      const isRequired = requiredFields.includes(col.column_name)
      dataSchemaShape[col.column_name] = isRequired ? baseType : baseType.optional()
    }
    const dataSchema = z.object(dataSchemaShape)

    tools[`insert_${ds.table_name}`] = tool({
      description: `Erstellt einen neuen Eintrag in "${ds.display_name}".`,
      inputSchema: z.object({
        data: dataSchema.describe("Die einzufügenden Daten"),
      }),
      execute: async (args) => {
        const result = await executeTool(`insert_${ds.table_name}`, args, ctx)
        if (!result.success) {
          throw new Error(result.error ?? "Insert failed")
        }
        // Bei Dry-Run: SQL zurückgeben
        if (result.dryRunQuery) {
          return { dryRun: true, sql: result.dryRunQuery, data: result.data }
        }
        return result.data
      },
    })

    tools[`update_${ds.table_name}`] = tool({
      description: `Aktualisiert Einträge in "${ds.display_name}". VORSICHT: Filter müssen mindestens eine Bedingung enthalten!`,
      inputSchema: z.object({
        filters: z
          .record(z.unknown())
          .describe("Filter für die zu ändernden Zeilen (PFLICHT - mindestens eine Bedingung!)"),
        data: z.object(columnProperties).describe("Die neuen Werte"),
      }),
      execute: async (args) => {
        const result = await executeTool(`update_${ds.table_name}`, args, ctx)
        if (!result.success) {
          throw new Error(result.error ?? "Update failed")
        }
        if (result.dryRunQuery) {
          return { dryRun: true, sql: result.dryRunQuery, data: result.data }
        }
        return result.data
      },
    })
  }

  // DELETE Tool (nur für full)
  if (ds.access_level === "full") {
    tools[`delete_${ds.table_name}`] = tool({
      description: `Löscht Einträge aus "${ds.display_name}". VORSICHT: Nicht rückgängig machbar! Filter müssen mindestens eine Bedingung enthalten.`,
      inputSchema: z.object({
        filters: z
          .record(z.unknown())
          .describe("Filter für die zu löschenden Zeilen (PFLICHT - mindestens eine Bedingung!)"),
        confirm: z.boolean().describe("Muss true sein, um das Löschen zu bestätigen"),
      }),
      execute: async (args) => {
        const result = await executeTool(`delete_${ds.table_name}`, args, ctx)
        if (!result.success) {
          throw new Error(result.error ?? "Delete failed")
        }
        if (result.dryRunQuery) {
          return { dryRun: true, sql: result.dryRunQuery, rowCount: result.rowCount }
        }
        return { rowCount: result.rowCount ?? 0 }
      },
    })
  }

  return tools
}

/**
 * Generiert alle verfügbaren Tools basierend auf Berechtigungen
 *
 * Enthält:
 * 1. Generische CRUD-Tools aus ai_datasources (query_*, insert_*, update_*, delete_*)
 * 2. Spezielle Tools für Admin-APIs und komplexe Workflows (create_user, delete_user, etc.)
 *
 * @param ctx - Execution Context (userId, sessionId, dryRun)
 */
export async function generateAllTools(ctx: ToolExecutionContext): Promise<ToolSet> {
  const dataSources = await loadDataSources()
  const allTools: ToolSet = {}

  // 1. Generische CRUD-Tools aus ai_datasources
  for (const ds of dataSources) {
    try {
      const tools = await generateToolsForDataSource(ds, ctx)
      Object.assign(allTools, tools)
    } catch (error) {
      console.error(`[ToolRegistry] Fehler beim Generieren von Tools für ${ds.table_name}:`, error)
      // Weiter mit nächster DataSource
    }
  }

  // 2. Spezielle Tools (Admin-APIs, Multi-Step-Workflows, etc.)
  try {
    const specialTools = generateSpecialTools(ctx)
    Object.assign(allTools, specialTools)
    console.log(`[ToolRegistry] Special Tools geladen: ${SPECIAL_TOOL_NAMES.join(", ")}`)
  } catch (error) {
    console.error("[ToolRegistry] Fehler beim Laden der Special Tools:", error)
  }

  return allTools
}

/**
 * Prüft ob ein Tool-Aufruf erlaubt ist
 */
export async function validateToolCall(
  toolName: string,
  args: Record<string, unknown>
): Promise<{ valid: boolean; error?: string; dataSource?: DataSource }> {
  // Special Tools haben eigene Validierung in ihren execute-Funktionen
  if (SPECIAL_TOOL_NAMES.includes(toolName as (typeof SPECIAL_TOOL_NAMES)[number])) {
    return { valid: true }
  }

  // Tool-Name parsen: query_themes → { action: 'query', table: 'themes' }
  const match = toolName.match(/^(query|insert|update|delete)_(.+)$/)
  if (!match) {
    return { valid: false, error: `Unknown tool format: ${toolName}` }
  }

  const [, action, tableName] = match
  const dataSources = await loadDataSources()
  const ds = dataSources.find((d) => d.table_name === tableName)

  if (!ds) {
    return { valid: false, error: `No datasource configured for table: ${tableName}` }
  }

  // Permission-Check
  const requiredLevel: Record<string, AccessLevel[]> = {
    query: ["read", "read_write", "full"],
    insert: ["read_write", "full"],
    update: ["read_write", "full"],
    delete: ["full"],
  }

  if (!requiredLevel[action]?.includes(ds.access_level)) {
    return {
      valid: false,
      error: `Action "${action}" not allowed for "${tableName}" (level: ${ds.access_level})`,
    }
  }

  // Für delete: confirm-Flag prüfen
  if (action === "delete" && args.confirm !== true) {
    return { valid: false, error: "Delete requires confirm: true" }
  }

  // Für update/delete: filters müssen mindestens eine Bedingung haben
  if ((action === "update" || action === "delete") && args.filters) {
    const filters = args.filters as Record<string, unknown>
    if (Object.keys(filters).length === 0) {
      return { valid: false, error: `${action} requires at least one filter condition` }
    }
  }

  return { valid: true, dataSource: ds }
}
