import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Ignorar scripts e arquivos de configuração
    "scripts/**",
    "*.config.js",
    "*.config.ts",
    "postcss.config.js",
    "tailwind.config.js",
  ]),
  // Regras customizadas
  {
    rules: {
      // Desabilitar regra de any explícito - muitos casos legítimos em APIs
      "@typescript-eslint/no-explicit-any": "off",
      // Desabilitar warning de img - usamos img por performance em alguns casos
      "@next/next/no-img-element": "off",
      // Desabilitar regra de require imports - usado em scripts e configs
      "@typescript-eslint/no-require-imports": "off",
      // Desabilitar regra de aspas não escapadas - muitos falsos positivos
      "react/no-unescaped-entities": "off",
    },
  },
]);

export default eslintConfig;
