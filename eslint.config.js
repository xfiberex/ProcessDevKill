import js from "@eslint/js";
import a11y from "eslint-plugin-jsx-a11y";
import hooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

/**
 * ESLint del frontend.
 *
 * El backend tenía clippy desde el principio y el frontend no tenía nada: unas 4.000 líneas de TSX
 * con `tsc --strict` como única red. `tsc` comprueba tipos, no costumbres — un `useEffect` al que
 * le falta una dependencia, un `catch` que se traga el error o un `<div>` con `onClick` y sin
 * teclado le parecen bien a los tres.
 *
 * **ESLint 9, no 10, y no es por pereza:** `eslint-plugin-jsx-a11y` (6.10.2, la última) declara
 * como peer `eslint@^3 … ^9`. Con la 10 npm aborta, y forzarlo con `--legacy-peer-deps` deja el
 * plugin corriendo sobre una API que no dice soportar. Se sube cuando el plugin suba.
 *
 * Sin comprobación con tipos (`projectService`): multiplica el tiempo de la pasada y esto se
 * ejecuta en cada corte de versión desde `release.ps1`. Lo que aporta —promesas sin `await`,
 * sobre todo— aquí lo cubre `tsc --strict`, que ya corre en `npm run build`.
 */
export default tseslint.config(
  {
    // No se mira lo que no se escribe a mano.
    ignores: [
      "dist",
      "coverage",
      "src-tauri/target",
      // Los `.cjs` de los packs de skills: código de terceros que ni se compila ni se publica con
      // la app. Daban **142 de los 148 avisos de la primera pasada**, todos por ser CommonJS de
      // Node mirado con reglas de navegador. Qué hacer con esos 271 archivos es otra decisión
      // (T2-09); mientras tanto no pueden esconder los avisos del código propio.
      ".claude",
      // Los genera shadcn. Se editan a mano solo por excepción y anotando el motivo (CLAUDE.md),
      // así que sus avisos serían ruido sobre código que no es nuestro: mismo criterio que su
      // exclusión de la cobertura en vitest.config.ts.
      "src/components/ui",
    ],
  },

  js.configs.recommended,
  tseslint.configs.recommended,
  a11y.flatConfigs.recommended,
  // `configs.flat.*` y no `configs["recommended-latest"]`: el segundo sigue siendo el formato viejo
  // —declara `plugins` como array de cadenas— y ESLint 9 lo rechaza al arrancar.
  hooks.configs.flat["recommended-latest"],

  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      globals: { ...globals.browser },
    },
    rules: {
      // Un argumento que sobra suele ser un cambio de firma a medio hacer; uno que empieza por `_`
      // dice "sé que está aquí y no lo uso", que es justo lo que se quiere poder decir.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },

  {
    // Las pruebas corren en Node (vitest), no en el navegador: sin esto, `process` y compañía
    // salen como no definidos.
    files: ["**/*.test.{ts,tsx}", "src/test/**", "*.config.{ts,js}"],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
);
