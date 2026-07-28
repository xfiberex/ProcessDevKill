# 🚀 Roadmap: ProcessDevKill — Process Manager para Devs

> Aplicación de escritorio construida con **Tauri 2 + React + Vite + TypeScript** para la gestión inteligente de procesos de desarrollo (`node`, `python`, `dotnet`, …).
>
> **Documento verificado** — 2026-07-23. Las notas ⚠️ marcan correcciones respecto a la idea original. El progreso y las decisiones se registran en [CONTEXT.md](CONTEXT.md).

---

## 🛠 Tier 1: Cimientos y MVP — ✅ **completado y verificado**
*Objetivo: tener una lista funcional de procesos y poder matarlos.*

Entorno (Rust vía `rustup`, plantilla React + TS + Vite de `create-tauri-app`, Tailwind v4), backend
con `sysinfo` (`get_processes` y `kill_process`), y frontend con sidebar de filtros y tabla de
nombre, PID, CPU, RAM, tiempo activo y botón Kill.

Lo que sigue enseñando algo:

> ⚠️ **Tailwind v4 se instala distinto que la v3**: `npm i tailwindcss @tailwindcss/vite`, plugin en
> `vite.config.ts` y `@import "tailwindcss";` en el CSS. Sin `tailwind.config.js` ni PostCSS.
> ⚠️ **Los runtimes no se detectan por prefijo**: `nodemon.exe` empieza por `node` sin serlo. Se
> exige nombre exacto o sufijo de versión (`python3.11`), con tests que lo cubren.
> ⚠️ **El calentamiento de CPU necesita tres muestras, no una.** sysinfo descarta la primera sin
> guardar líneas base y compara la segunda contra cero; solo la tercera es real. Es lo que hacía que
> todos los procesos reportaran 0 %, y los tests iniciales no lo cazaron porque la máquina estaba
> ociosa y 0 % parecía plausible.
> ⚠️ `kill_process` valida que el PID sea de un runtime vigilado. Un comando de Tauri acepta lo que
> le manden; sin la guardia sería un "mata lo que quieras".

---

## 🎨 Tier 2: UX/UI y Reactividad — ✅ **completado y verificado**
*Objetivo: que la app sea visualmente atractiva y fácil de usar.*

Iconos SVG por runtime, barras de consumo, animaciones de salida con Motion, auto-refresco
conmutable (Off / 2 s / 5 s), buscador, selección múltiple y **"Nuke All"** con diálogo de
confirmación, más `kill_processes` en Rust.

Lo que sigue enseñando algo:

> ⚠️ **Las barras se escalan al proceso que más consume de la lista**, no a la capacidad del equipo:
> con 32 GB de RAM, un Node de 300 MB daría una barra invisible. El número de al lado sí es absoluto.
> ⚠️ **Framer Motion se renombró**: el paquete es `motion` y se importa de `motion/react`.
> ⚠️ `kill_processes` devuelve **un resultado por PID**, no un `Result` global: en un lote es normal
> que alguno muera solo entre el refresco y el clic, y eso no debe impedir matar los demás.

---

## 🔧 Tier 3: Integración profunda con el sistema — ✅ **completado y verificado**
*Objetivo: dar información técnica que la terminal no da fácilmente.*

