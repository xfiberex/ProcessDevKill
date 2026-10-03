# 🚀 Roadmap: ProcessDevKill

> Responde a **qué falta por hacer**. Lo abierto está aquí entero, con su criterio de aceptación;
> lo cerrado, en una línea por Tier y con su detalle en [docs/TIERS-1-11.md](docs/TIERS-1-11.md) y
> [docs/TIER-12.md](docs/TIER-12.md).
> Por qué se decidió cada cosa, en [CONTEXT §4](CONTEXT.md); qué trajo cada versión, en el
> [CHANGELOG](CHANGELOG.md).
>
> Los checkboxes se marcan `[x]` **solo con la funcionalidad probada**. Si se probó a medias, la
> tarea dice qué quedó fuera.

## Lo hecho

| Tier | Qué trajo | Versión |
|---|---|---|
| 1 | **MVP**: la lista de procesos de desarrollo y el Kill | hasta la v1.1.1 |
| 2 | UX/UI y reactividad: eventos desde Rust, filtros, animaciones | hasta la v1.1.1 |
| 3 | **El puerto de cada proceso**, la bandeja, el atajo global y el historial | hasta la v1.1.1 |
| 4 | Uso intensivo: selección múltiple, menú contextual, rendimiento | hasta la v1.1.1 |
| 5 | Producto: tema, icono, Auto-Kill, Zombie Finder e instaladores | hasta la v1.1.1 |
| 6 | Proyecto publicado: licencia, README, pruebas del frontend y auto-actualización | v1.1.1 |
| 7 | Deuda técnica tras la primera revisión, y la documentación compactada | v1.2.0 |
| 8 | El medidor del entorno en el sidebar | v1.3.0 |
| 9 | La actualización, en silencio (`/S /UPDATE /R`) | v1.3.1 |
| 10 | **Servicios de desarrollo**: ver, arrancar, detener y cambiar el arranque, con deshacer | v1.5.0 |
| 11 | Auditoría de UX/UI: riesgo, accesibilidad, maquetación, consistencia, pulido y modo administrador | v1.6.0 a v1.8.0 |
| 12 | [Re-auditoría completa](docs/TIER-12.md): 39 tareas de seguridad, código, arquitectura, pruebas, DevOps, legal y redacción | v1.8.1 a v1.9.1 |
| — | [Revisión del 2026-08-18](docs/REVISION-2026-08-18.md): 37 tareas, cerradas | v1.3.2 a v1.5.0 |

---

## 🧩 Tier 13: Más runtimes y lo que el Tier 12 dejó suelto — abierto el 2026-10-02
*Objetivo: vigilar Java, Deno y Bun de fábrica, y cerrar lo que el Tier 12 dejó dicho y sin hacer
que se puede hacer sin depender de otra persona.*

> **No sale de una auditoría**: sale de «Lo que queda suelto» tras el Tier 12 y de las decisiones
> pendientes de [CONTEXT §5](CONTEXT.md). Lo que depende de terceros —la revisión legal y la
> lectura del inglés por un nativo— se queda abajo, en «Lo que queda suelto».
>
> **Plan de cortes:** T13-01 a T13-04 en una tanda, que se corta como **v1.10.0** (los runtimes
> nuevos son función nueva). T13-05 se hace con ese corte, porque es la versión a la que se
> actualiza. T13-06, después.
>
> Esfuerzo: **bajo** = una sesión corta; **medio** = una sesión larga o dos.

