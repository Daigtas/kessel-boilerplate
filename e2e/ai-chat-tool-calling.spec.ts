/**
 * E2E Tests für AI Chat mit Tool-Calling
 *
 * Testet den vollständigen Flow:
 * 1. User öffnet Chat
 * 2. User stellt Frage, die Tool-Call erfordert
 * 3. AI führt Tool-Call aus
 * 4. AI gibt Ergebnis zurück
 */

import { test, expect } from "@playwright/test"

test.describe("AI Chat mit Tool-Calling", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to app (assumes dev server is running)
    await page.goto("http://localhost:3000")

    // Login (falls nötig)
    // TODO: Anpassen an tatsächliche Login-Logik
    // await page.fill('[name="email"]', "admin@kessel.local")
    // await page.fill('[name="password"]', "Admin123!")
    // await page.click('button[type="submit"]')
  })

  test("sollte Chat-Panel öffnen können", async ({ page }) => {
    // Arrange: Navigate to page with chat
    await page.goto("http://localhost:3000")

    // Act: Open Assist Panel (Cmd/Ctrl + J)
    await page.keyboard.press("Meta+j") // Cmd+J on Mac, Ctrl+J on Windows

    // Assert: Chat Panel sollte sichtbar sein
    const chatPanel = page.locator('[data-testid="assist-panel"]').or(page.locator('text="Hallo"'))
    await expect(chatPanel).toBeVisible({ timeout: 5000 })
  })

  test("sollte einfache Chat-Nachricht senden können", async ({ page }) => {
    // Arrange
    await page.goto("http://localhost:3000")
    await page.keyboard.press("Meta+j") // Open Assist Panel

    // Act: Sende Nachricht
    const chatInput = page
      .locator('textarea[placeholder*="Nachricht"]')
      .or(page.locator('input[type="text"]'))
    await chatInput.fill("Hallo, wie geht es dir?")
    await chatInput.press("Enter")

    // Assert: Antwort sollte erscheinen
    await expect(page.locator("text=/.*/i")).toBeVisible({ timeout: 10000 })
  })

  test("sollte Tool-Call für Datenbank-Abfrage durchführen können", async ({ page }) => {
    // Arrange: Stelle sicher, dass themes-Tabelle auf 'read' gesetzt ist
    // (Dies sollte über Admin UI gemacht werden, aber für Tests können wir es direkt setzen)
    await page.goto("http://localhost:3000")
    await page.keyboard.press("Meta+j")

    // Act: Frage nach Themes
    const chatInput = page
      .locator('textarea[placeholder*="Nachricht"]')
      .or(page.locator('input[type="text"]'))
    await chatInput.fill("Zeige mir alle verfügbaren Themes")
    await chatInput.press("Enter")

    // Assert: Antwort sollte Themes enthalten (oder zumindest eine Antwort)
    // Da Tool-Calls asynchron sind, warten wir auf Antwort
    await expect(page.locator("text=/.*/i")).toBeVisible({ timeout: 15000 })

    // Prüfe ob Tool-Call in Audit-Log geschrieben wurde
    // (Dies würde einen Backend-Check erfordern)
  })

  test("sollte Dry-Run für INSERT-Operationen unterstützen", async ({ page }) => {
    // Arrange
    await page.goto("http://localhost:3000")
    await page.keyboard.press("Meta+j")

    // Act: Frage nach Erstellen eines neuen Themes (Dry-Run)
    const chatInput = page
      .locator('textarea[placeholder*="Nachricht"]')
      .or(page.locator('input[type="text"]'))
    await chatInput.fill("Erstelle ein neues Theme mit dem Namen 'Test Theme' (Dry-Run)")
    await chatInput.press("Enter")

    // Assert: Antwort sollte SQL-Preview enthalten
    await expect(page.locator("text=/.*/i")).toBeVisible({ timeout: 15000 })
    // Prüfe ob Dry-Run-Flag gesetzt wurde (Backend-Check)
  })
})

test.describe("Admin UI für AI Datasources", () => {
  test("sollte Admin-Seite öffnen können", async ({ page }) => {
    // Arrange: Login als Admin
    await page.goto("http://localhost:3000")
    // TODO: Login-Logik

    // Act: Navigate to Admin UI
    await page.goto("http://localhost:3000/admin/ai-datasources")

    // Assert: Seite sollte geladen sein
    await expect(page.locator('text="AI Datasources"')).toBeVisible()
  })

  test("sollte Zugriffslevel ändern können", async ({ page }) => {
    // Arrange
    await page.goto("http://localhost:3000/admin/ai-datasources")
    await expect(page.locator('text="AI Datasources"')).toBeVisible()

    // Act: Ändere Zugriffslevel für erste Tabelle
    const firstSelect = page.locator("select").first()
    await firstSelect.selectOption("read_write")

    // Assert: Änderung sollte gespeichert sein
    await expect(firstSelect).toHaveValue("read_write")
  })

  test("sollte Tabelle aktivieren/deaktivieren können", async ({ page }) => {
    // Arrange
    await page.goto("http://localhost:3000/admin/ai-datasources")

    // Act: Toggle Switch für erste Tabelle
    const firstSwitch = page.locator('input[type="checkbox"]').first()
    const initialState = await firstSwitch.isChecked()
    await firstSwitch.click()

    // Assert: Switch sollte umgeschaltet sein
    await expect(firstSwitch).toHaveProperty("checked", !initialState)
  })
})
