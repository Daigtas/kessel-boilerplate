"use client"

import { useEffect, useState, useMemo } from "react"
import { PageContent, PageHeader } from "@/components/shell"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { createClient } from "@/utils/supabase/client"
import { RefreshCw, Database as DatabaseIcon } from "lucide-react"
import { toast } from "sonner"
import { useCurrentNavItem } from "@/lib/navigation/use-current-nav-item"
import { useDatasourceFilter, DUMMY_DATABASES } from "@/hooks/use-datasource-filter"

type AccessLevel = "none" | "read" | "read_write" | "full"

type DataSource = {
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
  created_at: string
  updated_at: string
  created_by: string | null
}

/**
 * Vereinigte Datenquelle für die Tabelle
 * Enthält DB-Referenz für Gruppierung/Filterung
 */
type UnifiedDataSource = DataSource & {
  database_id: string
  database_name: string
  database_type: "infra" | "dev"
}

/**
 * Datenquellen-Seite
 *
 * Zeigt alle Datenquellen aus allen verbundenen Datenbanken in einer vereinigten Tabelle.
 * Der Explorer (Spalte 2) dient als Filter-Tree zum Eingrenzen der Ansicht.
 *
 * Architektur:
 * - Infra-DB (KESSEL): Echte Daten aus ai_datasources Tabelle
 * - Dev-DBs: Dummy-Daten für Entwicklung (später: echte Connections)
 */
