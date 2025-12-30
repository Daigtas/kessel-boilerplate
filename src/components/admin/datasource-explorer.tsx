"use client"

import { useState, useMemo } from "react"
import { Database, Search, ChevronRight, ChevronDown, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"

/**
 * Datenbank-Definition für den Filter-Tree
 */
export interface DatabaseNode {
  id: string
  name: string
  type: "infra" | "dev"
  tables: string[]
  description?: string
}

/**
 * Filter-State der vom Explorer verwaltet wird
 */
export interface DatasourceFilter {
  selectedDatabases: string[]
  selectedTables: string[]
  searchQuery: string
}

interface DatasourceExplorerProps {
  databases: DatabaseNode[]
  filter: DatasourceFilter
  onFilterChange: (filter: DatasourceFilter) => void
  className?: string
}

/**
 * DatasourceExplorer
 *
 * Filter-Tree für die Datenquellen-Seite.
 * Zeigt alle verfügbaren Datenbanken als Baum mit Checkboxen zum Filtern.
 *
 * Features:
 * - Suche über alle DBs und Tabellen
 * - Expand/Collapse für DB-Gruppen
 * - Multi-Select für Filterung
 * - Badge mit Anzahl ausgewählter Items
 */
export function DatasourceExplorer({
  databases,
  filter,
  onFilterChange,
  className,
}: DatasourceExplorerProps): React.ReactElement {
  const [expandedDbs, setExpandedDbs] = useState<Set<string>>(new Set(databases.map((db) => db.id)))

  // Gefilterte DBs basierend auf Suche
  const filteredDatabases = useMemo(() => {
    if (!filter.searchQuery) return databases

    const query = filter.searchQuery.toLowerCase()
    return databases
      .map((db) => ({
        ...db,
        tables: db.tables.filter(
          (table) => table.toLowerCase().includes(query) || db.name.toLowerCase().includes(query)
        ),
      }))
      .filter((db) => db.tables.length > 0 || db.name.toLowerCase().includes(query))
  }, [databases, filter.searchQuery])

  const toggleDatabase = (dbId: string) => {
    const newSelected = new Set(filter.selectedDatabases)
    if (newSelected.has(dbId)) {
      newSelected.delete(dbId)
    } else {
      newSelected.add(dbId)
    }
    onFilterChange({ ...filter, selectedDatabases: Array.from(newSelected) })
  }

  const toggleTable = (dbId: string, tableName: string) => {
    const tableKey = `${dbId}:${tableName}`
    const newSelected = new Set(filter.selectedTables)
    if (newSelected.has(tableKey)) {
      newSelected.delete(tableKey)
    } else {
      newSelected.add(tableKey)
    }
    onFilterChange({ ...filter, selectedTables: Array.from(newSelected) })
  }

  const toggleExpanded = (dbId: string) => {
    const newExpanded = new Set(expandedDbs)
    if (newExpanded.has(dbId)) {
      newExpanded.delete(dbId)
    } else {
      newExpanded.add(dbId)
    }
    setExpandedDbs(newExpanded)
  }

  const clearFilters = () => {
    onFilterChange({
      selectedDatabases: [],
      selectedTables: [],
      searchQuery: "",
    })
  }

  const activeFilterCount = filter.selectedDatabases.length + filter.selectedTables.length

  return (
    <div className={cn("flex h-full flex-col", className)}>
      {/* Search */}
      <div className="border-b p-3">
        <div className="relative">
          <Search className="text-muted-foreground absolute top-2.5 left-2.5 size-4" />
          <Input
            placeholder="Suchen..."
            value={filter.searchQuery}
            onChange={(e) => onFilterChange({ ...filter, searchQuery: e.target.value })}
            className="pl-9"
          />
        </div>
        {activeFilterCount > 0 && (
          <div className="mt-2 flex items-center justify-between">
            <Badge variant="secondary" className="text-xs">
              {activeFilterCount} Filter aktiv
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="h-6 text-xs"
              data-ai-exempt="true"
            >
              Zurücksetzen
            </Button>
          </div>
        )}
      </div>

      {/* Tree */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {filteredDatabases.map((db) => {
            const isExpanded = expandedDbs.has(db.id)
            const isDbSelected = filter.selectedDatabases.includes(db.id)

            return (
              <div key={db.id} className="mb-1">
                {/* Database Node */}
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => toggleExpanded(db.id)}
                    data-ai-exempt="true"
                  >
                    {isExpanded ? (
                      <ChevronDown className="size-4" />
                    ) : (
                      <ChevronRight className="size-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "h-7 flex-1 justify-start gap-2 px-2",
                      isDbSelected && "bg-accent"
                    )}
                    onClick={() => toggleDatabase(db.id)}
                    data-ai-exempt="true"
                  >
                    <Database
                      className={cn(
                        "size-4",
                        db.type === "infra" ? "text-primary" : "text-muted-foreground"
                      )}
                    />
                    <span className="flex-1 truncate text-left text-sm">{db.name}</span>
                    <Badge variant="outline" className="ml-auto text-xs">
                      {db.tables.length}
                    </Badge>
                    {isDbSelected && <Check className="text-primary size-3" />}
                  </Button>
                </div>

                {/* Tables */}
                {isExpanded && (
                  <div className="mt-0.5 ml-6 space-y-0.5">
                    {db.tables.map((table) => {
                      const tableKey = `${db.id}:${table}`
                      const isTableSelected = filter.selectedTables.includes(tableKey)

                      return (
                        <Button
                          key={table}
                          variant="ghost"
                          size="sm"
                          className={cn(
                            "h-6 w-full justify-start gap-2 pl-4 text-xs",
                            isTableSelected && "bg-accent"
                          )}
                          onClick={() => toggleTable(db.id, table)}
                          data-ai-exempt="true"
                        >
                          <span className="text-muted-foreground font-mono">{table}</span>
                          {isTableSelected && <Check className="text-primary ml-auto size-3" />}
                        </Button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}

          {filteredDatabases.length === 0 && (
            <div className="text-muted-foreground py-8 text-center text-sm">
              Keine Ergebnisse für &quot;{filter.searchQuery}&quot;
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
