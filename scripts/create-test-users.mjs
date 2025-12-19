#!/usr/bin/env node

/**
 * Script zum Anlegen von Test-Usern in Supabase
 *
 * WICHTIG: Dieses Script wird automatisch bei der Boilerplate-Einrichtung ausgeführt.
 * Die erstellten Test-User müssen in Production geändert oder gelöscht werden!
 *
 * Legt zwei Test-User an:
 * - admin@local (Admin-Rolle) - Passwort: admin123
 * - user@local (User-Rolle) - Passwort: user123
 *
 * Das Script ist idempotent: Es kann mehrfach ausgeführt werden ohne Duplikate zu erstellen.
 * Bestehende User werden aktualisiert (Passwort und Rolle).
 */

import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "fs"
import { fileURLToPath } from "url"
import { dirname, join } from "path"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Lade Environment-Variablen
function loadEnv() {
  try {
    const envPath = join(__dirname, "..", ".env.local")
    const envContent = readFileSync(envPath, "utf-8")
    const env = {}

    envContent.split("\n").forEach((line) => {
      const match = line.match(/^([^=]+)=(.*)$/)
      if (match) {
        env[match[1].trim()] = match[2].trim()
      }
    })

    return env
  } catch (error) {
    console.error("Fehler beim Laden von .env.local:", error.message)
    process.exit(1)
  }
}

const env = loadEnv()

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "❌ Fehler: NEXT_PUBLIC_SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY müssen in .env.local gesetzt sein"
  )
  console.error(`   SUPABASE_URL: ${SUPABASE_URL ? "✓" : "✗"}`)
  console.error(
    `   SERVICE_ROLE_KEY: ${SERVICE_ROLE_KEY ? "✓ (" + SERVICE_ROLE_KEY.substring(0, 20) + "...)" : "✗"}`
  )
  process.exit(1)
}

// Entferne ANSI Escape Codes aus dem Service Role Key (falls vorhanden)
const cleanServiceRoleKey = SERVICE_ROLE_KEY.replace(/\x1b\[[0-9;]*m/g, "")
  .replace(/\u001b\[\d+m/g, "")
  .trim()

if (!cleanServiceRoleKey || cleanServiceRoleKey.length < 20) {
  console.error("❌ Fehler: SUPABASE_SERVICE_ROLE_KEY ist ungültig oder zu kurz")
  console.error(`   Key-Länge: ${cleanServiceRoleKey.length}`)
  process.exit(1)
}

// Erstelle Supabase Client mit Service Role (für Admin-Operationen)
const supabase = createClient(SUPABASE_URL, cleanServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

// Test-User Definitionen
// WICHTIG: Diese einfachen Credentials sind nur für Entwicklung gedacht!
// In Production müssen diese User gelöscht oder die Passwörter geändert werden.
const testUsers = [
  {
    email: "admin@local",
    password: "admin123", // Mindestens 6 Zeichen für Supabase
    role: "admin",
    displayName: "Administrator",
  },
  {
    email: "user@local",
    password: "user123", // Mindestens 6 Zeichen für Supabase
    role: "user",
    displayName: "Standard User",
  },
]

async function createUsers() {
  console.log("🚀 Erstelle Test-User in Supabase...\n")

  const results = []

  for (const user of testUsers) {
    try {
      console.log(`📧 Erstelle User: ${user.email}...`)

      // User in Supabase Auth anlegen
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true, // Email sofort bestätigen (keine Bestätigung nötig)
        user_metadata: {
          display_name: user.displayName,
          role: user.role,
        },
      })

      if (authError) {
        // Wenn User bereits existiert, versuche ihn zu aktualisieren
        if (
          authError.message.includes("already registered") ||
          authError.message.includes("already exists") ||
          authError.message.includes("already been registered")
        ) {
          console.log(`   ⚠️  User existiert bereits, aktualisiere...`)

          // Suche bestehenden User
          const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers()

          if (listError) {
            console.error(`   ❌ Fehler beim Auflisten der User: ${listError.message}`)
            results.push({ ...user, status: "error", error: listError.message })
            continue
          }

          const existingUser = existingUsers?.users?.find((u) => u.email === user.email)

          if (existingUser) {
            // Aktualisiere Passwort und Metadaten
            // WICHTIG: Passwort muss mindestens 6 Zeichen haben
            const updateData = {
              user_metadata: {
                display_name: user.displayName,
                role: user.role,
              },
            }

            // Setze Passwort nur wenn es mindestens 6 Zeichen hat
            if (user.password && user.password.length >= 6) {
              updateData.password = user.password
            }

            const { error: updateError } = await supabase.auth.admin.updateUserById(
              existingUser.id,
              updateData
            )

            if (updateError) {
              console.error(`   ❌ Fehler beim Aktualisieren: ${updateError.message}`)
              results.push({ ...user, status: "error", error: updateError.message })
              continue
            }

            // Aktualisiere Rolle in profiles-Tabelle
            const { error: profileError } = await supabase
              .from("profiles")
              .update({ role: user.role, display_name: user.displayName })
              .eq("id", existingUser.id)

            if (profileError) {
              console.error(`   ⚠️  Profil-Update fehlgeschlagen: ${profileError.message}`)
            }

            console.log(`   ✅ User aktualisiert`)
            results.push({ ...user, status: "updated", userId: existingUser.id })
            continue
          } else {
            console.error(`   ❌ User nicht gefunden trotz 'already registered' Fehler`)
            results.push({ ...user, status: "error", error: "User exists but not found in list" })
            continue
          }
        } else {
          console.error(`   ❌ Fehler: ${authError.message}`)
          results.push({ ...user, status: "error", error: authError.message })
          continue
        }
      }

      if (!authData?.user) {
        console.error(`   ❌ Kein User-Daten zurückgegeben`)
        results.push({ ...user, status: "error", error: "No user data returned" })
        continue
      }

      // Rolle in profiles-Tabelle aktualisieren (falls Trigger nicht funktioniert)
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ role: user.role })
        .eq("id", authData.user.id)

      if (profileError && !profileError.message.includes("No rows")) {
        console.error(`   ⚠️  Profil-Update fehlgeschlagen: ${profileError.message}`)
      }

      console.log(`   ✅ User erstellt: ${authData.user.id}`)
      results.push({ ...user, status: "created", userId: authData.user.id })
    } catch (error) {
      console.error(`   ❌ Unerwarteter Fehler: ${error.message}`)
      results.push({ ...user, status: "error", error: error.message })
    }
  }

  console.log("\n" + "=".repeat(60))
  console.log("📋 ZUSAMMENFASSUNG - Test-User Credentials:")
  console.log("=".repeat(60) + "\n")

  results.forEach((user, index) => {
    if (user.status === "created" || user.status === "updated") {
      console.log(`${index + 1}. ${user.displayName}`)
      console.log(`   E-Mail:    ${user.email}`)
      console.log(`   Passwort:  ${user.password}`)
      console.log(`   Rolle:     ${user.role}`)
      console.log(
        `   Status:    ${user.status === "created" ? "✅ Erstellt" : "🔄 Aktualisiert"}\n`
      )
    } else {
      console.log(`${index + 1}. ${user.email} - ❌ Fehler: ${user.error}\n`)
    }
  })

  console.log("=".repeat(60))
  console.log("\n💡 Tipp: Email-Bestätigung ist für diese User deaktiviert.")
  console.log("   Du kannst dich direkt mit den Credentials einloggen.\n")
}

// Führe Script aus
createUsers().catch((error) => {
  console.error("Fataler Fehler:", error)
  process.exit(1)
})
