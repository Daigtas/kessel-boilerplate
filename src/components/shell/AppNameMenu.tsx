"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useAuth, usePermissions } from "@/components/auth"
import { navigationConfig, appConfig } from "@/config/navigation"

/**
 * AppNameMenu Komponente
 *
 * Zeigt den App-Namen mit optionalem Dropdown-Menü für Admin-Funktionen.
 * - Für Admins: Dropdown mit ChevronDown Icon und Admin-Menüpunkten
 * - Für Nicht-Admins: Einfacher Link zur Home-Seite (kein Dropdown)
 *
 * @example
 * ```tsx
 * <AppNameMenu collapsed={false} />
 * ```
 */
export function AppNameMenu({ collapsed = false }: { collapsed?: boolean }): React.ReactElement {
  const { role } = useAuth()
  const { canAccess } = usePermissions()
  const pathname = usePathname()
  const router = useRouter()

  // User-Rolle für Berechtigungsprüfung
  const userRole = role ?? "NoUser"

  // Finde Admin-Section
  const adminSection = navigationConfig.find((section) => section.id === "admin")

  // Prüfe ob User Admin ist und Admin-Section sichtbar ist
  const isAdmin = adminSection ? canAccess(adminSection.id, userRole) : false

  // Filtere sichtbare Admin-Menüpunkte basierend auf Berechtigungen
  const visibleAdminItems = adminSection
    ? adminSection.items.filter((item) => canAccess(item.id, userRole))
    : []

  // Collapsed Mode: Nur Icon mit Tooltip
  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Link href="/">
            <Button
              variant="ghost"
              size="icon"
              className="size-10 transition-transform duration-200"
            >
              <appConfig.logo className="size-5" />
            </Button>
          </Link>
        </TooltipTrigger>
        <TooltipContent side="right">{appConfig.name}</TooltipContent>
      </Tooltip>
    )
  }

  // Nicht-Admin: Einfacher Link ohne Dropdown
  if (!isAdmin || visibleAdminItems.length === 0) {
    return (
      <Link
        href="/"
        className="flex min-w-0 items-center gap-2 transition-opacity duration-200 hover:opacity-80"
      >
        <appConfig.logo className="text-sidebar-foreground size-5 shrink-0" />
        <span className="text-sidebar-foreground truncate text-lg font-bold uppercase transition-opacity duration-200">
          {appConfig.name}
        </span>
      </Link>
    )
  }

  // Admin: Dropdown mit Menüpunkten
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="hover:bg-sidebar-accent flex h-auto min-w-0 items-center gap-2 px-2 py-1.5"
        >
          <appConfig.logo className="text-sidebar-foreground size-5 shrink-0" />
          <span className="text-sidebar-foreground truncate text-lg font-bold uppercase">
            {appConfig.name}
          </span>
          <ChevronDown className="text-sidebar-foreground size-4 shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>App-Verwaltung</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Dynamisch gerenderte Admin-Menüpunkte basierend auf Berechtigungen */}
        {visibleAdminItems.map((item) => {
          const Icon = item.icon
          const isActive = item.href === pathname

          return (
            <DropdownMenuItem
              key={item.id}
              onClick={() => item.href && router.push(item.href)}
              className={cn(isActive && "bg-accent")}
            >
              <Icon className="mr-2 size-4" />
              <span>{item.label}</span>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
