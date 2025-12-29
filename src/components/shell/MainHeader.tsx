"use client"

import { type ReactNode } from "react"
import { PanelLeft } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

import { useShell } from "./shell-context"
import { Breadcrumbs } from "./Breadcrumbs"
import { UserAvatar } from "./UserAvatar"
import { AIInteractable } from "@/components/ai/AIInteractable"

/**
 * MainHeader Props
 */
interface MainHeaderProps {
  /** Zusätzliche CSS-Klassen */
  className?: string
  /** Zusätzlicher Content links (nach Breadcrumbs) */
  leftContent?: ReactNode
  /** Zusätzlicher Content rechts (vor Assist-Buttons) */
  rightContent?: ReactNode
  /** Breadcrumbs verstecken */
  hideBreadcrumbs?: boolean
}

/**
 * MainHeader Komponente
 *
 * Floating Header für die Main Area (Spalte 3).
 * - Links: Breadcrumbs (automatisch aus Route)
 * - Rechts: User Avatar (Dropdown-Menü)
 *
 * Position: Fixed, schwebt über scrollbarem Content.
 */
export function MainHeader({
  className,
  leftContent,
  rightContent,
  hideBreadcrumbs = false,
}: MainHeaderProps): React.ReactElement {
  const { navbarCollapsed, toggleNavbar } = useShell()

  return (
    <TooltipProvider delayDuration={0}>
      <header
        className={cn(
          "border-border bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10 flex items-center justify-between gap-4 border-b px-6 py-3 backdrop-blur",
          className
        )}
      >
        {/* Left Section: Toggle Button + Breadcrumbs */}
        <div className="flex items-center gap-3">
          {/* Navbar Toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <AIInteractable
                id="toggle-navbar"
                action="toggle"
                target="navbar"
                description="Klappt die Navigationsleiste ein oder aus"
                keywords={[
                  "navbar",
                  "navigation",
                  "sidebar",
                  "seitenleiste",
                  "menü",
                  "menu",
                  "einklappen",
                  "ausklappen",
                ]}
                category="layout"
              >
                <Button variant="ghost" size="icon" onClick={toggleNavbar} className="size-8">
                  <PanelLeft className={cn("size-4", navbarCollapsed && "text-muted-foreground")} />
                </Button>
              </AIInteractable>
            </TooltipTrigger>
            <TooltipContent>
              {navbarCollapsed ? "Navbar erweitern" : "Navbar minimieren"}
            </TooltipContent>
          </Tooltip>

          {/* Breadcrumbs */}
          {!hideBreadcrumbs && <Breadcrumbs />}

          {/* Additional Left Content */}
          {leftContent}
        </div>

        {/* Right Section: Custom Content + User Avatar */}
        <div className="flex items-center gap-2">
          {/* Additional Right Content */}
          {rightContent}

          {/* User Avatar */}
          <UserAvatar />
        </div>
      </header>
    </TooltipProvider>
  )
}
