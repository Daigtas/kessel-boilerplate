"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { AddButton } from "@/components/ui/add-button"
import { ExpandableSearch } from "@/components/ui/expandable-search"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Edit, Trash2, Loader2 } from "lucide-react"
import { createClient } from "@/utils/supabase/client"
import { cn } from "@/lib/utils"

export interface Role {
  id: string
  name: string
  display_name: string
  description?: string
  is_system: boolean
}

interface RoleManagementProps {
  roles: Role[]
  onRoleAdded: () => void
  onRoleDeleted: () => void
}

/**
 * Rollen-Management Komponente
 * Ermöglicht das Anlegen, Bearbeiten und Löschen von Rollen
 * Analog zur Theme-Verwaltung mit Card-Layout und Table
 */
export function RoleManagement({
  roles,
  onRoleAdded,
  onRoleDeleted,
}: RoleManagementProps): React.ReactElement {
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [newRoleDisplayName, setNewRoleDisplayName] = useState("")
  const [newRoleDescription, setNewRoleDescription] = useState("")

  const [editingRole, setEditingRole] = useState<Role | null>(null)
  const [editRoleDisplayName, setEditRoleDisplayName] = useState("")
  const [editRoleDescription, setEditRoleDescription] = useState("")
  const [searchTerm, setSearchTerm] = useState("")

  const supabase = createClient()

  // Filter Rollen
  const filteredRoles = roles.filter(
    (r) =>
      r.display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.description?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Generiere Slug aus Anzeigenamen
  function generateSlug(displayName: string): string {
    return displayName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "") // Entferne Sonderzeichen
      .replace(/\s+/g, "-") // Ersetze Leerzeichen mit Bindestrichen
      .replace(/-+/g, "-") // Entferne mehrfache Bindestriche
      .replace(/^-|-$/g, "") // Entferne führende/abschließende Bindestriche
  }

  // Validiere generierten Slug
  function validateSlug(slug: string): boolean {
    return /^[a-z0-9-]+$/.test(slug) && slug.length > 0
  }

  // Öffne Edit-Dialog
  function handleEditRole(role: Role) {
    setEditingRole(role)
    setEditRoleDisplayName(role.display_name)
    setEditRoleDescription(role.description || "")
    setError(null)
    setShowEditDialog(true)
  }

  // Erstelle neue Rolle
  async function handleAddRole() {
    setError(null)

    // Validierung
    if (!newRoleDisplayName.trim()) {
      setError("Anzeigename ist erforderlich")
      return
    }

    // Generiere Slug aus Anzeigenamen
    const generatedSlug = generateSlug(newRoleDisplayName.trim())

    if (!validateSlug(generatedSlug)) {
      setError(
        "Der Anzeigename enthält ungültige Zeichen. Bitte verwende nur Buchstaben, Zahlen und Leerzeichen."
      )
      return
    }

    // Prüfe ob Rolle bereits existiert
    const existingRole = roles.find((r) => r.name === generatedSlug)
    if (existingRole) {
      setError(
        `Eine Rolle mit dem Namen "${generatedSlug}" existiert bereits. Bitte wähle einen anderen Anzeigenamen.`
      )
      return
    }

    setIsSaving(true)

    try {
      const { error: insertError } = await supabase.from("roles").insert({
        name: generatedSlug,
        display_name: newRoleDisplayName.trim(),
        description: newRoleDescription.trim() || null,
        is_system: false,
      })

      if (insertError) {
        throw insertError
      }

      // Erfolg: Dialog schließen und zurücksetzen
      setShowAddDialog(false)
      setNewRoleDisplayName("")
      setNewRoleDescription("")
      setError(null)

      // Callback aufrufen
      onRoleAdded()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Anlegen der Rolle")
    } finally {
      setIsSaving(false)
    }
  }

  // Aktualisiere Rolle
  async function handleUpdateRole() {
    if (!editingRole) return

    setError(null)

    // Validierung
    if (!editRoleDisplayName.trim()) {
      setError("Anzeigename ist erforderlich")
      return
    }

    setIsSaving(true)

    try {
      const { error: updateError } = await supabase
        .from("roles")
        .update({
          display_name: editRoleDisplayName.trim(),
          description: editRoleDescription.trim() || null,
        })
        .eq("id", editingRole.id)

      if (updateError) {
        throw updateError
      }

      // Erfolg: Dialog schließen und zurücksetzen
      setShowEditDialog(false)
      setEditingRole(null)
      setEditRoleDisplayName("")
      setEditRoleDescription("")
      setError(null)

      // Callback aufrufen
      onRoleAdded()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Aktualisieren der Rolle")
    } finally {
      setIsSaving(false)
    }
  }

  // Lösche Rolle
  async function handleDeleteRole(roleId: string) {
    setIsDeleting(true)
    setError(null)

    try {
      // 1. Finde die Default-Rolle ('user')
      const { data: defaultRole, error: roleError } = await supabase
        .from("roles")
        .select("id")
        .eq("name", "user")
        .single()

      if (roleError || !defaultRole) {
        throw new Error("Default-Rolle 'user' nicht gefunden")
      }

      // 2. Setze alle User mit dieser Rolle auf die Default-Rolle
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ role_id: defaultRole.id })
        .eq("role_id", roleId)

      if (updateError) {
        throw updateError
      }

      // 3. Jetzt die Rolle löschen
      const { error: deleteError } = await supabase.from("roles").delete().eq("id", roleId)

      if (deleteError) {
        throw deleteError
      }

      // Callback aufrufen (AlertDialog schließt sich automatisch)
      onRoleDeleted()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Löschen der Rolle")
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <>
      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Verfügbare Rollen</CardTitle>
          </div>
          <div className="flex items-center gap-4">
            <ExpandableSearch
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Suche Rollen..."
            />
            <AddButton text="Neue Rolle" onClick={() => setShowAddDialog(true)} />
          </div>
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Neue Rolle anlegen</DialogTitle>
                <DialogDescription>
                  Erstelle eine neue Rolle für das Berechtigungssystem.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="role-display-name">Anzeigename</Label>
                  <Input
                    id="role-display-name"
                    placeholder="z.B. Superuser"
                    value={newRoleDisplayName}
                    onChange={(e) => setNewRoleDisplayName(e.target.value)}
                    disabled={isSaving}
                  />
                  {newRoleDisplayName.trim() && (
                    <p className="text-muted-foreground text-xs">
                      Rollen-Name (automatisch):{" "}
                      <span className="font-mono">{generateSlug(newRoleDisplayName.trim())}</span>
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role-description">Beschreibung (optional)</Label>
                  <Textarea
                    id="role-description"
                    placeholder="Beschreibung der Rolle..."
                    value={newRoleDescription}
                    onChange={(e) => setNewRoleDescription(e.target.value)}
                    disabled={isSaving}
                    rows={3}
                  />
                </div>
                {error && (
                  <div className="bg-destructive/10 text-destructive border-destructive/20 rounded-md border p-2 text-sm">
                    {error}
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setShowAddDialog(false)}
                  disabled={isSaving}
                >
                  Abbrechen
                </Button>
                <Button onClick={handleAddRole} disabled={isSaving}>
                  {isSaving && <Loader2 className="mr-2 size-4 animate-spin" />}
                  Rolle anlegen
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="hidden md:table-cell">Beschreibung</TableHead>
                <TableHead className="w-24 text-right">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRoles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="h-24 text-center">
                    Keine Rollen gefunden.
                  </TableCell>
                </TableRow>
              ) : (
                filteredRoles.map((role) => (
                  <TableRow key={role.id} className="hover:bg-accent/50 transition-colors">
                    <TableCell className="font-medium">{role.display_name}</TableCell>
                    <TableCell className="text-muted-foreground hidden md:table-cell">
                      {role.description || "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditRole(role)}
                          disabled={role.is_system}
                          className={cn(role.is_system && "opacity-50")}
                        >
                          <Edit className="size-4" />
                        </Button>
                        {!role.is_system ? (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-destructive">
                                <Trash2 className="size-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Rolle löschen?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Möchtest du die Rolle &quot;{role.display_name}&quot; wirklich
                                  löschen? Alle zugehörigen Berechtigungen werden ebenfalls
                                  entfernt. Diese Aktion kann nicht rückgängig gemacht werden.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              {error && (
                                <div className="bg-destructive/10 text-destructive border-destructive/20 rounded-md border p-2 text-sm">
                                  {error}
                                </div>
                              )}
                              <AlertDialogFooter>
                                <AlertDialogCancel disabled={isDeleting}>
                                  Abbrechen
                                </AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteRole(role.id)}
                                  disabled={isDeleting}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  {isDeleting && <Loader2 className="mr-2 size-4 animate-spin" />}
                                  Löschen
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled
                            className="text-destructive opacity-50"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rolle bearbeiten</DialogTitle>
            <DialogDescription>
              Bearbeite die Rolle &quot;{editingRole?.display_name}&quot;.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {editingRole && (
              <div className="space-y-2">
                <Label>Rollen-Name (Slug)</Label>
                <Input value={editingRole.name} disabled className="bg-muted" />
                <p className="text-muted-foreground text-xs">
                  Der Rollen-Name kann nicht geändert werden
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="edit-role-display-name">Anzeigename</Label>
              <Input
                id="edit-role-display-name"
                placeholder="z.B. Superuser"
                value={editRoleDisplayName}
                onChange={(e) => setEditRoleDisplayName(e.target.value)}
                disabled={isSaving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-role-description">Beschreibung (optional)</Label>
              <Textarea
                id="edit-role-description"
                placeholder="Beschreibung der Rolle..."
                value={editRoleDescription}
                onChange={(e) => setEditRoleDescription(e.target.value)}
                disabled={isSaving}
                rows={3}
              />
            </div>
            {error && (
              <div className="bg-destructive/10 text-destructive border-destructive/20 rounded-md border p-2 text-sm">
                {error}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)} disabled={isSaving}>
              Abbrechen
            </Button>
            <Button onClick={handleUpdateRole} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 size-4 animate-spin" />}
              Änderungen speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
