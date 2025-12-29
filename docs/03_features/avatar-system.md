# Avatar-System

**Typ:** 🧠 Core Feature

## Übersicht

Das Avatar-System verwendet DiceBear für beide Avatar-Typen:

- **User-Avatar**: DiceBear "avataaars" (comic-artige Avatare)
- **Chatbot-Avatar**: DiceBear "bottts" (Robots-Serie)

DiceBear ist der **Standard**, nicht der Fallback. Später kann optional ein OAuth-Avatar (Google/Apple/Microsoft) in den Benutzereinstellungen aktiviert werden.

---

## Architektur

### User-Avatar

**Komponente:** [`src/components/shell/UserAvatar.tsx`](src/components/shell/UserAvatar.tsx)

**DiceBear API:**

```
https://api.dicebear.com/7.x/avataaars/svg?seed={seed}
```

**Seed-Generierung:**

- Primär: `profiles.avatar_seed` (gespeichert in DB)
- Fallback: `user.name` oder `user.email`

**Speicherung:**

- Seed wird in `profiles.avatar_seed` persistiert
- User kann Seed in Profil-Einstellungen ändern ("Neu generieren")

**Verwendung:**

- Avatar-Dropdown (oben rechts)
- Profilseite
- Überall wo User-Avatar angezeigt wird

---

### Chatbot-Avatar

**Komponente:** [`src/components/shell/FloatingChatButton.tsx`](src/components/shell/FloatingChatButton.tsx)

**DiceBear API:**

```
https://api.dicebear.com/7.x/bottts/svg?seed={seed}
```

**Seed-Generierung:**

- Primär: `profiles.chatbot_avatar_seed` (gespeichert in DB)
- Fallback: `'default'` (wenn kein Seed vorhanden)

**Speicherung:**

- Seed wird in `profiles.chatbot_avatar_seed` persistiert
- User kann Seed in Chatbot-Einstellungen ändern ("Neu generieren")

**Verwendung:**

- FloatingChatButton (unten rechts)
- Wird angezeigt wenn Chat geschlossen ist
- Wenn Chat offen: X-Icon statt Avatar

---

## Datenbank-Schema

### `profiles` Tabelle

```sql
-- User-Avatar
avatar_seed text  -- Seed für DiceBear avataaars

-- Chatbot-Avatar
chatbot_avatar_seed text  -- Seed für DiceBear bottts

-- Chatbot-Persönlichkeit (siehe Chatbot-Personalisierung)
chatbot_tone text DEFAULT 'casual'  -- 'formal' | 'casual'
chatbot_detail_level text DEFAULT 'balanced'  -- 'brief' | 'balanced' | 'detailed'
chatbot_emoji_usage text DEFAULT 'moderate'  -- 'none' | 'moderate' | 'many'
```

**Constraints:**

- `chatbot_tone`: CHECK IN ('formal', 'casual')
- `chatbot_detail_level`: CHECK IN ('brief', 'balanced', 'detailed')
- `chatbot_emoji_usage`: CHECK IN ('none', 'moderate', 'many')

---

## Seed-Generierung

### Zufälliger Seed

```typescript
const randomSeed = Math.random().toString(36).substring(2, 15) + Date.now().toString(36)
```

**Eigenschaften:**

- Eindeutig durch Timestamp
- URL-safe (alphanumerisch)
- ~20 Zeichen lang

### Seed aus User-Daten

```typescript
const seed = user.avatarSeed || user.name || user.email || "default"
```

**Priorität:**

1. Gespeicherter Seed (`avatar_seed`)
2. User-Name
3. E-Mail
4. Fallback: `'default'`

---

## Geplantes Feature: OAuth-Avatar

**Status:** Geplant, noch nicht implementiert

**Konzept:**

- User kann in Benutzereinstellungen einen OAuth-Avatar aktivieren
- Option: "OAuth-Avatar verwenden" (Checkbox)
- Wenn aktiviert: `user.avatar` (von Google/Apple/Microsoft) wird verwendet
- Wenn deaktiviert: DiceBear wird verwendet

**Implementierung:**

```typescript
// Neues Feld in profiles
use_oauth_avatar boolean DEFAULT false

// Logik in UserAvatar.tsx
const avatarSrc = user?.useOAuthAvatar && user?.avatar
  ? user.avatar
  : diceBearUrl
```

**Hinweis:** OAuth-Integration (Google/Apple/Microsoft) ist noch nicht implementiert. Dieses Feature wird später hinzugefügt.

---

## UI-Komponenten

### Avatar-Komponente

**Datei:** [`src/components/ui/avatar.tsx`](src/components/ui/avatar.tsx)

**Features:**

- Border: `border border-border`
- Hintergrund: `bg-card` (leichte Schattierung)
- Fallback: Initialen wenn Bild nicht lädt

### Profilseite

**Datei:** [`src/app/(shell)/account/profile/page.tsx`](<src/app/(shell)/account/profile/page.tsx>)

**Layout:**

- Card 1: Benutzer-Profil
  - Avatar links (mit "Neu generieren" Button)
  - Formularfelder rechts (Anzeigename, E-Mail, Passwort)
- Card 2: Chatbot-Einstellungen
  - Chatbot-Avatar links (mit "Neu generieren" Button)
  - Persönlichkeits-Einstellungen rechts

---

## Best Practices

### Seed-Persistierung

- **Immer speichern:** Nach User-Änderung Seed in DB speichern
- **Fallback:** Wenn kein Seed vorhanden, aus User-Daten generieren
- **Validierung:** Seed sollte nicht leer sein

### Performance

- **Caching:** DiceBear-URLs werden von DiceBear gecacht
- **Lazy Loading:** Avatare werden erst geladen wenn sichtbar
- **Fallback:** Immer Fallback (Initialen) bereitstellen

### Accessibility

- **Alt-Text:** Immer `alt` Attribut setzen (User-Name oder "Chatbot")
- **ARIA-Labels:** Für interaktive Avatar-Buttons

---

## Migration

**Datei:** `supabase/migrations/XXX_chatbot_settings.sql`

**Inhalt:**

- Neue Spalten für Chatbot-Avatar und Einstellungen
- Constraints für Validierung
- Default-Werte setzen

---

## Referenzen

- [DiceBear API Dokumentation](https://www.dicebear.com/docs/api)
- [DiceBear avataaars Style](https://www.dicebear.com/styles/avataaars)
- [DiceBear bottts Style](https://www.dicebear.com/styles/bottts)
- [`src/components/shell/UserAvatar.tsx`](../../src/components/shell/UserAvatar.tsx)
- [`src/components/shell/FloatingChatButton.tsx`](../../src/components/shell/FloatingChatButton.tsx)
- [`src/app/(shell)/account/profile/page.tsx`](<../../src/app/(shell)/account/profile/page.tsx>)
