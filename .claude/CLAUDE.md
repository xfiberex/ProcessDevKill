# ProcessDevKill — convenciones del proyecto

App de escritorio (Tauri 2 + React + TypeScript) que lista los procesos de desarrollo activos con
su CPU, su RAM y **el puerto local que ocupa cada uno**, y permite cerrarlos. Solo Windows.

El estado y las decisiones viven en [CONTEXT.md](../CONTEXT.md), y lo que falta por hacer en
[ROADMAP.md](../ROADMAP.md). **Leer los dos antes de tocar nada**: casi todo lo que parece raro está
explicado en CONTEXT §4 con su fecha y su motivo. Lo que cambió en cada versión, contado para quien
usa la app, en [CHANGELOG.md](../CHANGELOG.md). Lo cerrado vive entero en `docs/`: los Tiers 1 a 11
en [docs/TIERS-1-11.md](../docs/TIERS-1-11.md), la auditoría del 2026-08-18 en
[docs/REVISION-2026-08-18.md](../docs/REVISION-2026-08-18.md) y la historia sesión a sesión en
[docs/BITACORA.md](../docs/BITACORA.md). Ninguno de los tres hace falta salvo para reconstruir cómo
se llegó a algo.

**Al cerrar un Tier, su detalle sale del ROADMAP a `docs/`** y en el ROADMAP queda una línea en «Lo
hecho». Mientras algo es accionable su sitio es el ROADMAP; cerrado, es historia. Así se hizo con la
bitácora (2026-07-27), la revisión (2026-08-23) y los Tiers 1 a 11 (2026-09-30).

**Este archivo es la fuente única de las convenciones.** Hasta el 2026-07-27 también estaban en
CONTEXT.md §7, con una nota que pedía cambiarlas en los dos sitios; la copia se había quedado corta,
que es lo que pasa siempre. Al añadir una regla aquí, no se replica en ningún otro documento.

## Reglas de esta casa

- **Una sola sesión de agente por repositorio.** Dos a la vez se sobrescriben los archivos, y el
  `tauri dev` de una reinicia la app que la otra está inspeccionando. Pasó el 2026-07-24 y costó
  una sesión entera de repasar qué se había perdido.
- **Idioma:** todo en español —comentarios, mensajes de commit, textos de la UI, nombres de tests—
  salvo los identificadores de código, que van en inglés.
- **Commits en imperativo:** «Añade comando get_processes», no «Añadido» ni «Adding».
- Los checkboxes de ROADMAP.md se marcan `[x]` **solo cuando la funcionalidad está probada**, no
  cuando está escrita. Si se probó a medias, se dice qué quedó fuera.
- **Lo que cambia para quien usa la app se anota en la sección «Sin publicar» del CHANGELOG** al
  hacerlo, no al cortar la versión. Y si el README describe algo que aún no está publicado, lo dice.
- Toda decisión técnica que contradiga o precise el roadmap se anota en CONTEXT.md §4 con su fecha.

## Comentarios

Este código explica **por qué**, no qué. Un comentario que repite lo que dice la línea siguiente
sobra; uno que explica por qué se eligió lo raro en vez de lo obvio vale su peso en oro. Cuando algo
se descubrió probando y costó, se escribe: hay media docena de comentarios así y son los que evitan
repetir el error.

Ejemplo del estilo que se busca, de `processes.rs`:

> Crear el `System` con `RefreshKind::nothing()`: **obligatorio**, porque sysinfo multiplica el uso
> de CPU por `cpus.len()` y con `System::new()` esa lista queda vacía → todos los procesos
> reportarían 0 %.

**Lo nuevo se escribe con su ortografía entera: tildes, «ñ», «¿» y «¡»** (T12-33). El Tier 7.3 dejó
los comentarios sin tildes «de forma sistemática» y desde entonces conviven los dos estilos:
`textos.rs` y `lib.rs` sin ellas, `service_control.rs` y `elevation.rs` con ellas. Todo lo escrito
desde el Tier 10 las lleva, así que esa es la regla. **Lo que ya está no se reformatea**: un commit
que solo pone tildes cambia cientos de líneas, no arregla nada y deja el `git blame` apuntando a él.
Un comentario se corrige cuando se toca por otro motivo. Los nombres de las pruebas de Rust son
identificadores y siguen sin tildes (`el_catalogo_ingles_no_tiene_letras_del_espanol`).

## Backend (Rust, `src-tauri/src/`)

