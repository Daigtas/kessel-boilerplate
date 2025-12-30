"use client"

import { DatasourceExplorer } from "./datasource-explorer"
import { useDatasourceFilter } from "@/hooks/use-datasource-filter"
import { ExplorerPanel } from "@/components/shell"

/**
 * DatasourceExplorerWrapper
 *
 * Wrapper-Komponente die den DatasourceExplorer in ein ExplorerPanel einbettet.
 * Wird im Shell-Layout für die Datenquellen-Route verwendet.
 */
export function DatasourceExplorerWrapper(): React.ReactElement {
  const { databases, filter, setFilter } = useDatasourceFilter()

  return (
    <ExplorerPanel variant="custom" title="Datenquellen">
      <DatasourceExplorer databases={databases} filter={filter} onFilterChange={setFilter} />
    </ExplorerPanel>
  )
}
