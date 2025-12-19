"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronRight, ChevronLeft } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import { useShell } from "./shell-context"
import { useAuth, usePermissions } from "@/components/auth"
import { navigationConfig, appConfig, type NavItem, type NavSection } from "@/config/navigation"

/** Typ für die isVisible Funktion */
type IsVisibleFn = (item: NavItem | NavSection) => boolean

/**
 * Navbar Komponente
 *
 * Implementiert die Spalte 1 des 4-Spalten-Layouts:
 * - App-Name Header
 * - Collapsible Accordion-Gruppen mit Dividers
 * - Icons-only Mode bei collapsed state
 *
 * Nutzt PermissionsContext für DB-basierte Berechtigungsprüfung.
 */
export function Navbar(): React.ReactElement {
  const { navbarCollapsed, toggleNavbar } = useShell()
  const { logout, user } = useAuth()
  const { canAccess } = usePermissions()
  const pathname = usePathname()

  // User-Rolle für Sichtbarkeitsprüfung
  const userRole = user?.role ?? "NoUser"

  // Sichtbarkeitsprüfung über PermissionsContext (nutzt DB-Berechtigungen)
  const isVisible: IsVisibleFn = (item) => canAccess(item.id, userRole)

  // Logout mit hartem Redirect zur Login-Seite
  // Verwendet window.location für vollständigen Page-Reload, um alle Caches zu leeren
  const handleLogout = async () => {
    await logout()
    // Hard redirect - leert alle Client-Side Caches und Router-State
    window.location.href = "/login"
  }

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex h-full flex-col">
        {/* App Name Header - Link zur Home-Seite (fixiert oben) */}
        <div
          className={cn(
            "flex h-14 shrink-0 items-center",
            navbarCollapsed ? "justify-center px-1" : "justify-between px-4"
          )}
        >
          {navbarCollapsed ? (
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
          ) : (
            <>
              <Link
                href="/"
                className="flex min-w-0 items-center gap-2 transition-opacity duration-200 hover:opacity-80"
              >
                <appConfig.logo className="text-sidebar-foreground size-5 shrink-0" />
                <span className="text-sidebar-foreground truncate text-lg font-bold uppercase transition-opacity duration-200">
                  {appConfig.name}
                </span>
              </Link>

              {/* Collapse Toggle - Chevron */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleNavbar}
                    className="text-sidebar-foreground hover:bg-sidebar-accent size-6 shrink-0"
                  >
                    <ChevronLeft className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Navbar minimieren</TooltipContent>
              </Tooltip>
            </>
          )}
        </div>

        {/* App-Content Navigation (scrollbar) - nimmt verfügbaren Platz ein */}
        <ScrollArea className="min-h-0 flex-1">
          <nav className={cn("flex flex-col gap-1", navbarCollapsed ? "items-center px-1" : "p-1")}>
            {navigationConfig
              .filter((section) => section.id === "app-content")
              .map((section) => {
                if (!isVisible(section)) return null
                return (
                  <NavSectionComponent
                    key={section.id}
                    section={section}
                    collapsed={navbarCollapsed}
                    pathname={pathname}
                    isVisible={isVisible}
                    onLogout={handleLogout}
                  />
                )
              })}
          </nav>
        </ScrollArea>

        {/* About & Account (fixiert unten) - immer vollständig sichtbar */}
        <div className="border-sidebar-border shrink-0 border-t">
          {/* About Section */}
          {navigationConfig
            .filter((section) => section.id === "about")
            .map((section) => {
              if (!isVisible(section)) return null
              return (
                <nav
                  key={section.id}
                  className={cn(
                    "flex flex-col gap-1",
                    navbarCollapsed ? "items-center px-1 py-2" : "p-2"
                  )}
                >
                  <NavSectionComponent
                    section={section}
                    collapsed={navbarCollapsed}
                    pathname={pathname}
                    isVisible={isVisible}
                    onLogout={handleLogout}
                  />
                </nav>
              )
            })}

          {/* Separator über volle Breite */}
          <Separator />

          {/* Account Section */}
          {navigationConfig
            .filter((section) => section.id === "account")
            .map((section) => {
              if (!isVisible(section)) return null
              return (
                <nav
                  key={section.id}
                  className={cn(
                    "flex flex-col gap-1",
                    navbarCollapsed ? "items-center px-1 py-2" : "p-2"
                  )}
                >
                  <NavSectionComponent
                    section={section}
                    collapsed={navbarCollapsed}
                    pathname={pathname}
                    isVisible={isVisible}
                    onLogout={handleLogout}
                  />
                </nav>
              )
            })}
        </div>
      </div>
    </TooltipProvider>
  )
}

