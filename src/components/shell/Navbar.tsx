"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
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
import { navigationConfig, type NavItem, type NavSection } from "@/config/navigation"
import { AIInteractable } from "@/components/ai/AIInteractable"
import { AppNameMenu } from "./AppNameMenu"

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
  const { navbarCollapsed } = useShell()
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
        {/* App Name Header - mit optionalem Admin-Dropdown (fixiert oben) */}
        <div
          className={cn(
            "flex h-14 shrink-0 items-center",
            navbarCollapsed ? "justify-center px-1" : "justify-between px-4"
          )}
        >
          <AppNameMenu collapsed={navbarCollapsed} />
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
                    user={user}
                  />
                )
              })}
          </nav>
        </ScrollArea>

        {/* About Section (fixiert unten) - immer sichtbar */}
        <div className="border-sidebar-border shrink-0 border-t">
          {navigationConfig
            .filter((section) => section.id === "about")
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
                  user={user}
                />
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
  user,
}: {
  section: NavSection
  collapsed: boolean
  pathname: string
  isVisible: IsVisibleFn
  onLogout: () => Promise<void>
  user: { name?: string; email?: string } | null
}): React.ReactElement {
  return (
    <div className="flex flex-col gap-1">
      {/* Section Title (nicht klickbar) */}
      {section.title && !collapsed && (
        <div className="text-muted-foreground pt-2 pr-1 pb-2 pl-2 text-xs font-semibold tracking-wider uppercase">
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
            user={user}
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
  user,
}: {
  item: NavItem
  collapsed: boolean
  pathname: string
  level: number
  isVisible: IsVisibleFn
  onLogout: () => Promise<void>
  user: { name?: string; email?: string } | null
}): React.ReactElement | null {
  // Filter children based on roles
  const visibleChildren = item.children?.filter((child) => isVisible(child))
  const hasChildren = visibleChildren && visibleChildren.length > 0
  const isActive = item.href === pathname
  const isChildActive = visibleChildren?.some((child) => child.href === pathname) ?? false

  // Standardmäßig expanded (aufgeklappt), außer für Account-Section Items "Design System" und "Layout Templates"
  // Diese sollen standardmäßig eingeklappt sein, es sei denn, ein Child ist aktiv
  const shouldDefaultCollapse =
    item.id === "account-design-system" || item.id === "account-layout-templates"
  const defaultOpen = !shouldDefaultCollapse

  // Track ob der Benutzer das Accordion manuell geöffnet hat (nicht durch aktives Child)
  const wasManuallyOpenedRef = useRef(false)
  const previousIsChildActiveRef = useRef<boolean | null>(null)

  // Berechne isOpen: Wenn Child aktiv ist, immer geöffnet; sonst verwende manuellen State oder Default
  const [manualOpen, setManualOpen] = useState<boolean | null>(null)

  // Berechne finalen isOpen State basierend auf aktuellem Zustand
  const isOpen = isChildActive || (manualOpen ?? defaultOpen)

  // Reagiere auf Änderungen von isChildActive
  // Wichtig: previousIsChildActiveRef wird mit null initialisiert, um den ersten Render zu erkennen
  useEffect(() => {
    const previousIsChildActive = previousIsChildActiveRef.current

    // Beim ersten Render nur den Wert speichern, keine Logik ausführen
    if (previousIsChildActive === null) {
      previousIsChildActiveRef.current = isChildActive
      return
    }

    // Child wurde aktiv → merken dass es nicht mehr manuell geöffnet ist
    if (isChildActive && !previousIsChildActive) {
      wasManuallyOpenedRef.current = false
    }

    // Child wurde inaktiv und war nicht manuell geöffnet → zurück zum Default
    if (!isChildActive && previousIsChildActive && !wasManuallyOpenedRef.current) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- This effect needs to sync state when isChildActive changes
      setManualOpen(null)
    }

    // Aktualisiere den vorherigen Wert für den nächsten Render
    previousIsChildActiveRef.current = isChildActive
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
    const keywords = [
      item.label.toLowerCase(),
      item.label.toLowerCase().replace(/\s+/g, "-"),
      item.id.toLowerCase(),
    ]

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          {item.href ? (
            <AIInteractable
              id={`nav-${item.id}`}
              action="navigate"
              target={item.href}
              description={`Navigiert zu ${item.label}`}
              keywords={keywords}
              category="navigation"
            >
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
            </AIInteractable>
          ) : item.isAction ? (
            <AIInteractable
              id={`nav-${item.id}`}
              action="trigger"
              target={item.id}
              description={item.label}
              keywords={keywords}
              category="navigation"
            >
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
            </AIInteractable>
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
              user={user}
            />
          ))}
        </CollapsibleContent>
      </Collapsible>
    )
  }

  // Leaf Item (kein Accordion)
  if (item.href) {
    // Für "User Details" (account-profile): Zeige den Namen des angemeldeten Users
    const displayLabel =
      item.id === "account-profile" && user
        ? user.name || user.email?.split("@")[0] || "User"
        : item.label

    // Generiere Keywords aus Label (DE + EN)
    const keywords = [
      item.label.toLowerCase(),
      item.label.toLowerCase().replace(/\s+/g, "-"),
      item.id.toLowerCase(),
    ]

    return (
      <AIInteractable
        id={`nav-${item.id}`}
        action="navigate"
        target={item.href}
        description={`Navigiert zu ${item.label}`}
        keywords={keywords}
        category="navigation"
      >
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
            <span className="truncate text-sm transition-opacity duration-200">{displayLabel}</span>
          </Button>
        </Link>
      </AIInteractable>
    )
  }

  // Action Item (z.B. Logout)
  if (item.isAction) {
    const handleAction = () => {
      if (item.id === "account-logout") {
        onLogout()
      }
      // Andere Actions können hier bei Bedarf implementiert werden
    }

    // Generiere Keywords aus Label
    const keywords = [
      item.label.toLowerCase(),
      item.label.toLowerCase().replace(/\s+/g, "-"),
      item.id.toLowerCase(),
    ]

    return (
      <AIInteractable
        id={`nav-${item.id}`}
        action="trigger"
        target={item.id}
        description={item.label}
        keywords={keywords}
        category="navigation"
      >
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
      </AIInteractable>
    )
  }

  return null
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
    const keywords = [
      item.label.toLowerCase(),
      item.label.toLowerCase().replace(/\s+/g, "-"),
      item.id.toLowerCase(),
    ]

    return (
      <DropdownMenuItem asChild className={cn(isActive && "bg-accent")}>
        <AIInteractable
          id={`nav-${item.id}`}
          action="navigate"
          target={item.href}
          description={`Navigiert zu ${item.label}`}
          keywords={keywords}
          category="navigation"
        >
          <Link href={item.href}>
            <Icon className="size-4" />
            <span>{item.label}</span>
          </Link>
        </AIInteractable>
      </DropdownMenuItem>
    )
  }

  // Action Item (z.B. Logout)
  if (item.isAction) {
    const keywords = [
      item.label.toLowerCase(),
      item.label.toLowerCase().replace(/\s+/g, "-"),
      item.id.toLowerCase(),
    ]

    return (
      <DropdownMenuItem asChild>
        <AIInteractable
          id={`nav-${item.id}`}
          action="trigger"
          target={item.id}
          description={item.label}
          keywords={keywords}
          category="navigation"
        >
          <div
            onClick={() => {
              if (item.id === "account-logout") onLogout()
            }}
            className="flex items-center gap-2"
          >
            <Icon className="size-4" />
            <span>{item.label}</span>
          </div>
        </AIInteractable>
      </DropdownMenuItem>
    )
  }

  return null
}