- [ ] **[T13-01] Java, Deno y Bun, vigilados de fábrica**
  - **Ubicación:** `src-tauri/src/processes.rs` (`Runtime`, `classify`, `OPCIONES_CON_VALOR`),
    `src-tauri/src/tray.rs`, `src-tauri/src/textos.rs`, `src/types.ts`, `src/icons.tsx`,
    `src/i18n.tsx`, `tools/prueba-en-marcha.mjs`
  - **Qué hacer:** tres variantes nuevas de `Runtime` con su espejo en `types.ts`, su icono, su
    filtro en el sidebar, su entrada en el menú de la bandeja y sus textos en los dos idiomas.
    `java` y `javaw` cuentan como Java: los dos los usan herramientas de desarrollo (el demonio de
    Gradle, Eclipse, los servidores de lenguaje). Java entra de fábrica por decisión del usuario
    (CONTEXT §4, 2026-10-02): la fila dice qué es cada proceso, y lo que no sea de desarrollo se
    protege.
  - **Que la fila diga qué es:** `describe` está escrito para Node, Python y .NET. Con
    `java -cp C:\libs\a.jar;C:\libs\b.jar com.app.Main` tomaría el classpath por el script y la
    fila diría `b.jar`, el último tramo, en vez de la clase principal. Hay que añadir a `OPCIONES_CON_VALOR` las de Java que llevan valor aparte
    (`-cp`, `-classpath`, `--class-path`, `-p`, `--module-path`, `--add-opens`, `--add-exports`,
    `--add-modules`…), para que salga la clase principal o el `.jar`. `-jar app.jar` y `-m mod/Main`
    ya salen bien. Bun y Deno con su verbo (`bun run dev`, `deno task start`, `deno run main.ts`) se
    comprueban igual.
  - **Lo que la descripción no cubre:** Nuke All, «Cerrar todos los Java» en la bandeja, el atajo
    global y el Auto-Kill cierran sin mirar la fila. Un Minecraft o una aplicación de escritorio
    en Java caería con ellos si no está protegido. El README lo dice al presentar Java.
  - **Criterio de aceptación:** la prueba negativa obligatoria: un `java` protegido no cae por
    ninguna de las vías (como `un_protegido_no_cae_por_ninguna_via`), y ningún proceso cuyo nombre
    solo contenga «java», «bun» o «deno» (`javaws`, `bunny`) entra en la lista. `describe` con un
    classpath da la clase principal. En vivo: un proceso de cada runtime nuevo, lanzado por el guion,
    sale en su filtro y se cierra; si el equipo no tiene Java, Deno o Bun, `lanzar_disfrazado` da
    la copia con el nombre, y se dice.
  - **Esfuerzo:** medio · **Depende de:** ninguna

- [ ] **[T13-02] Los avisos de las dependencias de desarrollo, resueltos o explicados**
  - **Ubicación:** `package.json`, `package-lock.json`, este ROADMAP
  - **Qué hacer:** el 2026-10-02, después de los PR de Dependabot, `npm audit` da **7 avisos, 6 altos
    y 1 moderado**, no el moderado solo que se había anotado. Los altos son de `braces`, por
    `shadcn` → `ts-morph` → `fast-glob` → `micromatch`; el moderado, de `qs`. Ninguno viaja en el
    instalador, así que no bloquean ni la CI ni el corte. Subirlos sin tocar lo que sí viaja; lo que
    no tenga arreglo dentro del rango se dice con su motivo.
  - **Criterio de aceptación:** el resumen de la CI enseña 0 avisos, o cada uno que quede tiene
    escrito aquí por qué. `node tools/avisos-de-terceros.mjs --comprobar` sigue en verde.
  - **Esfuerzo:** bajo · **Depende de:** ninguna
  - **Hecho en local el 2026-10-02; falta verlo en el resumen de la CI tras el push.** Producción
    sigue a 0. `qs` sube de 6.15.3 a 6.16.0 con `npm update qs`, que cierra los dos avisos
    moderados y solo toca esa entrada del lockfile. **`npm audit fix` no sirve aquí**: de paso sube
    `shadcn` de 3.8.3 a 3.8.5 sin quitar ningún aviso, y `shadcn` sí viaja —su `tailwind.css` va en
    el CSS compilado—, así que obligaba a regenerar los avisos de terceros a cambio de nada.
    **Los 6 altos se quedan**, todos el mismo: `braces`
    ([GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), publicado el
    2026-09-18) **no tiene versión arreglada**; afecta a todas hasta la 3.0.3, que es la última. Los
    otros cinco son la cadena que lo arrastra (`micromatch`, `fast-glob`, `@ts-morph/common`,
    `ts-morph` y `shadcn`). Lo que propone npm, `shadcn` 1.0.0, es bajar dos versiones mayores, y
    `shadcn` 4 sigue colgando de `fast-glob`. El riesgo es una denegación de servicio con patrones
    anidados a propósito, y aquí solo los lee el CLI de `shadcn` cuando lo ejecuta quien desarrolla:
    no se puede explotar desde la app. Se quita cuando `braces` publique el arreglo. Pruebas
    (398), lint y `--comprobar`, en verde.

