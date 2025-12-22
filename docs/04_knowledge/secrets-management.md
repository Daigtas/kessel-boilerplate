# Secrets Management - Ein-Projekt-Architektur

## Architektur-Übersicht

Dieses Projekt verwendet **ein Supabase-Projekt** für App-Daten, Auth, Storage und Secrets:

```
┌─────────────────────────────────────────────────────────────────────┐
│                    EIN-PROJEKT-ARCHITEKTUR                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │            KESSEL-PROJEKT (ufqlocxqizmiaozkashi)           │   │
│   ├─────────────────────────────────────────────────────────────┤   │
│   │ • Tabellen (profiles, themes, roles, ...)                  │   │
│   │ • Storage (themes bucket)                                  │   │
│   │ • Auth (Supabase Auth)                                     │   │
│   │ • Vault (Secrets) ← Alle Secrets hier!                    │   │
│   │ • MCP aktiv ✓                                              │   │
│   └───────────────────────┬───────────────────────────────────┘   │
│                           │                                         │
│                           ▼                                         │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │  pnpm pull-env  +  Supabase MCP                            │   │
│   │  (Secrets abrufen)  (AI-gesteuert)                         │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

| Projekt    | Project Ref            | Zugriff            | MCP?  |
| ---------- | ---------------------- | ------------------ | ----- |
| **KESSEL** | `ufqlocxqizmiaozkashi` | CLI + MCP + Client | ✅ Ja |

> **Hinweis:** Alle Secrets sind im KESSEL-Projekt Vault gespeichert. Das vereinfacht die Architektur und eliminiert MCP-Token-Probleme.

## Warum ein Projekt?

1. **Vereinfachung**: Keine zwei Projekte mehr zu verwalten
2. **Ein MCP-Token**: Kein Umschalten zwischen Vault und Daten-Projekt
3. **Kosten**: Nutzt nur einen Free-Tier Slot
4. **Isolation**: Vault-Funktionen sind trotzdem sicher (nur service_role Zugriff)

---

## Dateien und Credentials

### `.env` (Bootstrap - KESSEL-Projekt)

```bash
# Bootstrap-Credentials für KESSEL-Projekt
# Wird von pnpm pull-env verwendet, um Secrets aus dem Vault zu holen
NEXT_PUBLIC_SUPABASE_URL=https://ufqlocxqizmiaozkashi.supabase.co
SERVICE_ROLE_KEY=eyJ...  # KESSEL Service Role Key
```

**Wichtig:**

- Diese Datei ist in `.gitignore` → wird **niemals** committed
- Enthält Credentials für das **KESSEL-Projekt** (Vault + Daten)
- Wird nur vom `pull-env.mjs` Script verwendet

### `.env.local` (Runtime - Generiert)

```bash
# Generiert von: pnpm pull-env
# Enthält alle Secrets aus dem KESSEL-Vault
NEXT_PUBLIC_SUPABASE_URL=https://ufqlocxqizmiaozkashi.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=eyJ...  # Public Key für Client
GOOGLE_GENERATIVE_AI_API_KEY=...
OPENAI_API_KEY=...
# ... weitere Secrets
```

**Wichtig:**

- Wird **automatisch generiert** von `pnpm pull-env`
- Enthält alle Secrets aus dem KESSEL-Vault
- In `.gitignore` → wird niemals committed

---

## Workflow

### 1. Projekt-Setup (einmalig)

```bash
# 1. .env manuell erstellen mit KESSEL-Credentials
echo "NEXT_PUBLIC_SUPABASE_URL=https://ufqlocxqizmiaozkashi.supabase.co" > .env
echo "SERVICE_ROLE_KEY=eyJ..." >> .env

# 2. Secrets aus KESSEL-Vault holen → .env.local generieren
pnpm pull-env
```

### 2. Tägliche Entwicklung

```bash
# Dev-Server starten (nutzt .env.local automatisch)
pnpm dev