- Comandos de Tauri en `snake_case`: `get_processes`, `kill_process`.
- `lib.rs` es **arranque y `AppState`, y nada más**; los comandos viven en `commands.rs` y la
  lógica en `lista`, `processes`, `ports`, `storage`, `tray`, `poller`, `auto_kill`, `hotkey`,
  `notify`, `textos`, `services`, `service_control`, `elevation` y `update`. **Cuando `lib.rs` vuelva
  a pasar de ~450 líneas de código, se parte otra vez**: ya ha pasado cinco veces (Tier 4, Tier 7.6,
  Tier 10, Tier 11 y T12-16, que sacó a `lista.rs` el camino de la lista y del cierre). **Ahora
  mismo van 302** (2026-10-01), medidas sin el `mod tests`, que es como cuenta esta regla.
- Los comandos que tienen lógica propia detrás **no** están en `commands.rs`: los de servicios van
  en `service_control.rs` junto a su guardia, los del actualizador en `update.rs` y los del log en
  `logging.rs`. Se registran con su ruta (`service_control::control_service`) y el nombre por IPC
  lo da el último segmento, así que mover un comando de archivo no cambia cómo se le llama.
- **Todo el texto de cara al usuario que escribe Rust vive en `textos.rs`**, en los dos idiomas y
  con el catálogo comprobado por el compilador. `notify.rs` solo envía; las palabras no son suyas.
  El espejo de esto en el frontend es `src/i18n.tsx`. **Un error que acaba en la ventana se
  devuelve como enum sin frase** (`update::Fallo`, `processes::FalloCierre`,
  `storage::FalloGuardado`), y el comando lo convierte con su función de `textos.rs` en el idioma
  de la app. Un `Err(format!("…"))` en español es el fallo que arregló T12-05.
- Los comandos del actualizador se registran como `update::check_update` en `generate_handler!`. El
  nombre por IPC lo da el **último segmento**, así que `invoke("check_update")` no cambia.
- **Toda muerte de proceso pasa por `kill_and_record`.** La ventana, la bandeja, el atajo global y
  el Auto-Kill comparten camino, así que los cuatro notifican, registran en el historial y refrescan
  igual. Tres rutas separadas se desincronizaron a la primera. Por ahí pasa también la guardia de
  los **procesos protegidos**: una vía nueva que cierre procesos los deja fuera al elegir, y
  `kill_one` los vuelve a rechazar.
- Separar la lógica pura del comando de Tauri (como `collect_processes` / `get_processes`) para
  poder probarla sin montar una `App`.
- Los candados: copiar los ajustes y **soltar** su candado antes de bloquear `sys`. Nunca anidarlos.
  El turno de escritura de `Storage` (T12-13) es una hoja: dentro no se pide ningún otro, y así se
  queda.
- **Lo que escribe en un archivo de datos pide el turno antes de leerlo** (`Storage::en_exclusiva`):
  leer, modificar y escribir sin turno pierde lo que otro hilo acaba de guardar.
- Cualquier comando que reciba un PID valida que sea de un runtime vigilado. Un comando de Tauri
  acepta lo que le manden; sin la guardia sería un «mata lo que quieras».

## Frontend (`src/`)

- **`App.tsx` une y pinta; lo que tiene estado propio vive en su hook** (`hooks/useSettings`,
  `useProcessList`, `useKills`, `useServices`, `useUpdater`). **Cuando vuelva a pasar de ~450
  líneas, se parte otra vez**, igual que `lib.rs`: ya ha pasado dos veces (Tier 7.6 y T12-15, que
  lo encontró en 927). **Ahora mismo van 374** (2026-10-02). El diálogo de confirmación y los avisos
  se quedan en `App`, porque los comparten todas las vistas; un hook que los necesite los recibe.
- **Una vista nueva usa `ViewHeader` y `ViewBody`** (`components/ViewHeader.tsx`): cabecera fija
  con su `h2` y cuerpo con scroll. Si el cuerpo no tiene nada enfocable, `ViewBody` con `label`, o
  con teclado no se puede desplazar (Tier 11, D1).
- **Un solo verbo para cerrar procesos**: «Kill» y «Nuke All» en inglés en los dos idiomas; todo lo
  demás, «cerrar» / «close». Nada de «matar» ni «terminar» en textos de cara al usuario (D3).
- **El inglés es en-US y tiene su propia puntuación** (T12-35): «license», coma antes del «and» que
  cierra una lista, incisos entre rayas con espacios y comillas tipográficas. Las reglas están
  escritas encima de `en` en `i18n.tsx`, y `i18n.test.tsx` las hace cumplir.
- **Una fecha se escribe en el idioma de la app, no en el de Windows** (T12-39): `localeDeFechas`
  en `lib/format.ts`. Un `toLocaleString()` sin argumento es el fallo que arregló.
- **Lo que no puede actuar con los ajustes de fábrica espera a `cargados`** (`useSettings`). El
  primer render se pinta con los de fábrica, y los del disco llegan después: la comprobación de
  actualizaciones del arranque salía antes de saber que el usuario la había apagado (T12-31).
