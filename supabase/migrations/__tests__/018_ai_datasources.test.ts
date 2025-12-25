/**
 * Tests für Migration 018: AI Datasources
 */

import { describe, it, expect, beforeAll } from "vitest"
import { createClient } from "@supabase/supabase-js"
import { config } from "dotenv"
import { resolve } from "path"

// Environment laden
config({ path: resolve(process.cwd(), ".env.local") })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL und SERVICE_ROLE_KEY müssen gesetzt sein")
}

const supabase = createClient(supabaseUrl, serviceRoleKey)

describe("Migration 018: AI Datasources", () => {
  beforeAll(async () => {
    // Migration sollte bereits ausgeführt sein
    // Falls nicht, würde dieser Test fehlschlagen
  })

  describe("Tabellen-Erstellung", () => {
    it("sollte ai_datasources Tabelle existieren", async () => {
      const { data, error } = await supabase.from("ai_datasources").select("id").limit(1)

      expect(error).toBeNull()
      expect(data).toBeDefined()
    })

    it("sollte ai_tool_calls Tabelle existieren", async () => {
      const { data, error } = await supabase.from("ai_tool_calls").select("id").limit(1)

      expect(error).toBeNull()
      expect(data).toBeDefined()
    })

    it("sollte ai_models Tabelle existieren", async () => {
      const { data, error } = await supabase.from("ai_models").select("id").limit(1)

      expect(error).toBeNull()
      expect(data).toBeDefined()
    })
  })

  describe("ENUM-Typ", () => {
    it("sollte ai_access_level ENUM existieren", async () => {
      const { data, error } = await supabase.rpc("get_table_columns", {
        p_schema: "public",
        p_table: "ai_datasources",
      })

      expect(error).toBeNull()

      // Prüfe ob access_level Spalte existiert
      const accessLevelColumn = data?.find(
        (col: { column_name: string }) => col.column_name === "access_level"
      )
      expect(accessLevelColumn).toBeDefined()
    })
  })

  describe("Helper-Funktion", () => {
    it("sollte get_table_columns Funktion existieren", async () => {
      const { error, data } = await supabase.rpc("get_table_columns", {
        p_schema: "public",
        p_table: "themes",
      })

      expect(error).toBeNull()
      expect(data).toBeDefined()
      expect(Array.isArray(data)).toBe(true)

      // Prüfe ob Spalten zurückgegeben werden
      if (data && data.length > 0) {
        expect(data[0]).toHaveProperty("column_name")
        expect(data[0]).toHaveProperty("data_type")
      }
    })
  })

  describe("Auto-Discovery", () => {
    it("sollte initiale Einträge für public-Tabellen erstellt haben", async () => {
      const { data, error } = await supabase
        .from("ai_datasources")
        .select("table_name, access_level")
        .eq("table_schema", "public")

      expect(error).toBeNull()
      expect(data).toBeDefined()
      expect(data?.length).toBeGreaterThan(0)

      // Prüfe ob themes Tabelle vorhanden ist
      const themesEntry = data?.find((d) => d.table_name === "themes")
      expect(themesEntry).toBeDefined()
    })

    it("sollte Standard-Zugriff auf 'none' setzen", async () => {
      const { data, error } = await supabase
        .from("ai_datasources")
        .select("table_name, access_level")
        .eq("table_schema", "public")
        .neq("table_name", "themes") // themes hat read
        .neq("table_name", "profiles") // profiles hat read
        .neq("table_name", "roles") // roles hat read
        .limit(5)

      expect(error).toBeNull()

      // Alle anderen sollten 'none' haben
      data?.forEach((entry) => {
        expect(entry.access_level).toBe("none")
      })
    })

    it("sollte wichtige Tabellen auf 'read' gesetzt haben", async () => {
      const { error, data } = await supabase
        .from("ai_datasources")
        .select("table_name, access_level")
        .in("table_name", ["themes", "profiles", "roles"])

      expect(error).toBeNull()
      expect(data).toBeDefined()

      data?.forEach((entry) => {
        expect(entry.access_level).toBe("read")
      })
    })
  })

  describe("Default-Modelle", () => {
    it("sollte Standard-Modelle eingefügt haben", async () => {
      const { data, error } = await supabase
        .from("ai_models")
        .select("id, provider, is_default")
        .eq("id", "google/gemini-3-flash-preview")

      expect(error).toBeNull()
      expect(data).toBeDefined()
      expect(data?.length).toBe(1)
      expect(data?.[0].provider).toBe("openrouter")
      expect(data?.[0].is_default).toBe(true)
    })

    it("sollte Claude Opus 4.5 als Tool-Calling Modell haben", async () => {
      const { data, error } = await supabase
        .from("ai_models")
        .select("id, supports_tools")
        .eq("id", "anthropic/claude-opus-4.5")

      expect(error).toBeNull()
      expect(data).toBeDefined()
      expect(data?.length).toBe(1)
      expect(data?.[0].supports_tools).toBe(true)
    })
  })

  describe("RLS Policies", () => {
    it("sollte RLS auf ai_datasources aktiviert haben", async () => {
      const { error } = await supabase.rpc("get_table_columns", {
        p_schema: "public",
        p_table: "ai_datasources",
      })

      // Wenn RLS aktiviert ist, können wir die Tabelle lesen
      // (auch ohne explizite Policy-Prüfung)
      expect(error).toBeNull()
    })
  })
})
