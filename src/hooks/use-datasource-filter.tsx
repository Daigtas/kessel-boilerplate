"use client"

import { createContext, useContext, useState, type ReactNode } from "react"
import type { DatabaseNode, DatasourceFilter } from "@/components/admin/datasource-explorer"

/**
 * Dummy-Datenbanken für Entwicklung
 *
 * In Production werden diese durch echte DB-Connections ersetzt.
 * Die Infra-DB (KESSEL) wird immer aus ai_datasources geladen.
 */
export const DUMMY_DATABASES: DatabaseNode[] = [
  {
    id: "infra-kessel",
    name: "Infra-DB (KESSEL)",
    type: "infra",
    tables: [], // Wird dynamisch aus ai_datasources geladen
    description: "Boilerplate-Infrastruktur: Auth, Profiles, Themes, Roles",
  },
  {
    id: "dev-db-1",
    name: "Dev-DB 1 (Demo)",
    type: "dev",
    tables: ["customers", "orders", "products", "invoices"],
    description: "Beispiel-Datenbank für E-Commerce",
  },
  {
    id: "dev-db-2",
    name: "Dev-DB 2 (Demo)",
    type: "dev",
    tables: ["projects", "tasks", "comments", "attachments"],
    description: "Beispiel-Datenbank für Projektmanagement",
  },
]

interface DatasourceFilterContextValue {
  databases: DatabaseNode[]
  setDatabases: (databases: DatabaseNode[]) => void
  filter: DatasourceFilter
  setFilter: (filter: DatasourceFilter) => void
  /** Prüft ob eine Tabelle durch den Filter sichtbar ist */
  isTableVisible: (dbId: string, tableName: string) => boolean
}

const DatasourceFilterContext = createContext<DatasourceFilterContextValue | null>(null)

/**
 * DatasourceFilterProvider
 *
 * Verwaltet den Filter-State für die Datenquellen-Seite.
 * Ermöglicht Kommunikation zwischen Explorer (Spalte 2) und Main Content (Spalte 3).
 */
export function DatasourceFilterProvider({
  children,
}: {
  children: ReactNode
}): React.ReactElement {
  const [databases, setDatabases] = useState<DatabaseNode[]>(DUMMY_DATABASES)
  const [filter, setFilter] = useState<DatasourceFilter>({
    selectedDatabases: [],
    selectedTables: [],
    searchQuery: "",
  })

  const isTableVisible = (dbId: string, tableName: string): boolean => {
    // Wenn keine Filter aktiv sind, zeige alles
    if (
      filter.selectedDatabases.length === 0 &&
      filter.selectedTables.length === 0 &&
      !filter.searchQuery
    ) {
      return true
    }

    // Suche prüfen
    if (filter.searchQuery) {
      const query = filter.searchQuery.toLowerCase()
      const db = databases.find((d) => d.id === dbId)
      if (!tableName.toLowerCase().includes(query) && !db?.name.toLowerCase().includes(query)) {
        return false
      }
    }

    // DB-Filter prüfen
    if (filter.selectedDatabases.length > 0 && !filter.selectedDatabases.includes(dbId)) {
      return false
    }

    // Tabellen-Filter prüfen
    if (filter.selectedTables.length > 0) {
      const tableKey = `${dbId}:${tableName}`
      if (!filter.selectedTables.includes(tableKey)) {
        return false
      }
    }

    return true
  }

  return (
    <DatasourceFilterContext.Provider
      value={{ databases, setDatabases, filter, setFilter, isTableVisible }}
    >
      {children}
    </DatasourceFilterContext.Provider>
  )
}

/**
 * Hook zum Zugriff auf den Datasource-Filter
 */
export function useDatasourceFilter(): DatasourceFilterContextValue {
  const context = useContext(DatasourceFilterContext)
  if (!context) {
    throw new Error("useDatasourceFilter must be used within a DatasourceFilterProvider")
  }
  return context
}
