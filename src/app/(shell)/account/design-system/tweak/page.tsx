"use client"

import { useState, useEffect } from "react"
import { PageContent, PageHeader } from "@/components/shell"
import { useExplorer } from "@/components/shell"
import { useTheme as useColorMode } from "next-themes"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useTheme } from "@/lib/themes"
import { TokenEditor } from "@/components/theme/TokenEditor"

/**
 * Tweak the UI Seite
 *
 * Zeigt alle Design-Tokens des aktiven Themes und ermöglicht Live-Editing.
 * Änderungen werden als temporäre Inline-Styles angezeigt und können als neues Theme gespeichert werden.
 */
export default function TweakPage(): React.ReactElement {
  const { theme: currentThemeId } = useTheme()
  const { theme: colorMode, resolvedTheme } = useColorMode()
  const { setOpen: setExplorerOpen } = useExplorer()

  // Warte auf Client-Mount, um Hydration-Mismatch zu vermeiden
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Notwendig für Hydration-Safety
    setMounted(true)
  }, [])

  // Font-Namen State
  const [fontNames, setFontNames] = useState<{
    sans: { name: string; isFallback: boolean }
    mono: { name: string; isFallback: boolean }
    serif: { name: string; isFallback: boolean }
  }>({
    sans: { name: "", isFallback: false },
    mono: { name: "", isFallback: false },
    serif: { name: "", isFallback: false },
  })

  // Explorer für diese Seite deaktivieren
  useEffect(() => {
    const timer = setTimeout(() => {
      setExplorerOpen(false)
    }, 50)
    return () => clearTimeout(timer)
  }, [setExplorerOpen])

  // Lade Schriftnamen aus CSS-Variablen
  useEffect(() => {
    // Skip on server
    if (typeof window === "undefined") return

    const genericFonts = [
      "sans-serif",
      "serif",
      "monospace",
      "system-ui",
      "ui-sans-serif",
      "ui-serif",
      "ui-monospace",
    ]

    const extractFontInfo = (cssVar: string): { name: string; isFallback: boolean } => {
      const root = document.documentElement
      const computedStyle = window.getComputedStyle(root)
      const value = computedStyle.getPropertyValue(cssVar).trim()

      if (!value) {
        return { name: "nicht definiert", isFallback: true }
      }

      const firstFont = value.split(",")[0].trim().replace(/['"]/g, "")
      const isGeneric = !firstFont || genericFonts.includes(firstFont.toLowerCase())

      let isFontLoaded = false
      if (firstFont && !isGeneric) {
        try {
          isFontLoaded = document.fonts.check(`16px "${firstFont}"`)
        } catch {
          isFontLoaded = false
        }
      }

      return {
        name: !firstFont || isGeneric ? "Standard" : firstFont,
        isFallback: isGeneric || (!isFontLoaded && !!firstFont),
      }
    }

    const updateFontNames = () => {
      setFontNames({
        sans: extractFontInfo("--font-sans"),
        mono: extractFontInfo("--font-mono"),
        serif: extractFontInfo("--font-serif"),
      })
    }

    const timeoutId = setTimeout(() => {
      if (document.fonts?.ready) {
        document.fonts.ready.then(updateFontNames)
      } else {
        updateFontNames()
      }
    }, 200)

    return () => clearTimeout(timeoutId)
  }, [currentThemeId])

  // Dark Mode ist aktiv wenn:
  // - colorMode explizit "dark" ist, ODER
  // - colorMode "system" ist UND das System Dark Mode verwendet (resolvedTheme === "dark")
  // Während SSR (mounted === false) verwenden wir einen sicheren Fallback
  const isDarkMode = mounted
    ? colorMode === "dark" || (colorMode === "system" && resolvedTheme === "dark")
    : false

  return (
    <PageContent>
      <PageHeader
        title="Tweak the UI"
        description="Passe Design-Tokens live an und speichere sie als neues Theme"
      />

      <div className="space-y-8">
        {/* Farbsystem */}
        <Card>
          <CardHeader>
            <CardTitle>Farbsystem</CardTitle>
            <CardDescription>Alle Design-Tokens des aktiven Themes im Überblick</CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            {/* Hauptfarben als Kreise */}
            <div className="flex flex-wrap gap-6">
              <div className="flex flex-col items-center gap-2">
                <div className="bg-primary size-12 rounded-full border shadow-sm" />
                <span className="text-muted-foreground text-xs">Primary</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="bg-foreground size-12 rounded-full border shadow-sm" />
                <span className="text-muted-foreground text-xs">Foreground</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="bg-muted-foreground size-12 rounded-full border shadow-sm" />
                <span className="text-muted-foreground text-xs">Muted FG</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="bg-border size-12 rounded-full border shadow-sm" />
                <span className="text-muted-foreground text-xs">Border</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="bg-background size-12 rounded-full border shadow-sm" />
                <span className="text-muted-foreground text-xs">Background</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="bg-destructive size-12 rounded-full border shadow-sm" />
                <span className="text-muted-foreground text-xs">Destructive</span>
              </div>
            </div>

            {/* Farbpaletten mit Verläufen */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {/* Brand/Primary */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Brand</h4>
                <div className="space-y-1">
                  <div className="bg-primary text-primary-foreground flex items-center justify-between rounded-md px-3 py-2">
                    <span className="text-xs font-medium">Primary</span>
                    <span className="text-xs opacity-70">FG</span>
                  </div>
                  <div className="bg-primary/80 text-primary-foreground flex items-center justify-between rounded-md px-3 py-2">
                    <span className="text-xs">80%</span>
                  </div>
                  <div className="bg-primary/60 text-primary-foreground flex items-center justify-between rounded-md px-3 py-2">
                    <span className="text-xs">60%</span>
                  </div>
                  <div className="bg-primary/40 flex items-center justify-between rounded-md px-3 py-2">
                    <span className="text-xs">40%</span>
                  </div>
                  <div className="bg-primary/20 flex items-center justify-between rounded-md px-3 py-2">
                    <span className="text-xs">20%</span>
                  </div>
                </div>
              </div>

              {/* Neutral */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Neutral</h4>
                <div className="space-y-1">
                  <div className="bg-foreground text-background flex items-center justify-between rounded-md px-3 py-2">
                    <span className="text-xs font-medium">Foreground</span>
                  </div>
                  <div className="bg-muted-foreground text-background flex items-center justify-between rounded-md px-3 py-2">
                    <span className="text-xs">Muted FG</span>
                  </div>
                  <div className="bg-border flex items-center justify-between rounded-md px-3 py-2">
                    <span className="text-xs">Border</span>
                  </div>
                  <div className="bg-muted text-muted-foreground flex items-center justify-between rounded-md px-3 py-2">
                    <span className="text-xs">Muted</span>
                  </div>
                  <div className="bg-background text-foreground flex items-center justify-between rounded-md border px-3 py-2">
                    <span className="text-xs">Background</span>
                  </div>
                </div>
              </div>

              {/* Status */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Status</h4>
                <div className="space-y-1">
                  <div className="bg-destructive text-destructive-foreground flex items-center justify-between rounded-md px-3 py-2">
                    <span className="text-xs font-medium">Destructive</span>
                  </div>
                  <div className="bg-destructive/80 text-destructive-foreground flex items-center justify-between rounded-md px-3 py-2">
                    <span className="text-xs">80%</span>
                  </div>
                  <div className="bg-destructive/60 flex items-center justify-between rounded-md px-3 py-2">
                    <span className="text-xs">60%</span>
                  </div>
                  <div className="bg-destructive/40 flex items-center justify-between rounded-md px-3 py-2">
                    <span className="text-xs">40%</span>
                  </div>
                  <div className="bg-destructive/20 flex items-center justify-between rounded-md px-3 py-2">
                    <span className="text-xs">20%</span>
                  </div>
                </div>
              </div>

              {/* Charts */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Charts</h4>
                <div className="space-y-1">
                  <div className="bg-chart-1 flex items-center justify-between rounded-md px-3 py-2 text-white">
                    <span className="text-xs font-medium">Chart 1</span>
                  </div>
                  <div className="bg-chart-2 flex items-center justify-between rounded-md px-3 py-2 text-white">
                    <span className="text-xs">Chart 2</span>
                  </div>
                  <div className="bg-chart-3 flex items-center justify-between rounded-md px-3 py-2 text-white">
                    <span className="text-xs">Chart 3</span>
                  </div>
                  <div className="bg-chart-4 flex items-center justify-between rounded-md px-3 py-2 text-white">
                    <span className="text-xs">Chart 4</span>
                  </div>
                  <div className="bg-chart-5 flex items-center justify-between rounded-md px-3 py-2 text-white">
                    <span className="text-xs">Chart 5</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Interaktive Farben */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Interaktiv</h4>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                <div className="bg-secondary text-secondary-foreground rounded-md px-3 py-2 text-center">
                  <span className="text-xs">Secondary</span>
                </div>
                <div className="bg-accent text-accent-foreground rounded-md px-3 py-2 text-center">
                  <span className="text-xs">Accent</span>
                </div>
                <div className="bg-card text-card-foreground rounded-md border px-3 py-2 text-center">
                  <span className="text-xs">Card</span>
                </div>
                <div className="bg-popover text-popover-foreground rounded-md border px-3 py-2 text-center">
                  <span className="text-xs">Popover</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Typografie */}
        <Card>
          <CardHeader>
            <CardTitle>Typografie</CardTitle>
            <CardDescription>Die Schriftarten des aktiven Themes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              {/* Sans */}
              <div className="bg-muted/30 space-y-2 rounded-lg border p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                    Sans
                  </span>
                  {fontNames.sans.isFallback ? (
                    <span className="text-destructive truncate text-sm font-semibold line-through">
                      {fontNames.sans.name || "..."}
                    </span>
                  ) : (
                    <span className="text-foreground truncate text-sm font-semibold">
                      {fontNames.sans.name || "..."}
                    </span>
                  )}
                </div>
                <div className="font-sans text-2xl font-semibold">Aa Bb Cc Dd</div>
                <div className="font-sans text-sm">ABCDEFGHIJKLMNOPQRSTUVWXYZ</div>
                <div className="font-sans text-sm">abcdefghijklmnopqrstuvwxyz</div>
                <div className="font-sans text-sm">0123456789</div>
                <div className="text-muted-foreground mt-2 text-xs">
                  Hauptschrift für Fließtext und UI-Elemente
                </div>
              </div>

              {/* Mono */}
              <div className="bg-muted/30 space-y-2 rounded-lg border p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                    Mono
                  </span>
                  {fontNames.mono.isFallback ? (
                    <span className="text-destructive truncate text-sm font-semibold line-through">
                      {fontNames.mono.name || "..."}
                    </span>
                  ) : (
                    <span className="text-foreground truncate text-sm font-semibold">
                      {fontNames.mono.name || "..."}
                    </span>
                  )}
                </div>
                <div className="font-mono text-2xl font-semibold">Aa Bb Cc Dd</div>
                <div className="font-mono text-sm">ABCDEFGHIJKLMNOPQRSTUVWXYZ</div>
                <div className="font-mono text-sm">abcdefghijklmnopqrstuvwxyz</div>
                <div className="font-mono text-sm">0123456789</div>
                <div className="text-muted-foreground mt-2 text-xs">
                  Code, technische Daten, Terminals
                </div>
              </div>

              {/* Serif */}
              <div className="bg-muted/30 space-y-2 rounded-lg border p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                    Serif
                  </span>
                  {fontNames.serif.isFallback ? (
                    <span className="text-destructive truncate text-sm font-semibold line-through">
                      {fontNames.serif.name || "..."}
                    </span>
                  ) : (
                    <span className="text-foreground truncate text-sm font-semibold">
                      {fontNames.serif.name || "..."}
                    </span>
                  )}
                </div>
                <div style={{ fontFamily: "var(--font-serif)" }} className="text-2xl font-semibold">
                  Aa Bb Cc Dd
                </div>
                <div style={{ fontFamily: "var(--font-serif)" }} className="text-sm">
                  ABCDEFGHIJKLMNOPQRSTUVWXYZ
                </div>
                <div style={{ fontFamily: "var(--font-serif)" }} className="text-sm">
                  abcdefghijklmnopqrstuvwxyz
                </div>
                <div style={{ fontFamily: "var(--font-serif)" }} className="text-sm">
                  0123456789
                </div>
                <div className="text-muted-foreground mt-2 text-xs">
                  Überschriften, Editorial, Akzente
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Rundungen */}
        <Card>
          <CardHeader>
            <CardTitle>Rundungen</CardTitle>
            <CardDescription>Border Radius Varianten basierend auf --radius</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex flex-col items-center gap-2">
                <div className="bg-primary size-16 rounded-sm" />
                <span className="text-muted-foreground text-xs">sm</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="bg-primary size-16 rounded-md" />
                <span className="text-muted-foreground text-xs">md</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="bg-primary size-16 rounded-lg" />
                <span className="text-muted-foreground text-xs">lg</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="bg-primary size-16 rounded-xl" />
                <span className="text-muted-foreground text-xs">xl</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="bg-primary size-16 rounded-full" />
                <span className="text-muted-foreground text-xs">full</span>
              </div>
            </div>
            <p className="text-muted-foreground text-xs">
              Basis: <code className="bg-muted rounded px-1 py-0.5">--radius</code> · Die Stufen
              werden automatisch berechnet (sm = radius-4px, md = radius-2px, lg = radius)
            </p>
          </CardContent>
        </Card>

        {/* Schatten */}
        <Card>
          <CardHeader>
            <CardTitle>Schatten</CardTitle>
            <CardDescription>Shadow-Varianten für Tiefeneffekte</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
              <div className="bg-card flex h-24 items-center justify-center rounded-lg shadow-xs">
                <span className="text-muted-foreground text-xs">xs</span>
              </div>
              <div className="bg-card flex h-24 items-center justify-center rounded-lg shadow-sm">
                <span className="text-muted-foreground text-xs">sm</span>
              </div>
              <div className="bg-card flex h-24 items-center justify-center rounded-lg shadow-md">
                <span className="text-muted-foreground text-xs">md</span>
              </div>
              <div className="bg-card flex h-24 items-center justify-center rounded-lg shadow-lg">
                <span className="text-muted-foreground text-xs">lg</span>
              </div>
              <div className="bg-card flex h-24 items-center justify-center rounded-lg shadow-xl">
                <span className="text-muted-foreground text-xs">xl</span>
              </div>
              <div className="bg-card flex h-24 items-center justify-center rounded-lg shadow-2xl">
                <span className="text-muted-foreground text-xs">2xl</span>
              </div>
            </div>
            <p className="text-muted-foreground text-xs">
              Schatten passen sich automatisch an Light/Dark Mode an
            </p>
          </CardContent>
        </Card>

        {/* Token Editor */}
        <TokenEditor />
      </div>
    </PageContent>
  )
}
