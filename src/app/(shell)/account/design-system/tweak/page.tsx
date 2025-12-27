"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { PageContent, PageHeader } from "@/components/shell"
import { useExplorer } from "@/components/shell"
import { useTheme as useColorMode } from "next-themes"
import Color from "color"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { ColorPicker } from "@/components/ui/color-picker"
import { RotateCcw, Palette } from "lucide-react"
import { useTheme } from "@/lib/themes"
import { useThemeEditor } from "@/hooks/use-theme-editor"
import { ColorPairSwatch } from "@/components/theme/ColorPairSwatch"
import { FloatingToolbar } from "@/components/theme/FloatingToolbar"

/**
 * Konvertiert OKLCH zu Hex
 */
function oklchToHex(oklch: string): string {
  if (!oklch) return "#808080"
  if (oklch.startsWith("#")) return oklch
  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas")
    canvas.width = 1
    canvas.height = 1
    const ctx = canvas.getContext("2d")
    if (ctx) {
      ctx.fillStyle = oklch
      ctx.fillRect(0, 0, 1, 1)
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
      return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`
    }
  }
  return "#808080"
}

/**
 * Konvertiert Hex zu RGB-String
 */
function hexToRgb(hex: string): string {
  try {
    const c = Color(hex)
    const rgb = c.rgb().array()
    return `rgb(${Math.round(rgb[0])}, ${Math.round(rgb[1])}, ${Math.round(rgb[2])})`
  } catch {
    return "rgb(128, 128, 128)"
  }
}

/**
 * SingleColorSwatch - Einzelne Farbe (Border, Chart, etc.)
 * Layout: Rechteck LINKS, Beschreibung RECHTS
 * Verwendet ColorPicker für die Farbauswahl.
 */
function SingleColorSwatch({
  tokenName,
  name,
  description,
  variant = "filled",
}: {
  tokenName: string
  name: string
  description: string
  variant?: "filled" | "border" | "gradient"
}): React.ReactElement {
  const { previewToken, getCurrentTokens } = useThemeEditor()
  const { theme: colorMode, resolvedTheme } = useColorMode()
  const isDarkMode = colorMode === "dark" || (colorMode === "system" && resolvedTheme === "dark")

  const [hex, setHex] = useState("#808080")
  const [oklch, setOklch] = useState("")
  const [originalValue, setOriginalValue] = useState("")

  useEffect(() => {
    if (typeof window === "undefined") return
    const loadValue = () => {
      const tokens = getCurrentTokens()
      const token = tokens[tokenName] || { light: "", dark: "" }
      const currentValue = isDarkMode ? token.dark : token.light
      setHex(oklchToHex(currentValue))
      setOklch(currentValue)
      if (!originalValue) setOriginalValue(currentValue)
    }
    const timeout = setTimeout(loadValue, 50)
    return () => clearTimeout(timeout)
  }, [tokenName, getCurrentTokens, isDarkMode, originalValue])

  const handleChange = useCallback(
    (newHex: string) => {
      setHex(newHex)
      if (isDarkMode) {
        previewToken(tokenName, undefined, newHex)
      } else {
        previewToken(tokenName, newHex)
      }
    },
    [tokenName, previewToken, isDarkMode]
  )

  const handleReset = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      if (originalValue) {
        setHex(oklchToHex(originalValue))
        if (isDarkMode) {
          previewToken(tokenName, undefined, originalValue)
        } else {
          previewToken(tokenName, originalValue)
        }
      }
    },
    [tokenName, originalValue, previewToken, isDarkMode]
  )

  const getSwatchStyle = (): React.CSSProperties => {
    switch (variant) {
      case "border":
        return {
          borderColor: `var(${tokenName})`,
          borderWidth: "2px",
          borderRadius: "var(--radius)",
        }
      case "gradient":
        return {
          background: `linear-gradient(135deg, var(${tokenName}) 0%, var(${tokenName}) 60%, transparent 60%)`,
          backgroundColor: `var(${tokenName})`,
          borderRadius: "var(--radius)",
        }
      default:
        return {
          backgroundColor: `var(${tokenName})`,
          borderRadius: "var(--radius)",
        }
    }
  }

  return (
    <div className="flex items-start gap-6">
      {/* Swatch - LINKS */}
      <div className="group relative h-16 w-64 shrink-0">
        <ColorPicker value={hex} onChange={handleChange}>
          <div
            className="hover:ring-ring absolute inset-0 cursor-pointer rounded-lg border shadow-sm transition-all hover:ring-2"
            style={getSwatchStyle()}
          />
        </ColorPicker>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleReset}
          className="bg-background/80 hover:bg-background absolute top-2 right-2 z-20 size-6 rounded-full opacity-0 shadow-sm transition-opacity group-hover:opacity-100"
          title="Auf Original zurücksetzen"
        >
          <RotateCcw className="text-muted-foreground size-3" />
        </Button>
      </div>

      {/* Beschreibung - RECHTS (3 Zeilen) */}
      <div className="flex min-w-0 flex-1 flex-col py-1">
        <span className="text-foreground text-sm font-medium">{name}</span>
        <span className="text-muted-foreground truncate text-xs">{description}</span>
        <div className="text-muted-foreground flex gap-4 font-mono text-xs">
          <span title={oklch}>{oklch.substring(0, 25) || hex}</span>
          <span className="opacity-50">|</span>
          <span>{hexToRgb(hex)}</span>
        </div>
      </div>
    </div>
  )
}

/**
 * DisplaySwatch - Nur Anzeige (Radius, Shadow) ohne Farbpicker
 * Layout: Rechteck LINKS, Beschreibung RECHTS
 */
function DisplaySwatch({
  name,
  description,
  value,
  className,
  style,
}: {
  name: string
  description: string
  value: string
  className?: string
  style?: React.CSSProperties
}): React.ReactElement {
  return (
    <div className="flex items-start gap-6">
      {/* Swatch - LINKS */}
      <div className={`bg-card h-16 w-64 shrink-0 border ${className || ""}`} style={style} />

      {/* Beschreibung - RECHTS */}
      <div className="flex min-w-0 flex-1 flex-col py-1">
        <span className="text-foreground text-sm font-medium">{name}</span>
        <span className="text-muted-foreground truncate text-xs">{description}</span>
        <span className="text-muted-foreground font-mono text-xs">{value}</span>
      </div>
    </div>
  )
}

/**
 * Tweak the UI Seite
 */
export default function TweakPage(): React.ReactElement {
  const { theme: currentThemeId } = useTheme()
  const { theme: colorMode, resolvedTheme } = useColorMode()
  const { setOpen: setExplorerOpen } = useExplorer()
  const { isDirty, resetPreview, previewToken, getCurrentTokens } = useThemeEditor()

  const isDarkMode = colorMode === "dark" || (colorMode === "system" && resolvedTheme === "dark")

  // State
  const [radiusValue, setRadiusValue] = useState(0.5)
  const [spacingValue, setSpacingValue] = useState(0.25)
  const [letterSpacing, setLetterSpacing] = useState(0)
  const [hueShift, setHueShift] = useState(0)
  const [saturationMult, setSaturationMult] = useState(1.0)
  const [lightnessMult, setLightnessMult] = useState(1.0)

  // Debounce refs
  const globalAdjustTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => setExplorerOpen(false), 50)
    return () => clearTimeout(timer)
  }, [setExplorerOpen])

  // Lade aktuelle Werte
  useEffect(() => {
    if (typeof window === "undefined") return
    const updateValues = () => {
      const root = document.documentElement
      const computedStyle = window.getComputedStyle(root)

      const radiusStr = computedStyle.getPropertyValue("--radius").trim()
      if (radiusStr) {
        const match = radiusStr.match(/(\d+\.?\d*)/)
        if (match) setRadiusValue(parseFloat(match[1]) / 16)
      }

      const spacingStr = computedStyle.getPropertyValue("--spacing").trim()
      if (spacingStr) {
        const match = spacingStr.match(/(\d+\.?\d*)/)
        if (match) setSpacingValue(parseFloat(match[1]))
      }
    }
    const timeout = setTimeout(updateValues, 100)
    return () => clearTimeout(timeout)
  }, [currentThemeId])

  // Font-Namen
  const [fontNames, setFontNames] = useState<{
    sans: string
    mono: string
    serif: string
  }>({ sans: "", mono: "", serif: "" })

  useEffect(() => {
    if (typeof window === "undefined") return
    const extractFontName = (cssVar: string): string => {
      const root = document.documentElement
      const value = window.getComputedStyle(root).getPropertyValue(cssVar).trim()
      if (!value) return "nicht definiert"
      const firstFont = value.split(",")[0].trim().replace(/['"]/g, "")
      return firstFont || "Standard"
    }
    const timeout = setTimeout(() => {
      setFontNames({
        sans: extractFontName("--font-sans"),
        mono: extractFontName("--font-mono"),
        serif: extractFontName("--font-serif"),
      })
    }, 200)
    return () => clearTimeout(timeout)
  }, [currentThemeId])

  // Handler
  const handleRadiusChange = useCallback(
    (value: number[]) => {
      const rem = value[0]
      setRadiusValue(rem)
      previewToken("--radius", `${rem * 16}px`)
    },
    [previewToken]
  )

  const handleSpacingChange = useCallback(
    (value: number[]) => {
      const rem = value[0]
      setSpacingValue(rem)
      previewToken("--spacing", `${rem}rem`)
    },
    [previewToken]
  )

  // Harmonize Chart Colors
  const handleHarmonize = useCallback(() => {
    if (typeof window === "undefined") return
    const tokens = getCurrentTokens()
    const chart1Value = isDarkMode ? tokens["--chart-1"]?.dark : tokens["--chart-1"]?.light
    if (!chart1Value) return

    const match = chart1Value.match(/oklch\(([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\)/)
    if (!match) return

    const l = parseFloat(match[1])
    const c = parseFloat(match[2])
    const h = parseFloat(match[3])

    const hueSpacing = 72
    const chartTokens = ["--chart-2", "--chart-3", "--chart-4", "--chart-5"]

    chartTokens.forEach((token, index) => {
      const newHue = (h + (index + 1) * hueSpacing) % 360
      const newValue = `oklch(${l.toFixed(2)} ${c} ${newHue})`
      if (isDarkMode) {
        previewToken(token, undefined, newValue)
      } else {
        previewToken(token, newValue)
      }
    })
  }, [getCurrentTokens, previewToken, isDarkMode])

  // Global Adjustments
  const applyGlobalAdjustments = useCallback(
    (hue: number, sat: number, light: number) => {
      if (typeof window === "undefined") return

      const tokens = getCurrentTokens()
      const colorTokens = [
        "--primary",
        "--primary-foreground",
        "--secondary",
        "--secondary-foreground",
        "--background",
        "--foreground",
        "--card",
        "--card-foreground",
        "--popover",
        "--popover-foreground",
        "--muted",
        "--muted-foreground",
        "--accent",
        "--accent-foreground",
        "--destructive",
        "--destructive-foreground",
        "--border",
        "--input",
        "--ring",
        "--chart-1",
        "--chart-2",
        "--chart-3",
        "--chart-4",
        "--chart-5",
        "--sidebar",
        "--sidebar-foreground",
        "--sidebar-primary",
        "--sidebar-primary-foreground",
        "--sidebar-accent",
        "--sidebar-accent-foreground",
        "--sidebar-border",
        "--sidebar-ring",
      ]

      colorTokens.forEach((tokenName) => {
        const tokenValue = tokens[tokenName]
        if (!tokenValue) return

        const currentValue = isDarkMode ? tokenValue.dark : tokenValue.light
        const match = currentValue.match(/oklch\(([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\)/)
        if (!match) return

        const l = Math.max(0, Math.min(1, parseFloat(match[1]) * light))
        const c = Math.max(0, Math.min(0.4, parseFloat(match[2]) * sat))
        const h = (((parseFloat(match[3]) + hue) % 360) + 360) % 360

        const adjusted = `oklch(${l.toFixed(2)} ${c.toFixed(2)} ${h})`
        if (isDarkMode) {
          previewToken(tokenName, undefined, adjusted)
        } else {
          previewToken(tokenName, adjusted)
        }
      })
    },
    [getCurrentTokens, previewToken, isDarkMode]
  )

  const handleGlobalSliderChange = useCallback(
    (type: "hue" | "saturation" | "lightness", value: number[]) => {
      const val = value[0]
      if (type === "hue") setHueShift(val)
      else if (type === "saturation") setSaturationMult(val)
      else setLightnessMult(val)

      if (globalAdjustTimeoutRef.current) clearTimeout(globalAdjustTimeoutRef.current)
      globalAdjustTimeoutRef.current = setTimeout(() => {
        const h = type === "hue" ? val : hueShift
        const s = type === "saturation" ? val : saturationMult
        const l = type === "lightness" ? val : lightnessMult
        applyGlobalAdjustments(h, s, l)
      }, 100)
    },
    [hueShift, saturationMult, lightnessMult, applyGlobalAdjustments]
  )

  // Token-Daten mit Beschreibungen
  const coreColorPairs = [
    {
      token: "--background",
      foreground: "--foreground",
      name: "Background",
      description: "Haupt-Hintergrundfarbe der Anwendung",
    },
    {
      token: "--card",
      foreground: "--card-foreground",
      name: "Card",
      description: "Hintergrund für Card-Komponenten",
    },
    {
      token: "--popover",
      foreground: "--popover-foreground",
      name: "Popover",
      description: "Hintergrund für Popovers, Dropdowns, Tooltips",
    },
    {
      token: "--primary",
      foreground: "--primary-foreground",
      name: "Primary",
      description: "Primärfarbe für Buttons, Links, CTAs",
    },
    {
      token: "--secondary",
      foreground: "--secondary-foreground",
      name: "Secondary",
      description: "Sekundärfarbe für weniger prominente Aktionen",
    },
    {
      token: "--muted",
      foreground: "--muted-foreground",
      name: "Muted",
      description: "Gedämpfte Hintergründe, Badges, Labels",
    },
    {
      token: "--accent",
      foreground: "--accent-foreground",
      name: "Accent",
      description: "Hover-States, Highlights, ausgewählte Items",
    },
    {
      token: "--destructive",
      foreground: "--destructive-foreground",
      name: "Destructive",
      description: "Fehler, Löschen, destruktive Aktionen",
    },
  ]

  const borderTokens = [
    { token: "--border", name: "Border", description: "Standard-Border-Farbe für Trennlinien" },
    { token: "--input", name: "Input", description: "Border-Farbe für Input-Felder" },
    { token: "--ring", name: "Ring", description: "Focus-Ring für interaktive Elemente" },
  ]

  const chartTokens = [
    {
      token: "--chart-1",
      name: "Chart 1",
      description: "Erste Farbe in Diagrammen und Visualisierungen",
    },
    { token: "--chart-2", name: "Chart 2", description: "Zweite Farbe in Diagrammen" },
    { token: "--chart-3", name: "Chart 3", description: "Dritte Farbe in Diagrammen" },
    { token: "--chart-4", name: "Chart 4", description: "Vierte Farbe in Diagrammen" },
    { token: "--chart-5", name: "Chart 5", description: "Fünfte Farbe in Diagrammen" },
  ]

  const sidebarColorPairs = [
    {
      token: "--sidebar",
      foreground: "--sidebar-foreground",
      name: "Sidebar",
      description: "Hintergrund der Seitennavigation",
    },
    {
      token: "--sidebar-primary",
      foreground: "--sidebar-primary-foreground",
      name: "Sidebar Primary",
      description: "Aktive/ausgewählte Sidebar-Items",
    },
    {
      token: "--sidebar-accent",
      foreground: "--sidebar-accent-foreground",
      name: "Sidebar Accent",
      description: "Hover-State der Sidebar-Items",
    },
  ]

  const sidebarBorderTokens = [
    {
      token: "--sidebar-border",
      name: "Sidebar Border",
      description: "Border/Trennlinien in der Sidebar",
    },
    {
      token: "--sidebar-ring",
      name: "Sidebar Ring",
      description: "Focus-Ring für Sidebar-Elemente",
    },
  ]

  const radiusItems = [
    {
      class: "rounded-sm",
      name: "Small (sm)",
      description: "Kleine Elemente: Checkboxen, Badges",
      value: "calc(var(--radius) - 4px)",
    },
    {
      class: "rounded-md",
      name: "Medium (md)",
      description: "Standard für Buttons und Inputs",
      value: "calc(var(--radius) - 2px)",
    },
    {
      class: "rounded-lg",
      name: "Large (lg)",
      description: "Cards und Container",
      value: "var(--radius)",
    },
    {
      class: "rounded-xl",
      name: "Extra Large (xl)",
      description: "Große Panels und Modals",
      value: "calc(var(--radius) + 4px)",
    },
    {
      class: "rounded-full",
      name: "Full",
      description: "Avatare, Pills, runde Buttons",
      value: "9999px",
    },
  ]

  const shadowItems = [
    { class: "shadow-2xs", name: "2XS", description: "Minimaler Schatten für subtile Tiefe" },
    { class: "shadow-xs", name: "XS", description: "Sehr kleiner Schatten" },
    { class: "shadow-sm", name: "Small", description: "Leichte Elevation für Buttons" },
    { class: "shadow-md", name: "Medium", description: "Standard-Schatten für Cards" },
    { class: "shadow-lg", name: "Large", description: "Stärkere Elevation für Modals" },
    { class: "shadow-xl", name: "XL", description: "Hohe Elevation für Dialoge" },
    { class: "shadow-2xl", name: "2XL", description: "Maximaler Schatten für Overlays" },
  ]

  return (
    <PageContent>
      <PageHeader
        title="Tweak the UI"
        description="Passe Design-Tokens live an und speichere sie als neues Theme"
      />

      <div className="space-y-12 pb-24">
        {/* Core Theme Colors */}
        <section>
          <h2 className="text-foreground mb-6 text-xl font-semibold">Core Theme Colors</h2>
          <div className="space-y-4">
            {coreColorPairs.map((pair) => (
              <ColorPairSwatch
                key={pair.token}
                tokenName={pair.token}
                foregroundTokenName={pair.foreground}
                name={pair.name}
                description={pair.description}
              />
            ))}
          </div>
        </section>

        {/* Borders */}
        <section>
          <h2 className="text-foreground mb-6 text-xl font-semibold">Borders</h2>
          <div className="space-y-4">
            {borderTokens.map((token) => (
              <SingleColorSwatch
                key={token.token}
                tokenName={token.token}
                name={token.name}
                description={token.description}
                variant="border"
              />
            ))}
          </div>
        </section>

        {/* Chart Colors */}
        <section>
          <h2 className="text-foreground mb-6 text-xl font-semibold">Chart Colors</h2>
          <div className="mb-4">
            <Button variant="outline" size="sm" onClick={handleHarmonize}>
              <Palette className="mr-2 size-4" />
              Harmonize (72° Spacing)
            </Button>
          </div>
          <div className="space-y-4">
            {chartTokens.map((token) => (
              <SingleColorSwatch
                key={token.token}
                tokenName={token.token}
                name={token.name}
                description={token.description}
                variant="gradient"
              />
            ))}
          </div>
        </section>

        {/* Sidebar Colors */}
        <section>
          <h2 className="text-foreground mb-6 text-xl font-semibold">Sidebar Colors</h2>
          <div className="space-y-4">
            {sidebarColorPairs.map((pair) => (
              <ColorPairSwatch
                key={pair.token}
                tokenName={pair.token}
                foregroundTokenName={pair.foreground}
                name={pair.name}
                description={pair.description}
              />
            ))}
          </div>
          <div className="mt-4 space-y-4">
            {sidebarBorderTokens.map((token) => (
              <SingleColorSwatch
                key={token.token}
                tokenName={token.token}
                name={token.name}
                description={token.description}
                variant="border"
              />
            ))}
          </div>
        </section>

        {/* Radius & Spacing */}
        <section>
          <h2 className="text-foreground mb-6 text-xl font-semibold">Radius & Spacing</h2>

          {/* Radius Slider */}
          <div className="mb-6 w-96 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">--radius</Label>
              <span className="text-muted-foreground font-mono text-xs">
                {radiusValue.toFixed(2)}rem ({Math.round(radiusValue * 16)}px)
              </span>
            </div>
            <Slider
              value={[radiusValue]}
              onValueChange={handleRadiusChange}
              min={0}
              max={2}
              step={0.125}
            />
          </div>

          {/* Radius Previews */}
          <div className="space-y-4">
            {radiusItems.map((item) => (
              <DisplaySwatch
                key={item.class}
                name={item.name}
                description={item.description}
                value={item.value}
                className={`bg-primary ${item.class}`}
              />
            ))}
          </div>

          {/* Spacing Slider */}
          <div className="mt-8 w-96 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">--spacing</Label>
              <span className="text-muted-foreground font-mono text-xs">
                {spacingValue.toFixed(2)}rem
              </span>
            </div>
            <Slider
              value={[spacingValue]}
              onValueChange={handleSpacingChange}
              min={0}
              max={1}
              step={0.01}
            />
          </div>
        </section>

        {/* Typography */}
        <section>
          <h2 className="text-foreground mb-6 text-xl font-semibold">Typografie</h2>

          {/* Letter Spacing Slider */}
          <div className="mb-6 w-96 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Letter Spacing</Label>
              <span className="text-muted-foreground font-mono text-xs">
                {letterSpacing > 0 ? "+" : ""}
                {letterSpacing.toFixed(2)}em
              </span>
            </div>
            <Slider
              value={[letterSpacing]}
              onValueChange={(v) => setLetterSpacing(v[0])}
              min={-0.1}
              max={0.2}
              step={0.01}
            />
          </div>

          {/* Font Previews */}
          <div className="space-y-4">
            <div className="flex items-start gap-6">
              <div
                className="h-16 w-64 shrink-0 font-sans text-2xl leading-[64px] font-semibold"
                style={{ letterSpacing: `${letterSpacing}em` }}
              >
                Aa Bb Cc Dd Ee
              </div>
              <div className="flex min-w-0 flex-1 flex-col py-1">
                <span className="text-foreground text-sm font-medium">Sans ({fontNames.sans})</span>
                <span className="text-muted-foreground text-xs">
                  Hauptschrift für UI-Text und Überschriften
                </span>
                <span className="text-muted-foreground font-mono text-xs">--font-sans</span>
              </div>
            </div>
            <div className="flex items-start gap-6">
              <div
                className="h-16 w-64 shrink-0 font-mono text-2xl leading-[64px] font-semibold"
                style={{ letterSpacing: `${letterSpacing}em` }}
              >
                Aa Bb Cc Dd Ee
              </div>
              <div className="flex min-w-0 flex-1 flex-col py-1">
                <span className="text-foreground text-sm font-medium">Mono ({fontNames.mono})</span>
                <span className="text-muted-foreground text-xs">
                  Code-Blöcke, technische Werte, Keyboard-Shortcuts
                </span>
                <span className="text-muted-foreground font-mono text-xs">--font-mono</span>
              </div>
            </div>
            <div className="flex items-start gap-6">
              <div
                className="h-16 w-64 shrink-0 text-2xl leading-[64px] font-semibold"
                style={{ fontFamily: "var(--font-serif)", letterSpacing: `${letterSpacing}em` }}
              >
                Aa Bb Cc Dd Ee
              </div>
              <div className="flex min-w-0 flex-1 flex-col py-1">
                <span className="text-foreground text-sm font-medium">
                  Serif ({fontNames.serif})
                </span>
                <span className="text-muted-foreground text-xs">
                  Längere Texte, Artikel, Zitate
                </span>
                <span className="text-muted-foreground font-mono text-xs">--font-serif</span>
              </div>
            </div>
          </div>
        </section>

        {/* Shadows */}
        <section>
          <h2 className="text-foreground mb-6 text-xl font-semibold">Schatten</h2>
          <div className="space-y-4">
            {shadowItems.map((item) => (
              <DisplaySwatch
                key={item.class}
                name={item.name}
                description={item.description}
                value={item.class}
                className={`rounded-lg ${item.class}`}
              />
            ))}
          </div>
        </section>

        {/* Global Adjustments */}
        <section>
          <h2 className="text-foreground mb-6 text-xl font-semibold">Global Adjustments</h2>
          <p className="text-muted-foreground mb-6 text-sm">
            Master-Slider für alle Farben gleichzeitig
          </p>

          <div className="w-96 space-y-6">
            {/* Hue Shift */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Hue-Shift</Label>
                <span className="text-muted-foreground font-mono text-xs">
                  {hueShift > 0 ? "+" : ""}
                  {hueShift}°
                </span>
              </div>
              <Slider
                value={[hueShift]}
                onValueChange={(v) => handleGlobalSliderChange("hue", v)}
                min={-180}
                max={180}
                step={1}
              />
            </div>

            {/* Saturation */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Saturation</Label>
                <span className="text-muted-foreground font-mono text-xs">
                  {saturationMult.toFixed(2)}x
                </span>
              </div>
              <Slider
                value={[saturationMult]}
                onValueChange={(v) => handleGlobalSliderChange("saturation", v)}
                min={0}
                max={2}
                step={0.01}
              />
            </div>

            {/* Lightness */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Lightness</Label>
                <span className="text-muted-foreground font-mono text-xs">
                  {lightnessMult.toFixed(2)}x
                </span>
              </div>
              <Slider
                value={[lightnessMult]}
                onValueChange={(v) => handleGlobalSliderChange("lightness", v)}
                min={0.5}
                max={1.5}
                step={0.01}
              />
            </div>
          </div>
        </section>
      </div>

      <FloatingToolbar isDirty={isDirty} onReset={resetPreview} />
    </PageContent>
  )
}
