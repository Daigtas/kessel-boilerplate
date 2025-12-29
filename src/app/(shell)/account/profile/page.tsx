"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/components/auth"
import { PageContent } from "@/components/shell/PageContent"
import { User, Mail, Lock, RefreshCw, Check } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SaveableInput } from "@/components/ui/saveable-input"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { createClient } from "@/utils/supabase/client"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { AIInteractable } from "@/components/ai/AIInteractable"

/**
 * User Profile Seite
 */
export default function ProfilePage(): React.ReactElement {
  const { user, isLoading, refreshUser } = useAuth()
  const supabase = createClient()

  // Form States
  const [displayName, setDisplayName] = useState("")
  const [email, setEmail] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  // Avatar States
  const [avatarSeed, setAvatarSeed] = useState<string>("")
  const [previewSeed, setPreviewSeed] = useState<string>("")
  const [savedAvatarSeed, setSavedAvatarSeed] = useState(false)
  const [savingAvatar, setSavingAvatar] = useState(false)

  // UI States
  const [error, setError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Visual feedback states for checkmarks
  const [savedDisplayName, setSavedDisplayName] = useState(false)
  const [savedEmail, setSavedEmail] = useState(false)
  const [savedPassword, setSavedPassword] = useState(false)

  // Track which field is currently being saved
  const [savingField, setSavingField] = useState<string | null>(null)
  const [, setIsSaving] = useState(false)

  // Initialize form values from user data
  useEffect(() => {
    if (user) {
      setDisplayName(user.name)
      setEmail(user.email)
      // Avatar Seed: Gespeicherter Seed oder Name als Fallback
      const initialSeed = user.avatarSeed || user.name || user.email
      setAvatarSeed(initialSeed)
      setPreviewSeed(initialSeed)
    }
  }, [user])

  // Avatar URL generieren
  const getAvatarUrl = (seed: string) =>
    `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed)}`

  // Zufälligen Seed generieren
  const randomizeSeed = () => {
    const randomSeed = Math.random().toString(36).substring(2, 15) + Date.now().toString(36)
    setPreviewSeed(randomSeed)
  }

  // Avatar Seed speichern
  async function handleSaveAvatar() {
    if (!user) return

    setSavingAvatar(true)
    setError(null)
    setSavedAvatarSeed(false)

    try {
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_seed: previewSeed })
        .eq("id", user.id)

      if (updateError) {
        throw updateError
      }

      setAvatarSeed(previewSeed)
      await refreshUser()
      setSavedAvatarSeed(true)

      // Reset saved state after 3 seconds
      setTimeout(() => setSavedAvatarSeed(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Speichern des Avatars")
    } finally {
      setSavingAvatar(false)
    }
  }

  // Avatar zurücksetzen auf gespeicherten Wert
  const resetAvatarPreview = () => {
    setPreviewSeed(avatarSeed)
  }

  // Prüfen ob Preview sich vom gespeicherten Wert unterscheidet
  const hasAvatarChanges = previewSeed !== avatarSeed

  if (isLoading) {
    return (
      <PageContent title="User Details" description="Verwalte deine persönlichen Informationen">
        <div className="flex items-center justify-center p-8">
          <Loader2 className="text-muted-foreground size-8 animate-spin" />
        </div>
      </PageContent>
    )
  }

  // Validate email format
  function isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }

  // Save display name
  async function handleSaveDisplayName() {
    if (!user || !displayName.trim()) {
      setError("Anzeigename darf nicht leer sein")
      return
    }

    setSavingField("displayName")
    setIsSaving(true)
    setError(null)
    setSuccess(null)
    setSavedDisplayName(false)

    try {
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ display_name: displayName.trim() })
        .eq("id", user.id)

      if (updateError) {
        throw updateError
      }

      // Refresh user data
      await refreshUser()
      setSavedDisplayName(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Speichern des Anzeigenamens")
    } finally {
      setIsSaving(false)
      setSavingField(null)
    }
  }

  // Save email
  async function handleSaveEmail() {
    if (!user) return

    if (!email.trim()) {
      setError("E-Mail-Adresse darf nicht leer sein")
      return
    }

    if (!isValidEmail(email)) {
      setError("Bitte gib eine gültige E-Mail-Adresse ein")
      return
    }

    if (email === user.email) {
      setError("Die E-Mail-Adresse wurde nicht geändert")
      return
    }

    setSavingField("email")
    setIsSaving(true)
    setError(null)
    setSuccess(null)
    setSavedEmail(false)

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        email: email.trim(),
      })

      if (updateError) {
        // Handle specific error cases
        if (updateError.message.includes("already registered")) {
          throw new Error("Diese E-Mail-Adresse wird bereits verwendet")
        }
        throw updateError
      }

      setSavedEmail(true)
      setSuccess(
        "Eine Bestätigungs-E-Mail wurde an die neue Adresse gesendet. Bitte bestätige die Änderung, bevor die neue E-Mail-Adresse aktiv wird."
      )

      // Clear success message after 10 seconds (longer for email confirmation)
      setTimeout(() => setSuccess(null), 10000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Ändern der E-Mail-Adresse")
    } finally {
      setIsSaving(false)
      setSavingField(null)
    }
  }

  // Save password
  async function handleSavePassword() {
    if (!user) return

    if (!newPassword) {
      setPasswordError("Bitte gib ein neues Passwort ein")
      return
    }

    if (newPassword.length < 6) {
      setPasswordError("Das Passwort muss mindestens 6 Zeichen lang sein")
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("Die Passwörter stimmen nicht überein")
      return
    }

    setSavingField("password")
    setIsSaving(true)
    setPasswordError(null)
    setSuccess(null)
    setSavedPassword(false)

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (updateError) {
        throw updateError
      }

      // Clear password fields
      setNewPassword("")
      setConfirmPassword("")
      setSavedPassword(true)
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "Fehler beim Ändern des Passworts")
    } finally {
      setIsSaving(false)
      setSavingField(null)
    }
  }

  if (!user) {
    return (
      <PageContent title="User Details" description="Verwalte deine persönlichen Informationen">
        <div className="flex items-center justify-center p-8">
          <p className="text-muted-foreground">Bitte melde dich an, um dein Profil zu sehen.</p>
        </div>
      </PageContent>
    )
  }

  const isPasswordValid = newPassword.length >= 6 && newPassword === confirmPassword

  return (
    <PageContent title="User Details" description="Verwalte deine persönlichen Informationen">
      <div className="space-y-6">
        {/* Messages */}
        {error && (
          <div className="bg-destructive/10 text-destructive border-destructive/20 rounded-md border p-3 text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-chart-1/10 text-chart-1 border-chart-1/20 rounded-md border p-3 text-sm">
            {success}
          </div>
        )}

        {/* Avatar Card - Oben */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="size-5" />
              Profilbild
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center gap-6">
              {/* Großer Avatar */}
              <div className="relative">
                <Avatar className="border-border size-32 border-4 shadow-lg">
                  <AvatarImage src={getAvatarUrl(previewSeed)} alt={displayName} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-bold">
                    {displayName
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                {hasAvatarChanges && (
                  <div className="bg-warning absolute -top-1 -right-1 size-4 animate-pulse rounded-full" />
                )}
              </div>

              {/* Aktionen */}
              <div className="flex flex-wrap items-center justify-center gap-2">
                <AIInteractable
                  id="avatar-randomize"
                  action="trigger"
                  target="randomize-avatar"
                  description="Generiert ein neues zufälliges Avatar-Bild"
                  keywords={["avatar", "profilbild", "zufällig", "random", "neu", "neues avatar"]}
                  category="settings"
                  onAction={randomizeSeed}
                >
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={randomizeSeed}
                    disabled={savingAvatar}
                    className="gap-2"
                  >
                    <RefreshCw className="size-4" />
                    Neuer Avatar
                  </Button>
                </AIInteractable>

                {hasAvatarChanges && (
                  <>
                    <AIInteractable
                      id="avatar-save"
                      action="trigger"
                      target="save-avatar"
                      description="Speichert das aktuelle Avatar-Bild"
                      keywords={["avatar", "speichern", "save", "profilbild"]}
                      category="settings"
                      onAction={handleSaveAvatar}
                    >
                      <Button
                        variant="default"
                        size="sm"
                        onClick={handleSaveAvatar}
                        disabled={savingAvatar}
                        className="gap-2"
                      >
                        {savingAvatar ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : savedAvatarSeed ? (
                          <Check className="size-4" />
                        ) : null}
                        Speichern
                      </Button>
                    </AIInteractable>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={resetAvatarPreview}
                      disabled={savingAvatar}
                    >
                      Zurücksetzen
                    </Button>
                  </>
                )}
              </div>

              <p className="text-muted-foreground text-center text-xs">
                Klicke auf &quot;Neuer Avatar&quot;, bis dir ein Bild gefällt, dann speichere es.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Personal Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="size-5" />
              Persönliche Informationen
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="displayName">Anzeigename</Label>
                <SaveableInput
                  id="displayName"
                  value={displayName}
                  onValueChange={setDisplayName}
                  originalValue={user.name}
                  onSave={handleSaveDisplayName}
                  isSaving={savingField === "displayName"}
                  saved={savedDisplayName}
                  onSavedReset={() => setSavedDisplayName(false)}
                  isValid={displayName.trim().length > 0}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Email Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="size-5" />
              E-Mail Adresse
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="email">E-Mail</Label>
                <SaveableInput
                  id="email"
                  type="email"
                  value={email}
                  onValueChange={setEmail}
                  originalValue={user.email}
                  onSave={handleSaveEmail}
                  isSaving={savingField === "email"}
                  saved={savedEmail}
                  onSavedReset={() => setSavedEmail(false)}
                  isValid={isValidEmail(email) && email.trim().length > 0}
                />
                <p className="text-muted-foreground mt-4 text-xs">
                  Änderungen erfordern eine Bestätigung per E-Mail
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Password Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="size-5" />
              Passwort ändern
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="newPassword">Neues Passwort</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value)
                      // Clear error when user starts typing
                      if (passwordError) setPasswordError(null)
                    }}
                    disabled={savingField === "password"}
                    placeholder="Mindestens 6 Zeichen"
                    className="!bg-muted"
                  />
                </div>
                <div>
                  <Label htmlFor="confirmPassword">Passwort bestätigen</Label>
                  <SaveableInput
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onValueChange={(value) => {
                      setConfirmPassword(value)
                      // Clear error when user starts typing
                      if (passwordError) setPasswordError(null)
                    }}
                    originalValue=""
                    onSave={handleSavePassword}
                    isSaving={savingField === "password"}
                    saved={savedPassword}
                    onSavedReset={() => setSavedPassword(false)}
                    isValid={isPasswordValid}
                    showSaveButton={newPassword.length > 0 && confirmPassword.length > 0}
                    placeholder="Passwort wiederholen"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Password Error Messages */}
        {passwordError && (
          <div className="bg-destructive/10 text-destructive border-destructive/20 rounded-md border p-3 text-sm">
            {passwordError}
          </div>
        )}
      </div>
    </PageContent>
  )
}
