# Boilerplate Update-Workflow

Dieses Dokument beschreibt, wie die Kessel-Boilerplate langfristig wartbar bleibt und wie Updates in abhängige Apps eingespielt werden können.

## Überblick

```
┌─────────────────────────────────────────────────────────────────┐
│                    KESSEL ÖKOSYSTEM                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌─────────────────┐                                           │
│   │  Boilerplate    │ ─── GitHub Issues (Bugs, Features)        │
│   │  (Template)     │ ─── Semantic Versioning (v1.0.0)          │
│   │                 │ ─── CHANGELOG.md                          │
│   └────────┬────────┘                                           │
│            │                                                    │
│            │  kessel <project-name>                             │
│            ▼                                                    │
│   ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│   │   Galaxy App    │  │   App 2         │  │   App N         │ │
│   │   (v1.0.0)      │  │   (v1.1.0)      │  │   (v1.2.0)      │ │
│   └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│                                                                 │
│            ▲                                                    │
│            │  kessel update (geplant)                           │
│            │                                                    │
└─────────────────────────────────────────────────────────────────┘
```

## Feature Wishlist & Bug Tracking

### GitHub Issues verwenden

Alle Bugs und Feature-Requests für die Boilerplate werden als **GitHub Issues** erfasst:

- **Repository**: https://github.com/phkoenig/kessel-boilerplate
- **Issues**: https://github.com/phkoenig/kessel-boilerplate/issues

### Labels

| Label              | Beschreibung                              |
| ------------------ | ----------------------------------------- |
| `bug`              | Fehler in der Boilerplate                 |
| `enhancement`      | Neue Features oder Verbesserungen         |
| `breaking-change`  | Änderung, die bestehende Apps beeinflusst |
| `documentation`    | Dokumentation verbessern                  |
| `good-first-issue` | Einfache Issues für den Einstieg          |
| `priority-high`    | Dringend zu beheben                       |
| `priority-low`     | Nice-to-have                              |

### Issue Templates

Es gibt vordefinierte Templates für:

- **Bug Report**: `.github/ISSUE_TEMPLATE/bug_report.md`
- **Feature Request**: `.github/ISSUE_TEMPLATE/feature_request.md`

---

## Versionierung

### Semantic Versioning

