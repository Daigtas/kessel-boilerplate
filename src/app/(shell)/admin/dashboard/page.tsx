import { PageContent } from "@/components/shell/PageContent"

/**
 * App-Dashboard Seite
 */
export default function DashboardPage(): React.ReactElement {
  return (
    <PageContent
      title="App-Dashboard"
      description="Übersicht über Benutzer, Rollen, GitHub Repo Info, Vercel autodeploy, App Version, Connected Db's AI Accessibility"
    >
      <div className="space-y-6">{/* Placeholder für zukünftigen Inhalt */}</div>
    </PageContent>
  )
}
