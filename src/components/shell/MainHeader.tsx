"use client"

import { type ReactNode } from "react"
import { PanelLeft, MessageSquare, BookOpen, MessageCircle, ShoppingCart } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

import { useShell, useAssist, type AssistPanelType } from "./shell-context"
import { Breadcrumbs } from "./Breadcrumbs"
import { AIInteractable } from "@/components/ai/AIInteractable"

/**
 * Assist Panel Button Konfiguration
 */
const assistButtons: {
  type: AssistPanelType
  icon: typeof MessageSquare
  label: string
}[] = [
  { type: "chat", icon: MessageSquare, label: "AI-Chat" },
  { type: "wiki", icon: BookOpen, label: "Wiki" },
  { type: "comments", icon: MessageCircle, label: "Kommentare" },
  { type: "cart", icon: ShoppingCart, label: "Warenkorb" },
]

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
  /** Assist-Buttons verstecken */
  hideAssistButtons?: boolean
}

/**
 * MainHeader Komponente
 *
 * Floating Header für die Main Area (Spalte 3).
 * - Links: Breadcrumbs (automatisch aus Route)
 * - Rechts: Toggle-Buttons für Assist-Panels (Spalte 4)
 *
 * Position: Fixed, schwebt über scrollbarem Content.
 */
export function MainHeader({
  className,
  leftContent,
  rightContent,
  hideBreadcrumbs = false,
  hideAssistButtons = false,
}: MainHeaderProps): React.ReactElement {
  const { navbarCollapsed, toggleNavbar } = useShell()
  const { isOpen: assistOpen, activePanel, toggle: toggleAssist } = useAssist()

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

        {/* Right Section: Custom Content + Assist Buttons */}
        <div className="flex items-center gap-2">
          {/* Additional Right Content */}
          {rightContent}

          {/* Assist Panel Buttons */}
          {!hideAssistButtons && (
            <div className="flex items-center gap-1">
              {assistButtons.map(({ type, icon: Icon, label }) => {
                const keywords: string[] =
                  type === "chat"
                    ? ["chat", "ki", "ai", "assistent", "hilfe", "help", "assist", "panel"]
                    : type === "wiki"
                      ? ["wiki", "dokumentation", "documentation", "hilfe", "help", "panel"]
                      : [type, label.toLowerCase()].filter((k): k is string => k !== null)

                return (
                  <Tooltip key={type}>
                    <TooltipTrigger asChild>
                      <AIInteractable
                        id={`toggle-assist-${type}`}
                        action="toggle"
                        target={`assist-${type}`}
                        description={`Öffnet oder schließt das ${label}-Panel`}
                        keywords={keywords}
                        category="layout"
                      >
                        <Button
                          variant={assistOpen && activePanel === type ? "secondary" : "ghost"}
                          size="icon"
                          onClick={() => toggleAssist(type)}
                          className="size-8"
                        >
                          <Icon className="size-4" />
                        </Button>
                      </AIInteractable>
                    </TooltipTrigger>
                    <TooltipContent>{label}</TooltipContent>
                  </Tooltip>
                )
              })}
            </div>
          )}
        </div>
      </header>
    </TooltipProvider>
  )
}