# MCP kommuniziert mit KESSEL-Projekt
# → Tabellen anlegen, Queries ausführen, Secrets verwalten
```

### 3. Bei Secret-Änderungen

```bash
# Wenn Secrets im Vault geändert wurden:
pnpm pull-env  # Aktualisiert .env.local
```

---

## MCP-Konfiguration

### Ein MCP pro Workspace (Governance-Regel)

Dieses Projekt nutzt **genau einen Supabase-MCP**. Er ist immer mit der KESSEL-Datenbank verbunden.

```json
{
  "mcpServers": {
    "supabase_KESSEL": {
      "type": "http",
      "url": "https://mcp.supabase.com/mcp?project_ref=ufqlocxqizmiaozkashi"
    }
  }
}
```

**Wichtig:** Keine weiteren Supabase-MCP-Server in diesem Workspace aktivieren!

Cursor hat bekannte Bugs beim Routing von Requests auf mehrere MCP-Instanzen desselben Typs. Diese Architektur umschifft das Problem.

### Andere DBs ansprechen (ohne MCP)

Falls du auf andere Supabase-Datenbanken zugreifen musst:

- **Backend-API-Routes** (`/api/...`)
- **Supabase SDK** (`@supabase/ssr`, `@supabase/supabase-js`)
- **Server-Side Scripts** (`scripts/*.mjs`)

```typescript
// Beispiel: Zugriff auf INFRA-DB ohne MCP
import { createClient } from "@supabase/supabase-js"
const infraClient = createClient(INFRA_URL, INFRA_KEY)
```

Siehe auch: [MCP Governance Rules](../../.cursor/rules/mcp-governance.mdc)

---

## 🔒 SERVICE_ROLE_KEY - Kritische Sicherheitsrichtlinien

Der `SERVICE_ROLE_KEY` ist **der mächtigste Schlüssel**. Er hat **vollständigen Zugriff** auf die Datenbank.

### ⚠️ NIEMALS:

1. Im Client-Code verwenden
2. In Git committen
3. Als `NEXT_PUBLIC_*` Variable definieren
4. In Logs ausgeben

### ✅ Nur verwenden in:

- `scripts/pull-env.mjs` (Vault-Zugriff)
- Server-Side API-Routes (wenn nötig)
- Production Environment Variables

---

## Vault-Funktionen

Das KESSEL-Projekt hat folgende Vault-Funktionen:

- `insert_secret(name TEXT, secret TEXT)` - Secret erstellen
- `read_secret(secret_name TEXT)` - Secret lesen
- `delete_secret(secret_name TEXT)` - Secret löschen
- `get_all_secrets_for_env()` - Alle Secrets für `.env.local` exportieren

**Sicherheit:** Alle Funktionen sind nur für `service_role` zugänglich.

---

## Sicherheits-Checkliste

- [ ] `.env` ist in `.gitignore`
- [ ] `.env.local` ist in `.gitignore`
- [ ] `SERVICE_ROLE_KEY` wird nur serverseitig verwendet
- [ ] MCP zeigt auf KESSEL-Projekt
- [ ] Kein Client-Code importiert `SERVICE_ROLE_KEY`

---

## Verifikation

```bash
# Prüfe, ob .env in Git ist (sollte NICHT sein)
git ls-files | grep "\.env$"

# Prüfe .env (KESSEL-Projekt)
grep "supabase.co" .env
# Sollte: ufqlocxqizmiaozkashi (KESSEL) zeigen

# Prüfe .env.local (KESSEL-Projekt)
grep "supabase.co" .env.local
# Sollte: ufqlocxqizmiaozkashi (KESSEL) zeigen

# Teste pull-env
pnpm pull-env
# Sollte erfolgreich sein und .env.local aktualisieren
```

## Vault-Secrets verwalten

### Secret hinzufügen (via MCP)

```sql
SELECT vault.create_secret('SECRET_VALUE', 'SECRET_NAME');
```

### Secret lesen (via MCP - nur service_role)

```sql
SELECT read_secret('SECRET_NAME');
```

### Secret aktualisieren

```sql
-- Altes Secret löschen
SELECT delete_secret('SECRET_NAME');

-- Neues Secret erstellen
SELECT vault.create_secret('NEUER_WERT', 'SECRET_NAME');
```

### Alle Secrets auflisten

```sql
SELECT name, created_at, updated_at
FROM vault.secrets
ORDER BY name;
```

---

## Migration von Zwei-Projekt-Architektur

Falls du von der alten Zwei-Projekt-Architektur migrierst:

1. Secrets aus altem Vault exportieren (via `pnpm pull-env` mit alter `.env`)
2. Secrets ins KESSEL-Vault importieren (via MCP oder SQL)
3. `.env` auf KESSEL-Projekt umstellen
4. `pnpm pull-env` testen

Siehe auch: [Migration Guide](../06_history/CHANGELOG.md)

---

## Weitere Informationen

- [Supabase Vault Documentation](https://supabase.com/docs/guides/platform/vault)
- [MCP Setup](./mcp-setup.md)
- [Multi-Tenant Architektur](./multi-tenant-architektur.md)
