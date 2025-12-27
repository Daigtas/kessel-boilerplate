"use client"

import { useState, useEffect, useCallback } from "react"
import { RotateCcw } from "lucide-react"
import { useTheme as useColorMode } from "next-themes"
import Color from "color"
import { Button } from "@/components/ui/button"
import { ColorPicker } from "@/components/ui/color-picker"
import { useThemeEditor } from "@/hooks/use-theme-editor"

interface ColorPairSwatchProps {
  /** Token-Name für Background (z.B. "--primary") */
  tokenName: string
  /** Token-Name für Foreground (z.B. "--primary-foreground") */
  foregroundTokenName: string
  /** Name für die Anzeige */
  name: string
  /** Beschreibung wo/wie verwendet */
  description: string
}

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
 * ColorPairSwatch - Zeigt ein Farbpaar als breites Rechteck (256×64)
 *
 * Layout: Rechteck LINKS, Beschreibung RECHTS (3 Zeilen)
 *
 * Verwendet ColorPicker für die Farbauswahl.
 */
export function ColorPairSwatch({
  tokenName,
  foregroundTokenName,
  name,
  description,
}: ColorPairSwatchProps): React.ReactElement {
  const { previewToken, getCurrentTokens } = useThemeEditor()
  const { theme: colorMode, resolvedTheme } = useColorMode()

  const isDarkMode = colorMode === "dark" || (colorMode === "system" && resolvedTheme === "dark")

  // Aktuelle Werte
  const [bgHex, setBgHex] = useState("#808080")
  const [fgHex, setFgHex] = useState("#808080")
  const [bgOklch, setBgOklch] = useState("")

  // Original-Werte (für Reset)
  const [originalBg, setOriginalBg] = useState<{ light: string; dark: string }>({
    light: "",
    dark: "",
  })
  const [originalFg, setOriginalFg] = useState<{ light: string; dark: string }>({
    light: "",
    dark: "",
  })

  // Lade initiale Werte
  useEffect(() => {
    if (typeof window === "undefined") return

    const loadValues = () => {
      const tokens = getCurrentTokens()
      const bgToken = tokens[tokenName] || { light: "", dark: "" }
      const fgToken = tokens[foregroundTokenName] || { light: "", dark: "" }

      const currentBgValue = isDarkMode ? bgToken.dark : bgToken.light
      const currentFgValue = isDarkMode ? fgToken.dark : fgToken.light

      setBgHex(oklchToHex(currentBgValue))
      setFgHex(oklchToHex(currentFgValue))
      setBgOklch(currentBgValue)

      setOriginalBg((prev) => {
        if (isDarkMode) {
          return { light: prev.light, dark: currentBgValue || prev.dark }
        } else {
          return { light: currentBgValue || prev.light, dark: prev.dark }
        }
      })
      setOriginalFg((prev) => {
        if (isDarkMode) {
          return { light: prev.light, dark: currentFgValue || prev.dark }
        } else {
          return { light: currentFgValue || prev.light, dark: prev.dark }
        }
      })
    }

    const timeout = setTimeout(loadValues, 50)
    return () => clearTimeout(timeout)
  }, [tokenName, foregroundTokenName, getCurrentTokens, isDarkMode])

  const handleBgChange = useCallback(
    (hex: string) => {
      setBgHex(hex)
      if (isDarkMode) {
        previewToken(tokenName, undefined, hex)
      } else {
        previewToken(tokenName, hex)
      }
    },
    [tokenName, previewToken, isDarkMode]
  )

  const handleFgChange = useCallback(
    (hex: string) => {
      setFgHex(hex)
      if (isDarkMode) {
        previewToken(foregroundTokenName, undefined, hex)
      } else {
        previewToken(foregroundTokenName, hex)
      }
    },
    [foregroundTokenName, previewToken, isDarkMode]
  )

  const handleReset = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      const bgOriginal = isDarkMode ? originalBg.dark : originalBg.light
      const fgOriginal = isDarkMode ? originalFg.dark : originalFg.light

      if (bgOriginal) {
        setBgHex(oklchToHex(bgOriginal))
        if (isDarkMode) {
          previewToken(tokenName, undefined, bgOriginal)
        } else {
          previewToken(tokenName, bgOriginal, undefined)
        }
      }
      if (fgOriginal) {
        setFgHex(oklchToHex(fgOriginal))
        if (isDarkMode) {
          previewToken(foregroundTokenName, undefined, fgOriginal)
        } else {
          previewToken(foregroundTokenName, fgOriginal, undefined)
        }
      }
    },
    [tokenName, foregroundTokenName, originalBg, originalFg, previewToken, isDarkMode]
  )

  // Inneres Rechteck: 90×26px
  const innerPadding = 12
  const innerWidth = 90
  const innerHeight = 26

  return (
    <div className="flex items-start gap-6">
      {/* Swatch Container - LINKS */}
      <div className="group relative h-16 w-64 shrink-0">
        {/* Background Farbe - äußeres Rechteck */}
        <ColorPicker value={bgHex} onChange={handleBgChange}>
          <div
            className="hover:ring-ring absolute inset-0 cursor-pointer rounded-lg border shadow-sm transition-all hover:ring-2"
            style={{
              backgroundColor: `var(${tokenName})`,
              borderRadius: "var(--radius)",
            }}
          />
        </ColorPicker>

        {/* Foreground Farbe - inneres Rechteck (links zentriert) */}
        <ColorPicker value={fgHex} onChange={handleFgChange}>
          <div
            className="hover:ring-ring absolute z-10 cursor-pointer rounded-sm transition-all hover:ring-2"
            style={{
              backgroundColor: `var(${foregroundTokenName})`,
              width: innerWidth,
              height: innerHeight,
              left: innerPadding,
              top: "50%",
              transform: "translateY(-50%)",
              borderRadius: "var(--radius-sm)",
            }}
          />
        </ColorPicker>

        {/* Reset-Icon oben rechts */}
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
        {/* Zeile 1: Name */}
        <span className="text-foreground text-sm font-medium">{name}</span>
        {/* Zeile 2: Beschreibung */}
        <span className="text-muted-foreground truncate text-xs">{description}</span>
        {/* Zeile 3: Farbwerte */}
        <div className="text-muted-foreground flex gap-4 font-mono text-xs">
          <span title={bgOklch}>{bgOklch.substring(0, 25) || bgHex}</span>
          <span className="opacity-50">|</span>
          <span>{hexToRgb(bgHex)}</span>
        </div>
      </div>
    </div>
  )
}