- [ ] **[T13-03] Las pruebas en marcha, probadas en el runner**
  - **Ubicación:** `.github/workflows/ci.yml`, `tools/prueba-en-marcha.mjs`
  - **Qué hacer:** un job que solo se lanza a mano (`workflow_dispatch`) en `windows-latest`, que
    compila la copia `.envivo` y la conduce. Si aguanta, se decide si pasa a cada push; si no, se
    anota por qué (sin escritorio, WebView2, el tiempo) en CONTEXT §4 y la excepción de CLAUDE.md
    sigue como está.
  - **Criterio de aceptación:** una ejecución en verde con su enlace, o el motivo exacto del fallo.
  - **Esfuerzo:** bajo a medio · **Depende de:** ninguna

- [ ] **[T13-04] Las notas de cada versión, también en inglés** (T12-36)
  - **Ubicación:** `CHANGELOG.md`, `src/lib/notas.ts`, `src/lib/notas.test.ts`, `release.ps1`
  - **Qué hacer:** quien tiene la app en inglés lee las notas de la actualización en español. Cada
    versión lleva su texto en inglés y la app elige según su idioma. El título «Descarga» donde la
    app deja de leer no cambia en un sitio sin el otro.
  - **Criterio de aceptación:** `notas.test.ts` cubre los dos idiomas y la falta del inglés (cae
    al español, no a nada); en vivo, la app en inglés enseña las notas en inglés.
  - **Esfuerzo:** medio · **Depende de:** ninguna

- [ ] **[T13-05] Una actualización de punta a punta, vista** (T12-02)
  - **Qué hacer:** con la v1.9.1 instalada, actualizar a la v1.10.0 desde la app: una vez normal y
    otra con el instalador bloqueado o cambiado tras la descarga, que la app tiene que rechazar.
  - **Criterio de aceptación:** las dos vistas en el equipo del usuario, con lo que se vio escrito.
  - **Esfuerzo:** bajo · **Depende de:** el corte de la v1.10.0

- [ ] **[T13-06] Lo que no se ha visto en vivo: provocarlo o decir que no**
  - **Qué hacer:** el gancho de pánico (T12-14), un PID reciclado (T12-09), una conexión lenta
    (T12-17) y el aviso de «protegido» cuando el guardado falla (T12-08) tienen sus pruebas y nunca
    se han visto en marcha. Para cada uno, provocarlo en la copia `.envivo` si es barato —el pánico
    lo es— o dejar escrito que se queda cubierto solo por sus pruebas.
  - **Criterio de aceptación:** los cuatro decididos, y los que se provoquen, en el guion.
  - **Esfuerzo:** bajo · **Depende de:** ninguna

### Lo que queda suelto

Cosas dichas y sin hacer que no son del Tier 13, casi siempre porque dependen de otra persona.

- **La revisión legal de `THIRD-PARTY-NOTICES.txt` no se ha hecho** (T12-30). El archivo
  reproduce lo que se podía reproducir y dice lo que no. Por dónde empezaría: el cargador de
  WebView2 de Microsoft, enlazado en el binario y sin su licencia reproducida, y los 13
  componentes que no publican archivo de licencia. Con ella iría también si el ajuste de
  T12-31 basta en todas las jurisdicciones.
- **Los PR de Dependabot se miran y se fusionan a mano.** Los siete que abrió al encenderlo
  (`undici`, `hono`, `brace-expansion`, `ip-address`, `fast-uri`, `js-yaml` y `vitest`) se
  fusionaron el 2026-10-02. Seguirá abriendo otros: cada uno se lee, se comprueba que solo toca
  dependencias de desarrollo —o se regeneran los avisos de terceros si no— y se fusiona con la
  CI en verde. Queda una alerta abierta, la de `glib`: es un crate de Linux, no va en el binario
  de Windows, y `cargo audit` la deja pasar como aviso.
- **El inglés no lo ha leído un hablante nativo** (T12-35).

---

## 🔎 Revisión 2026-08-18 — cerrada

Auditoría estática del repositorio sobre la v1.3.1, en doce áreas: **37 tareas y ningún hallazgo
crítico**, cerradas las 37 el 2026-08-21. Cuatro se cerraron por decisión o por medición, no
escribiendo código: no habrá firma Authenticode (T4-02), el bundle no se divide porque no compensa
(T4-05), el rendimiento se midió (T4-03) y no había CI (T4-04, **revocada el 2026-09-23**: ver
CONTEXT §4). El detalle, en [docs/REVISION-2026-08-18.md](docs/REVISION-2026-08-18.md).

> **Los numerados se distinguen por el prefijo:** `Tier 4` es un Tier de este documento, `T4-01`
> una tarea de aquella revisión y `T12-01` una del [Tier 12](docs/TIER-12.md).
