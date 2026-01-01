"use client"

import { usePathname, useRouter } from "next/navigation"
import { User, ShoppingCart, Languages, LogOut, Palette } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAuth, usePermissions } from "@/components/auth"
import { userMenuConfig } from "@/config/navigation"

/**
 * UserAvatar Komponente
 *
 * Zeigt den User-Avatar mit Dropdown-Menü für Account-Funktionen.
 * Menüpunkte werden basierend auf Rollen-Berechtigungen angezeigt/versteckt.
 *
 * @example
 * ```tsx
 * <UserAvatar />
 * ```
 */
export function UserAvatar(): React.ReactElement {
  const { user, logout, role } = useAuth()
  const { canAccess } = usePermissions()
  const pathname = usePathname()
  const router = useRouter()

  // User-Rolle für Berechtigungsprüfung
  const userRole = role ?? "NoUser"

  // Logout mit hartem Redirect zur Login-Seite
  const handleLogout = async () => {
    await logout()
    window.location.href = "/login"
  }

  // User-Initialen für Avatar-Fallback
  const userInitials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : user?.email
      ? user.email[0].toUpperCase()
      : "U"

  // User-Name für Anzeige
  const displayName = user?.name || user?.email?.split("@")[0] || "User"

  // Avatar Seed: Gespeicherter Seed oder Name als Fallback
  const avatarSeed = user?.avatarSeed || displayName

  // DiceBear "avataaars" URL für lustige, comic-artige Avatare
  // DiceBear ist IMMER der Standard-Avatar
  // Später: OAuth-Avatar kann in Benutzereinstellungen aktiviert werden
  const diceBearUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(avatarSeed)}`
  const avatarSrc = diceBearUrl

  // Icon-Mapping für die Menüpunkte
  const iconMap: Record<string, typeof User> = {
    "user-profile": User,
    "user-cart": ShoppingCart,
    "user-display-settings": Palette,
    "user-language": Languages,
    "user-logout": LogOut,
  }

  // Filtere sichtbare Menüpunkte basierend auf Berechtigungen
  const visibleItems = userMenuConfig.items.filter((item) => canAccess(item.id, userRole))

  // Separiere normale Items und Logout
  const normalItems = visibleItems.filter((item) => item.id !== "user-logout")
  const logoutItem = visibleItems.find((item) => item.id === "user-logout")

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          suppressHydrationWarning
          className={cn(
            "relative size-12 shrink-0 rounded-full bg-transparent p-0 shadow-lg transition-all",
            "hover:scale-110 hover:bg-transparent hover:shadow-xl",
            "focus:ring-ring focus:ring-2 focus:ring-offset-2 focus:outline-none"
          )}
        >
          <Avatar className="size-12">
            <AvatarImage src={avatarSrc} alt={displayName} />
            <AvatarFallback className="bg-primary text-primary-foreground text-sm font-medium">
              {userInitials}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <p className="text-sm leading-none font-medium">{displayName}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Dynamisch gerenderte Menüpunkte basierend auf Berechtigungen */}
        {normalItems.map((item) => {
          const Icon = iconMap[item.id] || User
          const isActive = item.href === pathname

          const label = item.label

          return (
            <DropdownMenuItem
              key={item.id}
              onClick={() => item.href && router.push(item.href)}
              className={cn(isActive && "bg-accent")}
            >
              <Icon className="mr-2 size-4" />
              <span>{label}</span>
            </DropdownMenuItem>
          )
        })}

        {/* Logout (falls sichtbar) */}
        {logoutItem && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleLogout}
              className="text-destructive focus:text-destructive"
            >
              <LogOut className="mr-2 size-4" />
              <span>{logoutItem.label}</span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
