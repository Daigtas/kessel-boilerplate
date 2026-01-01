"use client"

import * as React from "react"
import { Home } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * AppIcon Props
 */
export interface AppIconProps {
  /** Größe des Icons (in Pixel oder Tailwind-Klasse) */
  size?: number | string
  /** Zusätzliche CSS-Klassen */
  className?: string
  /** Icon-URL (falls nicht gesetzt, wird aus app_settings geladen) */
  iconUrl?: string | null
}

/**
 * AppIcon Komponente
 *
 * Zeigt das App-Icon an mit Theme-Farb-Anpassung via CSS mask-image.
 * Das Icon selbst bleibt monochrom, die Farbe kommt über CSS.
 *
 * @example
 * ```tsx
 * <AppIcon size={64} />
 * <AppIcon size="w-16 h-16" className="text-primary" />
 * ```
 */
export function AppIcon({ size = 32, className, iconUrl }: AppIconProps): React.ReactElement {
  const [currentIconUrl, setCurrentIconUrl] = React.useState<string | null>(iconUrl || null)
  const [isLoading, setIsLoading] = React.useState(!iconUrl)

  // Lade Icon aus app_settings wenn nicht übergeben
  React.useEffect(() => {
    if (iconUrl !== undefined) {
      setCurrentIconUrl(iconUrl)
      setIsLoading(false)
      return
    }

    async function loadAppIcon() {
      try {
        const response = await fetch("/api/app-settings")
        if (response.ok) {
          const data = await response.json()
          setCurrentIconUrl(data.icon_url || null)
        }
      } catch (error) {
        console.error("Error loading app icon:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadAppIcon()
  }, [iconUrl])

  // Größe als CSS-Wert berechnen
  const sizeValue = typeof size === "number" ? `${size}px` : size

  // Fallback auf Lucide Home-Icon wenn kein Custom-Icon
  if (!currentIconUrl || isLoading) {
    return (
      <div
        className={cn("flex items-center justify-center", className)}
        style={{ width: sizeValue, height: sizeValue }}
      >
        <Home className="text-foreground" style={{ width: sizeValue, height: sizeValue }} />
      </div>
    )
  }

  // Custom Icon direkt als Bild anzeigen
  // Hinweis: mask-image funktioniert nur mit transparenten PNGs
  // Da die meisten Image-Generatoren keine echten transparenten Bilder erzeugen,
  // zeigen wir das Bild direkt an.
  return (
    <div
      className={cn("flex items-center justify-center overflow-hidden rounded-lg", className)}
      style={{ width: sizeValue, height: sizeValue }}
    >
      <img
        src={currentIconUrl}
        alt="App Icon"
        className="h-full w-full object-contain"
        onError={(e) => {
          console.error("Error loading app icon:", currentIconUrl)
          // Fallback: Verstecke das kaputte Bild
          e.currentTarget.style.display = "none"
        }}
      />
    </div>
  )
}
