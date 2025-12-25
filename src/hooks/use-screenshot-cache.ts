/**
 * Screenshot Cache Hook
 *
 * Cached Screenshots bei Route-Änderungen für optimierte Performance.
 * Der Screenshot wird automatisch aktualisiert wenn der User navigiert.
 *
 * Features:
 * - Automatischer Screenshot bei Route-Change (500ms Delay für Rendering)
 * - Cache für schnellen Zugriff
 * - Force-Fresh Option für garantiert aktuellen Screenshot
 */

"use client"

import { useEffect, useRef, useCallback } from "react"
import { usePathname } from "next/navigation"
import { captureScreenshot } from "@/lib/ai-chat/context-collector"

interface UseScreenshotCacheReturn {
  /**
   * Gibt den aktuellen Screenshot zurück.
   * @param forceFresh - Wenn true, wird ein neuer Screenshot gemacht
   */
  getScreenshot: (forceFresh?: boolean) => Promise<string | null>
  /** Aktuelle Route */
  pathname: string
  /** Ob gerade ein Screenshot gemacht wird */
  isCapturing: boolean
}

/**
 * Hook für Screenshot-Caching mit automatischer Aktualisierung bei Navigation
 *
 * @example
 * ```tsx
 * const { getScreenshot, pathname } = useScreenshotCache()
 *
 * const handleSend = async () => {
 *   const screenshot = await getScreenshot()
 *   // Screenshot mit Nachricht senden
 * }
 * ```
 */
export function useScreenshotCache(): UseScreenshotCacheReturn {
  const pathname = usePathname()

  // Refs für State ohne Re-Renders
  const screenshotRef = useRef<string | null>(null)
  const lastRouteRef = useRef<string>("")
  const isCapturingRef = useRef<boolean>(false)
  const capturePromiseRef = useRef<Promise<string | null> | null>(null)

  // Screenshot bei Route-Change
  useEffect(() => {
    if (pathname !== lastRouteRef.current) {
      lastRouteRef.current = pathname

      // Kurze Verzögerung damit Page vollständig gerendert ist
      const timer = setTimeout(async () => {
        if (isCapturingRef.current) return // Bereits am Capturen

        console.log("[ScreenshotCache] Route changed, capturing:", pathname)
        isCapturingRef.current = true

        try {
          const screenshot = await captureScreenshot()
          screenshotRef.current = screenshot
          console.log(
            "[ScreenshotCache] Cached screenshot:",
            screenshot ? `${screenshot.length} chars` : "null"
          )
        } catch (error) {
          console.error("[ScreenshotCache] Capture failed:", error)
          screenshotRef.current = null
        } finally {
          isCapturingRef.current = false
        }
      }, 500) // 500ms Delay für vollständiges Rendering

      return () => clearTimeout(timer)
    }
  }, [pathname])

  // Getter für Screenshot (mit Fresh-Option)
  const getScreenshot = useCallback(async (forceFresh = false): Promise<string | null> => {
    // Wenn bereits ein Capture läuft, darauf warten
    if (capturePromiseRef.current) {
      return capturePromiseRef.current
    }

    // Wenn Force-Fresh oder kein Cache vorhanden
    if (forceFresh || !screenshotRef.current) {
      console.log("[ScreenshotCache] Getting fresh screenshot (forceFresh:", forceFresh, ")")
      isCapturingRef.current = true

      const capturePromise = captureScreenshot()
        .then((screenshot) => {
          screenshotRef.current = screenshot
          return screenshot
        })
        .catch((error) => {
          console.error("[ScreenshotCache] Fresh capture failed:", error)
          return null
        })
        .finally(() => {
          isCapturingRef.current = false
          capturePromiseRef.current = null
        })

      capturePromiseRef.current = capturePromise
      return capturePromise
    }

    // Cache verwenden
    console.log("[ScreenshotCache] Using cached screenshot")
    return screenshotRef.current
  }, [])

  return {
    getScreenshot,
    pathname,
    isCapturing: isCapturingRef.current,
  }
}