La **feature estrella**: cada PID mapeado a sus puertos locales en escucha con el crate
[`listeners`](https://crates.io/crates/listeners) 0.6, columna "Puerto" junto al nombre y búsqueda
por número de puerto. Más notificaciones nativas emitidas desde Rust e icono de bandeja con menú.

Lo que sigue enseñando algo:

> ⚠️ `sysinfo` **no expone puertos por proceso**; hizo falta el crate aparte.
> ⚠️ `listeners::get_all()` devuelve **todos** los sockets, incluidas las conexiones salientes. Hay
> que filtrar por `Protocol::TCP` + `SocketState::Listen`; si no, la UI enseñaría el puerto efímero
> de una petición HTTP en vez del puerto donde sirve tu servidor. Y un servidor que escucha en IPv4
> e IPv6 aparece dos veces con el mismo puerto: hay que deduplicar.
> ⚠️ En Windows, ver puertos de procesos de **otros usuarios** puede requerir permisos elevados.
> ⚠️ **Las notificaciones se emiten desde Rust, no desde el frontend**: la bandeja mata procesos sin
> que la ventana intervenga, y ahí un toast de la UI no lo vería nadie.
> ⚠️ La opción **"Salir"** del menú de la bandeja no estaba en el plan y es imprescindible: sin ella,
> esconder la ventana al cerrar dejaba la app sin forma de terminar. (Desde el Tier 7.4 la X cierra
> de fábrica, y esconderse es opcional.)

---

## ⚡ Tier 4: Power User y optimización — ✅ **completado y verificado**
*Objetivo: pulir detalles y mejorar el rendimiento.*

**Primer troceado de `lib.rs`** (a `processes`, `ports`, `storage` y `tray`) antes de seguir
creciendo. Vista de Historial persistida, lista de procesos vigilados editable, atajo global
`Ctrl+Alt+K` con interruptor, y el `setInterval` del frontend sustituido por un hilo en Rust que
emite `processes-updated`.

Lo que sigue enseñando algo:

> ⚠️ **Persistencia con archivos JSON propios, no `tauri-plugin-store`**: su API es de frontend, y
> aquí la bandeja y el atajo escriben historial sin que la ventana exista. Tope de 200 entradas para
> que el archivo no crezca sin fin, y un JSON corrupto degrada a valores por defecto en vez de
> impedir el arranque.
> ⚠️ Los nombres que añade el usuario se comparan **exactos**, no por prefijo: añadir `go` no debe
> capturar `golang`.
> ⚠️ El atajo global lleva **interruptor en Ajustes**: dispara un cierre masivo sin confirmación, y
> uno mal pulsado no debería ser irreversible por accidente.

---


## 📦 Tier 5: Distribución y estética final — ✅ **completado y verificado**
*Objetivo: que parezca un producto comercial.*

> **La app pasa a llamarse ProcessDevKill** (2026-07-24). Cambian el `productName`, el título de la
> ventana, la bandeja, el crate de Rust y el identificador (`com.processdevkill.app`), que es lo que
> decide dónde viven los ajustes y el historial.

Modo claro/oscuro, componentes de shadcn/ui, icono propio, las dos funciones "salsa secreta"
(**Auto-Kill** y **Zombie Finder**), instaladores NSIS y MSI, y `release.ps1` para cortar versiones.
**v1.0.0 publicada** (luego retirada; ver el Tier 6.5).

### Tema, componentes e icono

> ⚠️ **La clase `dark` la pone `src/theme.tsx`, no la media query de CSS.** Si lo decidiera el CSS,
> elegir "Claro" con Windows en oscuro no tendría ningún efecto. Con "Sistema" se escucha
> `prefers-color-scheme` en vivo y la app cambia sin reiniciar.
> ⚠️ Un script en `index.html` aplica el tema **antes de la primera pintura**, leyendo una copia en
> `localStorage`: los ajustes llegan de Rust de forma asíncrona y sin esto la ventana arrancaría en
> blanco unos milisegundos.
> ⚠️ El alias `@/` va en `vite.config.ts` **y** en `tsconfig.json`: uno resuelve el bundle y el otro
> el chequeo de tipos. Si falta en uno, falla el otro.
> ⚠️ **shadcn ya no genera sobre Radix**: el estilo `base-nova` usa **Base UI**, y el `Toast` clásico
> no existe — su sustituto es **Sonner**. El `sonner.tsx` generado importa `next-themes`; se
> reescribió para leer el tema de `src/theme.tsx`.
> ⚠️ El foco al abrir el diálogo se fuerza con `initialFocus`: Base UI enfoca "Cancelar" y aquí
> interesa el botón destructivo.
> ⚠️ **Copiar no puede usar `navigator.clipboard`**: exige que el documento tenga el foco y lanza
> `NotAllowedError` si no lo tiene, que es justo lo que pasa al recuperar la ventana de la bandeja.
> Se usa `tauri-plugin-clipboard-manager`, solo con permiso de escritura.
> ⚠️ El icono tiene que aguantar los **16 px de la bandeja**: la primera versión llevaba un corchete
> que a ese tamaño era un borrón. Y la barra vertical del símbolo de encendido no se pintaba: un
> degradado con `objectBoundingBox` no se aplica a una línea de **ancho cero** (se arregló con
> `gradientUnits="userSpaceOnUse"`).

### Auto-Kill

Cierra solo los procesos vigilados que pasen de un umbral de RAM, con notificación y entrada en el
historial con origen `auto`. **Apagado de fábrica**, umbral por defecto 2048 MB.

> ⚠️ **Suelo de 256 MB, y no es validación de formulario**: con 50 MB cualquier proceso vigilado lo
> supera y el siguiente ciclo se lleva por delante el entorno entero. Se aplica al guardar **y** al
> leer, porque `settings.json` es un archivo que el usuario puede editar a mano.
> ⚠️ El umbral se compara en **estricto** (`>`): quien esté justo en el límite no muere.
> ⚠️ **Sigue vigilando con el auto-refresco en "Off"**, a ritmo fijo y sin publicar la lista. Es la
> diferencia entre una red de seguridad y un adorno: si dejara de mirar porque la ventana no se
> refresca, el usuario se creería protegido sin estarlo.
> ⚠️ El umbral se guarda **al salir del campo**, no en cada tecla: escribir "2048" pasa por "2", y
> guardar eso dejaría el umbral en el mínimo un instante con el vigilante mirando.
> ⚠️ El campo es editable con el Auto-Kill apagado. Se descubrió probándolo: si no, había que armarlo
> con el umbral por defecto para poder cambiarlo, y ese rato con 2 GB puede cerrar algo legítimo.
> ⚠️ Un `settings.json` anterior no trae los campos nuevos: `los_ajustes_de_una_version_anterior_siguen_valiendo`
> fija que actualizar la app **nunca** enciende solo el Auto-Kill.

**Verificado con procesos de mentira creados para la prueba**: uno de 651 MB con el umbral en 400
muere solo, y los **7 `node` reales** de la máquina siguen vivos. El criterio discrimina.

### Zombie Finder

Resalta —sin cerrar nada— los procesos sin actividad de CPU durante los minutos configurados **que
además siguen ocupando un puerto**. Apagado de fábrica.

> ⚠️ **La condición del puerto no es un adorno.** Casi todo proceso de desarrollo en reposo marca
> 0 % de CPU: en la máquina de pruebas, 7 de 10 `node`. Sin exigir puerto saldría resaltada la tabla
> entera, que es lo mismo que no resaltar nada.
> ⚠️ El umbral de CPU es **0,5 %**, no 0 exacto: un servidor parado sigue despertando por sus
> temporizadores y el recolector de basura.
> ⚠️ Se **olvidan los PIDs que desaparecen**. La app vive días en la bandeja: el mapa crecería sin
> fin, y un PID reciclado por Windows heredaría la racha del proceso anterior.
> ⚠️ Apagar la función **borra las rachas**: mientras estuvo apagada nadie miraba, y contar ese rato
> sería inventárselo.
> Limitación asumida: un servidor en uso pero ocioso —el propio Vite— también sale marcado. La
> insignia dice cuánto lleva parado y qué puerto ocupa; cerrarlo sigue siendo decisión del usuario.

### Instaladores y releases

NSIS en modo **`currentUser`** (instala en `%LOCALAPPDATA%` sin pedir UAC) y MSI. `release.ps1`
adaptado del de FormatDiskPro: pruebas, bump en los tres sitios, build, `.sha256`, tag y Release.

> macOS (`.dmg`) no se puede generar desde Windows: queda para cuando haya máquina o CI de macOS.
> ⚠️ **`SendKeys` no dispara un atajo global.** Manda mensajes a la ventana con foco, y uno
> registrado con `RegisterHotKey` no se entera; hace falta entrada real de sistema (`keybd_event`).
> Así se cerró la salvedad del atajo: pulsado de verdad, cerró los 4 `node` vivos y liberó el 4321.
> ⚠️ **Los toast de Windows no se pueden capturar con `Graphics.CopyFromScreen`.** Salían capturas
> vacías y se concluyó en falso que el banner no se pintaba: BitBlt no recoge lo que DWM compone en
> otra capa. O lo mira una persona, o se consulta el centro de notificaciones por WinRT.
> ⚠️ **Tres tropiezos de PowerShell 5.1 que cuestan una tarde**: escapar comillas con `\"` cierra la
> cadena; las comillas tipográficas `“ ”` también cuentan como delimitador; y un `.ps1` sin BOM se
> lee como ANSI y rompe los acentos, pero ponerlo dos veces deja un `U+FEFF` que atraganta al parser.

---


## 🏗 Tier 6: Infraestructura de proyecto publicado — ✅ **completado y verificado**
*Objetivo: que el repositorio aguante a alguien que no seas tú, ahora que el instalador está en la calle.*

Sale de comparar este repo con **FormatDiskPro** (2026-07-24), que lleva 15 versiones publicadas.
Licencia GPL-3.0 y avisos de terceros, repositorio renombrado, README de producto con capturas
automatizables, las primeras pruebas de frontend, auto-actualización y `.claude/CLAUDE.md`.

### Licencia y avisos legales

> ⚠️ **No era burocracia**: un repositorio público **sin licencia** es "todos los derechos
> reservados" por defecto. Con la v1.0.0 ya publicada, nadie tenía derecho legal a usar lo que se
> estaba descargando.
> ⚠️ `THIRD-PARTY-NOTICES.txt` cubre lo que **el instalador distribuye**, no todo `node_modules`. La
> tipografía **Geist va embebida** y su **OFL-1.1 obliga** a distribuir su aviso: es la única
> dependencia con una obligación que no se cubre sola. De los 515 crates de Rust, 5 son MPL-2.0
> (copyleft por archivo, se usan sin modificar). Ninguna licencia del árbol es incompatible con la
> GPLv3 — y Apache-2.0 solo lo es con la **v3**, no con la v2, lo que confirma la elección.
> ⚠️ La licencia se empaqueta renombrada a **`LICENSE.txt`** aunque en el repo se llame `LICENSE`
> (lo que espera GitHub): un archivo **sin extensión no tiene asociación en Windows** y al pulsar el
> botón no pasaba nada visible.
> ⚠️ `opener:default` **no incluye `open_path`**, solo `open_url`. Hay que concederlo aparte y con
> ámbito; aquí se limita a esos dos archivos concretos, no a una carpeta.

### README de producto y capturas

`tools/capture-screenshots.ps1` regenera las capturas conduciendo la app por CDP, con dos servidores
Node de verdad levantados mientras tanto.

> Las imágenes salen del **webview** (`Page.captureScreenshot`), no de la pantalla: sin barra de
> título ni fondo de escritorio, y a tamaño fijo, así que se ven igual las genere quien las genere.
> ⚠️ Sin los servidores de verdad, la columna de puertos sale vacía —justo la que justifica la app—
> y las barras salen todas a cero.
> ⚠️ El script **cierra la app antes de restaurar** `tauri.conf.json`: al revés, Tauri detecta el
> cambio y reinicia la app en mitad de la limpieza.
> ⚠️ `Emulation.setDeviceMetricsOverride` **no encoge** el viewport si ya había uno más alto. Se
> limpia el override antes de fijar el nuevo, y la única captura alta va la última.
> ⚠️ `Start-Process` une los argumentos con espacios y **no entrecomilla nada**: el `node -e "…"` de
> los servidores llegaba partido y moría con *Unexpected end of input*.
> ⚠️ Un `.GetAwaiter().GetResult()` sobre un `Task` no genérico **emite un `VoidTaskResult`**, así
> que `return $ws` devolvía un array de dos elementos. Va con `| Out-Null`.
> No se puede capturar lo que Windows dibuja por encima del webview (menú de bandeja,
> notificaciones). Los toast de la app sí: son HTML.

### Pruebas del frontend

98 pruebas con Vitest + Testing Library en jsdom, donde antes había cero. Cubren, por orden de lo
que cuesta romperlo: **Escape cancela el diálogo destructivo sin confirmar** (verificado a mano en
tres tiers y por fin fijado), la búsqueda por puerto/PID/nombre como subcadena, la poda de la
selección, el suelo de 256 MB, que se copia con el plugin de Tauri, que la clase `dark` la pone JS,
y el menú contextual con clic derecho real.

> ⚠️ Las fábricas de `vi.mock` **se izan por encima de los imports**, así que los `vi.fn()` viven en
> `src/test/tauri-mock.ts` y se traen con un `await import` dentro de la fábrica.
> ⚠️ **Motion también se dobla.** `AnimatePresence` mantiene montada la fila que sale hasta que
> acaba su animación: sin el doble, filtrar la tabla seguía contando las filas de antes y la
> aserción medía la animación en vez del filtro.
> ⚠️ `types.test.ts` **lee el fuente de Rust** y compara las constantes espejo. Nada obligaba a que
> `types.ts` siguiera siendo un espejo: cambiar una constante en `storage.rs` y olvidarse aquí no
> rompía ni el build ni `cargo test`.
> **Un fallo real encontrado al montarlas:** los dos campos numéricos de Ajustes no tenían nombre
> accesible, solo `aria-describedby`, que describe pero no nombra. Se les añadió `aria-label`.
> Las pruebas end-to-end sobre la ventana real quedan fuera a propósito: el 80 % del valor está en
> Vitest, se mantiene solo y corre en dos segundos.

### Auto-actualización

> **Reescrito el 2026-07-26.** Se implementó primero con `tauri-plugin-updater` y firmas minisign, y
> se **descartó** tras dos días de fricción con la clave: se filtró, la rotación se atascó y el
> prompt de contraseña resultó impegable. Se sustituyó por el modelo de FormatDiskPro, decisión del
> usuario. El recorrido está en la [bitácora](docs/BITACORA.md); aquí queda solo lo que hay.

Actualizaciones vía **GitHub Releases** verificadas con **SHA-256**, en `src-tauri/src/update.rs`:
se consulta la API, se elige el instalador NSIS y su `.sha256`, se descarga, se **verifica antes de
ejecutar** y se lanza. Si el hash no coincide, el archivo se borra. Sin plugin y sin clave: `reqwest`
+ `sha2` directamente. Qué garantiza y qué no, en el
[README](README.md#el-modelo-de-confianza-y-qué-no-cubre).

> ⚠️ **El `.sha256` deja de ser cortesía y pasa a ser el mecanismo.** Un release sin él hace que la
> app se niegue a actualizarse a esa versión — correcto, pero hay que saberlo.
> ⚠️ La comprobación del arranque va en **modo silencioso**: un fallo de red al abrir la app es lo
> normal y no puede pintar un error en la cara de nadie. **Descargar e instalar exige pulsarlo.**
> ⚠️ `install_update` **solo acepta rutas de su carpeta de descargas**; el comando queda expuesto al
> frontend. (Esa guardia se saltaba con un `..` hasta el Tier 7.1.)
> ⚠️ **Corregida una afirmación falsa del README**, que decía que la app no tiene concedido ningún
> permiso de red enlazando al `capabilities/default.json` como prueba. Con el actualizador, el propio
> archivo que se citaba la desmentía. La red la usa **solo Rust**.
> **Se descarta a propósito** la verificación **Authenticode** que FormatDiskPro intenta antes del
> hash: sin certificado ningún instalador propio la pasaría, y una comprobación que siempre falla
> acaba ignorándose.

**Verificado contra el release v1.1.1 publicado**: la API responde 200, `pick_assets` elige el
`-setup.exe` y **su** `.sha256` (no el del MSI, que es el error fácil), y el instalador descargado
coincide con el hash publicado. Lo que más importa de las pruebas: **`is_newer` solo dice que sí si
de verdad lo es** —la misma versión no cuenta, una anterior tampoco, y una etiqueta ilegible responde
"no hay actualización"—, y un `.sha256` sin un hash de 64 hex **se rechaza** en vez de compararse (un
"404: Not Found" guardado como hash daría "no coincide", pero por el motivo equivocado).

> ⚠️ **Queda sin ejecutar en vivo el último paso**: lanzar el instalador y que reemplace la app.
> Necesita un release posterior a éste para que uno encuentre al otro.

### Herramientas del repositorio

`.claude/CLAUDE.md` con las convenciones y las cosas que cuestan una sesión si no se saben, y
`.mcp.json` enganchando `codegraph`.

> ⚠️ **La suposición de partida era incorrecta.** El roadmap daba por hecho que el índice de
> codegraph existía y solo faltaba conectarlo; `.codegraph/` contenía únicamente su `.gitignore`. El
> `.mcp.json` conecta el servidor pero **no construye nada**: hay que ejecutar `codegraph init` en la
> raíz y abrir una sesión nueva. Índice construido el 2026-07-27.

---


## 🧹 Tier 7: Deuda técnica y compactación de la documentación — ✅ **completado y verificado**
*Objetivo: cerrar lo que encontró la revisión completa y devolver los documentos a un tamaño que alguien lea de verdad.*

Sale de una **revisión completa del repositorio** hecha el 2026-07-27 sobre la v1.1.1 publicada —código,
seguridad, rendimiento, estructura, accesibilidad, responsividad, ortografía y documentación—, con las
101 pruebas de frontend y las 35 de `cargo test` en verde y el árbol limpio. Nada de lo de aquí era un
fallo de funcionamiento: la app hace lo que promete. Era lo que se rompe o estorba a partir de ahora.

**Cerrado entero el mismo día.** Al terminar: **140 pruebas de frontend** (antes 101) y **44 de
`cargo test`** (antes 35). Lo único con consecuencias de seguridad —la guardia de rutas de
`install_update`, que se saltaba con un `..`— se arregló en el 7.1.

> ⚠️ **Nada de esto está publicado todavía.** El release vigente sigue siendo la v1.1.1, que no lleva
> ni el CSP, ni el cierre de ventana configurable, ni la instancia única, ni la ordenación. Hace
> falta cortar una versión nueva con `.\release.ps1 -Version X.Y.Z`.

### 1. Seguridad — ✅ **completado y verificado**

- [x] **Canonicalizar la ruta en `install_update` antes de compararla.**
  > ⚠️ **La guardia se saltaba con `..`, comprobado antes de tocar nada.** `Path::starts_with` compara
  > componentes literales y **no normaliza**: `%TEMP%\ProcessDevKill_update\..\..\Windows\System32\calc.exe`
  > pasaba como válida, y `is_file()` también. El comentario de la función decía que sin ella sería un
  > "ejecuta lo que quieras", y cumplía menos de lo que prometía. La guardia de PID de `kill_process`
  > sí era sólida, porque relee el proceso y valida el nombre.
  > Arreglado con `canonicalize` sobre las dos rutas antes del `starts_with`. De paso resuelve que
  > `temp_dir()` pueda devolver una ruta corta 8.3.
- [x] La comprobación se mueve a `update::ruta_de_instalador_valida`, función pura probable sin montar
      una `App` —igual que `collect_processes` frente a `get_processes`—, y **se ejecuta la ruta
      canónica que devuelve**: validar una y lanzar otra sería reabrir el agujero por detrás.
  > ⚠️ Canonicalizar devuelve el prefijo verbatim de Windows (`\\?\C:\…`), y ahora es **esa** la ruta
  > que se lanza. Comprobado aparte que `CreateProcess` la acepta: era lo único que podía romper la
  > actualización al añadir la canonicalización, y no se habría notado hasta el siguiente release.
- [x] Test de regresión con un `..` por medio, que es lo que nadie piensa en probar.
  > El test afirma primero que la ruta de escape **sí** pasa el `starts_with` crudo. Sin esa línea no
  > se sabría si cubre el fallo real o una versión cómoda de él.
- [x] **Sanear `asset_name` antes de usarlo como nombre de archivo** en `download_and_verify`.
  > Venía de la API de GitHub y se pegaba con `join` sin mirar. No era explotable —GitHub no admite
  > separadores en nombres de asset—, pero es la misma clase de descuido y costaba una línea.
- [x] `carpeta_descargas()` pasa a ser el único sitio donde se nombra la carpeta.
  > El literal estaba duplicado entre `lib.rs` y `update.rs`. Dos copias de la ruta contra la que se
  > valida es un agujero esperando a que alguien cambie una sola.
- [x] **CSP restrictivo** en `tauri.conf.json`, que estaba en `null`.
  > ⚠️ **El CSP solo se aplica en producción**: en `tauri dev` el HTML lo sirve Vite y Tauri no llega a
  > inyectarlo (por eso existe `dev_csp` aparte). Probarlo en desarrollo no demuestra nada.
  > ⚠️ `style-src` lleva `'unsafe-inline'` **y además `style-src-attr`**. No es dejadez: Motion,
  > `UsageBar` y el color de los iconos pintan con **atributos `style`**, y como Tauri añade su propio
  > nonce a `style-src`, el `'unsafe-inline'` de ahí queda anulado para los `<style>`. `style-src-attr`
  > es lo que garantiza que los atributos sigan aplicándose.

**Verificación end-to-end** (2026-07-27, sobre el **binario de release**, conducido por CDP):

- [x] 37 pruebas de `cargo test` en verde (antes 35), las dos nuevas sobre la guardia y el nombre.
- [x] La ventana **pinta y funciona**: 8 filas con datos reales del equipo (`node.exe … 21376 … 128 MB
      … 34m`), que solo pueden venir de `get_processes` por IPC. Si el CSP hubiera roto el bundle o el
      IPC, la ventana habría quedado en blanco o la tabla vacía.
- [x] **Los estilos inline se aplican**: el icono de Node mide `rgb(108, 184, 90)`, que es
      `--runtime-node` exacto, y el fondo es `oklch(0.175 0.009 265)` con `<html class="dark">`.
- [x] **El CSP está activo y Tauri hasheó el script inline del tema**: la política servida trae
      `script-src 'self' 'sha256-hPTyHH3…' 'sha256-leISGvn…'`, dos hashes que inyecta el propio Tauri
      al compilar. O sea que el script de primera pintura **no se bloquea** y el fogonazo blanco sigue
      evitado, sin necesidad de `'unsafe-inline'` en `script-src`.
- [x] Un `<script>` inline **nuevo sí se bloquea** (`violatedDirective: script-src-elem`), que es la
      prueba de que la política hace algo y no está puesta de adorno.
- [x] El puerto de depuración se quitó de `tauri.conf.json` después, cerrando antes la app.

> Lo que **no** hizo falta tocar: las capabilities ya estaban bien acotadas y son comprobables
> —portapapeles de escritura únicamente, `open_path` limitado a los dos avisos legales, y la red solo
> en Rust—.

### 2. Cosas de cinco minutos — ✅ **completado y verificado**

- [x] **Descripción y topics del repositorio en GitHub**, que estaban vacíos (`description: ""`,
      `repositoryTopics: null`).
  > Es lo único de este proyecto que un buscador indexa: el webview no lo ve nadie, así que el "SEO"
  > empieza y acaba aquí. Puestos **15 topics** (`tauri`, `tauri-app`, `rust`, `react`, `typescript`,
  > `windows`, `desktop-app`, `developer-tools`, `process-manager`, `port-killer`, `kill-process`,
  > `task-manager`, `sysinfo`, `tailwindcss`, `vite`) y una descripción que incluye el caso de uso con
  > el que la gente busca: *"Para cuando el puerto 3000 está ocupado y no sabes por quién"*.
  > ⚠️ La descripción se publicó primero **sin tildes**, por pasar el texto por la shell. Se corrigió
  > mandando el JSON desde un archivo UTF-8 con `gh api -X PATCH --input`. Mismo problema de siempre:
  > el texto con acentos no sobrevive al viaje por la línea de órdenes.
- [x] **Actualizar los conteos de pruebas del README**, que decía 98 de frontend y 22 de backend.
      Ahora **101 y 37** (las 35 del 2026-07-26 más las dos del Tier 7.1). Corregido también el estado
      de CONTEXT.md §3, que arrastraba el 98.
- [x] **Añadir `update.rs` a la tabla de estructura del README**, que listaba
      `{processes,ports,storage,tray}.rs` y dejaba fuera precisamente el módulo más delicado.
- [x] **Cerrada la casilla de `codegraph`** en CONTEXT.md §5, y corregidos §3 y el Tier 6.6 de aquí,
      que afirmaban que `.codegraph/` contenía solo su `.gitignore`.
  > Dejó de ser cierto el 2026-07-27: el índice existe (`codegraph.db`, 3 MB). Se conserva escrito el
  > motivo del malentendido —el `.mcp.json` conecta el servidor pero no construye nada—, porque es lo
  > que hizo perder el tiempo.
- [x] Quitado `@tauri-apps/plugin-process`, huérfano desde que se fue el actualizador de minisign:
      cero usos en `src/`, cero permisos en `capabilities/` y sin crate en `Cargo.toml`. Las 101
      pruebas y el build siguen en verde sin él.

> **`npm audit` reporta 2 vulnerabilidades moderadas, y no afectan al producto.** Vienen de
> `@modelcontextprotocol/sdk`, dependencia transitiva de `shadcn`, que aquí es **herramienta de
> build**: el instalador solo lleva `dist/` y el binario de Rust, y de shadcn únicamente sale CSS a
> través del `@import "shadcn/tailwind.css"` de `index.css`. Nada de ese árbol viaja al equipo del
> usuario. Se anota para no volver a investigarlo cada vez que alguien corra `npm audit`.
>
> De paso: `shadcn` está declarada en `dependencies` cuando es de desarrollo. Con `"private": true`
> y un empaquetado que ignora `node_modules`, moverla es cosmético — pero es lo que hace que estas
> dos vulnerabilidades salgan en una auditoría de producción.

### 3. Ortografía de la UI — ✅ **completado y verificado**

Nueve textos **visibles en la ventana** iban sin tilde mientras el resto de la interfaz sí las lleva
("confirmación", "notificación", "última versión", "Mínimo", "Ábrelo"). Era una inconsistencia, no un
criterio: los comentarios del código sí van sin tildes de forma sistemática, y eso se mantiene.

- [x] `App.tsx`: "terminara/terminaran" → **terminará/terminarán**; "Se borrara… ningun proceso en
      ejecucion" → **borrará, ningún, ejecución**; "Ningun proceso coincide" → **Ningún**.
  > ⚠️ El barrido para corregirlas destapó una novena que no estaba en la lista de la revisión:
  > **"Esta accion no se puede deshacer"** → *acción*, en el mismo mensaje del diálogo destructivo.
  > Merece la pena leer el texto entero antes de ir tachando: la lista inicial venía de un `grep`.
- [x] `HistoryView.tsx`: "Todavia… ningun proceso" → **Todavía, ningún**; encabezado "Cuando" →
      **Cuándo**.
- [x] `SettingsView.tsx`: "Aqui puedes añadir" → **Aquí**; "sin la extension" → **extensión**;
      "sin pedir confirmacion" → **confirmación** (la misma vista ya lo escribía bien 150 líneas antes).
- [x] **Corregido "1 cierre registrados"** en `HistoryView.tsx`.
  > ⚠️ Era exactamente el bug que el Tier 5 cazó y arregló con "Se terminaran los 1 procesos".
  > Se singulariza **la frase entera** (`"cierre registrado"` / `"cierres registrados"`) en vez del
  > sustantivo suelto, que es lo que dejaba el participio descolgado.
- [x] Ajustados los tests que **fijaban los textos antiguos**: `App.test.tsx` (tres) y
      `ConfirmDialog.test.tsx` (dos).
  > ⚠️ No era opcional ni se descubre a tiempo: corregir la UI sin tocarlos deja la suite en rojo.
- [x] **`HistoryView.test.tsx` creado**: era el único componente de dominio sin pruebas.
  > Cubre la concordancia del contador en singular y plural, la vista vacía, el guion de "sin puertos
  > liberados", la traducción de los cuatro orígenes de cierre y que el botón de vaciar **avisa al
  > padre en vez de borrar por su cuenta** —vaciar sin confirmar sería una pérdida irreversible a un
  > clic—.

**Verificación** (2026-07-27):

- [x] **108 pruebas de frontend** en verde, en 8 archivos (antes 101 en 7).
- [x] El test de la concordancia **caza el fallo**: reintroducido el texto antiguo a propósito, falla
      con *"Unable to find an element with the text: 1 cierre registrado"*. Un test de regresión que
      no se ve fallar no demuestra nada.
- [x] `tsc` sin errores y encoding UTF-8 intacto en los cinco archivos tocados.
- [x] Barrido final del texto visible: lo único que queda sin tildes son **comentarios y nombres de
      test**, que es el estilo establecido del proyecto.

### 4. Comportamiento de la ventana, y accesibilidad

#### 4a. Dos fallos de comportamiento que encontró el usuario usando la app — ✅ **completado y verificado**

Los reportó el 2026-07-27 con una captura que enseña **tres ventanas de ProcessDevKill abiertas a la
vez y cuatro iconos en la bandeja**. No son dos fallos independientes: **se retroalimentan**. Como
cerrar la ventana la esconde, el usuario cree que cerró la app; la vuelve a lanzar y, al no haber
instancia única, arranca otra copia. Repetir eso tres veces da exactamente la captura.

- [x] **Cerrar la ventana cierra la app.** Esconderla en la bandeja pasa a ser **opcional y
      apagada de fábrica** (`closeToTray`).
  > ⚠️ Hoy `on_window_event` hace `api.prevent_close()` + `hide()` **siempre, sin condición**. Se
  > decidió en el Tier 3 junto con el icono de bandeja, y visto en uso es lo contrario de lo que
  > espera cualquiera: el botón X de Windows cierra. Que una app siga viva e invisible tras pulsarlo
  > tiene que ser una decisión del usuario, no el valor de fábrica.
  > Ajuste nuevo `closeToTray`, **`false` por defecto**. Con `#[serde(default)]` ya en el struct, un
  > `settings.json` de una versión anterior sigue valiendo y toma el valor nuevo — lo mismo que se
  > fijó para el Auto-Kill con `los_ajustes_de_una_version_anterior_siguen_valiendo`.
  > ⚠️ Comprobar que al cerrar **el proceso muere de verdad**. Con un icono de bandeja registrado, una
  > app que deja de tener ventanas puede quedarse viva e invisible, que es el peor resultado posible:
  > ni ventana, ni icono útil, ni forma de darse cuenta salvo el Administrador de tareas.
- [x] **Instancia única**: lanzar la app estando abierta trae al frente la que ya hay, no abre otra.
  > Con `tauri-plugin-single-instance` (2.4.3). El plugin **se registra el primero**, antes que los
  > demás, que es como lo pide su documentación.
  > La segunda instancia no avisa con un toast: trae al frente la ventana existente y se cierra, que
  > es lo que hace cualquier app de Windows bien educada y lo que el usuario interpreta solo. Un aviso
  > de "ya estaba abierta" sería ruido para algo que se ve en pantalla.
  > ⚠️ Reaprovechar `tray::show_main_window`, que ya hace `show` + `unminimize` + `set_focus`. Si la
  > ventana estaba escondida en la bandeja hay que **mostrarla**, no solo enfocarla.
- [x] Interruptor en Ajustes, junto al del atajo global, con una sección propia *"Al cerrar la
      ventana"*.
  > Lo que hay que contar no es que la ventana se esconde —eso se ve—, sino que la app **sigue
  > funcionando**: es la parte que sorprende y la que hace que uno la vuelva a abrir. El texto lo dice
  > y explica las dos salidas (icono de bandeja para recuperarla, "Salir" para terminarla).
- [x] Espejo en `src/types.ts`, en `DEFAULT_SETTINGS` de `App.tsx`, en `DEFAULT_TEST_SETTINGS` y en el
      test de contrato de `lib.rs`, que enumera las claves de `Settings`.

**Verificación end-to-end** (2026-07-27, sobre el **binario de release**, con `WM_CLOSE` nativo —el
mensaje que manda el botón X— y no `Stop-Process`, que no ejercitaría el manejador):

- [x] **38 pruebas de `cargo test`** (antes 37) y **114 de frontend** (antes 108).
- [x] Con `closeToTray` en `false`, pulsar la X **no deja ningún proceso vivo**. Era el riesgo serio:
      con un icono de bandeja registrado, una app sin ventanas puede quedarse viva e invisible.
- [x] Lanzar la app estando abierta **deja una sola instancia, y es la original** (mismo PID).
- [x] Con `closeToTray` en `true`, la X esconde la ventana y el proceso **sigue vivo**.
- [x] **Estando escondida, relanzarla la recupera**: mismo PID, ventana visible otra vez. Es el caso
      que cierra el círculo — si relanzar no la recuperase, el usuario volvería a creer que no está.
- [x] El `settings.json` **real del usuario** se respaldó antes de las pruebas y se restauró después;
      quedó intacto y sin `closeToTray`, que es como estaba.

> ⚠️ **Un fallo del guion de pruebas que casi se lee como un fallo de la app.** La primera pasada dijo
> que con `closeToTray=true` la app se cerraba. Repetido el caso aislado, funcionaba. La causa era el
> propio guion: mandaba el `WM_CLOSE` en cuanto `MainWindowHandle` dejaba de ser 0, sin dar tiempo a
> que la app terminara de arrancar. Que exista la ventana no significa que el arranque haya acabado.
> Antes de creerse un fallo raro, comprobar si lo raro es la prueba.
>
> ⚠️ El `settings.json` del usuario **no tenía el campo `closeToTray`**, así que las pruebas se
> hicieron sobre el caso real de "ajustes de una versión anterior": toma el valor por defecto y la app
> cierra al pulsar la X, sin descartar el resto de los ajustes. Es lo que fija
> `los_ajustes_de_una_version_anterior_siguen_valiendo`.

#### 4b. Accesibilidad y semántica — ✅ **completado y verificado**

La base está cuidada —`lang="es"`, jerarquía de encabezados correcta, `aria-label` en checkboxes y en
los dos campos numéricos, el zombi señalado con color **y** texto, Escape cancelando con test que lo
fija—. Lo que desentona:

- [x] **Nombre accesible en el botón "Kill" de cada fila** (`Cerrar node.exe, PID 1234`).
  > ⚠️ Había veinte botones que se anunciaban "Kill" a secas, sin decir de qué proceso. El checkbox de
  > la misma fila sí lo hacía bien desde el Tier 6. Para el botón que mata un proceso es justo la
  > etiqueta que no se puede fallar. El texto **visible** sigue siendo "Kill".
  > ⚠️ Cambiar el nombre accesible rompió tres pruebas que buscaban el botón por `name: "Kill"`
  > (`ProcessTable.test.tsx` ×2 y `App.test.tsx` ×1). Mismo patrón que con la ortografía del 7.3: si
  > la prueba localiza por el texto que estás cambiando, se rompe.
- [x] **`scope="col"` en los `<th>`** de las dos tablas, con prueba que lo fija.
  > En una tabla de ocho columnas es lo que permite a un lector de pantalla decir "Puerto: 3000" en
  > vez de leer números sueltos. La columna de acciones, que no tiene título visible, gana un
  > `sr-only`.
- [x] Subido el contraste del guion de "sin puerto" en las dos tablas: el `/50` lo dejaba en ~2:1.
- [x] **El menú contextual se queda solo con clic derecho.** Decisión del usuario (2026-07-27) tras
      ver las dos alternativas y su coste.
  > Se descartó `tabIndex={0}` en la fila —la opción de una línea— **por las veinte paradas de
  > tabulación que añade**: empeora la navegación por teclado de todo el mundo para arreglar un
  > camino que casi nadie usa. La otra salida, un botón visible de "más acciones" (⋮) por fila, no se
  > toma porque cambiaría el diseño de la tabla.
  > ⚠️ **Lo que esto deja fuera, dicho claro:** "Copiar PID", "Copiar puerto" y
  > "Copiar http://localhost:PUERTO" siguen siendo **solo de ratón**, sin equivalente en el resto de
  > la UI. "Matar proceso" no cuenta: ese sí lo tiene en el botón Kill de la fila. Es un compromiso
  > asumido a sabiendas, no un descuido — el mismo criterio con el que el README dice qué **no**
  > protege el `.sha256`.
- [x] **`aria-current` en la navegación** Procesos/Historial/Ajustes, en vez de `aria-pressed`.
  > Son vistas excluyentes: esto es navegación, no un interruptor. Un lector de pantalla pasa a decir
  > "vista actual" en lugar de "presionado". Con prueba que fija que solo una lo lleva a la vez.
  > No se tocan los otros tres `aria-pressed` (tema, intervalo de refresco y filtros por runtime):
  > son grupos de selección exclusiva dentro de una vista, donde lo ideal sería un `radiogroup`, pero
  > el cambio es mayor, hay una prueba que depende de él y la ganancia es pequeña. Queda escrito por
  > si algún día se hace de una pasada.

### 5. Rendimiento — ✅ **completado y verificado**

- [x] **Los puertos se leen una sola vez por lote**, en `processes::kill_many`.
  > ⚠️ `kill_one` llamaba a `listening_ports()` por cada PID, y `kill_and_record` la invocaba en un
  > `map`: un "Nuke All" con quince procesos **recorría la tabla TCP del sistema quince veces**.
  > Leerlos antes de matar es obligatorio y estaba bien razonado; lo que sobraba era repetir la
  > enumeración.
  > De paso queda **más correcto**: la foto de puertos se toma con todos los procesos del lote aún
  > vivos, en vez de irse degradando conforme caen.
- [x] Prueba de que el lote **no cruza ni pierde** la atribución de puertos.
  > ⚠️ Es el riesgo real de este refactor, y de los que no se ven: si el puerto de un proceso acabara
  > apuntado en el resultado de otro, la UI enseñaría un número igual de plausible y solo se notaría
  > en el historial, cuando ya no hay forma de saber qué era verdad. Se prueba con dos servidores
  > `node` de verdad, en puertos distintos, cerrados en el mismo lote.
- [x] **Fuera el bucle de 300 ms del poller**: ahora espera en un `Condvar` al que se avisa al guardar
      ajustes.
  > Con el refresco en "Off" y el Auto-Kill apagado, el hilo despertaba tres veces por segundo para no
  > hacer nada: en una app pensada para vivir días en la bandeja, cientos de miles de despertares
  > diarios. Ahora espera hasta `PAUSA_MS` (60 s) y el aviso lo devuelve al trabajo al instante.
  > ⚠️ **El `bool` del `Condvar` no es decoración.** El poller lee los ajustes, decide cuánto dormir y
  > solo entonces entra a esperar; si alguien guarda ajustes en ese hueco, un `notify` a secas se
  > pierde —no había nadie escuchando— y el hilo se queda el plazo entero. El testigo se marca
  > **dentro del candado** y la espera lo consume, que es el patrón que cierra esa carrera.

**Verificación** (2026-07-27):

- [x] **41 pruebas de `cargo test`** (antes 38), y la suite pasa tres veces seguidas.
- [x] En vivo, sobre el binario de release y por CDP: con el refresco en 2 s un proceso nuevo entra en
      la lista en **1,9 s**; con "Off" **no entra**; y al volver a 2 s el poller despierta y lo lista
      en **2,2 s**, no en los 60 de `PAUSA_MS`.

> ⚠️ **Dos trampas de la verificación, que costaron más que el cambio.**
>
> 1. **La primera medición dio un falso fallo.** Usaba la columna "Activo" como latido, y
>    `formatUptime` la da en **minutos** en cuanto un proceso pasa del minuto: no cambiaba en 20 s
>    aunque el refresco funcionara. El latido bueno es lanzar un proceso y ver si **aparece**.
> 2. **El proceso hay que lanzarlo *después* de reactivar el refresco.** `save_settings` publica una
>    lista al guardar, así que uno lanzado antes aparecería por ese camino y no probaría nada sobre el
>    hilo del poller.
>
> El arreglo del testigo del `Condvar` se hizo mientras se perseguía ese falso fallo. **No era la
> causa** —no había nada roto—, pero la carrera que cierra es real, así que se queda con su prueba de
> regresión: `un_aviso_anterior_a_la_espera_no_se_pierde`.

> ⚠️ **El test nuevo destapó otro que ya era frágil.** `selecciona_solo_los_pids_del_runtime_pedido`
> tomaba dos fotos del sistema y exigía que cuadraran (15 contra 13 en cuanto algo lanza procesos
> `node` en paralelo). Ya era frágil por el `node` de `reporta_cpu_de_un_proceso_ocupado`; ahora
> comprueba el **criterio negativo** —que no cuele un PID de otro runtime—, que es lo que de verdad
> importa y además es la regla de la casa para todo lo que cierra procesos.

> Lo que ya estaba bien y no se toca: una sola instancia de `System`, `watch_cycle` leyendo la lista
> una vez por ciclo, el calentamiento de CPU en hilo aparte y el frontend sin polling.

### 6. Refactor: archivos que volvieron a crecer — ✅ **completado y verificado**

El Tier 4 partió `lib.rs` cuando pasaba de 450 líneas «porque el Tier 4 la habría llevado a 900». Al
abrir este tier tenía **704**, y el 7.5 la dejó en **860**. Es el mismo síntoma, un tier después.

- [x] **`lib.rs`: 860 → 635 líneas** (de las que 185 son tests, o sea ~450 de código).
  > Salen tres módulos, no los dos que decía este plan. El de más es `poller.rs`, y se añadió porque
  > el 7.5 metió en `lib.rs` el hilo entero y sus constantes **después** de escribirse esta lista: el
  > objetivo escrito era «volver a ser arranque y comandos», y un hilo de fondo no es ninguna de las
  > dos cosas.
  > - **`update.rs`** ← los tres comandos del actualizador. Cada uno delega en la función del mismo
  >   archivo que hace el trabajo; tenerlos en `lib.rs` obligaba a abrir dos archivos para seguir una
  >   actualización, y era donde peor se veía que `install_update` lleva una guardia detrás.
  > - **`auto_kill.rs`** ← lo único de la app que cierra procesos sin que nadie se lo pida. Módulo
  >   propio precisamente por eso: estaba suelto entre las cien líneas de arranque.
  > - **`notify.rs`** ← los avisos nativos, que comparten las cuatro vías de cierre.
  > - **`poller.rs`** ← el hilo, `watch_cycle` y los cuatro plazos (`MIN/MAX_REFRESH_MS`,
  >   `AUTO_KILL_IDLE_MS`, `PAUSA_MS`).
- [x] **`SettingsView.tsx` (518 → 419)**: `Actualizaciones` sale a `components/Actualizaciones.tsx`.
- [x] **`App.tsx` (477 → 367)**: el sidebar y `FilterButton` salen a `components/Sidebar.tsx`, que
      además se lleva los tipos `View` y `Filter` — es el componente que gobierna las dos cosas.
- [x] **`src/types.ts` (127 → 115) deja de hacer tres trabajos**: los formateadores se van a
      `src/lib/format.ts`, con sus pruebas en `src/lib/format.test.ts`. `types.test.ts` baja de 95 a
      57 líneas y queda solo con el contrato contra Rust, que es de lo que iba.
  > ⚠️ **A `src/lib/format.ts`, no a `src/lib/utils.ts`** como decía este plan. `utils.ts` lo genera
  > el CLI de shadcn con `cn` dentro, y volver a pasar `shadcn init` lo reescribe. El CLI está en las
  > dependencias del proyecto, así que no es hipotético.
  > **Los mapas de etiquetas se quedan** (`RUNTIMES`, `THEMES`, `KILL_SOURCES`, `REFRESH_INTERVALS`):
  > cada uno es un `Record` indexado por un tipo espejo, así que TypeScript obliga a completarlos
  > cuando Rust gana una variante. Sacarlos de ahí perdería esa comprobación a cambio de un archivo
  > más. Los formateadores no tenían esa atadura, y por eso sí se van.
- [x] **`src/update.ts` → `src/hooks/useUpdater.ts`**, con su prueba al lado. Movido con `git mv`
      para no perder el historial del archivo.

> No entra aquí `processes.rs` (705 líneas): 376 son tests. Está bien como está.

**Verificación** (2026-07-27):

- [x] **44 pruebas de `cargo test`** (antes 41) y **115 de frontend en 9 archivos** (antes 115 en 8).
  > Las tres nuevas de Rust cubren texto que hasta ahora no probaba nadie: la concordancia de la
  > frase de puertos liberados y los dos formatos del aviso del Auto-Kill (nombra al proceso cuando
  > cae uno, resume cuando caen varios). Al quedarse solas en un módulo pequeño se veía que el
  > mensaje más delicado de la app —el de lo que mató sin preguntar— no tenía ninguna.
- [x] `tsc` sin errores y `tauri build` en verde.
- [x] **En vivo, sobre el binario de release y por CDP**, las dos cosas que ninguna prueba caza:
      un proceso nuevo entra solo en la lista en **1,9 s** (el hilo sigue vivo tras mudarse de
      archivo) y `invoke("check_update")` responde *"Ya tienes la última versión."* desde el botón
      de Ajustes.
  > ⚠️ Esto último era **el riesgo real del refactor**: los comandos pasan a registrarse como
  > `update::check_update` en `generate_handler!`. Si Tauri tomara la ruta entera como nombre en vez
  > del último segmento, `invoke("check_update")` dejaría de existir — y compila igual, y
  > `cargo test` pasa igual. Solo se ve en marcha.
- [x] El puerto de depuración se quitó de `tauri.conf.json` después, cerrando antes la app, y se
      recompiló sin él.

> ⚠️ **`cargo build --release` NO produce un binario de producción utilizable.** La primera pasada
> de la verificación falló en los dos casos, y la causa era esa: el ejecutable arrancaba apuntando a
> `http://localhost:1420` (el `devUrl`) y la ventana enseñaba `ERR_CONNECTION_REFUSED`. Los assets de
> `dist/` los embebe el **CLI de Tauri**, no `cargo`. Para verificar en vivo hay que construir con
> `npx tauri build --no-bundle`.
> Es la tercera vez en este tier que un fallo del guion se lee como un fallo de la app. Mirar qué
> pinta la ventana antes de creerse nada sigue saliendo a cuenta.

> Lo que **no** se probó en vivo, dicho claro: el camino del **Auto-Kill**. Exigiría bajar el umbral
> y dejar suelto al vigilante sobre los procesos reales del equipo, y la regla de la casa es que
> ninguna prueba toca procesos del usuario. Queda cubierto por que el traslado es literal —el control
> de flujo de `enforce` devuelve `true` en los mismos casos en que `watch_cycle` hacía `return`— y por
> las dos pruebas nuevas del mensaje.

### 7. Compactar la documentación — ✅ **completado**

Al abrir este tier los cuatro documentos sumaban **18.237 palabras**, y `CONTEXT.md` solo ya eran
9.508. Al llegar aquí eran **26.102**: el propio Tier 7, con su verificación tier a tier, los había
engordado un 43 % antes de tocar nada. El problema no es el detalle —es lo que da valor a este
repositorio—; es que lo mismo estaba contado en varios sitios y nada decía cuál manda.

**Ahora suman 22.301 en cinco archivos**, y cada uno responde a una cosa:

| Documento | Responde a | Palabras |
|---|---|---|
| `README.md` | ¿Qué es y cómo la uso? (quien llega de fuera) | 2.148 |
| `.claude/CLAUDE.md` | ¿Cómo se trabaja aquí? (lo que lee el agente) | 1.208 |
| `CONTEXT.md` | ¿En qué estado está y por qué se decidió así? | 5.508 |
| `ROADMAP.md` | ¿Qué falta, y qué enseñó lo ya hecho? | 8.826 |
| `docs/BITACORA.md` | ¿Cómo se llegó hasta aquí? (historia) | 4.611 |

- [x] **El registro de sesiones sale a [`docs/BITACORA.md`](docs/BITACORA.md)**. Eran 180 líneas
      —más que todo el resto de CONTEXT.md— creciendo por sesión dentro del documento que uno abre
      para saber en qué punto está el proyecto. **CONTEXT.md pasa de 427 líneas a 212.**
- [x] **Reescrito CONTEXT.md §3.** Era una pila de párrafos «Verificado el…/Añadido el…» por orden de
      llegada, con salvedades ya cerradas conviviendo con las abiertas. Ahora dice el estado, lo que
      está verificado sobre la app en marcha, y **la única salvedad que sigue abierta** (el último
      paso de la auto-actualización). El recorrido está en la bitácora.
- [x] **Podadas 8 filas de decisiones de CONTEXT.md §4** que describían el actualizador de minisign,
      **borrado del código** el 2026-07-26.
  > La **lección** se conserva, el recorrido no: "nunca volcar un archivo de clave a la consola"
  > está en CLAUDE.md y vale para siempre; "la regeneración falló por estar en el directorio
  > equivocado" no le sirve a nadie. La fila de `ProcessStartInfo` **se queda**, porque su lección
  > —`$env:VAR = ""` borra la variable en PowerShell— sigue valiendo.
  > ⚠️ **Y una fila decía algo falso.** La del 2026-07-24 afirmaba que se descartaba «el modelo de
  > confianza basado en SHA-256 del updater», decisión revertida el 2026-07-26 — o sea que describía
  > como descartado justo lo que hoy se usa. Corregida. Es exactamente el riesgo que justifica este
  > punto: la información vieja no envejece a la vista, se queda ahí pareciendo vigente.
- [x] **CONTEXT.md §7 pasa a ser un enlace a `.claude/CLAUDE.md`.** El propio documento confesaba la
      duplicación («al cambiar una, cambiarla en los dos sitios») y la lista de CONTEXT ya se había
      quedado corta, que es lo que pasa siempre con esas promesas.
- [x] **Quitada la duplicación del modelo de confianza del actualizador**, que estaba explicado siete
      veces. Se queda entero en el **README** (es información de producto) y en **`update.rs`** (es
      donde se implementa); el resto son enlaces. Siete copias de una explicación delicada garantizan
      que algún día seis digan una cosa y una diga otra.
- [x] **Condensados los Tiers 1-6**, de 367 líneas a 205. Cada uno queda con su objetivo, qué se hizo
      y **las notas ⚠️ que siguen enseñando algo**; las listas de verificación se van, porque la
      bitácora ya las cuenta y CONTEXT.md §3 las resume.
  > El criterio fue **no borrar información, borrar repetición**. Se conserva íntegro lo que explica
  > por qué algo raro está como está —que `SendKeys` no dispara un atajo global, que BitBlt no
  > captura los toast, que sysinfo necesita tres muestras, que la condición del puerto del Zombie
  > Finder no es un adorno—; se va lo que narra que en tal fecha había 13 filas en la tabla.
- [x] **Movido a CONTEXT.md §6 el bloque del toolset MSVC**, que estaba en §3 (estado) cuando es algo
      que solo importa al montar el entorno en otra máquina.
- [x] **Borrado de CONTEXT.md §3 el bloque «Cómo inspeccionar la UI en ejecución»**, copia de lo que
      ya está en CLAUDE.md, que es donde un agente lo lee sin buscarlo.
- [x] Actualizado CONTEXT.md §3, que daba el ROADMAP por terminado.

> ⚠️ **Editar estos `.md` con herramientas que respeten UTF-8.** PowerShell 5.1 los lee como ANSI y
> al guardarlos destroza todos los acentos y emojis. Está en CLAUDE.md y ya costó una sesión.

**Verificación** (2026-07-27):

- [x] **Ni un enlace roto** entre los cinco documentos: comprobados uno a uno los destinos relativos
      y las anclas.
- [x] Encoding UTF-8 intacto en los cinco (cero caracteres de reemplazo).
- [x] 44 pruebas de `cargo test`, 115 de frontend y `tsc` en verde: la única edición de código fue
      recortar el comentario del modelo de confianza en `hooks/useUpdater.ts`.


### 8. Producto — ✅ **completado y verificado**

Tres cosas que la revisión señaló como mejora, no como fallo. Entran por decisión del usuario
(2026-07-27).

- [x] **La tabla se ordena por columna.** Los seis encabezados de datos —Proceso, Puerto, PID, CPU,
      RAM y Activo— ordenan al pulsarlos; repetir la columna activa invierte la dirección.
  > Llegaba siempre por RAM descendente desde Rust, que es buen valor por defecto y **se mantiene
  > como estado inicial**. Pero el Administrador de tareas —con el que el usuario compara
  > inevitablemente, y así lo plantea el README— ordena por lo que quieras, y por CPU era lo primero
  > que se iba a pedir.
  > Las columnas numéricas se estrenan **descendentes**: al pulsar "CPU" lo que se busca es quién se
  > está comiendo la máquina, no quién gasta menos. Nombre y puerto empiezan ascendentes.
  > ⚠️ **El desempate por PID no es cosmético: es lo que impide que las filas bailen.** Rust reenvía
  > la lista cada dos segundos ya ordenada por RAM, y la RAM fluctúa, así que el orden de partida
  > cambia entre refrescos. Ordenando por CPU —donde media tabla marca 0,0 %— eso se traduce en filas
  > saltando de sitio solas cada dos segundos. Y el desempate **no se invierte** con la dirección, o
  > el problema volvería en descendente.
  > ⚠️ **Los procesos sin puerto se van siempre al final**, también en descendente. Al revés, ordenar
  > por puerto ascendente empezaría por veinte guiones y habría que bajar hasta el final para ver el
  > 3000, que es justo lo que se venía a buscar.
  > ⚠️ **El estado del orden vive en `App`, no en `ProcessTable`.** La tabla se desmonta al filtrar a
  > cero y al cambiar de vista: dentro, la elección del usuario se perdería cada vez que pasa por
  > Historial y vuelve. Hay dos pruebas que fijan justo eso.
  > La lógica va en `src/lib/sort.ts`, función pura, por lo mismo que `collect_processes` está
  > separada de `get_processes`: lo que hay que probar —la estabilidad entre refrescos— no se ve
  > mirando el DOM, solo comparando dos listas seguidas.
  > `aria-sort` en el `<th>` es lo que anuncia un lector de pantalla al entrar en la columna; la
  > flecha es su equivalente visual y va `aria-hidden` para no decirlo dos veces. Las columnas
  > inactivas enseñan una flecha fantasma al pasar por encima o al recibir el foco: sin ninguna
  > pista, que la tabla se ordena no lo descubre nadie.

- [x] **Estado vacío que orienta**, en `components/EmptyState.tsx`.
  > *"No hay procesos de desarrollo activos."* es lo primero que ve quien acaba de instalar la app
  > sin nada corriendo, y solo con esa frase se queda en un callejón sin salida: Node, Python y .NET
  > se vigilan siempre, pero quien trabaje con Go, Docker o PHP **no verá nunca nada** hasta que los
  > añada, y eso no se adivina. Ahora lo dice y lleva a Ajustes de un clic.
  > ⚠️ Son **dos** situaciones que en pantalla se parecen y no tienen nada que ver: no haber
  > encontrado nada, y no estar buscando lo correcto. Cuando el filtro es el que deja la lista vacía
  > **no** se ofrece añadir procesos — mandaría al usuario a arreglar algo que no está roto en vez de
  > a borrar lo que acaba de escribir. Hay una prueba para cada caso.

- [x] **`minWidth` sube de 720 a 900 px.** Decisión del usuario tras ver la medición.
  > La app prometía un tamaño mínimo que **no soportaba**. Medido sobre el binario de release con 16
  > filas reales: a 720 px el sidebar se lleva 208 fijos y a la tabla le quedan **497** cuando
  > necesita **672** — se esconden 175 px, un 26 % del ancho, detrás de un scroll lateral con la
  > cabecera *sticky* por encima. Cabe entera **a partir de 896 px**.
  > Se descartó colapsar el sidebar por debajo de cierta anchura: recuperaría el espacio, pero es
  > funcionalidad nueva —estados responsive, un control para plegarlo, reubicar los filtros por
  > runtime y el auto-refresco que viven ahí— para un tamaño que un gestor de procesos de escritorio
  > casi nunca necesita. El valor por defecto de la ventana ya es 1000.
  > ⚠️ **Este número tiene detrás una medición, no una estimación.** Si alguien lo vuelve a bajar,
  > que sepa que 900 sale de 208 (sidebar) + 672 (tabla) + margen.

**Verificación** (2026-07-27):

- [x] **140 pruebas de frontend** (antes 115), en 11 archivos. Las 25 nuevas cubren el criterio de
      ordenación, los encabezados, el estado vacío y la integración en `App`.
- [x] **La prueba del desempate caza el fallo**: reintroducido a propósito (`return 0` en el empate),
      falla con `expected [77, 45, 12] to deeply equal [12, 77, 45]`, que es exactamente el baile de
      filas. Un test de regresión que no se ve fallar no demuestra nada.
- [x] **En vivo, sobre el binario de release y por CDP**, con 16 procesos reales: pulsar "PID" los
      deja ascendentes con `aria-sort="ascending"`, repetir invierte a `descending`, y ordenando por
      **CPU** —con media tabla a 0,0 %— el orden **no cambia tras 5 segundos** y varios refrescos de
      Rust por medio. Es la prueba de estabilidad que jsdom no puede dar.
- [x] Las mediciones de anchura de arriba, tomadas a 720, 896 y 1000 px sobre esa misma ventana.
- [x] El puerto de depuración se quitó de `tauri.conf.json` después, cerrando antes la app, y se
      recompiló sin él.


---

### 9. Sidebar vertical, con los filtros colgando de «Procesos» — ✅ **completado y verificado**

Lo pidió el usuario el 2026-07-28 viendo la app en marcha: las tres vistas estaban en **tres
pestañas en fila** dentro de 208 px, y los filtros por runtime flotaban debajo sin decir de qué
dependían.

- [x] **La navegación pasa a vertical**: Procesos, Historial y Ajustes, uno por línea y con icono.
  > Las tres pestañas en fila ya venían con `px-1` a mano *"porque con el padding por defecto no
  > caben en los 208 px del sidebar y Ajustes se sale por el borde"*. Esa nota del Tier 2 era el
  > aviso de que el diseño no daba más de sí; en vertical sobra sitio y desaparece el apaño.
- [x] **«Procesos» pliega y despliega sus filtros**, desplegado de fábrica. Al plegar, Historial y
      Ajustes suben a ocupar el hueco (130 px medidos).
  > El mismo botón navega y pliega, según dónde estés: desde otra vista **navega** —y respeta el
  > pliegue tal como lo dejó el usuario, sin desplegarlo solo—; ya estando en Procesos, pliega. Si
  > volver de Ajustes lo desplegara, plegar no serviría de nada.
  > Los filtros solo se pintan en la vista de Procesos: filtrar lo que no se está mirando no ordena
  > nada. Por eso `aria-expanded` es la conjunción de las dos cosas y no solo del pliegue.
  > ⚠️ **El estado vive en `Sidebar`, al revés que el del orden de la tabla.** El sidebar no se
  > desmonta nunca, así que no hay nada que perder al cambiar de vista; subirlo a `App` sería pasarle
  > un detalle que solo le importa a este componente. El del orden **sí** tuvo que subir, porque la
  > tabla se desmonta al filtrar a cero.
  > Guía vertical bajo «Procesos» para que los filtros se lean como hijos suyos, y hueco del ancho
  > del chevron en Historial y Ajustes para que sus iconos alineen.
- [x] **Plegado, «Procesos» recoge el total.** Desplegado lo dice «Todos», y repetirlo dos líneas
      seguidas sobra.
  > ⚠️ Eso hace que el texto del botón **cambie según el estado**, y rompió dos cosas que lo
  > buscaban por texto exacto: dos pruebas de `App.test.tsx` y el `Invoke-Boton` de
  > `tools/capture-screenshots.ps1`. Las pruebas pasan a expresión regular —como ya hacía la de
  > `Node.js`, que lleva contador desde el Tier 6— y el script prueba primero coincidencia exacta y
  > solo después por prefijo, que es lo que evita acertar otro botón que empiece igual.

**Verificación** (2026-07-28):

- [x] **147 pruebas de frontend** (antes 140). Las 7 nuevas cubren el pliegue: que viene desplegado,
      que el mismo botón pliega y devuelve, que plegar **no** cambia de vista, que plegado enseña el
      total, que desde otra vista navega en vez de plegar, que el pliegue sobrevive a ir y volver, y
      que los filtros no aparecen en Historial ni en Ajustes.
- [x] **En vivo, sobre el binario de release y por CDP**: ningún texto del sidebar se recorta a
      208 px, plegar recupera **130 px** de alto, la tabla sigue en su sitio con `aria-current` en
      «page», el pliegue sobrevive a pasar por Ajustes y volver, y a la anchura mínima nueva (900 px)
      no se recorta nada ni desborda la tabla.
- [x] **Capturas del README regeneradas** con `tools/capture-screenshots.ps1`: enseñaban el sidebar
      viejo.
  > ⚠️ **Y al regenerarlas salió un defecto que no era del cambio.** La captura principal salió con
  > **un solo puerto visible y trece guiones**: los servidores de demostración son pequeños, y con el
  > orden de fábrica —RAM descendente— se hunden por debajo del corte en cuanto la máquina tiene unos
  > cuantos `node` sueltos (18 ese día, 13 cuando se generaron las anteriores). La columna de puertos
  > es lo que justifica la app: una captura que la enseña vacía la vende mal.
  > Arreglado aprovechando lo que acababa de entrar en el 7.8: **el script ordena por Puerto antes de
  > capturar**. Los que ocupan alguno suben arriba, los que no van siempre al final, y la captura
  > sale igual la genere quien la genere, con dos `node` de más o de menos. Deja de depender del
  > estado de la máquina.

---


## ✅ Resumen de la verificación técnica

| Punto original | Estado | Corrección aplicada |
|---|---|---|
| Tauri + React + Vite | ✅ Válido | Precisado a **Tauri 2** y TypeScript |
| Tailwind CSS | ⚠️ Desactualizado | Setup de **v4** con `@tailwindcss/vite` |
| `sysinfo` para procesos/CPU/RAM/kill | ✅ Válido | Notas de rendimiento y CPU% |
| `sysinfo` para puertos | ❌ No lo soporta | Crates `listeners` / `netstat2` |
| Framer Motion | ⚠️ Renombrado | Paquete `motion` (`motion/react`) |
| Notificaciones Tauri | ✅ Válido | Plugin `tauri-plugin-notification` + capabilities |
| System Tray | ✅ Válido | API Tauri 2 `TrayIconBuilder` |
| Hotkeys globales | ✅ Válido | Plugin `tauri-plugin-global-shortcut` |
| shadcn/ui | ⚠️ Cambió | Alias `@/` en Vite **y** tsconfig; hoy genera sobre **Base UI**, no Radix, y el Toast es **Sonner** |
| Portapapeles del navegador | ❌ No sirve | `navigator.clipboard` exige foco; `tauri-plugin-clipboard-manager` |
| CI en cada commit | ⚠️ Costoso | Descartado: release local con `release.ps1` (ver Tier 5.6) |
