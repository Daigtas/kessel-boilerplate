"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/components/auth"
import { PageContent } from "@/components/shell/PageContent"
import { User, Mail, Lock, RefreshCw, Check, Bot } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SaveableInput } from "@/components/ui/saveable-input"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Loader2 } from "lucide-react"
import { createClient } from "@/utils/supabase/client"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { AIInteractable } from "@/components/ai/AIInteractable"

/**
 * Profil Seite
 */
export default function ProfilePage(): React.ReactElement {
  const { user, isLoading, refreshUser } = useAuth()
  const supabase = createClient()

  // Form States
  const [displayName, setDisplayName] = useState("")
  const [email, setEmail] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  // User Avatar States
  const [avatarSeed, setAvatarSeed] = useState<string>("")
  const [previewAvatarSeed, setPreviewAvatarSeed] = useState<string>("")
  const [savedAvatarSeed, setSavedAvatarSeed] = useState(false)
  const [savingAvatar, setSavingAvatar] = useState(false)

  // Chatbot Avatar States
  const [chatbotAvatarSeed, setChatbotAvatarSeed] = useState<string>("")
  const [previewChatbotAvatarSeed, setPreviewChatbotAvatarSeed] = useState<string>("")
  const [savedChatbotAvatarSeed, setSavedChatbotAvatarSeed] = useState(false)
  const [savingChatbotAvatar, setSavingChatbotAvatar] = useState(false)

  // Chatbot Settings States
  const [chatbotTone, setChatbotTone] = useState<"formal" | "casual">("casual")
  const [chatbotDetailLevel, setChatbotDetailLevel] = useState<"brief" | "balanced" | "detailed">(
    "balanced"
  )
  const [chatbotEmojiUsage, setChatbotEmojiUsage] = useState<"none" | "moderate" | "many">(
    "moderate"
  )
  const [savingChatbotSettings, setSavingChatbotSettings] = useState(false)
  const [savedChatbotSettings, setSavedChatbotSettings] = useState(false)

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
      // User Avatar Seed
      const initialAvatarSeed = user.avatarSeed || user.name || user.email || "default"
      setAvatarSeed(initialAvatarSeed)
      setPreviewAvatarSeed(initialAvatarSeed)
      // Chatbot Avatar Seed
      const initialChatbotSeed = user.chatbotAvatarSeed || user.email || "default"
      setChatbotAvatarSeed(initialChatbotSeed)
      setPreviewChatbotAvatarSeed(initialChatbotSeed)
      // Chatbot Settings
      setChatbotTone(user.chatbotTone || "casual")
      setChatbotDetailLevel(user.chatbotDetailLevel || "balanced")
      setChatbotEmojiUsage(user.chatbotEmojiUsage || "moderate")
    }
  }, [user])

  // Avatar URLs generieren
  const getUserAvatarUrl = (seed: string) =>
    `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed)}`
  const getChatbotAvatarUrl = (seed: string) =>
    `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(seed)}`

  // Zufälligen Seed generieren
  const randomizeSeed = () => {
    const randomSeed = Math.random().toString(36).substring(2, 15) + Date.now().toString(36)
    return randomSeed
  }

  // User Avatar Seed speichern
  async function handleSaveUserAvatar() {
    if (!user) return

    setSavingAvatar(true)
    setError(null)
    setSavedAvatarSeed(false)

    try {
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_seed: previewAvatarSeed })
        .eq("id", user.id)

      if (updateError) {
        throw updateError
      }

      setAvatarSeed(previewAvatarSeed)
      await refreshUser()
      setSavedAvatarSeed(true)
      setTimeout(() => setSavedAvatarSeed(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Speichern des Avatars")
    } finally {
      setSavingAvatar(false)
    }
  }

  // Chatbot Avatar Seed speichern
  async function handleSaveChatbotAvatar() {
    if (!user) return

    setSavingChatbotAvatar(true)
    setError(null)
    setSavedChatbotAvatarSeed(false)

    try {
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ chatbot_avatar_seed: previewChatbotAvatarSeed })
        .eq("id", user.id)

      if (updateError) {
        throw updateError
      }

      setChatbotAvatarSeed(previewChatbotAvatarSeed)
      await refreshUser()
      setSavedChatbotAvatarSeed(true)
      setTimeout(() => setSavedChatbotAvatarSeed(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Speichern des Chatbot-Avatars")
    } finally {
      setSavingChatbotAvatar(false)
    }
  }

  // Chatbot Settings speichern
  async function handleSaveChatbotSettings() {
    if (!user) return

    setSavingChatbotSettings(true)
    setError(null)
    setSavedChatbotSettings(false)

    try {
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          chatbot_tone: chatbotTone,
          chatbot_detail_level: chatbotDetailLevel,
          chatbot_emoji_usage: chatbotEmojiUsage,
        })
        .eq("id", user.id)

      if (updateError) {
        throw updateError
      }

      await refreshUser()
      setSavedChatbotSettings(true)
      setTimeout(() => setSavedChatbotSettings(false), 3000)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Fehler beim Speichern der Chatbot-Einstellungen"
      )
    } finally {
      setSavingChatbotSettings(false)
    }
  }

  // Prüfen ob Änderungen vorhanden
  const hasUserAvatarChanges = previewAvatarSeed !== avatarSeed
  const hasChatbotAvatarChanges = previewChatbotAvatarSeed !== chatbotAvatarSeed
  const hasChatbotSettingsChanges =
    chatbotTone !== (user?.chatbotTone || "casual") ||
    chatbotDetailLevel !== (user?.chatbotDetailLevel || "balanced") ||
    chatbotEmojiUsage !== (user?.chatbotEmojiUsage || "moderate")

  if (isLoading) {
    return (
      <PageContent title="Profil" description="Dein Profil und Chatbot-Einstellungen">
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
        if (updateError.message.includes("already registered")) {
          throw new Error("Diese E-Mail-Adresse wird bereits verwendet")
        }
        throw updateError
      }

      setSavedEmail(true)
      setSuccess(
        "Eine Bestätigungs-E-Mail wurde an die neue Adresse gesendet. Bitte bestätige die Änderung, bevor die neue E-Mail-Adresse aktiv wird."
      )
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
      <PageContent title="Profil" description="Dein Profil und Chatbot-Einstellungen">
        <div className="flex items-center justify-center p-8">
          <p className="text-muted-foreground">Bitte melde dich an, um dein Profil zu sehen.</p>
        </div>
      </PageContent>
    )
  }

  const isPasswordValid = newPassword.length >= 6 && newPassword === confirmPassword
  const userInitials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  return (
    <PageContent title="Profil" description="Dein Profil und Chatbot-Einstellungen">
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
        {passwordError && (
          <div className="bg-destructive/10 text-destructive border-destructive/20 rounded-md border p-3 text-sm">
            {passwordError}
          </div>
        )}

        {/* Card 1: Benutzer-Profil */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="size-5" />
              Benutzer-Profil
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-8">
              {/* Links: Avatar */}
              <div className="flex flex-col items-center gap-4">
                <div className="relative">
                  <Avatar className="border-border size-32 border-4 shadow-lg">
                    <AvatarImage src={getUserAvatarUrl(previewAvatarSeed)} alt={displayName} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-bold">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                  {hasUserAvatarChanges && (
                    <div className="bg-warning absolute -top-1 -right-1 size-4 animate-pulse rounded-full" />
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <AIInteractable
                    id="avatar-randomize"
                    action="trigger"
                    target="randomize-avatar"
                    description="Generiert ein neues zufälliges Avatar-Bild"
                    keywords={["avatar", "profilbild", "zufällig", "random", "neu", "neues avatar"]}
                    category="settings"
                  >
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPreviewAvatarSeed(randomizeSeed())}
                      disabled={savingAvatar}
                      className="gap-2"
                    >
                      <RefreshCw className="size-4" />
                      Neu generieren
                    </Button>
                  </AIInteractable>
                  {hasUserAvatarChanges && (
                    <>
                      <AIInteractable
                        id="avatar-save"
                        action="trigger"
                        target="save-avatar"
                        description="Speichert das aktuelle Avatar-Bild"
                        keywords={["avatar", "speichern", "save", "profilbild"]}
                        category="settings"
                      >
                        <Button
                          variant="default"
                          size="sm"
                          onClick={handleSaveUserAvatar}
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
                        onClick={() => setPreviewAvatarSeed(avatarSeed)}
                        disabled={savingAvatar}
                      >
                        Zurücksetzen
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Rechts: Formularfelder */}
              <div className="flex-1 space-y-4">
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
                  <p className="text-muted-foreground mt-2 text-xs">
                    Änderungen erfordern eine Bestätigung per E-Mail
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="newPassword">Neues Passwort</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value)
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

        {/* Card 2: Chatbot-Einstellungen */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="size-5" />
              Chatbot-Einstellungen
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-8">
              {/* Links: Chatbot-Avatar */}
              <div className="flex flex-col items-center gap-4">
                <div className="relative">
                  <Avatar className="border-border size-32 border-4 shadow-lg">
                    <AvatarImage
                      src={getChatbotAvatarUrl(previewChatbotAvatarSeed)}
                      alt="Chatbot"
                    />
                    <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-bold">
                      🤖
                    </AvatarFallback>
                  </Avatar>
                  {hasChatbotAvatarChanges && (
                    <div className="bg-warning absolute -top-1 -right-1 size-4 animate-pulse rounded-full" />
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPreviewChatbotAvatarSeed(randomizeSeed())}
                    disabled={savingChatbotAvatar}
                    className="gap-2"
                  >
                    <RefreshCw className="size-4" />
                    Neu generieren
                  </Button>
                  {hasChatbotAvatarChanges && (
                    <>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={handleSaveChatbotAvatar}
                        disabled={savingChatbotAvatar}
                        className="gap-2"
                      >
                        {savingChatbotAvatar ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : savedChatbotAvatarSeed ? (
                          <Check className="size-4" />
                        ) : null}
                        Speichern
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setPreviewChatbotAvatarSeed(chatbotAvatarSeed)}
                        disabled={savingChatbotAvatar}
                      >
                        Zurücksetzen
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Rechts: Einstellungen */}
              <div className="flex-1 space-y-6">
                {/* Ansprache */}
                <div className="space-y-2">
                  <Label>Ansprache</Label>
                  <RadioGroup
                    value={chatbotTone}
                    onValueChange={(value) => setChatbotTone(value as "formal" | "casual")}
                  >
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="formal" id="tone-formal" />
                      <Label htmlFor="tone-formal" className="cursor-pointer font-normal">
                        Förmlich (Sie, professionell)
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="casual" id="tone-casual" />
                      <Label htmlFor="tone-casual" className="cursor-pointer font-normal">
                        Locker (Du, entspannt)
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                {/* Detailgrad */}
                <div className="space-y-2">
                  <Label>Detailgrad</Label>
                  <RadioGroup
                    value={chatbotDetailLevel}
                    onValueChange={(value) =>
                      setChatbotDetailLevel(value as "brief" | "balanced" | "detailed")
                    }
                  >
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="brief" id="detail-brief" />
                      <Label htmlFor="detail-brief" className="cursor-pointer font-normal">
                        Kurz & knapp
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="balanced" id="detail-balanced" />
                      <Label htmlFor="detail-balanced" className="cursor-pointer font-normal">
                        Ausgewogen
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="detailed" id="detail-detailed" />
                      <Label htmlFor="detail-detailed" className="cursor-pointer font-normal">
                        Ausführlich
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                {/* Emoji-Verwendung */}
                <div className="space-y-2">
                  <Label>Emoji-Verwendung</Label>
                  <RadioGroup
                    value={chatbotEmojiUsage}
                    onValueChange={(value) =>
                      setChatbotEmojiUsage(value as "none" | "moderate" | "many")
                    }
                  >
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="none" id="emoji-none" />
                      <Label htmlFor="emoji-none" className="cursor-pointer font-normal">
                        Keine
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="moderate" id="emoji-moderate" />
                      <Label htmlFor="emoji-moderate" className="cursor-pointer font-normal">
                        Moderat
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="many" id="emoji-many" />
                      <Label htmlFor="emoji-many" className="cursor-pointer font-normal">
                        Viele
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                {/* Speichern Button */}
                {hasChatbotSettingsChanges && (
                  <Button
                    variant="default"
                    onClick={handleSaveChatbotSettings}
                    disabled={savingChatbotSettings}
                    className="gap-2"
                  >
                    {savingChatbotSettings ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : savedChatbotSettings ? (
                      <Check className="size-4" />
                    ) : null}
                    Einstellungen speichern
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageContent>
  )
}
