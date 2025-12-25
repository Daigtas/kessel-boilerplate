"use client"

import { useEffect, useState } from "react"
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

export default function AIDatasourcesPage() {
  const [dataSources, setDataSources] = useState<DataSource[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const loadDataSources = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.from("ai_datasources").select("*").order("table_name")

      if (error) throw error
      setDataSources(data ?? [])
    } catch (error) {
      console.error("Fehler beim Laden der Datasources:", error)
      toast.error("Fehler beim Laden der Datasources")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDataSources()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const updateAccessLevel = async (id: string, accessLevel: AccessLevel) => {
    try {
      const { error } = await supabase
        .from("ai_datasources")
        .update({ access_level: accessLevel })
        .eq("id", id)

      if (error) throw error
      toast.success("Zugriffslevel aktualisiert")
      await loadDataSources()
    } catch (error) {
      console.error("Fehler beim Aktualisieren:", error)
      toast.error("Fehler beim Aktualisieren")
    }
  }

  const toggleEnabled = async (id: string, enabled: boolean) => {
    try {
      const { error } = await supabase
        .from("ai_datasources")
        .update({ is_enabled: enabled })
        .eq("id", id)

      if (error) throw error
      toast.success(enabled ? "Datasource aktiviert" : "Datasource deaktiviert")
      await loadDataSources()
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

  return (
    <PageContent>
      <div className="space-y-6">
        <PageHeader
          title="AI Datasources"
          description="Verwalte, welche Tabellen die AI lesen und ändern darf"
        />

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Datenbank-Tabellen</CardTitle>
                <CardDescription>Konfiguriere Zugriffsrechte für AI-Tool-Calls</CardDescription>
              </div>
              <Button onClick={loadDataSources} variant="outline" size="sm">
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
            ) : dataSources.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <DatabaseIcon className="text-muted-foreground mb-4 size-12" />
                <p className="text-muted-foreground">
                  Keine Datasources gefunden. Führe die Migration aus, um Tabellen zu entdecken.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tabelle</TableHead>
                    <TableHead>Anzeigename</TableHead>
                    <TableHead>Zugriffslevel</TableHead>
                    <TableHead>Aktiviert</TableHead>
                    <TableHead>Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dataSources.map((ds) => (
                    <TableRow key={ds.id}>
                      <TableCell className="font-mono text-sm">{ds.table_name}</TableCell>
                      <TableCell>{ds.display_name}</TableCell>
                      <TableCell>{getAccessLevelBadge(ds.access_level)}</TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Switch
                            checked={ds.is_enabled}
                            onCheckedChange={(checked) => toggleEnabled(ds.id, checked)}
                          />
                          <Label className="text-sm">{ds.is_enabled ? "Aktiv" : "Inaktiv"}</Label>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={ds.access_level}
                          onValueChange={(value) => updateAccessLevel(ds.id, value as AccessLevel)}
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