/**
 * Nav Section Komponente
 *
 * Rendert eine Navigations-Sektion mit optionalem Section Title:
 * - Section Title (nicht klickbar, nur Label) - wenn section.title gesetzt
 * - Darunter die Menüpunkte (Links oder Accordions)
 */
function NavSectionComponent({
  section,
  collapsed,
  pathname,
  isVisible,
  onLogout,
}: {
  section: NavSection
  collapsed: boolean
  pathname: string
  isVisible: IsVisibleFn
  onLogout: () => Promise<void>
}): React.ReactElement {
  return (
    <div className="flex flex-col gap-1">
      {/* Section Title (nicht klickbar) */}
      {section.title && !collapsed && (
        <div className="text-muted-foreground px-3 py-2 text-xs font-semibold tracking-wider uppercase">
          {section.title}
        </div>
      )}

      {/* Menüpunkte */}
      {section.items.map((item) => {
        // Item überspringen wenn nicht sichtbar für aktuelle Rolle
        if (!isVisible(item)) return null

        return (
          <NavItemComponent
            key={item.id}
            item={item}
            collapsed={collapsed}
            pathname={pathname}
            level={0}
            isVisible={isVisible}
            onLogout={onLogout}
          />
        )
      })}
    </div>
  )
}

/**
 * Nav Item Komponente
 *
 * Rendert einen einzelnen Navigations-Eintrag:
 * - Link (wenn href gesetzt)
 * - Accordion (wenn children vorhanden)
 * - Action Button (wenn isAction gesetzt)
 */
function NavItemComponent({
  item,
  collapsed,
  pathname,
  level,
  isVisible,
  onLogout,
}: {
  item: NavItem
  collapsed: boolean
  pathname: string
  level: number
  isVisible: IsVisibleFn
  onLogout: () => Promise<void>
}): React.ReactElement {
  // Filter children based on roles
  const visibleChildren = item.children?.filter((child) => isVisible(child))
  const hasChildren = visibleChildren && visibleChildren.length > 0
  const isActive = item.href === pathname
  const isChildActive = visibleChildren?.some((child) => child.href === pathname)

  // Standardmäßig expanded (aufgeklappt), außer für Account-Section Items "Design System" und "Layout Templates"
  // Diese sollen standardmäßig eingeklappt sein, es sei denn, ein Child ist aktiv
  const shouldDefaultCollapse =
    item.id === "account-design-system" || item.id === "account-layout-templates"
  const defaultOpen = !shouldDefaultCollapse

  // Track ob der Benutzer das Accordion manuell geöffnet hat (nicht durch aktives Child)
  const wasManuallyOpenedRef = useRef(false)
  const previousIsChildActiveRef = useRef(isChildActive)

  // Berechne isOpen: Wenn Child aktiv ist, immer geöffnet; sonst verwende manuellen State oder Default
  const [manualOpen, setManualOpen] = useState<boolean | null>(null)

  // Berechne finalen isOpen State basierend auf aktuellem Zustand
  const isOpen = isChildActive || (manualOpen ?? defaultOpen)

  // Aktualisiere Refs wenn sich isChildActive ändert (ohne Re-Render zu triggern)
  useEffect(() => {
    const previousIsChildActive = previousIsChildActiveRef.current

    if (isChildActive && !previousIsChildActive) {
      // Child wurde aktiv → merken dass es nicht mehr manuell geöffnet ist
      wasManuallyOpenedRef.current = false
    }

    previousIsChildActiveRef.current = isChildActive
  }, [isChildActive])

  // Wenn Child inaktiv wird und nicht manuell geöffnet wurde, zurück zum Default
  useEffect(() => {
    if (!isChildActive && previousIsChildActiveRef.current && !wasManuallyOpenedRef.current) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- This effect needs to sync state when isChildActive changes
      setManualOpen(null) // Zurück zum Default
    }
  }, [isChildActive])

  const Icon = item.icon

  // Collapsed Mode: Icon mit Tooltip (für Links) oder Dropdown (für Untermenüs)
  if (collapsed && level === 0) {
    // Item mit Children: Dropdown-Menü anzeigen
    if (hasChildren) {
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground size-10",
                isChildActive && "bg-sidebar-accent/50"
              )}
            >
              <Icon className="size-5 transition-transform duration-200" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="start" className="min-w-48">
            <DropdownMenuLabel>{item.label}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {visibleChildren?.map((child) => (
              <CollapsedDropdownItem
                key={child.id}
                item={child}
                pathname={pathname}
                isVisible={isVisible}
                onLogout={onLogout}
              />
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )
    }

    // Item ohne Children: Tooltip + Link
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          {item.href ? (
            <Link href={item.href}>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground size-10",
                  isActive && "bg-sidebar-accent text-sidebar-accent-foreground"
                )}
              >
                <Icon className="size-5 transition-transform duration-200" />
              </Button>
            </Link>
          ) : item.isAction ? (
            <Button
              variant="ghost"
              size="icon"
              className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground size-10"
              onClick={() => {
                if (item.id === "account-logout") onLogout()
              }}
            >
              <Icon className="size-5 transition-transform duration-200" />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground size-10"
            >
              <Icon className="size-5 transition-transform duration-200" />
            </Button>
          )}
        </TooltipTrigger>
        <TooltipContent side="right">{item.label}</TooltipContent>
      </Tooltip>
    )
  }

  // Expanded Mode: Accordion mit Children (mit Chevron)
  if (hasChildren) {
    return (
      <Collapsible
        open={isOpen}
        onOpenChange={(open) => {
          // Wenn ein Child aktiv ist, kann der Benutzer nicht schließen
          if (isChildActive && !open) {
            return
          }

          // Track manuelles Öffnen/Schließen durch Benutzer
          setManualOpen(open)
          wasManuallyOpenedRef.current = open
        }}
      >
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className={cn(
              "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground w-full justify-start gap-2",
              isChildActive && "bg-sidebar-accent/50",
              level > 0 && "pl-8"
            )}
          >
            <Icon className="size-4 shrink-0 transition-transform duration-200" />
            <span className="flex-1 truncate text-left text-sm font-medium transition-opacity duration-200">
              {item.label}
            </span>
            <ChevronRight
              className={cn(
                "size-4 shrink-0 transition-transform duration-200",
                isOpen && "rotate-90"
              )}
            />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pl-4">
          {visibleChildren?.map((child) => (
            <NavItemComponent
              key={child.id}
              item={child}
              collapsed={collapsed}
              pathname={pathname}
              level={level + 1}
              isVisible={isVisible}
              onLogout={onLogout}
            />
          ))}
        </CollapsibleContent>
      </Collapsible>
    )
  }

  // Leaf Item (kein Accordion)
  if (item.href) {
    return (
      <Link href={item.href}>
        <Button
          variant="ghost"
          className={cn(
            "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground w-full justify-start gap-2",
            isActive && "bg-sidebar-accent text-sidebar-accent-foreground",
            level > 0 && "pl-8"
          )}
        >
          <Icon className="size-4 shrink-0 transition-transform duration-200" />
          <span className="truncate text-sm transition-opacity duration-200">{item.label}</span>
        </Button>
      </Link>
    )
  }

  // Action Item (z.B. Logout)
  if (item.isAction) {
    const handleAction = () => {
      if (item.id === "account-logout") {
        onLogout()
      } else {
        console.log("Action:", item.id)
      }
    }

    return (
      <Button
        variant="ghost"
        className={cn(
          "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground w-full justify-start gap-2",
          level > 0 && "pl-8"
        )}
        onClick={handleAction}
      >
        <Icon className="size-4 shrink-0 transition-transform duration-200" />
        <span className="truncate text-sm transition-opacity duration-200">{item.label}</span>
      </Button>
    )
  }

  return null as never
}

