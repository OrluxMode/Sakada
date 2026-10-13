// ESLint "flat" config. Run with: npm run lint
import js from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: ["node_modules/**", "playwright-report/**", "test-results/**"],
  },
  js.configs.recommended,
  {
    // Browser code. All of it is ES modules except js/main.js.
    files: ["js/**/*.js"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: {
        ...globals.browser,
        DOMPurify: "readonly", // loaded from cdnjs in the dashboards
      },
    },
  },
  {
    files: ["js/main.js"],
    languageOptions: { sourceType: "script" },
  },
  {
    // Unit tests, smoke tests and config files.
    files: ["tests/**/*.js", "e2e/**/*.mjs", "*.config.mjs"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: { ...globals.node, ...globals.browser },
    },
  },
  {
    rules: {
      "no-unused-vars": ["error", { argsIgnorePattern: "^_", caughtErrors: "none" }],
    },
  },
];