Die Boilerplate folgt [Semantic Versioning](https://semver.org/lang/de/):

```
MAJOR.MINOR.PATCH

1.0.0 → 1.0.1  (Patch: Bugfixes, keine Breaking Changes)
1.0.1 → 1.1.0  (Minor: Neue Features, abwärtskompatibel)
1.1.0 → 2.0.0  (Major: Breaking Changes)
```

### Version-Tracking

Die aktuelle Version wird in `boilerplate.json` im Root-Verzeichnis gespeichert:

```json
{
  "name": "kessel-boilerplate",
  "version": "1.1.0",
  "repository": "https://github.com/phkoenig/kessel-boilerplate"
}
```

### Git Tags

Jedes Release bekommt einen Git Tag:

```bash
# Neues Release taggen
git tag -a v1.1.0 -m "Release v1.1.0: Dynamischer App-Name, User-Name in Navbar"
git push origin v1.1.0
```

---

## CHANGELOG führen

Alle Änderungen werden in `docs/06_history/CHANGELOG.md` dokumentiert:

```markdown
## [1.1.0] - 2024-12-19

### Added

- Dynamischer App-Name aus NEXT_PUBLIC_APP_NAME
- User-Name statt "User Details" in Navbar

### Fixed

- AI-Service Fehlerbehandlung verbessert
```

### Regeln für CHANGELOG-Einträge

1. **Immer unter `[Unreleased]`** neue Änderungen eintragen
2. **Bei Release**: `[Unreleased]` → `[X.Y.Z] - YYYY-MM-DD`
3. **Kategorien**: `Added`, `Changed`, `Fixed`, `Removed`, `Security`, `Deprecated`

---

## Updates in Apps einspielen

### Strategie 1: Manual Cherry-Pick (Aktuell empfohlen)

Für gezielte Updates einzelner Features:

```bash
# In der App (z.B. galaxy)
cd galaxy

# Boilerplate als Remote hinzufügen (einmalig)
git remote add boilerplate https://github.com/phkoenig/kessel-boilerplate.git
git fetch boilerplate

# Einzelne Commits cherry-picken
git cherry-pick <commit-hash>

# Oder: Diff anschauen und manuell übernehmen
git diff boilerplate/main -- src/components/shell/Navbar.tsx
```

### Strategie 2: Kessel CLI Update (Geplant)

In Zukunft wird `kessel update` automatisierte Updates ermöglichen:

```bash
# Prüfen ob Updates verfügbar sind
kessel update --check

# Interaktives Update durchführen
kessel update

# Output:
# 🔄 Kessel Boilerplate Update
#
# Deine Version: v1.0.0
# Neueste Version: v1.2.0
#
# Änderungen:
# ✅ v1.1.0 - Dynamischer App-Name
#    - src/config/navigation.ts (geändert)
#    - src/components/shell/Navbar.tsx (geändert)
#
# Möchtest du updaten? [y/n/select]
```

### Strategie 3: NPM Package (Langfristig)

Wenn es viele Apps gibt, wird der Core als NPM Package extrahiert:

```bash
pnpm add @kessel/core@latest
pnpm add @kessel/ui@latest
```

---

## Breaking Changes minimieren

### Goldene Regeln

1. **Interfaces stabil halten**: Einmal definierte Props nicht ändern
2. **Additive Änderungen bevorzugen**: Neue Features als optionale Props
3. **Deprecation Warnings**: Alte APIs 1-2 Versionen beibehalten
4. **Migration Guides**: Bei Breaking Changes Anleitung schreiben

### Beispiel: Gute vs. Schlechte Änderung

```tsx
// ❌ SCHLECHT: Breaking Change
// Alt: <PageContent maxWidth="lg" />
// Neu: <PageContent size="lg" />  ← Prop umbenannt!

// ✅ GUT: Abwärtskompatibel
// Alt: <PageContent maxWidth="lg" />
// Neu: <PageContent maxWidth="lg" />  ← Funktioniert weiterhin
//      <PageContent size="lg" />       ← Neue Alternative (optional)
```

---

## Workflow bei neuen Features

### 1. Issue erstellen

```markdown
## Feature: XYZ

### Beschreibung

Was soll das Feature tun?

### Betroffene Dateien

- src/components/...
- src/config/...

### Breaking Change?

[ ] Ja → Major Version
[x] Nein → Minor Version
```

### 2. Feature entwickeln

```bash
git checkout -b feature/xyz
# ... entwickeln ...
git commit -m "feat: XYZ implementiert"
```

### 3. CHANGELOG aktualisieren

```markdown
## [Unreleased]

### Added

- XYZ Feature (#123)
```

### 4. Release erstellen

```bash
# Version in boilerplate.json erhöhen
# CHANGELOG: [Unreleased] → [1.2.0] - 2024-12-20
git add .
git commit -m "chore: Release v1.2.0"
git tag -a v1.2.0 -m "Release v1.2.0"
git push origin main --tags
```

---

## Roadmap

### Phase 1: Grundlagen ✅

- [x] GitHub Issues für Bug/Feature Tracking
- [x] CHANGELOG.md pflegen
- [x] Semantic Versioning mit Git Tags
- [x] boilerplate.json für Version-Tracking

### Phase 2: Tooling (Q1 2025)

- [ ] `kessel --version` zeigt Boilerplate-Version
- [ ] `kessel update --check` prüft auf Updates
- [ ] `kessel update` führt interaktives Update durch

### Phase 3: Package-Extraktion (Bei 10+ Apps)

- [ ] `@kessel/core` Package (Shell, Auth, Themes)
- [ ] `@kessel/ui` Package (angepasste ShadCN-Komponenten)
- [ ] Renovate/Dependabot Integration

---

## Verwandte Dokumentation

- [CLI Workflow](./cli-workflow.md)
- [Multi-Tenant Architektur](./multi-tenant-architektur.md)
- [Initial Setup](./initial-setup.md)
