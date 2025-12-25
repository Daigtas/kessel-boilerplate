import { defineConfig, globalIgnores } from "eslint/config"
import nextVitals from "eslint-config-next/core-web-vitals"
import nextTs from "eslint-config-next/typescript"
import prettierConfig from "eslint-config-prettier"
import prettierPlugin from "eslint-plugin-prettier"

// Custom ESLint Rules
import noNextFontClassName from "./eslint/rules/no-next-font-classname.js"
import noRawFontNames from "./eslint/rules/no-raw-font-names.js"
import noHardcodedTailwind from "./eslint/rules/no-hardcoded-tailwind.js"
import useDesignSystemComponents from "./eslint/rules/use-design-system-components.js"
import noMiddlewareFile from "./eslint/rules/no-middleware-file.js"
import aiComponentCompliance from "./eslint/rules/ai-component-compliance.js"

/**
 * Lokales Plugin für projektspezifische Regeln.
 *
 * Design System Governance:
 * - no-next-font-classname: Verhindert .className von next/font auf Root-Elementen
 * - no-raw-font-names: Verhindert rohe Font-Namen in CSS
 * - no-hardcoded-tailwind: Verbietet hardcodierte Tailwind-Farben und Arbitrary Values
 * - use-design-system-components: Erzwingt ShadCN-Komponenten statt nativer HTML-Elemente
 * - no-middleware-file: Verhindert middleware.ts (deprecated in Next.js 16, nutze proxy.ts)
 */
const localPlugin = {
  rules: {
    "no-next-font-classname": noNextFontClassName,
    "no-raw-font-names": noRawFontNames,
    "no-hardcoded-tailwind": noHardcodedTailwind,
    "use-design-system-components": useDesignSystemComponents,
    "no-middleware-file": noMiddlewareFile,
    "ai-component-compliance": aiComponentCompliance,
  },
}

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Prettier Integration
  {
    plugins: {
      prettier: prettierPlugin,
      local: localPlugin,
    },
    rules: {
      "prettier/prettier": "error",
    },
  },
  // Custom Rule: Verbietet .className von next/font im gesamten Projekt
  {
    files: ["src/**/*.tsx", "src/**/*.ts"],
    plugins: {
      local: localPlugin,
    },
    rules: {
      "local/no-next-font-classname": "error",
    },
  },
  // Custom Rule: Verbietet middleware.ts (Next.js 16 Migration)
  {
    files: ["src/**/*.ts", "src/**/*.tsx"],
    plugins: {
      local: localPlugin,
    },
    rules: {
      "local/no-middleware-file": "error",
    },
  },
  // ESLint-Regeldateien von Plugin-Regeln ausschließen
  {
    files: ["eslint/**/*.js"],
    rules: {
      "import/no-anonymous-default-export": "off",
    },
  },
  // Design System Governance: Token-Prüfung für App-Code
  // Aktiviert für alle App-Seiten und Komponenten (außer ui/, das sind ShadCN-Basiskomponenten)
  {
    files: ["src/app/**/*.tsx", "src/components/**/*.tsx"],
    ignores: ["src/components/ui/**"],
    plugins: {
      local: localPlugin,
    },
    rules: {
      // Verbietet hardcodierte Tailwind-Farben und Arbitrary Values
      "local/no-hardcoded-tailwind": [
        "error",
        {
          allowCssVariables: true, // Erlaubt w-[var(--sidebar-width)]
          enforceSpacingScale: false, // Deaktiviert, da zu strikt für Migration
        },
      ],
    },
  },
  // Design System Governance: Komponenten-Prüfung für App-Code
  // Erzwingt ShadCN-Komponenten, aber NICHT in UI-Komponenten selbst
  {
    files: ["src/app/**/*.tsx", "src/components/shell/**/*.tsx"],
    ignores: ["src/components/ui/**"],
    plugins: {
      local: localPlugin,
    },
    rules: {
      // Erzwingt ShadCN-Komponenten statt nativer HTML-Elemente
      "local/use-design-system-components": [
        "error", // Strikt für neue Entwicklung
        {
          allowInUiComponents: true,
          checkLinks: true,
        },
      ],
    },
  },
  // AI Component Governance: Prüft AIInteractable Compliance
  {
    files: ["src/**/*.tsx", "src/**/*.ts"],
    ignores: [
      "src/components/ui/**",
      "**/__tests__/**",
      "**/*.test.tsx",
      "**/*.test.ts",
      "**/*.spec.tsx",
      "**/*.spec.ts",
    ],
    plugins: {
      local: localPlugin,
    },
    rules: {
      // Prüft dass AIInteractable Komponenten im Manifest registriert sind
      "local/ai-component-compliance": "error",
    },
  },
  // ESLint-Regel-Dateien ausschließen (dürfen require() verwenden)
  {
    files: ["eslint/**/*.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
      "import/no-anonymous-default-export": "off",
    },
  },
  // Prettier Config muss zuletzt kommen, um andere Regeln zu überschreiben
  prettierConfig,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Archivierte Dateien ignorieren
    "src/_archive/**",
  ]),
])

export default eslintConfig
