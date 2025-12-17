# CLI-Tool: Automatische Features

## 🎯 Übersicht

Das CLI-Tool unterstützt jetzt drei automatische Features, die den Workflow erheblich vereinfachen:

1. **Automatisches Laden des SERVICE_ROLE_KEY**
2. **Supabase-Projekt-Auswahl und -Erstellung**
3. **Vercel-Integration**

## 1. Automatisches Laden des SERVICE_ROLE_KEY

### Was passiert?

Das CLI-Tool liest automatisch den `SERVICE_ROLE_KEY` aus der `.env` Datei im `boiler_plate_A` Projekt.

**Pfad:** `../boiler_plate_A/.env`

### Wie funktioniert es?

```javascript
// Das Tool sucht automatisch nach:
../boiler_plate_A/.env

// Extrahiert:
SERVICE_ROLE_KEY=eyJ...

// Zeigt als Default-Wert an:
"SERVICE_ROLE_KEY (vom zentralen Projekt) - automatisch geladen, Enter zum Bestätigen:"
```

### Vorteile

- ✅ Keine manuelle Eingabe des SERVICE_ROLE_KEY mehr nötig
- ✅ Einfach Enter drücken, um den geladenen Wert zu bestätigen
- ✅ Falls `.env` nicht gefunden wird, funktioniert die manuelle Eingabe weiterhin

### Fallback

Falls die `.env` Datei nicht gefunden wird oder der Key nicht extrahiert werden kann:
- Das Tool zeigt eine normale Eingabeaufforderung
- Manuelle Eingabe ist weiterhin möglich

## 2. Supabase-Projekt-Auswahl und -Erstellung

### Was passiert?

Beim Erstellen eines neuen Projekts kannst du wählen:

1. **Bestehendes Projekt verwenden**
   - Liste aller Supabase-Projekte (außer dem Secret-Projekt)
   - Auswahl aus der Liste
   - Automatische URL-Generierung

2. **Neues Projekt erstellen**
   - Automatische Erstellung via Supabase CLI
   - Automatische URL-Generierung
   - Fallback zu manueller Eingabe bei Fehlern

3. **Manuell URL eingeben**
   - Direkte Eingabe der Supabase URL
   - Manuelle Eingabe des Publishable Keys

### Wie funktioniert es?

#### Option 1: Bestehendes Projekt verwenden

```bash
kessel mein-projekt

# Eingabe:
"Wie möchtest du das Supabase-Projekt für die App verwenden?"
→ Bestehendes Projekt verwenden

# Das Tool:
1. Führt aus: supabase projects list --json
2. Filtert das Secret-Projekt raus (zedhieyjlfhygsfxzbze)
3. Zeigt Liste: "Projekt 1 (abc123)", "Projekt 2 (def456)", ...
4. Nach Auswahl: Automatische URL-Generierung
   → https://abc123.supabase.co
5. Fragt nach: Publishable Key
```

#### Option 2: Neues Projekt erstellen

```bash
kessel mein-projekt

# Eingabe:
"Wie möchtest du das Supabase-Projekt für die App verwenden?"
→ Neues Projekt erstellen

# Das Tool:
1. Fragt nach: Projektname (Default: Projektname)
2. Fragt nach: Organization ID (optional)
3. Führt aus: supabase projects create <name> --json
4. Erstellt Projekt automatisch
5. Generiert URL: https://<project_ref>.supabase.co
6. Fragt nach: Publishable Key
```

#### Option 3: Manuell URL eingeben

```bash
kessel mein-projekt

# Eingabe:
"Wie möchtest du das Supabase-Projekt für die App verwenden?"
→ Manuell URL eingeben

# Das Tool:
1. Fragt nach: Supabase URL
2. Fragt nach: Publishable Key
```

### Voraussetzungen

**Für Option 1 & 2 (CLI-Integration):**

1. **Supabase CLI installiert:**
   ```bash
   npm install -g supabase
   ```

2. **Supabase CLI authentifiziert:**
   ```bash
   supabase login
   ```

**Falls CLI nicht verfügbar oder nicht authentifiziert:**
- Das Tool zeigt eine Warnung
- Fallback zu manueller Eingabe
- Funktioniert weiterhin, nur ohne automatische Projekt-Liste/Erstellung

### Filter: Secret-Projekt wird ausgeblendet

Das Secret-Projekt (`zedhieyjlfhygsfxzbze`) wird automatisch aus der Liste gefiltert, da es nur für Secrets verwendet wird.

