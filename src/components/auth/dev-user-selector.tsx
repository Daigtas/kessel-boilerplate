"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2, User, Shield, AlertCircle } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

interface DevUser {
  id: string
  email: string
  displayName: string
  role: string
  createdAt: string
  lastSignIn: string | null
}

/**
 * DevUserSelector - User-Auswahl für Local Development
 *
 * Zeigt eine Liste aller registrierten User an, die mit einem Klick eingeloggt werden können.
 * Funktioniert NUR im Development-Mode mit aktiviertem Bypass.
 */
export function DevUserSelector(): React.ReactElement {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get("redirect") || "/"

  const [users, setUsers] = useState<DevUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [impersonating, setImpersonating] = useState<string | null>(null)

  // Lade User-Liste beim Mount
  useEffect(() => {
    async function loadUsers() {
      try {
        const response = await fetch("/api/dev/users")
        if (!response.ok) {
          if (response.status === 403) {
            setError("Dev-Modus nicht aktiviert")
          } else {
            setError(`Fehler beim Laden der User: ${response.statusText}`)
          }
          return
        }

        const data = await response.json()
        setUsers(data.users || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unbekannter Fehler")
      } finally {
        setLoading(false)
      }
    }

    loadUsers()
  }, [])

  // User-Impersonation
  async function handleUserSelect(user: DevUser) {
    setImpersonating(user.id)

    try {
      const response = await fetch("/api/dev/impersonate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: user.id,
          email: user.email,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Fehler beim Anmelden")
      }

      // Erfolgreich eingeloggt - Redirect
      router.push(redirectTo)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Anmelden")
      setImpersonating(null)
    }
  }

  // Initiale der Display-Name
  function getInitials(name: string): string {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  // Rolle-Icon
  function getRoleIcon(role: string) {
    return role === "admin" ? (
      <Shield className="text-primary size-4" />
    ) : (
      <User className="text-muted-foreground size-4" />
    )
  }

  // Rolle-Badge-Farbe
  function getRoleBadgeClass(role: string): string {
    return role === "admin"
      ? "bg-primary/10 text-primary border-primary/20"
      : "bg-muted text-muted-foreground border-border"
  }

  if (loading) {
    return (
      <Card>
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Development Mode</CardTitle>
          <CardDescription>Lade User-Liste...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="text-muted-foreground size-8 animate-spin" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Development Mode</CardTitle>
          <CardDescription>Fehler beim Laden</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border-destructive/50 bg-destructive/10 text-destructive flex items-center gap-2 rounded-md border p-4">
            <AlertCircle className="size-5 shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (users.length === 0) {
    return (
      <Card>
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Development Mode</CardTitle>
          <CardDescription>Keine User gefunden</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Es wurden keine registrierten User gefunden. Bitte erstelle zuerst Test-User.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold">Development Mode</CardTitle>
        <CardDescription>
          Wähle einen User aus, um dich anzumelden ({users.length} User verfügbar)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {users.map((user) => {
            const isImpersonating = impersonating === user.id

            return (
              <Button
                key={user.id}
                variant="outline"
                className="h-auto w-full justify-start gap-4 p-4 text-left"
                onClick={() => handleUserSelect(user)}
                disabled={isImpersonating || !!impersonating}
              >
                <Avatar className="size-10 shrink-0">
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {getInitials(user.displayName)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-1 flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{user.displayName}</span>
                    {getRoleIcon(user.role)}
                  </div>
                  <span className="text-muted-foreground text-xs">{user.email}</span>
                </div>
                <div className="shrink-0">
                  {isImpersonating ? (
                    <Loader2 className="text-muted-foreground size-4 animate-spin" />
                  ) : (
                    <span
                      className={`rounded-md border px-2 py-0.5 text-xs font-medium ${getRoleBadgeClass(user.role)}`}
                    >
                      {user.role}
                    </span>
                  )}
                </div>
              </Button>
            )
          })}
        </div>
        <div className="border-muted bg-muted/30 mt-6 rounded-md border p-4">
          <p className="text-muted-foreground text-xs">
            <strong>Hinweis:</strong> Diese Ansicht ist nur im Development-Mode verfügbar. In
            Production wird das normale Login-Formular angezeigt.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
