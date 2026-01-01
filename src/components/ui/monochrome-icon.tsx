"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * MonochromeIcon Props
 */
export interface MonochromeIconProps {
  /** Bild-URL */
  src: string
  /** Alt-Text (für Accessibility) */
  alt?: string
  /** Größe (in Pixel oder CSS-Wert) */
  size?: number | string
  /** Zusätzliche CSS-Klassen */
  className?: string
  /** Schwellenwert für Thresholding (0-255, Standard: 128) */
  threshold?: number
  /** Icon-Farbe invertieren (für Dark Mode) - wird automatisch erkannt wenn nicht gesetzt */
  invert?: boolean
}

/**
 * MonochromeIcon Komponente
 *
 * Post-Processing Pipeline:
 * 1. Thresholding: Alle Pixel werden zu reinem Schwarz oder Weiß konvertiert
 * 2. Weiße Pixel werden transparent gemacht
 * 3. Ergebnis: Schwarze Pixel auf transparentem Hintergrund
 *
 * CSS-basierte Theme-Anpassung:
 * - Im Light Mode: Schwarzes Icon wird direkt angezeigt
 * - Im Dark Mode: CSS filter: invert(1) macht das Icon weiß
 * - Custom Farben können über className gesteuert werden
 *
 * @example
 * ```tsx
 * // Automatische Theme-Anpassung (empfohlen)
 * <MonochromeIcon src="/icon.png" size={64} />
 *
 * // Manuell invertieren
 * <MonochromeIcon src="/icon.png" size={64} invert={true} />
 * ```
 */