export default function DatasourcesPage(): React.ReactElement {
  const [infraDataSources, setInfraDataSources] = useState<DataSource[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  // Dynamischer Titel aus Navigation
  const currentNavItem = useCurrentNavItem()
  const pageTitle = currentNavItem?.label ?? "Datenquellen"

  // Filter-Context
  const { databases, setDatabases, filter, isTableVisible } = useDatasourceFilter()
  // Explorer-Öffnung wird vom Layout gesteuert (ExplorerAutoOpen)

  // Lade Infra-DB Daten
  const loadInfraDataSources = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.from("ai_datasources").select("*").order("table_name")

      if (error) throw error
      setInfraDataSources(data ?? [])

      // Aktualisiere die Infra-DB Tabellen im Filter-Context
      const infraDb = DUMMY_DATABASES.find((db) => db.id === "infra-kessel")
      if (infraDb && data) {
        const updatedDatabases = DUMMY_DATABASES.map((db) =>
          db.id === "infra-kessel" ? { ...db, tables: data.map((ds) => ds.table_name) } : db
        )
        setDatabases(updatedDatabases)
      }
    } catch (error) {
      console.error("Fehler beim Laden der Datasources:", error)
      toast.error("Fehler beim Laden der Datasources")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadInfraDataSources()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Vereinigte Tabelle: Infra-DB + Dummy Dev-DBs
  const unifiedDataSources: UnifiedDataSource[] = useMemo(() => {
    const sources: UnifiedDataSource[] = []

    // Infra-DB (echte Daten)
    infraDataSources.forEach((ds) => {
      sources.push({
        ...ds,
        database_id: "infra-kessel",
        database_name: "Infra-DB (KESSEL)",
        database_type: "infra",
      })
    })

    // Dev-DBs (Dummy-Daten)
    databases
      .filter((db) => db.type === "dev")
      .forEach((db) => {
        db.tables.forEach((tableName) => {
          sources.push({
            id: `${db.id}-${tableName}`,
            table_schema: "public",
            table_name: tableName,
            display_name: tableName.charAt(0).toUpperCase() + tableName.slice(1),
            description: `Tabelle aus ${db.name}`,
            access_level: "none" as AccessLevel,
            is_enabled: false,
            allowed_columns: [],
            excluded_columns: [],
            max_rows_per_query: 100,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            created_by: null,
            database_id: db.id,
            database_name: db.name,
            database_type: "dev",
          })
        })
      })

    return sources
  }, [infraDataSources, databases])

  // Gefilterte Datenquellen basierend auf Explorer-Filter
  const filteredDataSources = useMemo(() => {
    return unifiedDataSources.filter((ds) => isTableVisible(ds.database_id, ds.table_name))
  }, [unifiedDataSources, isTableVisible])

  const updateAccessLevel = async (
    id: string,
    accessLevel: AccessLevel,
    dbType: "infra" | "dev"
  ) => {
    if (dbType === "dev") {
      toast.info("Dev-DB Konfiguration wird noch nicht persistiert")
      return
    }

    try {
      const { error } = await supabase
        .from("ai_datasources")
        .update({ access_level: accessLevel })
        .eq("id", id)

      if (error) throw error
      toast.success("Zugriffslevel aktualisiert")
      await loadInfraDataSources()
    } catch (error) {
      console.error("Fehler beim Aktualisieren:", error)
      toast.error("Fehler beim Aktualisieren")
    }
  }

  const toggleEnabled = async (id: string, enabled: boolean, dbType: "infra" | "dev") => {
    if (dbType === "dev") {
      toast.info("Dev-DB Konfiguration wird noch nicht persistiert")
      return
    }

    try {
      const { error } = await supabase
        .from("ai_datasources")
        .update({ is_enabled: enabled })
        .eq("id", id)

      if (error) throw error
      toast.success(enabled ? "Datasource aktiviert" : "Datasource deaktiviert")
      await loadInfraDataSources()
    } catch (error) {
      console.error("Fehler beim Toggeln:", error)
      toast.error("Fehler beim Aktualisieren")
    }
  }

  const getAccessLevelBadge = (level: AccessLevel) => {
    const variants: Record<
      AccessLevel,
      { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
    > = {
      none: { label: "Kein Zugriff", variant: "outline" },
      read: { label: "Nur Lesen", variant: "secondary" },
      read_write: { label: "Lesen + Schreiben", variant: "default" },
      full: { label: "Vollzugriff", variant: "destructive" },
    }
    const config = variants[level]
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  const getDatabaseBadge = (dbType: "infra" | "dev", dbName: string) => {
    // Infra-DB: primary (blau), Dev-DB: secondary (grün/grau)
    return <Badge variant={dbType === "infra" ? "default" : "outline"}>{dbName}</Badge>
  }

  return (
    <PageContent>
      <div className="space-y-6">
        <PageHeader
          title={pageTitle}
          description="Verwalte Datenbank-Tabellen und AI-Zugriffsrechte für alle verbundenen Datenquellen"
        />

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Alle Datenquellen</CardTitle>
                <CardDescription>
                  {filteredDataSources.length} von {unifiedDataSources.length} Tabellen
                  {filter.selectedDatabases.length > 0 || filter.selectedTables.length > 0
                    ? " (gefiltert)"
                    : ""}
                </CardDescription>
              </div>
              <Button onClick={loadInfraDataSources} variant="outline" size="sm">
                <RefreshCw className="mr-2 size-4" />
                Aktualisieren
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="mr-2 size-4 animate-spin" />
                Lade Datasources...
              </div>
            ) : filteredDataSources.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <DatabaseIcon className="text-muted-foreground mb-4 size-12" />
                <p className="text-muted-foreground">
                  {unifiedDataSources.length === 0
                    ? "Keine Datasources gefunden. Führe die Migration aus, um Tabellen zu entdecken."
                    : "Keine Tabellen entsprechen dem Filter. Passe die Auswahl im Explorer an."}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Datenbank</TableHead>
                    <TableHead>Tabelle</TableHead>
                    <TableHead>Anzeigename</TableHead>
                    <TableHead>Zugriffslevel</TableHead>
                    <TableHead>Aktiviert</TableHead>
                    <TableHead>Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDataSources.map((ds) => (
                    <TableRow key={ds.id}>
                      <TableCell>{getDatabaseBadge(ds.database_type, ds.database_name)}</TableCell>
                      <TableCell className="font-mono text-sm">{ds.table_name}</TableCell>
                      <TableCell>{ds.display_name}</TableCell>
                      <TableCell>{getAccessLevelBadge(ds.access_level)}</TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Switch
                            checked={ds.is_enabled}
                            onCheckedChange={(checked) =>
                              toggleEnabled(ds.id, checked, ds.database_type)
                            }
                            disabled={ds.database_type === "dev"}
                          />
                          <Label className="text-sm">{ds.is_enabled ? "Aktiv" : "Inaktiv"}</Label>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={ds.access_level}
                          onValueChange={(value) =>
                            updateAccessLevel(ds.id, value as AccessLevel, ds.database_type)
                          }
                          disabled={ds.database_type === "dev"}
                        >
                          <SelectTrigger className="w-48">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Kein Zugriff</SelectItem>
                            <SelectItem value="read">Nur Lesen</SelectItem>
                            <SelectItem value="read_write">Lesen + Schreiben</SelectItem>
                            <SelectItem value="full">Vollzugriff</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </PageContent>
  )
}
