# ProcessDevKill — convenciones del proyecto

App de escritorio (Tauri 2 + React + TypeScript) que lista los procesos de desarrollo activos con
su CPU, su RAM y **el puerto local que ocupa cada uno**, y permite cerrarlos. Solo Windows.

El estado y las decisiones viven en [CONTEXT.md](../CONTEXT.md); el plan por fases, en
[ROADMAP.md](../ROADMAP.md). **Leer los dos antes de tocar nada**: casi todo lo que parece raro está
explicado ahí con su fecha y su motivo.

## Reglas de esta casa

- **Una sola sesión de agente por repositorio.** Dos a la vez se sobrescriben los archivos, y el
  `tauri dev` de una reinicia la app que la otra está inspeccionando. Pasó el 2026-07-24 y costó
  una sesión entera de repasar qué se había perdido.
- **Idioma:** todo en español —comentarios, mensajes de commit, textos de la UI, nombres de tests—
  salvo los identificadores de código, que van en inglés.
- **Commits en imperativo:** «Añade comando get_processes», no «Añadido» ni «Adding».
- Los checkboxes de ROADMAP.md se marcan `[x]` **solo cuando la funcionalidad está probada**, no
  cuando está escrita. Si se probó a medias, se dice qué quedó fuera.
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

## Backend (Rust, `src-tauri/src/`)

- Comandos de Tauri en `snake_case`: `get_processes`, `kill_process`.
- `lib.rs` es arranque y comandos; la lógica vive en `processes`, `ports`, `storage` y `tray`.
- **Toda muerte de proceso pasa por `kill_and_record`.** La ventana, la bandeja, el atajo global y
  el Auto-Kill comparten camino, así que los cuatro notifican, registran en el historial y refrescan
  igual. Tres rutas separadas se desincronizaron a la primera.
- Separar la lógica pura del comando de Tauri (como `collect_processes` / `get_processes`) para
  poder probarla sin montar una `App`.
- Los candados: copiar los ajustes y **soltar** su candado antes de bloquear `sys`. Nunca anidarlos.
- Cualquier comando que reciba un PID valida que sea de un runtime vigilado. Un comando de Tauri
  acepta lo que le manden; sin la guardia sería un «mata lo que quieras».

## Frontend (`src/`)

- `src/types.ts` es el **espejo** de los tipos de Rust. Al cambiar un `struct` o una constante en
  `storage.rs`, hay que cambiarlo aquí — `src/types.test.ts` lee el fuente de Rust y falla si no.
- Nada de `navigator.clipboard`: exige que el documento tenga el foco y falla justo cuando la
  ventana vuelve de la bandeja. Se usa `tauri-plugin-clipboard-manager`.
- El frontend **no hace polling**. Rust empuja `processes-updated` y React solo escucha.
- Componentes de `src/components/ui/` los genera shadcn (estilo `base-nova`, sobre **Base UI**, no
  Radix). Se editan a mano solo cuando hace falta, y se anota por qué.

## Pruebas

```bash
npm test                      # frontend: Vitest + Testing Library, en jsdom
cd src-tauri && cargo test    # backend: lee procesos reales del equipo
```

- Las de Rust **solo matan procesos que lanzan ellas mismas**. Ninguna prueba puede tocar los
  procesos del usuario: es la regla que no se rompe.
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
- **Para inspeccionar la UI en marcha** hay que añadir `"additionalBrowserArgs":
  "--remote-debugging-port=9222"` a la ventana en `tauri.conf.json` y **quitarlo después**. La
  variable de entorno `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS` no sirve: Tauri la sobrescribe.
- **Nunca evaluar `navigator.clipboard.readText()` por CDP**: abre un diálogo de permiso dentro de
  la ventana que deja la evaluación colgada. Para comprobar el portapapeles, `Get-Clipboard`.
- **Los toast de Windows no se pueden capturar** con `Graphics.CopyFromScreen`: DWM los compone en
  otra capa y BitBlt no los recoge. Salen capturas vacías y se concluye en falso que no aparecen.
- **`SendKeys` no dispara un atajo global** registrado con `RegisterHotKey`. Hace falta entrada real
  a nivel de sistema (`keybd_event`).

## Releases

`.\release.ps1 -Version X.Y.Z` hace el corte entero. Antes, `-DryRun`.

La versión vive en **tres** sitios que tienen que ir a la vez: `tauri.conf.json` (la que manda),
`package.json` y `Cargo.toml`. El script los toca los tres.

**La clave privada minisign que firma las actualizaciones NO puede entrar en el repositorio.** Vive
en `%USERPROFILE%\.tauri\processdevkill.key` y lleva **contraseña**; el script la pide por consola.
Generar una nueva invalida a todos los usuarios ya instalados —su binario lleva grabada la pública
vieja—, así que no se hace salvo que no exista ninguna o esté comprometida.

**Nunca vuelques el archivo de la clave a la consola.** Es una sola línea de base64, así que
`cat`, `head -1` o `Get-Content` imprimen el secreto entero. Pasó el 2026-07-26 con un `head -1`
que pretendía leer solo el comentario, y obligó a rotar la clave. Si necesitas identificarla, usa
el `key id` de la **pública**:

```bash
node -e "const c=require('./src-tauri/tauri.conf.json');console.log(Buffer.from(Buffer.from(c.plugins.updater.pubkey,'base64').toString().split('\n')[1],'base64').subarray(2,10).toString('hex'))"
```