- **Una tabla con `table-fixed` lleva `min-w`**: la suma de sus columnas fijas más unos 100 px para la
  flexible. La ventana admite zoom, y sin mínimo la columna sin ancho —la del nombre, la que
  identifica la fila— se queda en 0 px (Tier 11, E).
- `src/types.ts` es el **espejo** de los tipos de Rust. Al cambiar un `struct` o una constante en
  `storage.rs`, hay que cambiarlo aquí — `src/types.test.ts` lee el fuente de Rust y falla si no.
- Nada de `navigator.clipboard`: exige que el documento tenga el foco y falla justo cuando la
  ventana vuelve de la bandeja. Se usa `tauri-plugin-clipboard-manager`.
- El frontend **no hace polling**. Rust empuja `processes-updated` y React solo escucha.
- Componentes de `src/components/ui/` los genera shadcn (estilo `base-nova`, sobre **Base UI**, no
  Radix). Se editan a mano solo cuando hace falta, y se anota por qué.
- **Al generar o regenerar uno con `shadcn add`, dos retoques obligatorios** (Tier 11, B1): los
  bordes de controles van con `border-control`, no `border-input`, y el anillo de foco con
  `ring-ring`, sin el `/50`. Lo que trae shadcn no llega a 3:1. Y revisa el import de `cn`: el
  2026-09-23 el generador lo importó del paquete de npm `cn` —y lo instaló— en vez de `@/lib/utils`.

## Pruebas

```bash
npm test                          # frontend: Vitest + Testing Library, en jsdom
cd src-tauri && cargo test        # backend: lee procesos reales del equipo
node tools/prueba-en-marcha.mjs   # el binario de release, arrancado y conducido
```

- **Toda tanda de cambios se prueba también con la app en marcha**, no solo en las suites: lo pidió
  el usuario el 2026-10-01, y `release.ps1` lo hace solo, también en `-DryRun`. El guion compila
  una copia **con otro identificador** (`com.processdevkill.app.envivo`) en `target/envivo`: tiene
  su propia carpeta de datos y su propio candado de instancia única, así que no ve los ajustes del
  usuario ni choca con su app abierta, y no toca `tauri.conf.json`. Solo cierra los procesos que
  él mismo lanza. **Una función nueva lleva su comprobación en ese guion**; lo que no se pueda
  provocar en vivo —un pánico, un PID reciclado, una versión más nueva que ofrecer— se dice.
  `--sin-compilar` reutiliza el binario cuando solo ha cambiado el guion.
- **Es la excepción a «una comprobación nueva va en los dos sitios»**: las pruebas en marcha no
  están en la CI. Piden una compilación de release entera y un escritorio donde abrir la ventana;
  mientras no se pruebe que el runner lo aguanta, viven solo en el corte.

- **La CI (`.github/workflows/ci.yml`) repite las comprobaciones de `release.ps1`** en cada push y
  PR, en `windows-latest`. Una comprobación nueva se añade **en los dos sitios**, o la CI dejará de
  adelantar lo que luego aborta el corte. La CI solo comprueba: no publica ni tiene secretos, y así
  se queda (`permissions: contents: read`).
- Las de Rust **solo matan procesos que lanzan ellas mismas**. Ninguna prueba puede tocar los
  procesos del usuario: es la regla que no se rompe.
- **Una prueba de Rust que no puede montar lo que necesita llama a `omitir("motivo")` antes de su
  `return`**, nunca sale callada (T12-18). Con `PDK_EXIGIR_NODE=1`, que ponen la CI y el corte, eso
  es un fallo; en el equipo de quien desarrolla, un aviso. Y si necesita un proceso propio con un
  nombre concreto, `lanzar_disfrazado` da una copia de `PING.EXE`, sin depender de Node.
- Las del frontend doblan los módulos de Tauri en `src/test/setup.ts`. Motion también se dobla ahí:
  `AnimatePresence` mantiene montada la fila que sale y, sin el doble, las aserciones acaban
  midiendo la animación en vez del filtro.
- Al añadir una función que pueda cerrar procesos sola, la prueba obligatoria es la del criterio
  **negativo**: qué NO debe cerrar.

## Cosas que cuestan una sesión si no se saben

- **PowerShell 5.1 destroza estos `.md`.** `Get-Content -Raw` los lee como ANSI y al guardarlos como
  UTF-8 deja todos los acentos rotos. Para editarlos, herramientas que respeten UTF-8.
- **En PowerShell, `$env:VAR = ""` BORRA la variable**, no la deja vacía: `SetEnvironmentVariable`
  trata la cadena vacía como `$null`. Compruébalo con `$env:X = ""; Test-Path Env:\X` → `False`. Si
  un proceso hijo necesita una variable vacía —el `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` de una clave
  sin contraseña—, hay que pasársela por `ProcessStartInfo.Environment`, que sí la admite. Con la
  variable borrada, el CLI de Tauri decide preguntar por consola y **el build se cuelga para
  siempre** sin dar error.
