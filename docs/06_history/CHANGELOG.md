# Changelog

Alle bemerkenswerten Änderungen an diesem Projekt werden in dieser Datei dokumentiert.

Das Format basiert auf [Keep a Changelog](https://keepachangelog.com/de/1.0.0/),
und dieses Projekt hält sich an [Semantic Versioning](https://semver.org/lang/de/).

## [Unreleased]

### Geplant

- `kessel update` Command für automatisierte Updates
- NPM Package Extraktion für Core-Komponenten

---

## [1.1.0] - 2024-12-19

### Added

- **Dynamischer App-Name**: App-Name wird aus `NEXT_PUBLIC_APP_NAME` geladen
  - Anzeige immer in Großbuchstaben (CAPITALS)
  - Fallback zu "KESSEL APP" wenn nicht gesetzt
  - Angepasst in Navbar (Spalte 1) und Welcome-Seite
- **User-Name in Navbar**: Button "User Details" zeigt jetzt den Namen des angemeldeten Users
  - Verwendet `user.name` oder E-Mail-Username als Fallback
  - Dynamische Aktualisierung bei User-Wechsel

- **Local Dev Bypass**: Development-Modus mit User-Auswahl statt Login
  - API Route `/api/dev/users` listet alle registrierten User
  - API Route `/api/dev/impersonate` ermöglicht One-Click-Login
  - `DevUserSelector` Komponente mit User-Liste
  - Aktiviert via `NEXT_PUBLIC_AUTH_BYPASS=true`

- **Boilerplate Update-Workflow Dokumentation**
  - Feature Wishlist via GitHub Issues
  - Semantic Versioning mit Git Tags
  - CHANGELOG-Pflege
  - Update-Strategien für abhängige Apps

### Changed

- **Login-Seite**: Conditional Rendering für Dev-Mode vs. Production
  - Dev-Mode: DevUserSelector (User-Liste)
  - Production: Standard Supabase Auth UI

### Fixed

- **AI-Service Fehlerbehandlung**:
  - Status-Code 503 (Service Unavailable) statt 500
  - Spezifischer Error-Code `AI_SERVICE_NOT_CONFIGURED`
  - Benutzerfreundlichere Fehlermeldung im AIChatPanel

- **Hydration Mismatch**: Login-Seite prüft Dev-Mode jetzt client-seitig
  - Verwendet `useState` + `useEffect` statt direkter Prüfung
  - Verhindert Server/Client Rendering-Unterschiede

- **Auth State Refresh**: Nach Dev-Login wird Auth-Context explizit aktualisiert
  - `refreshUser()` nach Impersonation aufgerufen
  - Sidebar zeigt sofort korrekten User (kein F5 nötig)

---

## [1.0.0] - 2024-12-18

### Added

- **Multi-Tenant Architektur**: Alle Projekte teilen ein Supabase-Projekt
  - Schema-Isolation pro Projekt (z.B. `galaxy`, `app2`)
  - Automatische Schema-Erstellung via CLI
  - Storage-Isolation mit Projekt-Prefix

- **Kessel CLI Integration**
  - `kessel <project-name>` erstellt neues Projekt
  - Automatische Supabase-Schema-Erstellung
  - Default-User-Provisioning (admin@local, user@local)
  - MCP-Konfiguration für Cursor

- **4-Spalten App Shell**
  - Navbar (Spalte 1): Primäre Navigation mit RBAC
  - Explorer (Spalte 2): Optionaler Kontext-Browser
  - Main Area (Spalte 3): Hauptinhalt mit Floating Header/Footer
  - Assist (Spalte 4): AI-Chat, Hilfe-Panel

- **Theme-System mit Supabase**
  - Themes in Supabase Storage
  - Theme-Provider mit LocalStorage-Persistenz
  - TweakCN-kompatible CSS-Variablen
  - Dark Mode Support

- **Authentication**
  - Supabase Auth mit E-Mail/Passwort
  - Role-Based Access Control (RBAC)
  - Permissions-Context für UI-Steuerung

- **Design System Governance**
  - Strikte semantische Tokens (keine `bg-blue-500`)
  - ShadCN UI Komponenten
  - ESLint-Regeln für Token-Enforcement
  - Tailwind CSS v4 mit CSS-First Konfiguration

### Security

- Row Level Security (RLS) für alle Tabellen
- SERVICE_ROLE_KEY nur serverseitig
- Vault-basiertes Secrets Management

---

## Versionsvergleich

| Version | Datum      | Highlights                                          |
| ------- | ---------- | --------------------------------------------------- |
| 1.1.0   | 2024-12-19 | App-Name dynamisch, User-Name in Navbar, Dev Bypass |
| 1.0.0   | 2024-12-18 | Multi-Tenant, CLI Integration, App Shell, Themes    |

---

## Links

- [Releases](https://github.com/phkoenig/kessel-boilerplate/releases)
- [Issues](https://github.com/phkoenig/kessel-boilerplate/issues)
- [Update-Workflow](../04_knowledge/boilerplate-update-workflow.md)
