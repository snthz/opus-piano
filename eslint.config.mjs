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
    // Archivos generados o de terceros servidos tal cual.
    "public/**",
    // El servicio de OMR es Python; su entorno virtual trae JavaScript de
    // paquetes de terceros (matplotlib) que aquí no pinta nada.
    "omr-service/**",
  ]),
]);

export default eslintConfig;