```javascript
// Filter-Logik:
projects.filter(
  (p) => !p.project_ref?.includes("zedhieyjlfhygsfxzbze") && 
         !p.id?.includes("zedhieyjlfhygsfxzbze")
)
```

## 🔄 Kompletter Workflow

```bash
kessel mein-projekt

# 1. Projektname
→ mein-projekt

# 2. GitHub Token
→ [Token]

# 3. Zentrale Supabase URL
→ [Enter = Standardwert]

# 4. SERVICE_ROLE_KEY
→ [Enter = Automatisch geladen] ✅

# 5. Supabase-Projekt-Auswahl
→ Bestehendes Projekt verwenden
  → Wähle aus Liste: "Mein Projekt (abc123)"
  → Publishable Key: [Key]

# 6. Dependencies installieren?
→ Ja

# ✅ Fertig!
```

## ⚠️ Wichtig

- **SERVICE_ROLE_KEY:** Wird automatisch geladen, kann aber überschrieben werden
- **Supabase CLI:** Optional, aber empfohlen für besseren Workflow
- **Secret-Projekt:** Wird automatisch aus Listen gefiltert
- **Fallback:** Bei Fehlern funktioniert manuelle Eingabe weiterhin

## 🐛 Troubleshooting

### SERVICE_ROLE_KEY wird nicht geladen

**Problem:** `.env` Datei nicht gefunden

**Lösung:**
- Prüfe, ob `boiler_plate_A/.env` existiert
- Prüfe relativen Pfad: `../boiler_plate_A/.env` von `kessel/`
- Manuelle Eingabe funktioniert weiterhin

### Supabase-Projekte werden nicht aufgelistet

**Problem:** Supabase CLI nicht authentifiziert

**Lösung:**
```bash
supabase login
```

**Alternative:**
- Verwende "Manuell URL eingeben"
- Funktioniert genauso gut

### Neues Projekt kann nicht erstellt werden

**Problem:** Supabase CLI-Fehler oder fehlende Berechtigung

**Lösung:**
- Prüfe: `supabase login`
- Prüfe: Organization ID korrekt?
- Fallback: "Manuell URL eingeben" verwenden

## 3. Vercel-Integration

### Was passiert?

Nach der Supabase-Verknüpfung bietet das CLI-Tool eine optionale Vercel-Verknüpfung an.

### Wie funktioniert es?

```bash
kessel mein-projekt

# Nach Supabase Link:
"8/9: Verlinke Vercel-Projekt (optional)..."

# Das Tool:
1. Prüft ob Vercel CLI verfügbar ist (vercel --version)
2. Prüft ob User eingeloggt ist (vercel whoami)
3. Fragt: "Möchtest du das Projekt jetzt mit Vercel verknüpfen?"
4. Bei Zustimmung: Führt aus: vercel link --yes
```

### Voraussetzungen

**Für automatische Vercel-Verknüpfung:**

1. **Vercel CLI installiert:**
   ```bash
   npm install -g vercel
   ```

2. **Vercel CLI authentifiziert:**
   ```bash
   vercel login
   ```
   Oder besuche: https://vercel.com/login

**Falls CLI nicht verfügbar oder nicht authentifiziert:**
- Das Tool zeigt eine Warnung mit Installations-/Login-Anweisungen
- Fallback: Manuelle Verknüpfung später möglich
- Projekt funktioniert trotzdem vollständig

### Fallback-Verhalten

- **Vercel CLI nicht gefunden:** Warnung mit Installations-Anweisung
- **Nicht eingeloggt:** Warnung mit Login-Anweisung und Link
- **Link fehlgeschlagen:** Warnung, aber nicht kritisch
- **Alle Fehler:** Projekt funktioniert trotzdem, Vercel-Integration ist optional

### Vorteile

- ✅ Automatische Verknüpfung direkt nach Projekt-Erstellung
- ✅ "Tag Null"-Integration möglich
- ✅ Keine manuellen Schritte nötig (wenn CLI installiert)
- ✅ Hilfreiche Fehlermeldungen mit direkten Links

### Wichtige Hinweise

- **Optional:** Vercel-Integration ist nicht kritisch für das Projekt
- **Fehler sind nicht kritisch:** Projekt funktioniert auch ohne Vercel-Link
- **Später möglich:** Verknüpfung kann jederzeit manuell nachgeholt werden