export function MonochromeIcon({
  src,
  alt = "Icon",
  size = 32,
  className,
  threshold = 128,
  invert,
}: MonochromeIconProps): React.ReactElement {
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const [processedImageUrl, setProcessedImageUrl] = React.useState<string | null>(null)
  const [isProcessing, setIsProcessing] = React.useState(true)
  const [error, setError] = React.useState(false)
  const [isDarkMode, setIsDarkMode] = React.useState(false)
  const [canvasReady, setCanvasReady] = React.useState(false)

  const sizeValue = typeof size === "number" ? `${size}px` : size

  // Canvas-Ref Callback zum Erkennen, wenn das Canvas bereit ist
  const setCanvasRef = React.useCallback((node: HTMLCanvasElement | null) => {
    if (node) {
      ;(canvasRef as React.MutableRefObject<HTMLCanvasElement>).current = node
      setCanvasReady(true)
    }
  }, [])

  // Dark Mode erkennen
  React.useEffect(() => {
    // Prüfe ob das HTML-Element die dark class hat
    const checkDarkMode = () => {
      const isDark = document.documentElement.classList.contains("dark")
      setIsDarkMode(isDark)
    }

    checkDarkMode()

    // MutationObserver für Änderungen an der dark class
    const observer = new MutationObserver(checkDarkMode)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    })

    return () => observer.disconnect()
  }, [])

  // Bild-Verarbeitung - wartet auf canvasReady
  React.useEffect(() => {
    if (!canvasReady) {
      console.log("[MonochromeIcon] Waiting for canvas to be ready...")
      return
    }

    console.log("[MonochromeIcon] Starting processing for:", src)

    const canvas = canvasRef.current
    if (!canvas) {
      console.error("[MonochromeIcon] Canvas ref is still null after canvasReady")
      return
    }

    setIsProcessing(true)
    setError(false)

    const img = new Image()
    img.crossOrigin = "anonymous"

    console.log("[MonochromeIcon] Loading image...")

    img.onload = () => {
      try {
        console.log("[MonochromeIcon] Image loaded:", img.width, "x", img.height)

        const ctx = canvas.getContext("2d", { willReadFrequently: true })
        if (!ctx) {
          console.error("[MonochromeIcon] Failed to get canvas context")
          setError(true)
          setIsProcessing(false)
          return
        }

        // Canvas-Größe setzen
        canvas.width = img.width
        canvas.height = img.height

        // Bild auf Canvas zeichnen
        ctx.drawImage(img, 0, 0)

        // Pixel-Daten lesen (mit CORS-Fehlerbehandlung)
        let imageData: ImageData
        try {
          imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        } catch (corsError) {
          console.warn("[MonochromeIcon] CORS error - using CSS filter fallback:", corsError)
          // Bei CORS-Fehler: Original-Bild mit CSS-Filter als Fallback
          // Das Bild wird direkt angezeigt, CSS filter: invert() passt es ans Theme an
          setProcessedImageUrl(src)
          setIsProcessing(false)
          return
        }

        const data = imageData.data
        console.log(
          "[MonochromeIcon] Processing",
          data.length / 4,
          "pixels with threshold:",
          threshold
        )

        // Post-Processing Pipeline:
        // 1. Thresholding: Graustufen → reines Schwarz oder Weiß
        // 2. Weiß → Transparent (Alpha = 0)
        // 3. Schwarz bleibt (wird sichtbar)
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i]
          const g = data[i + 1]
          const b = data[i + 2]

          // Graustufen-Mittelwert berechnen
          const grayscale = (r + g + b) / 3

          // Thresholding: Unter threshold → Schwarz (sichtbar), darüber → Transparent
          if (grayscale < threshold) {
            // Schwarz (sichtbar)
            data[i] = 0 // R
            data[i + 1] = 0 // G
            data[i + 2] = 0 // B
            data[i + 3] = 255 // Alpha = voll sichtbar
          } else {
            // Weiß → Transparent
            data[i] = 0 // R (egal, da transparent)
            data[i + 1] = 0 // G
            data[i + 2] = 0 // B
            data[i + 3] = 0 // Alpha = transparent
          }
        }

        // Verarbeitete Pixel zurück auf Canvas schreiben
        ctx.putImageData(imageData, 0, 0)

        // Canvas zu Data URL konvertieren (PNG mit Transparenz)
        const dataUrl = canvas.toDataURL("image/png")
        console.log("[MonochromeIcon] Processing complete, dataUrl length:", dataUrl.length)
        setProcessedImageUrl(dataUrl)
      } catch (err) {
        console.error("[MonochromeIcon] Error processing image:", err)
        setError(true)
      } finally {
        setIsProcessing(false)
      }
    }

    img.onerror = (event) => {
      console.error("[MonochromeIcon] Error loading image:", src, event)
      setError(true)
      setIsProcessing(false)
    }

    console.log("[MonochromeIcon] Setting img.src to:", src)
    img.src = src
  }, [src, threshold, canvasReady])

  // Soll invertiert werden?
  const shouldInvert = invert !== undefined ? invert : isDarkMode

  // Immer das Canvas rendern (versteckt), plus das entsprechende Bild/Placeholder
  return (
    <div
      className={cn("relative flex items-center justify-center", className)}
      style={{ width: sizeValue, height: sizeValue }}
    >
      {/* Versteckter Canvas für Bildverarbeitung - IMMER gerendert */}
      <canvas ref={setCanvasRef} className="pointer-events-none absolute opacity-0" />

      {/* Fehler: Original-Bild als Fallback */}
      {error && (
        <img
          src={src}
          alt={alt}
          className="h-full w-full object-contain opacity-50"
          style={{ filter: shouldInvert ? "invert(1)" : "none" }}
        />
      )}

      {/* Während der Verarbeitung: Placeholder */}
      {!error && (isProcessing || !processedImageUrl) && (
        <div className="bg-muted h-full w-full animate-pulse rounded" />
      )}

      {/* Verarbeitetes Bild mit CSS-Filter für Theme-Anpassung */}
      {!error && !isProcessing && processedImageUrl && (
        <img
          src={processedImageUrl}
          alt={alt}
          className="h-full w-full object-contain"
          style={{ filter: shouldInvert ? "invert(1)" : "none" }}
        />
      )}
    </div>
  )
}