/**
 * Collapsed Dropdown Item
 *
 * Rekursive Komponente für Dropdown-Menü-Items im collapsed State.
 * Unterstützt verschachtelte Untermenüs via DropdownMenuSub.
 */
function CollapsedDropdownItem({
  item,
  pathname,
  isVisible,
  onLogout,
}: {
  item: NavItem
  pathname: string
  isVisible: IsVisibleFn
  onLogout: () => Promise<void>
}): React.ReactElement | null {
  const visibleChildren = item.children?.filter((child) => isVisible(child))
  const hasChildren = visibleChildren && visibleChildren.length > 0
  const isActive = item.href === pathname
  const Icon = item.icon

  // Item mit verschachtelten Children: Sub-Menü
  if (hasChildren) {
    return (
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>
          <Icon className="size-4" />
          <span>{item.label}</span>
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent>
          {visibleChildren?.map((child) => (
            <CollapsedDropdownItem
              key={child.id}
              item={child}
              pathname={pathname}
              isVisible={isVisible}
              onLogout={onLogout}
            />
          ))}
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    )
  }

  // Direkter Link
  if (item.href) {
    return (
      <DropdownMenuItem asChild className={cn(isActive && "bg-accent")}>
        <Link href={item.href}>
          <Icon className="size-4" />
          <span>{item.label}</span>
        </Link>
      </DropdownMenuItem>
    )
  }

  // Action Item (z.B. Logout)
  if (item.isAction) {
    return (
      <DropdownMenuItem
        onClick={() => {
          if (item.id === "account-logout") onLogout()
        }}
      >
        <Icon className="size-4" />
        <span>{item.label}</span>
      </DropdownMenuItem>
    )
  }

  return null
}
