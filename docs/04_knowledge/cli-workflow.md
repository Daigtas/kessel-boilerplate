# CLI-Tool Workflow - Wie verwende ich kessel?

## 🎯 Der ideale Workflow

Du kannst das Tool von **ÜBERALL** verwenden - nicht nur aus dem `boiler_plate_A` Projekt!

### Option 1: Neues Verzeichnis erstellen (Empfohlen)

```bash
# 1. Öffne Cursor in einem beliebigen Verzeichnis
#    (z.B. /b/Nextcloud/CODE/proj/)

# 2. Erstelle neues Verzeichnis für dein Projekt
mkdir mein-neues-projekt

# 3. Wechsle hinein
cd mein-neues-projekt

# 4. Führe CLI-Tool aus
kessel
# (Projektname wird automatisch aus Verzeichnisname übernommen)
```

### Option 2: Projektname direkt angeben

```bash
# 1. Öffne Cursor irgendwo
#    (z.B. /b/Nextcloud/CODE/proj/)

# 2. Führe direkt aus (erstellt Verzeichnis automatisch)
kessel mein-neues-projekt
```

### Option 3: In neuem Verzeichnis starten

```bash
# 1. Erstelle Verzeichnis
mkdir /b/Nextcloud/CODE/proj/mein-neues-projekt

# 2. Öffne Cursor in diesem Verzeichnis
#    (Cursor → File → Open Folder → mein-neues-projekt)

# 3. Im Terminal:
kessel
```

## 📁 Wo sollte ich mein Projekt erstellen?

**Du kannst es ÜBERALL erstellen!** Typische Orte:

- `/b/Nextcloud/CODE/proj/mein-projekt` - Neben anderen Projekten
- `/b/Nextcloud/CODE/proj/client-projekte/mein-projekt` - In einem Client-Ordner
- `~/Desktop/mein-projekt` - Auf dem Desktop
- Jeder andere Ort, den du möchtest

## ⚠️ Wichtig: Nicht im boiler_plate_A Projekt!

**Vermeide:**
```bash
cd boiler_plate_A
mkdir neues-projekt  # ❌ Nicht hier!
```

**Besser:**
```bash
cd ..  # Aus boiler_plate_A raus
mkdir neues-projekt  # ✅ Hier!
cd neues-projekt
kessel
```

## 🔄 Kompletter Beispiel-Workflow

```bash
# 1. Öffne Cursor in deinem Projekte-Verzeichnis
cd /b/Nextcloud/CODE/proj

# 2. Erstelle neues Projekt
kessel meine-app

# 3. Das Tool fragt nach:
#    - GitHub Token
#    - Zentrale Supabase URL (Standardwert vorhanden)
#    - SERVICE_ROLE_KEY (✅ automatisch geladen - Enter drücken!)
#    - Supabase-Projekt-Auswahl:
#      → Bestehendes Projekt verwenden (mit Liste)
#      → Neues Projekt erstellen (via CLI)
#      → Manuell URL eingeben
#    - Dependencies installieren? (Ja)

# 4. Nach erfolgreicher Erstellung:
cd meine-app

# 5. Entwickeln starten
pnpm dev
```

## 💡 Tipp: Cursor direkt im neuen Projekt öffnen

Nachdem das Projekt erstellt wurde:

1. **Cursor schließen** (falls noch offen)
2. **Neues Projekt öffnen:**
   - File → Open Folder
   - Wähle das neu erstellte Projekt-Verzeichnis
3. **Terminal öffnen** - du bist jetzt im Projekt-Root

## 🎯 Zusammenfassung

- ✅ **Tool funktioniert von überall** - nicht nur aus boiler_plate_A
- ✅ **Erstelle Projekt wo du willst** - typischerweise neben anderen Projekten
- ✅ **Öffne Cursor im neuen Projekt** - nicht im boiler_plate_A Projekt
- ✅ **Kein Hin- und Herwechseln nötig** - alles in einem Schritt

