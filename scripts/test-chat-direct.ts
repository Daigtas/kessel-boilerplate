import { createClient } from "@supabase/supabase-js"
import * as dotenv from "dotenv"

dotenv.config({ path: ".env.local" })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error("URL:", url)
  console.error("KEY:", key ? "vorhanden" : "fehlt")
  process.exit(1)
}

console.log("URL:", url)
console.log("KEY: vorhanden")

const supabase = createClient(url, key)

async function test() {
  // Login
  const { data, error } = await supabase.auth.signInWithPassword({
    email: "admin@kessel.local",
    password: "Admin123!",
  })

  if (error) {
    console.error("Login fehler:", error.message)
    process.exit(1)
  }

  console.log("Login OK, user:", data.user?.email)

  // Chat API aufrufen mit Bearer Token
  const cookieValue = `sb-ufqlocxqizmiaozkashi-auth-token=${encodeURIComponent(
    JSON.stringify({
      access_token: data.session?.access_token,
      refresh_token: data.session?.refresh_token,
    })
  )}`

  console.log("Sending chat request...")

  const response = await fetch("http://localhost:3000/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieValue,
    },
    body: JSON.stringify({
      messages: [
        {
          id: "1",
          role: "user",
          content: [{ type: "text", text: "Zeige mir alle Rollen in der Datenbank." }],
        },
      ],
      route: "/",
    }),
  })

  console.log("Response Status:", response.status)
  const text = await response.text()
  console.log("Response:", text.substring(0, 1000))
}

test().catch(console.error)