- **Las capturas del README las saca `tools/capture-screenshots.ps1` con el mismo truco**: una
  copia con otro identificador (`.capturas`) y sus propios ajustes, escritos por el script. No
  toca `tauri.conf.json` ni nada del usuario (T12-28). Enseñan los procesos y servicios reales del
  equipo: se miran antes de publicarlas.
- **Para inspeccionar la UI en marcha, lo primero es `tools/prueba-en-marcha.mjs`**, que no toca
  nada del usuario (ver Pruebas). Lo de abajo es para cuando haga falta mirar **la app instalada
  de verdad**, con sus ajustes: hay que añadir `"additionalBrowserArgs":
  "--remote-debugging-port=9222"` a la ventana en `tauri.conf.json` y **quitarlo después**
  —`release.ps1` se niega a cortar si lo encuentra—. La variable de entorno
  `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS` no sirve: Tauri la sobrescribe.
- **Antes de abrir ese puerto, mira `runAsAdmin` en el `settings.json` del usuario**
  (`%APPDATA%\com.processdevkill.app\`). Si está encendido, la build con el puerto **arranca
  elevada**: sale un UAC y queda un CDP sin autenticación en un proceso con privilegios, que
  cualquier programa del equipo puede conducir. Además, una consola sin elevar no puede cerrarla,
  porque UIPI se lo impide. Apágalo, respaldando antes el archivo, mientras dure la inspección.
  Pasó el 2026-09-25 (T12-27).
- **Si la build que lanzas se cierra sola al arrancar, hay otra instancia abierta**: la app es de
  instancia única y le pasa el testigo a la que ya corre, casi siempre la instalada del usuario. Si
  esa corre elevada, `Get-Process` no enseña su ruta y no se puede cerrar desde una consola sin
  elevar: hay que pedírselo al usuario («Salir» en la bandeja; cerrar la ventana solo la esconde).
- **El binario de release se construye con `npx tauri build --no-bundle`, no con `cargo build
  --release`.** Los assets de `dist/` los embebe el CLI de Tauri; el que sale de `cargo` arranca
  apuntando al `devUrl` y la ventana enseña `ERR_CONNECTION_REFUSED`. Se lee como si la app
  estuviera rota.
- **Nunca evaluar `navigator.clipboard.readText()` por CDP**: abre un diálogo de permiso dentro de
  la ventana que deja la evaluación colgada. Para comprobar el portapapeles, `Get-Clipboard`.
- **Los toast de Windows no se pueden capturar** con `Graphics.CopyFromScreen`: DWM los compone en
  otra capa y BitBlt no los recoge. Salen capturas vacías y se concluye en falso que no aparecen.
- **`SendKeys` no dispara un atajo global** registrado con `RegisterHotKey`. Hace falta entrada real
  a nivel de sistema (`keybd_event`).

## Releases

`.\release.ps1 -Version X.Y.Z` hace el corte entero. Antes, `-DryRun`.

**El corte termina comprobando lo publicado** (T12-24): los 4 assets, el `tag_name` de la API que
consulta la app y el instalador descargado contra su `.sha256` y contra el compilado. Si falla, el
release ya está fuera: se corrige o se despublica. `-VerifyOnly` repite solo esa comprobación.

**Las notas del release salen del CHANGELOG** (T12-23). Antes de cortar, lo de «Sin publicar» pasa a
una sección `## [X.Y.Z] — fecha`, con su enlace al final del archivo, y se commitea; sin esa sección
el script aborta. El dry run enseña las notas que publicaría. Lo que el script añade detrás empieza
por el título «Descarga», y **la app deja de leer las notas ahí** (`src/lib/notas.ts`): ese título
no se cambia en un sitio sin el otro, y `notas.test.ts` lo vigila.

La versión vive en **tres** sitios que tienen que ir a la vez: `tauri.conf.json` (la que manda),
`package.json` y `Cargo.toml`. El script los toca los tres.

**El `.sha256` del instalador NSIS no es decorativo: es lo que verifica la auto-actualización.** La
app lo descarga y lo compara con el instalador antes de ejecutarlo (`src-tauri/src/update.rs`). Un
release sin él hace que la app se niegue a actualizarse a esa versión — correcto, pero conviene
saberlo. No hay claves ni secretos que custodiar para cortar un release.

**Si algún día vuelve a haber un secreto en el proyecto, no lo vuelques nunca a la consola.** Los
archivos de clave suelen ser una sola línea de base64, así que `cat`, `head -1` o `Get-Content`
imprimen el secreto entero aunque solo quisieras ver la cabecera. Pasó el 2026-07-26 y costó rotar
una clave de firma.
