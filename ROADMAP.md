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

> ✅ **Publicado en la [v1.2.0](https://github.com/xfiberex/ProcessDevKill/releases/tag/v1.2.0)**
> (2026-07-28). Minor y no patch: trae funciones nuevas —ordenación, sidebar plegable, estado vacío,
> `closeToTray`, instancia única— y **dos cambios de comportamiento** que van avisados en las notas
> del release: la X ahora cierra la app, y la ventana no baja de 900 px.
> Verificado tras publicar: 4 assets, la API devuelve `tag_name: v1.2.0`, y el instalador descargado
> del release coincide con su `.sha256` publicado.

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
  >
  > ✅ **Corregido el 2026-09-25 (Tier 11, F1): no era solo de ratón.** Con el foco en la casilla o
  > en el Kill de una fila, **Shift+F10 o la tecla Menú abren su menú**, con todas las entradas, y
  > Escape lo cierra. Lo descubrió la auditoría del 2026-09-23 y se volvió a probar con teclas
  > reales tras las fases D y E. La decisión de no dar foco a la fila sigue en pie; lo que estaba
  > mal era la conclusión.
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


## 📊 Tier 8: El medidor del entorno — ✅ **completado y verificado**
*Objetivo: decir cuánto del equipo se está comiendo tu entorno de desarrollo.*

> ✅ **Publicado en la [v1.3.0](https://github.com/xfiberex/ProcessDevKill/releases/tag/v1.3.0)**
> (2026-08-07). Minor y no patch: añade una función visible y **no cambia ningún comportamiento**,
> al contrario que la v1.2.0. Verificado tras publicar: 4 assets, la API devuelve
> `tag_name: v1.3.0`, y el instalador descargado del release coincide con su `.sha256`
> (`0050ae80…`).

Lo pidió el usuario el 2026-08-07 sobre el hueco vacío que deja el sidebar entre «Ajustes» y el
auto-refresco. De las dos formas posibles se eligió la segunda:

> **Un medidor de CPU/RAM del equipo duplica el Administrador de tareas**, con el que el README ya
> invita a comparar. Lo que nadie más da es **qué parte de eso la pone tu entorno**. Y tapa un hueco
> real: desde el Tier 2 las barras de la tabla se escalan al proceso que más consume **de la lista**,
> así que una barra llena puede ser un proceso gastando el 2 % del equipo. Éste es el denominador que
> faltaba.

- [x] `SystemUsage` en `processes.rs`, con la parte del equipo (`cpu`, `usedMemoryMb`,
      `totalMemoryMb`) y la del entorno (`devCpu`, `devMemoryMb`). `dev_totals` es función pura y
      aparte, por lo mismo que `collect_processes` frente a `get_processes`.
- [x] `UsageMeter.tsx` en el sidebar: dos barras de **dos capas** sobre el mismo carril, que es el
      equipo entero. La tenue es lo que usa la máquina; la sólida, la parte del entorno.
- [x] **Rótulo corregido el mismo día**, tras leerlo el usuario.
  > ⚠️ **El primer rótulo se leía mal, y lo demostró el primero que lo vio.** Decía
  > «1008 MB de 15.6 GB» —tu entorno frente a lo que usa la máquina— con el total solo en el
  > tooltip, por ahorrar una línea. El usuario leyó ese 15,6 como su RAM instalada; **tiene 31,9 GB**.
  > Era justo la ambigüedad que se identificó al diseñarlo y se resolvió mal.
  > Ahora cada métrica lleva tres líneas: la tuya arriba, la barra, y **«Equipo» nombrado** con su
  > cifra debajo — en RAM, las dos (`15.5 / 31.9 GB`), sin repetir la unidad si coinciden. Medido en
  > la ventana: 154 px de alto y cero recortes en los 208 px del sidebar.
- [x] Evento propio `system-usage`, y `types.test.ts` comparando los campos del struct de Rust con
      los del tipo de TypeScript.

> ⚠️ **La primera lectura de CPU global no falla hacia 0, falla hacia 100.** Se dio por hecho lo
> contrario, y el primer test de regresión —`assert!(uso.cpu > 0.0)`— **pasaba igual con el
> calentamiento quitado**: 100 también es mayor que cero. Medido: un `System` recién creado responde
> `100.000 %` con la máquina al 10 % real, y **da igual cuánto se espere antes de preguntar** — no es
> cuestión de dejar pasar `MINIMUM_CPU_UPDATE_INTERVAL`, es que falta la muestra anterior contra la
> que comparar. Sin calentarlo, el sidebar se abre diciendo que el equipo está al tope.
> ⚠️ **Preguntar dos veces seguidas da el mismo 100 %.** Medido repitiendo la medida a distintos
> plazos con la máquina al 10 %: 0 ms → **100 %**; 10 ms → 11,6 %; 50 ms → 7,3 %; 100 ms → 3,3 %;
> 200 ms → 12,2 %. Por eso el medidor sale **solo del hilo del poller**, que es el único que corre a
> un ritmo conocido: emitirlo también desde `kill_and_record` lo habría disparado al tope cada vez
> que se mata un proceso.
> ⚠️ Con el refresco en **"Off" se dice "En pausa"** en vez de dejar la última cifra. No hace falta
> estado nuevo: lo decide `refreshMs`, el mismo ajuste que para al poller.
> ⚠️ La suma de los vigilados **puede pasarse** de lo que dice usar el equipo: la memoria residente
> cuenta dos veces las páginas compartidas. El número se enseña tal cual —es el que da el sistema—,
> pero la barra se recorta al 100 %.
> ⚠️ **Volvió a morder `Start-Process`**, ya documentado en el Tier 6: une los argumentos con
> espacios y no entrecomilla nada, así que el `node -e` del guion de verificación moría al instante.
> Los dos fallos de la primera pasada —la RAM que no subía y la fila que no aparecía— eran ese, no
> del medidor. **Cuarta vez en este repositorio que un fallo del guion se lee como fallo de la app.**

**Verificación** (2026-08-07):

- [x] **160 pruebas de frontend** (antes 147) y **48 de `cargo test`** (antes 44). Las dos últimas
      son la regresión del rótulo: que la RAM instalada esté a la vista y que la unidad no se repita.
- [x] **El test del calentamiento caza el fallo**: quitada a propósito la medida del equipo de
      `warm_up_cpu`, falla con *"el equipo reportó 100 %"*. La primera versión del test no lo cazaba,
      y por eso se reescribió.
- [x] **En vivo, sobre el binario de release y por CDP**: el medidor recibe medidas y **cambia entre
      ciclos** (4 lecturas distintas de 4), la CPU del equipo no se queda pegada al 100 %, levantar un
      `node` de ~380 MB sube la RAM del entorno de **576 a 1.008 MB**, cerrarlo la devuelve a 576, y
      «Off» pone «En pausa» mientras que volver a «2s» devuelve las cifras.
- [x] **Matar un proceso no descuadra el medidor**: se comprobó cerrando desde la ventana el `node`
      que había lanzado el propio guion —localizando su fila por PID en el nombre accesible del
      botón—, porque la regla de la casa es que ninguna prueba toca los procesos del usuario y un
      «Kill» a secas habría acertado la primera fila, que es suya.
- [x] El puerto de depuración se quitó de `tauri.conf.json` después, cerrando antes la app, y se
      recompiló sin él.

> Limitación asumida, y visible en la verificación: **`devCpu` marca 0,0 % casi siempre**. No es un
> fallo, es lo mismo que descubrió el Zombie Finder en el Tier 5 —7 de cada 10 procesos de desarrollo
> en reposo marcan 0 % de CPU—. La fila de CPU sigue diciendo lo que usa el equipo, que es
> información; el valor del medidor está sobre todo en la de RAM.

---


## 🤫 Tier 9: La actualización, en silencio — ✅ **completado y verificado**

> ✅ **Publicado en la [v1.3.1](https://github.com/xfiberex/ProcessDevKill/releases/tag/v1.3.1)**
> (2026-08-14). Patch: arregla un comportamiento y no añade nada. Verificado tras publicar: 4
> assets, la API devuelve `tag_name: v1.3.1`, y el instalador descargado del release coincide con
> su `.sha256` (`121b228e…`).

Lo reportó el usuario probando la auto-actualización: al pulsar «Instalar» **salían dos ventanas
seguidas** —la del desinstalador de la versión anterior y la del asistente de instalación— y había
que responder a las dos. La app decía «volverá a abrirse sola» y en realidad dejaba al usuario
haciendo clic en «Siguiente».

- [x] `launch_installer` pasa `/S /UPDATE /R` al instalador NSIS. Los tres flags son de la plantilla
      de Tauri, **leídos del `installer.nsi` que genera este proyecto**, no de la documentación:
      `/S` quita el asistente; **`/UPDATE` es el que quita la desinstalación previa** (la plantilla
      salta ese paso en modo actualización, conserva los accesos directos y no reinstala WebView2);
      `/R` vuelve a abrir la app al terminar, vía `RunAsUser`.
- [x] Comprobado en la plantilla que **`/R` solo se mira en modo silencioso o pasivo**: sin `/S` no
      haría nada, así que los flags van juntos o no van.
- [x] Comprobado que no hay carrera con el `app.exit(0)` de `install_update`: el instalador
      silencioso mata la app él mismo si aún la encuentra viva (`CheckIfAppIsRunning` en
      `utils.nsh`), llegue antes o después.
- [x] El texto de Ajustes deja de prometer lo que no pasaba: ahora dice que se instala en silencio y
      que no hay que responder a ninguna ventana.
- [x] Una prueba (`el_instalador_se_lanza_en_silencio`) fija los tres flags con el motivo de cada
      uno. 49 de `cargo test` (antes 48) y 160 de frontend.

> ✅ **Verificado en la app en marcha el 2026-08-18.** Se dijo al publicarlo que no se podía
> comprobar desde la propia v1.3.1 —el instalador lo lanza la app **instalada**— y que haría falta
> cortar una v1.3.2 y actualizar desde ésta. Es exactamente lo que pasó: el usuario actualizó de la
> v1.3.1 a la v1.3.2 desde *Ajustes → Actualizaciones* y **no apareció ninguna ventana**; la app se
> cerró, se actualizó y volvió a abrirse sola. Hasta ese momento la evidencia era la plantilla NSIS
> generada, que es fuerte, pero no es la app funcionando.
>
> De paso cierra **la última salvedad abierta del proyecto entero**: lanzar el instalador era el
> único paso del actualizador que nunca había corrido de principio a fin (ver CONTEXT §3).

---


## 🗄 Tier 10: Servicios de desarrollo — ✅ **completado y verificado**

> **Propuesto por el usuario el 2026-08-22.** Es el primer Tier que se abre desde que el backlog de
> la auditoría quedó sin nada pendiente (**37 de 37**), y va aquí y no como una tarea `T5-xx` a
> propósito: los `Tn-xx` son deuda encontrada en una revisión, y esto es una fase de desarrollo
> nueva. Nada de los Tiers 1-9 se toca.
>
> **Las tres fases están hechas y verificadas**: la A el 2026-08-22, la B y la C el 2026-08-23.
> Los checkboxes se marcan cuando la funcionalidad está *probada*, como en el resto del documento.

### Por qué encaja, y no es ampliar el alcance

El eslogan del producto es «el puerto 3000 está ocupado y no sé por quién». El **1433**, el **5432**,
el **27017** y el **6379** son puertos igual que el 3000. La app hoy responde esa pregunta para los
procesos que lanza el usuario y es **ciega a la mitad que lanza Windows por él**. No es una función
nueva pegada al lado: es el agujero del alcance que ya tiene.

**La prueba salió del equipo del propio usuario**, mirado el 2026-08-22 antes de escribir esto:

| Servicio | Estado | Arranque | Puerto | RAM |
|---|---|---|---|---|
| `postgresql-x64-17` | Running | **Automatic** | **5433** | * |
| `postgresql-x64-18` | Running | **Automatic** | **5432** | * |
| `MSSQL$SQLEXPRESS` | Running | **Automatic** | sin TCP | 125 MB |
| `SQLTELEMETRY$SQLEXPRESS` | Running | **Automatic** | — | 53 MB |
| `MySQL80` | Stopped | Manual | — | — |
| `com.docker.service` | Stopped | Manual | — | — |

**Dos PostgreSQL arrancando en cada boot**, en 5432 y 5433, y un servicio de telemetría de 53 MB.
Un panel de solo lectura ya habría enseñado eso el primer día.

`*` La RAM de los dos PostgreSQL se deja en blanco a propósito: el proceso que el SCM asocia al
servicio no es el que escucha en el puerto, así que la cifra que sale de ahí no es la del servidor.
Es la trampa 1 de más abajo, y sale ya en la primera tabla que se intenta pintar.

> **Y los puertos de esa tabla estuvieron mal escritos hasta el 2026-08-22.** Decían 17→5432 y
> 18→5433, que es lo que uno supone. Al comprobar el árbol de procesos de verdad salió al revés: el
> servicio del 17 es el PID 4992 (`pg_ctl.exe`), su hijo 6680 escucha en el **5433**, y el del 18
> acaba en el **5432**. Queda escrito porque es la demostración de la trampa: **suponer la relación
> servicio→puerto da un resultado creíble y equivocado**.

### Un filo que además arregla

Hoy, si el usuario añade `sqlservr` a los nombres vigilados, la app le ofrece un botón **Kill** para
SQL Server. Es la acción equivocada —matar un motor de base de datos en vez de detenerlo— y encima
fallaría sin privilegios. El panel da la acción correcta para esa clase de proceso.

### ⚠️ La decisión de los privilegios — **tomada, y la que sostiene las tres fases**

La app instala en `currentUser` (`tauri.conf.json`) y **nunca eleva**. Leer el estado de los
servicios es gratis; `StartService`, `StopService` y sobre todo `ChangeServiceConfig` piden
administrador.

- ❌ **Elevar la app entera.** Rompe su mejor propiedad. Hoy lo peor que puede hacer un fallo es
  cerrar procesos del usuario; elevada, la guardia de PIDs sería lo único entre un fallo y los
  procesos del sistema. Y saldría un UAC en cada arranque de una app pensada para vivir en la
  bandeja.
- ✅ **Leer siempre, elevar solo al actuar.** El panel funciona sin admin y el UAC sale al pulsar
  Detener o al cambiar el tipo de arranque. **Es lo que se hizo.** La app relanza su propio
  ejecutable con `runas` para una acción concreta; ese proceso hace una llamada al SCM y muere.
  Todo eso vive en `service_control.rs`, y `services.rs` —el que llama el poller y la ventana—
  sigue sin poder tocar nada.
- ❌ **Un servicio broker instalado con admin.** Obliga a `installMode: perMachine`, deja algo
  corriendo como SYSTEM para siempre y abre una superficie de IPC que este proyecto no necesita.

### ⚠️ El tipo de arranque persiste, y eso lo pone por encima del Auto-Kill en cuidado

Cambiar el tipo de arranque sería **lo primero que esta app hace que sobrevive a un reinicio y vive
fuera de su propio `settings.json`**. El Auto-Kill mata un proceso y vuelve la próxima vez que se
lanza; un servicio en `Deshabilitado` sigue deshabilitado dentro de tres meses, cuando ya nadie
recuerda que lo hizo la app. De ahí dos reglas que no se negocian:

- **La app registra lo que cambió, para poder deshacerlo.** Mismo criterio que el historial de
  cierres.
- **Nunca lo hace sola.** No hay, ni habrá, un «Auto-Kill de servicios».

### Fase A — solo lectura — ✅ **hecha y verificada el 2026-08-22**

Se publica sola y ya es útil. Sin privilegios, sin riesgo.

- [x] Enumerar los servicios con el SCM (`OpenSCManagerW` + `EnumServicesStatusExW`) desde Rust, en
      su propio módulo `services.rs`. Con la crate `windows`, no llamando a `sc.exe` ni a
      PowerShell: lanzar un proceso por consulta es lento y devuelve texto **localizado** que habría
      que parsear. El SCM se abre con `SC_MANAGER_CONNECT | SC_MANAGER_ENUMERATE_SERVICE` y nada
      más: con esos dos derechos el módulo **no puede** arrancar ni detener nada aunque quisiera.
- [x] Clasificar cuáles son «de desarrollo» con el mismo diseño que `classify` en `processes.rs`:
      una lista de fábrica más los que añada el usuario, en su propio ajuste `customServices`
      —aparte de `customNames`, que son ejecutables—.
- [x] Vista nueva en el sidebar con estado, tipo de arranque, RAM y **el puerto que ocupa cada uno**.
      Todo el color va al **estado** y no a la familia: en un panel de servicios lo que se escanea
      es qué está corriendo.
- [x] Prueba de que la lista de fábrica no incluye nada que no sea de desarrollo, y de que un
      servicio ajeno no se cuela por parecido de nombre. Son tres: la negativa de los parecidos, la
      de los servicios del sistema y la de que lo que añade el usuario entra **exacto**.

> ✅ **Verificado sobre el binario de release el 2026-08-22.** El panel lista los 10 servicios de
> desarrollo del equipo con su estado y su tipo de arranque, y **acierta los puertos**: 5433 para
> `postgresql-x64-17` y 5432 para el 18. 10 pruebas nuevas de Rust y 11 del frontend; **77 y 205 en
> total**.
>
> **Y enseña lo que se buscaba:** dos PostgreSQL en `Automático`, `MSSQL$SQLEXPRESS` y
> `SQLTELEMETRY$SQLEXPRESS` en `Automático (retrasado)`. Cuatro servicios arrancando solos, uno de
> ellos de telemetría.

### Fase B — arrancar y detener — ✅ **hecha y verificada el 2026-08-23**

- [x] Elevación puntual al actuar, no al arrancar la app. La app relanza **su propio ejecutable**
      con `ShellExecuteExW` y el verbo `runas`, pasándole un verbo y un nombre; ese proceso hace una
      sola llamada al SCM y muere. Vive elevado unos milisegundos, sin ventana, sin IPC y sin
      estado. Todo eso vive en `service_control.rs`, aparte, para que `services.rs` **siga siendo
      incapaz** de tocar nada.
- [x] Confirmación antes de detener, como en todo lo que esta app cierra. Arrancar no se confirma:
      no rompe nada y se deshace deteniéndolo.
- [x] **Enseñar las dependencias antes de detener.** Se consultan con `EnumDependentServicesW`
      filtrando por `SERVICE_ACTIVE` y se enseñan en el propio diálogo, antes de que salga el UAC.
- [x] Que el resultado real se lea del SCM y no se asuma. El padre sondea `QueryServiceStatusEx`
      cada 250 ms hasta diez segundos —leer no pide privilegios— y contesta `done`, o `pending` si
      al acabar la espera el servicio seguía en transición. `pending` no es un fallo: es un
      servicio que todavía está en ello, y decir «hecho» sin que lo esté sería justo lo que no se
      hace aquí.
- [x] La guardia, que no estaba en la lista y es lo que más importa de esta fase. Ver abajo.

> ⚠️ **La guardia va dentro del proceso elevado, no en quien lo lanza.** El hijo recibe un nombre
> por línea de comandos, y **vuelve a validarlo él mismo** contra el catálogo de fábrica más los
> `customServices` que **relee del disco**. Si se fiara de su padre, cualquier programa del equipo
> —sin privilegios, que es lo que suele tener— podría lanzar
> `processdevkill.exe --service-action stop <lo que sea>` y conseguir que el UAC enseñe el nombre y
> el icono de *esta* app para detener un servicio del sistema. Pasarle la lista de permitidos por
> parámetro sería la guardia validándose contra su propia entrada, que no valida nada.
>
> **Y no hay cascada.** Windows se niega a detener un servicio con dependientes vivos; la tentación
> es que el hijo los detenga también, como hace `services.msc`. No se hace: serían servicios que
> nunca pasaron por la guardia ni por el diálogo. Se enseñan los nombres y se dice que hay que
> detener esos primero.

> ✅ **Verificado sobre el binario de release el 2026-08-23**, en los dos sentidos:
>
> - **Con la app elevada** (donde `runas` no saca UAC) se recorrió el camino entero: arrancar
>   `MySQL80` lo dejó en `Corriendo` con **3306 y 33060**, puertos que la fila no tenía; detenerlo
>   sacó el diálogo, el toast «MySQL80 está parado.» y devolvió la fila a `Parado / Manual`, que es
>   como estaba.
> - **Con la app sin elevar**, el UAC aparece al instante al pulsar (`consent.exe`), y la columna de
>   RAM vuelve a «—» — la misma app, el mismo binario, y la prueba de que ese guion es el permiso.
> - **La guardia, contra el binario de verdad**: `wuauserv`, `TrustedInstaller`,
>   `GameInputRedistService` y `MSSQLSERVER2` devuelven el código 2 y siguen corriendo.
> - **El filtro `SERVICE_ACTIVE`**: `MSSQL$SQLEXPRESS` tiene un dependiente —`SQLAgent$SQLEXPRESS`,
>   deshabilitado— y el diálogo **no** lo menciona, que es lo correcto: un dependiente parado no
>   impide nada y nombrarlo sería asustar con lo que no pasa.
>
> 8 pruebas nuevas de Rust y 6 del frontend; **85 y 211** en total. El caso `blocked` —Windows
> negándose por dependientes vivos— **no se pudo reproducir en este equipo**: ningún servicio de
> desarrollo tiene aquí un dependiente en marcha, y forzar uno pedía cambiar un tipo de arranque,
> que es justo lo que la fase C todavía no hace. Queda cubierto por el mapeo de
> `ERROR_DEPENDENT_SERVICES_RUNNING` y por su prueba, pero **no visto en vivo**.

### Fase C — tipo de arranque — ✅ **hecha y verificada el 2026-08-23**

- [x] `ChangeServiceConfigW` con elevación, por el mismo camino que la fase B: un verbo más
      (`startup`) en el proceso hijo, con `SERVICE_CHANGE_CONFIG` y `SERVICE_NO_CHANGE` en todo lo
      demás — ni la ruta del binario, ni la cuenta con la que corre, ni las dependencias.
- [x] **Solo cuatro tipos, y `boot` y `system` no están.** Son de controladores que carga el núcleo
      antes de que exista el escritorio; ofrecerlos sería regalar una forma de dejar un equipo sin
      arrancar. El proceso elevado **también** valida el tipo, no solo el nombre: es el segundo
      argumento que le llega de fuera.
- [x] **Registro de lo que la app cambió, con deshacer**, en `service-changes.json`. Guarda el valor
      **original** —no cada paso— y la entrada **se borra sola** al volver a él: deshacer y volver
      a ponerlo son el mismo camino, y no hay que deshacer tres veces para desandar tres cambios.
- [x] Aviso claro en la UI de que el cambio sobrevive al reinicio, en el diálogo de confirmación y
      antes de que salga el UAC. Al deshacer, el aviso es **otro**: el de siempre promete que queda
      anotado abajo, y deshaciendo pasa justo lo contrario.
- [x] **Nunca lo hace sola.** No hay, ni habrá, un «Auto-Kill de servicios»: este comando solo
      existe colgando de un clic con su confirmación delante.

> ⚠️ **La trampa técnica de esta fase: los dos «Automático» son el mismo valor para el SCM.** El
> retraso vive en otra estructura (`SERVICE_CONFIG_DELAYED_AUTO_START_INFO`), así que hay que
> escribirlo con una **segunda** llamada, y escribirlo **siempre** — también cuando toca ponerlo en
> `false`. Sin eso, pasar un servicio de retrasado a automático normal no cambiaría nada y la app
> reportaría un cambio que no ocurrió.

> ✅ **Verificado sobre el binario de release el 2026-08-23**, entero y sobre `MySQL80`:
>
> - `Manual → Deshabilitado`: Windows dice `Disabled` y aparece la entrada en el registro.
> - `Deshabilitado → Automático`: **el registro sigue diciendo `from: manual`**, que es la decisión
>   de diseño que importa — el original aguanta los pasos intermedios.
> - `Automático → Automático (retrasado) → Automático`: `DelayedAutoStart` sube a `True` y **vuelve
>   a bajar a `False`**. Es la trampa de arriba, comprobada en los dos sentidos.
> - **Deshacer**: vuelve a `Manual`, el registro queda en `[]` y la sección desaparece sola.
>
> 5 pruebas nuevas de Rust y 6 del frontend; **93 y 217** en total —219 tras el repaso de UI del
> 2026-08-23, que añadió dos—. Y un fallo de texto propio que
> destapó la prueba en vivo: el diálogo de deshacer prometía «queda anotado abajo para poder
> deshacerlo», cuando deshaciendo la entrada se va. Corregido con su propio aviso.

### Cuatro trampas concretas, ya vistas en el equipo del usuario

0. **La RAM de un servicio no se puede leer sin ser administrador**, y esto se descubrió
   construyendo la Fase A, no antes. `sysinfo` devolvía 0 para todos; se probó además a abrirlos a
   mano con `OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION)`, que es el derecho *más* permisivo, y
   contestó **acceso denegado**. Medido: de 327 procesos del equipo, 168 dejan leer su memoria, y
   los 53 del propio usuario la dejan todos — los servicios corren con otra cuenta.
   **Consecuencia:** `memory_mb` es `Option<f64>` y la columna pinta «—» con su explicación en el
   `title`, nunca un «0 MB» que el usuario se creería. Rellenarla pediría o elevar la app —descartado
   arriba— o `NtQuerySystemInformation`, que es la API semi-documentada que usa `Get-Process`; no se
   añade una API que Microsoft se reserva el derecho a cambiar por una columna de conveniencia.

   > **Comprobado en los dos sentidos el 2026-08-22**, que es lo que convierte la suposición en dato:
   > desde una consola **elevada**, la misma llamada que antes daba acceso denegado lee los mismos
   > PIDs sin problema — `MSSQL$SQLEXPRESS` 124,4 MB, `SQLTELEMETRY$SQLEXPRESS` 53,4 MB. El «—» no
   > es que la app no sepa mirar: es exactamente el permiso, y por eso el `title` puede afirmarlo.
   >
   > Y de paso confirma que el árbol hace falta también para la RAM, no solo para los puertos:
   > `postgresql-x64-17` reporta **7,7 MB** por su PID —es el `pg_ctl.exe`— y **107,3 MB** al sumar
   > sus 9 procesos. Catorce veces. Si algún día se muestra esa cifra, la del PID suelto sería tan
   > engañosa como el cero.

1. **El PID del servicio no es el que tiene el puerto.** El SCM dice que `postgresql-x64-17` es el
   PID 4992 —que es un `pg_ctl.exe`—; quien escucha en 5433 es su hijo 6680, un `postgres.exe`. Hay que recorrer el árbol de procesos — es el mismo
   error que ya costó una medición inválida en T4-03, donde el consumo del WebView hubo que sacarlo
   caminando `ParentProcessId`.
2. **SQL Express no tiene puerto TCP**: viene con TCP/IP desactivado. La columna estrella de la app
   estaría vacía justo para el servicio más pesado. Eso hay que **decirlo** en la UI, no dejar un
   guion como si no se supiera — mismo criterio que el «En pausa» del medidor.
3. **Emparejar por nombre de servicio, nunca por nombre visible.** El equipo del usuario es es-DO y
   los `DisplayName` están localizados: `MSSQL$SQLEXPRESS` es estable, «SQL Server (SQLEXPRESS)» no.
   La vista enseña los dos —el corto en monoespaciada y el visible debajo en gris—, pero el que se
   compara es siempre el corto.

> **Y una que no estaba prevista: nunca comparar por subcadena.** Al explorar la idea se filtraron
> los servicios del equipo con un `-match` que incluía `Redis`, y apareció **`GameInputRedistService`**
> — «Redist» contiene «Redis». Un panel que en la fase B ofrecerá **detener** lo que lista no puede
> colar el mando de una consola entre las bases de datos. De ahí que los patrones sean de cuatro
> clases explícitas (exacto, instancia `NOMBRE$`, prefijo numerado, prefijo con separador) y ninguna
> sea «contiene». Es el primer caso de la prueba negativa.

### Lo que este Tier **no** va a hacer

- Ni instalar ni desinstalar servicios.
- Ni tocar servicios que no estén en la lista de desarrollo, aunque el usuario los busque.
- Ni cambiar nada de forma automática, en ningún caso.

---


## 🧭 Tier 11: Auditoría UX/UI — ✅ **completo: las seis fases hechas y verificadas (v1.6.0 a v1.8.0)**
*Objetivo: que la app no deje cerrar lo que no se quería, que se pueda usar entera con teclado y con poca vista, y que las cuatro vistas hablen el mismo idioma visual.*

> **Sale de una auditoría de UX/UI hecha el 2026-09-23 sobre la v1.5.3**, con la app en marcha
> (`tauri dev` conducido por CDP) y los procesos y servicios reales del equipo: axe-core 4.13 en las
> cuatro vistas y los dos temas, contrastes de bordes y foco calculados componiendo los colores que
> pinta el WebView, y capturas a 1000×680 y 900×480. **No se pulsó ningún Kill, Nuke All, Arrancar
> ni Detener, ni se guardó ningún ajuste**: el tema se cambió solo con la clase del DOM, y el puerto
> de depuración se quitó de `tauri.conf.json` al terminar.
>
> Nada de aquí es un fallo de funcionamiento. Son riesgos de uso, fallos medibles de accesibilidad
> y desajustes de maquetación. Las cifras que se citan son **medidas**, no estimadas.

> ⚠️ **Cuatro puntos reabren decisiones anotadas en CONTEXT §4**: el atajo encendido de fábrica
> (A1), el `select` nativo del arranque (A4), el estilo del Kill de cada fila (D5) y el menú
> contextual «solo de ratón» (F1). Si se adoptan, la decisión nueva va allí con su fecha.

### Fase A — riesgo de cerrar lo que no se quería — ✅ **hecha y verificada el 2026-09-23**

> Con 112 pruebas de Rust y 245 del frontend en verde, clippy y ESLint limpios, y la app en marcha
> por CDP con los procesos y servicios reales del equipo. En la verificación en vivo **no se pulsó
> ningún Kill ni se eligió ningún tipo de arranque**: los menús y la lista se cerraron con Escape.
> Las decisiones, con su porqué, en CONTEXT §4 (2026-09-23).

- [x] **A1. Ctrl+Alt+K apagado de fábrica** ([storage.rs](src-tauri/src/storage.rs), `hotkey_enabled: true`).
  > Cierra **todos** los procesos vigilados sin confirmar y, al ser global (`RegisterHotKey`), se lo
  > quita a todas las apps: en los IDE de JetBrains Ctrl+Alt+K es *Commit and Push*, así que quien lo
  > pulse ahí cierra sus servidores y el IDE ni recibe la tecla. El Auto-Kill y el Zombie Finder nacen
  > apagados por matar sin preguntar; esto merece el mismo criterio. Cambiar el valor de fábrica solo
  > afecta a quien no tenga el campo guardado. Además: combinación configurable, y valorar una doble
  > pulsación.
  >
  > ✅ **Hecho, con las dos cosas.** Apagado de fábrica; combinación elegible entre Ctrl+Alt+K,
  > Ctrl+Alt+Shift+K y Ctrl+Alt+F12; y **dos pulsaciones en 3 s**, encendido de fábrica, que sí
  > alcanza a quien ya tenía el atajo activo. La primera pulsación avisa de cuántos caerían. Probado
  > con pruebas unitarias (`hotkey::decidir`, los valores de fábrica y la migración de un
  > `settings.json` antiguo). ⚠️ **Lo que quedó fuera: no se pulsó el atajo de verdad**, porque
  > dispararlo cierra los procesos reales del equipo; el registro con `RegisterHotKey` es el mismo
  > camino de siempre, y la combinación nueva solo cambia el `Shortcut` que se le pasa.
- [x] **A2. Distinguir las filas**: segunda línea en gris con el script y la carpeta del proyecto.
  > En la auditoría, **13 de 15 filas eran `node.exe`**, y dos de ellas eran el CLI de Tauri y el Vite
  > que había lanzado la propia sesión: nada en la fila lo decía. Kill y Nuke All se usan a ciegas. Es
  > el mismo patrón de dos líneas que ya usa Servicios. Script + carpeta, **no la línea de comandos
  > entera**, que puede llevar tokens. El buscador también debe mirarla. Es la mejora de más valor.
  >
  > ✅ **Hecho y visto en vivo**: las filas pasaron a decir `vite · ProcessDevKill`,
  > `@tauri-apps/cli · src-tauri`, `chrome-devtools-mcp · ProcessDevKill`… La verificación destapó
  > dos cosas que se arreglaron en el momento: los lanzadores de npm (`node_modules\.bin\..\vite`)
  > salían como `.bin`, y una línea larga sacaba la tabla de la ventana a 1000 px. El buscador mira
  > también las dos.
- [x] **A3. Lista de procesos protegidos** que respeten Nuke All, la bandeja, el atajo y el Auto-Kill.
  > Entra por `kill_and_record`, que es por donde pasa toda muerte. Prueba obligatoria: el criterio
  > negativo, que un protegido **no** cae por ninguna de las cuatro vías.
  >
  > ✅ **Hecho.** En Ajustes y desde el menú de cada fila (por la carpeta). Tampoco lo cierra el Kill
  > de su fila, que sale apagado con un candado. La prueba del criterio negativo lanza un `node` desde
  > una carpeta propia, lo protege por ella y comprueba que ni la bandeja, ni el atajo, ni la guardia
  > de `kill_many` —por la que pasan la ventana y el Auto-Kill— lo tocan, y que **sigue vivo**; sin
  > protegerlo, el mismo PID muere. ⚠️ **En vivo no se protegió nada**, para no escribir en el
  > `settings.json` del usuario: la parte de la ventana está cubierta por las pruebas del frontend.
- [x] **A4. El tipo de arranque no se confirma en `change`.**
  > Un `<select>` nativo en WebView2 lanza `change` **con cada flecha** (medido: 1 flecha → 1
  > `change`, 2 → 2). En Servicios, ↓ sobre «Automático» abre ya la confirmación para «Automático
  > (retrasado)» con el foco en «Cambiar arranque»; «Deshabilitado» no se alcanza con flechas y un
  > Enter confirma lo que no se quería, con el UAC como única barrera — en la única acción que
  > sobrevive al reinicio. Salidas: el `Select` de Base UI (las flechas abren la lista, no cambian el
  > valor) o el nativo como borrador con un botón «Aplicar». Contradice la nota de `ServicesView.tsx`
  > que defiende el nativo porque «trae gratis el teclado».
  >
  > ✅ **Hecho con el `Select` de Base UI**, y solo se acepta un cambio al **elegir una entrada**:
  > Base UI también cambiaba el valor tecleando una letra con la lista cerrada. Verificado en vivo
  > sobre los 10 servicios del equipo: una letra no abre el diálogo, ↓ abre la lista sin cambiar el
  > valor y Escape lo deja todo como estaba.
- [x] **A5. Congelar el orden de la tabla mientras el puntero está encima** o hay un menú abierto.
  > Kill cierra sin confirmar —bien, como el Administrador de tareas—, pero con el orden por RAM las
  > filas cambian de sitio solas: en 30 s de reposo hubo un refresco que movió **5 filas a la vez**.
  > Los valores siguen actualizándose; lo que se congela es la posición.
  >
  > ✅ **Hecho y visto en vivo**: 8 refrescos seguidos con el puntero encima, sin que se moviera una
  > fila. Los que mueren salen sin dejar hueco y los nuevos van al final.
- [x] **A6. «Matar proceso» al final del menú contextual**, tras un separador.
  > Abierto por teclado, **la primera flecha cae en él**, y cierra sin diálogo. Con el ratón es la
  > entrada que queda justo bajo el cursor. Lo convencional es lo destructivo al final.
  >
  > ✅ **Hecho y visto en vivo**: abierto con Shift+F10, la primera flecha cae en «Copiar PID».
  > Entre medias queda «Proteger», con su propio separador.

### Fase B — accesibilidad medida — ✅ **hecha y verificada el 2026-09-24**

> **axe-core 4.13, con las mismas reglas que en la auditoría, da cero violaciones y cero
> resultados incompletos en las cuatro vistas y los dos temas.** Los contrastes que axe no mide
> —bordes y anillos— se volvieron a medir en la app en marcha componiendo los colores que pinta
> el WebView, con el mismo script de la auditoría. 249 pruebas del frontend en verde. Decisiones,
> en CONTEXT §4 (2026-09-24).

- [x] **B1. Bordes de control y anillos de foco a 3:1** (WCAG 1.4.11).

  | Elemento | Claro | Oscuro |
  |---|---|---|
  | Borde de casilla sin marcar | 1,26:1 | 1,74:1 |
  | Interruptor apagado (pista / pulgar) | 1,26 / 1,26:1 | 1,38 / 11,2:1 |
  | Borde de campos | 1,26:1 | 1,52–1,74:1 |
  | Anillo de foco | 1,44–1,57:1 | 1,64–1,87:1 |

  > Sale casi todo de `--input` y del `ring/50` de shadcn. Valores calculados que pasan: borde de
  > control `oklch(0.62 0.012 265)` en claro y `oklch(0.55 0.012 265)` en oscuro (3,6 y 3,9:1);
  > anillo **opaco** `oklch(0.55 0.02 265)` y `oklch(0.70 0.02 265)` (4,8 y 7,1:1). Si oscurecer
  > `--input` pesa en los campos de texto, un token aparte para casillas e interruptores cubre lo
  > imprescindible. ⚠️ En oscuro, el borde de los botones *outline* **no cambia al enfocar**:
  > `dark:border-input` gana a `focus-visible:border-ring`. Son componentes de shadcn: se anota por
  > qué se tocan.
  >
  > ✅ **Hecho con un token aparte, `--control`**, para los bordes de casillas, interruptores,
  > campos y desplegables: `--input` también pinta fondos (`bg-input/30`) y oscurecerlo ensuciaba
  > los campos. Anillo opaco y sin el `/50` en todos los componentes, también en Kill, que tenía uno
  > rojo propio a 20 %. **Medido en vivo**: bordes 3,59:1 en claro y 3,93:1 en oscuro, pista del
  > interruptor igual y pulgar sobre pista 3,59 / 3,94; anillo `oklch(0.55)` en claro (4,76:1) y
  > `oklch(0.70)` en oscuro (7,13:1), leído del `box-shadow` computado de cuatro controles. El borde
  > de los *outline* en oscuro ya cambia al enfocar.
- [x] **B2. Contraste del texto destructivo** (axe, WCAG 1.4.3 pide 4,5:1).
  > «Kill» da 3,94:1 en claro y 3,88:1 en oscuro; «Nuke All» en oscuro, 3,85:1. Con el texto de Kill
  > en `oklch(0.50 0.19 27)` / `oklch(0.74 0.16 25)` y `--destructive` oscuro en
  > `oklch(0.56 0.20 25.5)`, pasan a 5,5 / 6,3 / 4,9:1.
  >
  > ✅ **Hecho con esos valores**, en un token `--destructive-text` aparte del rojo de fondo: así el
  > de Nuke All en claro, que ya pasaba, no se tocó. Lo usan también el «Matar proceso» del menú,
  > el error de Actualizaciones y el icono de Detener. axe ya no marca ningún contraste.
- [x] **B3. «Seleccionar todos» de la cabecera a 24×24 px** de objetivo (WCAG 2.5.8); hoy 16×16.
  > ✅ **Resuelto por el espacio y no por el tamaño.** WCAG 2.5.8 admite un objetivo de 16 px si un
  > círculo de 24 px centrado en él no pisa otro, y lo que pisaba era el botón «Proceso», que
  > empezaba justo en su borde. El hueco pasa de dentro del botón a la celda: el texto no se mueve,
  > las casillas de las filas siguen iguales y la tabla no gana ni un píxel, que a 1000 px ya iba
  > justa. axe ya no lo marca.
- [x] **B4. Que se vea lo seleccionado.**
  > La vista activa del sidebar y el intervalo de refresco activo se separan del resto por **1,03:1**
  > en claro (1,21:1 en oscuro), con el mismo peso de letra. En Idioma y Tema lo no elegido va con
  > borde y parece más marcado que lo elegido. Navegación: barra de acento + seminegrita. Tema,
  > Idioma y Refresco: control segmentado con `radiogroup`, que el Tier 7.4b dejó anotado.
  >
  > ✅ **Hecho**, y el control segmentado (`Segmented.tsx`) va también en la combinación del atajo.
  > Lo elegido lleva fondo, borde a 3:1 y seminegrita; es un `radiogroup` con un solo tabulador,
  > flechas, Inicio y Fin. La vista activa del sidebar, y el filtro activo, llevan barra de acento
  > y seminegrita. Visto en capturas de los dos temas.
- [x] **B5. El nombre accesible de Kill contiene «Kill»** (WCAG 2.5.3): `Kill node.exe, PID 12444`.
  > Hoy se anuncia «Cerrar node.exe, PID 12444», y por voz «clic en Kill» no lo encuentra. El catálogo
  > ya aplica ese criterio a los dos «Añadir».
  >
  > ✅ **Hecho**, en los dos idiomas: «Kill node.exe, PID 16952», leído en vivo del botón enfocado.
- [x] **B6. El recuento del buscador, con el texto en `sr-only`** dentro de la región viva.
  > Lleva `aria-label` en un `<span>` sin rol: axe lo marca y los lectores ignoran ese nombre, así que
  > se anuncia «15» y no «15 procesos en la lista». T3-10 no consigue lo que pretendía.
  >
  > ✅ **Hecho**: la frase va en texto `sr-only` dentro de la región viva, y el número visible
  > `aria-hidden` para no leerlo dos veces. axe ya no lo marca. La nota en T3-10 la puso la F2.

### Fase C — maquetación — ✅ **hecha y verificada el 2026-09-24** (v1.6.2)

> **Todo medido en la app en marcha**, con los procesos y servicios reales del equipo, a 1000×680 y
> 900×480 y en los dos temas. axe-core 4.13 sigue en cero violaciones y cero incompletos en las
> cuatro vistas, y da lo mismo sobre el diálogo abierto en sus dos tonos. El diálogo se abrió desde
> el desplegable de Servicios y **se cerró siempre con Cancelar**: ningún arranque cambió. 255
> pruebas del frontend en verde. Decisiones, en CONTEXT §4 (2026-09-24).

- [x] **C1. Anchos fijos en la tabla de procesos**, como la de Servicios desde la v1.5.1.
  > Medido: las columnas se desplazan **hasta 13 px** entre refrescos; a 900 px la tabla desborda y la
  > RAM parte en dos líneas («126 / MB»); un nombre largo (`Microsoft.CodeAnalysis.LanguageServer.exe`)
  > **no se trunca**, ensancha la tabla de 777 a 898 px y saca Activo y Kill de la vista. `table-fixed`
  > + `colgroup` con anchos medidos, y `whitespace-nowrap` en la etiqueta de `UsageBar`.
  >
  > ✅ **Hecho, y con un cambio que el plan no preveía: la barra de CPU y RAM va debajo de la
  > cifra.** Midiendo lo que pedía cada columna, las fijas sumaban 612 px con la barra al lado, y a
  > 900 px al nombre le quedaban 65. Debajo, CPU y RAM caben en 76 y 88, las fijas suman 520 y el
  > nombre se queda con **157 px en la ventana mínima y 257 en la de fábrica**. La fila no crece
  > (53 px): la segunda línea del nombre ya ocupaba ese alto. **Medido en vivo**: 0 px de salto en
  > 8 refrescos, la tabla ocupa justo su contenedor a 1000 y a 900 (777 y 677), ninguna cifra en dos
  > líneas, y el nombre largo se trunca sin mover nada. Sobra el tope de 128 px que A2 le puso a la
  > segunda línea.
- [x] **C2. Encabezados numéricos alineados con sus cifras.** Quedan ~18 px a la izquierda por el
      hueco del icono de orden invisible; en las columnas alineadas a la derecha, el icono a la
      izquierda.
  > ✅ **Hecho con `flex-row-reverse`**: la flecha va delante del rótulo en PID, CPU, RAM y Activo.
  > Medido en vivo, borde derecho del rótulo contra el de la cifra más ancha: **0 px** en las cuatro.
- [x] **C3. El sidebar cabe a 480 px de alto**, que es el `minHeight` que se promete.
  > Necesita 578 px con los filtros desplegados —el estado de fábrica— y el auto-refresco queda
  > fuera, **sin scroll para alcanzarlo**. Que la navegación haga scroll o compactar el medidor por
  > debajo de ~600 px.
  >
  > ✅ **Las dos cosas.** Con la ventana a 600 px de alto o menos (variante `short:` en
  > `index.css`), el sidebar se compacta: sin el subtítulo, y el medidor sin su título ni las cifras
  > del equipo, que pasan a `sr-only` y siguen en el `title`. En pausa el título se queda. Y la
  > navegación hace scroll por si algún día no basta. **Medido en vivo** con los filtros
  > desplegados: pedía 582 y ahora **469 de 480**, con el auto-refresco entero a la vista; a 601 px
  > de alto vuelve el sidebar completo y cabe (582).
- [x] **C4. El diálogo de confirmación deja de ser un párrafo en 384 px.**
  > El de cambiar el arranque mete 285 caracteres seguidos, y «Este cambio sobrevive al reinicio»
  > **pierde la negrita** porque `message` es texto plano y `App.tsx` quita los `**`. El nombre del
  > servicio se parte en el título («postgresql-» / «x64-17»). Y todo sale en rojo, también
  > «Manual → Automático». `message` como `Rico` con `Marcado`, el aviso en un recuadro aparte,
  > `sm:max-w-md`, el nombre sin partir y el tono según la gravedad.
  >
  > ✅ **Hecho entero.** `ConfirmRequest` tiene mensaje (`Rico`), aviso en recuadro, nota en letra
  > pequeña —el aviso del UAC y los protegidos que quedan fuera de un lote— y tono: `danger` por
  > defecto y `change` —icono de información y botón neutro— para los arranques que no dejan el
  > servicio deshabilitado. Las tres partes siguen siendo la descripción del diálogo. **Visto en vivo
  > sobre `postgresql-x64-17`**, en los dos temas: 448 px de ancho, el nombre en una línea, la
  > negrita en su recuadro, el tono que toca a «Automático (retrasado)» y a «Deshabilitado», y el foco
  > en «Cambiar arranque». Al principio el recuadro iba entero en `foreground` y la negrita no se
  > distinguía del resto: ahora va en el gris de la descripción.

### Fuera de fase — modo administrador — ✅ **hecho y verificado el 2026-09-24** (v1.7.0)

> Pedido por el usuario entre la C y la D. No salió de la auditoría, pero es del mismo terreno: la
> app enseñaba huecos —«—» en la RAM de los servicios, filas sin script ni carpeta, Kills que
> fallaban— sin decir por qué, salvo en un `title`. Decisión en CONTEXT §4 (2026-09-24).

- [x] **Aviso de que la app corre sin permisos de administrador**, en el hueco del sidebar entre la
      navegación y el medidor, que lleva a su sección de Ajustes con el foco en el título.
  > ✅ **Visto en vivo sin elevar** (la app lanzada con `explorer.exe` desde una sesión elevada):
  > aviso de 80 px a 1000×680 sin que la navegación haga scroll; con el alto justo, solo el título
  > (620–679 px), y nada por debajo de 620. La primera versión medía 116 px y hacía scroll:
  > medido y corregido. Todos los `node` de la sesión, que era elevada, salían sin script ni
  > carpeta; los servicios, con «—».
- [x] **«Iniciar siempre como administrador»**, apagado de fábrica, y **«Reiniciar como
      administrador»** en Ajustes.
  > ✅ **Visto en vivo elevada**: sin aviso, el `node` de prueba con «servidor-prueba.js ·
  > prueba-elevada», PostgreSQL con su RAM (110 y 144 MB) y el Kill de ese `node` cerrándolo, que
  > sin elevar había fallado. **El reinicio, probado desde la instancia elevada**, donde `runas`
  > no pide UAC: la vieja se cerró, la nueva arrancó con la marca y el PID de la vieja, y quedó
  > una sola instancia, elevada. ⚠️ **No se probó el camino con UAC** —sin elevar, pulsar
  > Reiniciar o arrancar con el ajuste encendido—, porque el UAC lo tiene que aprobar una persona;
  > tampoco se encendió el ajuste en vivo, para no escribir en el `settings.json` del usuario. Lo
  > cubren las pruebas: `debe_relanzarse` con su criterio negativo (la relanzada no se relanza) y
  > el interruptor en la vista.
  >
  > ✅ **Probado a mano por el usuario el 2026-09-25**, sobre la versión instalada y con el UAC de
  > verdad: «Reiniciar como administrador» sin elevar, «Iniciar siempre como administrador» al
  > volver a abrir la app, y el UAC cerrado sin aprobar, que deja la app arrancando sin permisos.
  > Todo funcionó como se esperaba.
- [x] **Un Kill fallido sin elevar dice el motivo probable** («Si se abrió como administrador…»).
  > ✅ Visto en vivo sobre el `node` de prueba; la pista no sale con la app elevada (probado).

### Fase D — consistencia y claridad — ✅ **hecha y verificada el 2026-09-24** (v1.7.0)

> **Verificado en la app en marcha**, con los procesos y servicios reales del equipo, a 1000×680 y
> 900×480: axe-core 4.13 da **cero violaciones y cero incompletos** en las cuatro vistas y los dos
> temas, también con la barra de la selección a la vista y con una fila bajo el puntero. En vivo
> solo se marcaron y desmarcaron casillas, se pasó el puntero y se escribió en el buscador: **no se
> pulsó ningún Kill, Nuke All, Cerrar, Arrancar ni Detener**. 278 pruebas del frontend en verde.
> Decisiones, en CONTEXT §4 (2026-09-24).

- [x] **D1. Una cabecera común para las cuatro vistas** (título, una línea opcional, acciones a la
      derecha). Hoy cada una es distinta, y Procesos e Historial no tienen `h2`. La explicación de
      Servicios, en una línea con un desplegable «¿Por qué pide administrador?».
  > ✅ **`ViewHeader` y `ViewBody`**: cada vista pinta su cabecera —fija, fuera del scroll— y su
  > cuerpo, que es lo único que se desplaza. Las cuatro empiezan por su `h2` y miden al menos lo
  > mismo (57 px). Servicios: una línea y un `<details>` nativo. **La verificación encontró un fallo
  > nuevo**: con «Vaciar» en la cabecera, el cuerpo del Historial se quedó sin nada enfocable y con
  > teclado no se podía desplazar (axe, `scrollable-region-focusable`). El cuerpo entra ahora en el
  > tabulador con nombre.
- [x] **D2. Ajustes agrupado**: General (Idioma —primero, como se decidió—, Apariencia, Al cerrar,
      Atajo) · Vigilancia (Procesos, Servicios) · Automatismos (Auto-Kill, Zombie Finder) ·
      Actualizaciones · Acerca de, **al final**. Hoy son 10 secciones en 1.697 px con «Acerca de» en
      medio.
  > ✅ **Hecho**, con dos secciones que el plan no tenía: «Permisos de administrador» va en
  > General y «Procesos protegidos» en Vigilancia. Encabezados en tres niveles —vista, grupo,
  > sección— para quien salta por ellos con un lector de pantalla.
- [x] **D3. Un solo verbo para cerrar procesos.** Hoy son cinco: Kill, Matar, Nuke, Cerrar y
      Terminar. «Kill» y «Nuke All» se quedan en inglés, que está decidido; el resto se alinea.
      Con un filtro activo, el botón dice que actúa sobre la lista filtrada.
  > ✅ **«Cerrar»**, en los dos idiomas («Close» en inglés): el menú de la fila, los diálogos, los
  > avisos y el error de Rust. Con filtro o búsqueda, el botón pasa a **«Nuke filtrados»**, con el
  > número en su nombre accesible; visto en vivo con la búsqueda «node».
- [x] **D4. Servicios parados sin explicaciones equivocadas.** El «—» de su RAM habla de permisos de
      administrador y el de puertos de SQL Express sin TCP, cuando el motivo es que están parados; y
      el lector de pantalla lo lee en cada fila parada.
  > ✅ **Hecho**: «Parado: no ocupa RAM ni puertos» en el `title`, y nada para el lector de
  > pantalla, porque la columna Estado ya lo dice. Y con la app elevada, la RAM que falta de un
  > servicio corriendo dice «no se pudo leer» en vez de pedir administrador. Visto en vivo sobre los
  > ocho servicios parados del equipo.
- [x] **D5. Menos rojo en la tabla**: Kill neutro que se tiñe al pasar o enfocar la fila; el rojo
      lleno, solo para Nuke All. Hoy hay un botón rojo por fila compitiendo con los puertos.
  > ✅ **Hecho y medido en vivo**: en reposo, gris y con borde neutro; con la fila bajo el puntero o
  > el foco dentro, texto y borde rojos. axe sobre la fila con el puntero encima, limpio. Primero el
  > borde no cambiaba en oscuro —el `dark:` del outline ganaba—, y se corrigió.
- [x] **D6. Un suelo en la escala de la barra de CPU**, y `0.0%` en gris. Se escala al máximo de la
      lista, y en reposo un proceso al 2,5 % sale con la barra llena. La decisión del 2026-07-23 se
      razonó para la RAM, que se queda como está.
  > ✅ **El suelo es un núcleo entero** (`100 / hardwareConcurrency`), no una cifra fija: la CPU de
  > cada proceso va sobre el equipo, y un Node que satura su núcleo en 16 hilos da 6,25 %, que sí
  > es una barra llena. En reposo, en vivo, todas las barras quedaron vacías y los `0.0%` en gris.
- [x] **D7. Que se note la selección**: fondo en la fila seleccionada y una barra «3 seleccionados ·
      Cerrar · Quitar selección».
  > ✅ **Hecho**, con la barra **flotando abajo** y no intercalada sobre la tabla: medido, marcar
  > dos casillas movió **0 px** las ocho primeras filas. La fila marcada lleva fondo y la barra de
  > acento del sidebar. Con una selección, Nuke All se aparta (`invisible`, sin que salte el
  > buscador) y la acción está en la barra; el «Cerrar» de la barra va en rojo tenue.

### Fase E — pulido — ✅ **hecha y verificada el 2026-09-25** (v1.8.0)

> **Verificado en la app en marcha**: axe-core 4.13 en **cero violaciones y cero incompletos** en
> las cuatro vistas, los dos temas y el Historial con una tanda abierta. El zoom y Ctrl+F se
> probaron **con teclas reales** (`keybd_event`, solo con la ventana de la app en primer plano), y
> el aviso para medirlo se sacó con «Copiar PID», **guardando y restaurando el portapapeles**. No
> se cerró nada ni se cambió ningún ajuste. 299 pruebas del frontend en verde. Decisiones, en
> CONTEXT §4 (2026-09-25).

- [x] Texto seleccionable donde hace falta: `user-select: none` global impide copiar nada, **ni el
      error de la pantalla de fallo**, que dice existir para copiarlo en un issue.
  > ✅ En las tablas de Procesos, Servicios e Historial, el registro de cambios de arranque, el
  > error de la pantalla de fallo, el error y las notas de Actualizaciones y la ruta del log. **En
  > Procesos no bastó con ponerlo en el `<tbody>`**: medido en vivo, cada celda seguía en `none`
  > porque el `ContextMenuTrigger` de shadcn pone `select-none` en la fila; va en el disparador.
  > Los avisos flotantes se quedan sin seleccionar: arrastrarlos es como se descartan.
- [x] Buscador con Ctrl+F y botón ×; hoy hay 12 paradas de Tab antes de llegar a él. El vacío
      «Ningún proceso coincide» ofrece «Quitar filtro».
  > ✅ Ctrl+F lleva al buscador desde cualquier vista —probado con la tecla de verdad— y le gana a
  > la búsqueda propia de WebView2. Vacío, enseña la pista «Ctrl F»; con texto, una ×. Escape
  > también lo borra. «Quitar filtro» quita a la vez la búsqueda y el filtro de runtime.
- [x] Historial agrupado por acción y con hora relativa: hoy son 89 filas planas con la misma hora
      repetida en cada tanda.
  > ✅ **Las tandas son exactas, no adivinadas**: `kill_and_record` da la misma marca y el mismo
  > origen a todo un lote. Plegadas, dicen cuántos, de qué («dotnet.exe ×4») y qué puertos
  > soltaron. La hora es relativa —«ayer», «16 sept»—, con la exacta en el `title`. En vivo, las 90
  > entradas del equipo quedaron en 35 filas, 18 de ellas tandas.
- [x] «Refrescar» como icono, o destacado solo con el auto-refresco en «Off».
  > ✅ Las dos cosas: icono con el motivo en el `title` mientras la lista se refresca sola, y con su
  > texto en «Off», cuando es la única forma de ver datos nuevos.
- [x] Los textos de 11 px del medidor, a 12.
  > ✅ El sidebar completo pasa a pedir 579 px y sigue cabiendo; el compacto, 467 de 480.
- [x] Valorar `zoomHotkeysEnabled`, comprobando que el ancho mínimo aguanta el zoom.
  > ✅ **Activado**, y probado con Ctrl+= y Ctrl+0 reales. Con zoom, el ancho útil baja, y **la
  > tabla de procesos dejaba el nombre a 0 px** al 125 % en la ventana mínima (medido): las dos
  > tablas de ancho fijo llevan ahora un mínimo (620 y 660 px) y hacen scroll horizontal en vez de
  > perder la columna que identifica la fila. Al 110 % todo cabe en cualquier tamaño; al 125 % y al
  > 150 %, la tabla hace scroll y nada queda fuera de alcance.
- [x] Comprobar si los toasts, abajo a la derecha, tapan la columna Kill (no se midió).
  > ✅ **Medido: sí.** El aviso mide 356×54 px a 24 del borde y cae sobre la columna Kill (x
  > 945–980) de la última fila visible mientras dura. Se deja donde está, y la tabla de procesos
  > lleva siempre 80 px de hueco debajo, para que cualquier fila pueda subir por encima del aviso y
  > de la barra de la selección.
- [x] Menores: captions `sr-only` sin tilde («estan», «mas» ×2); `pidTitulo` sin uso; comentarios
      que describen Servicios como de solo lectura o la fase C como pendiente; «—.» huérfano en
      Servicios vigilados; «0.0%» en la tabla frente a «0.0 %» en el medidor.
  > ✅ Todos. Los comentarios de «fase C» de `services.rs` y `storage.rs` se quedan: hablan de la del
  > Tier 10, que está hecha, y describen bien el código. De paso, la barra de acento del sidebar
  > dejó de ser un `::before`: axe no sabía el fondo del recuento del filtro activo y lo marcaba
  > como contraste por revisar.

### Fase F — correcciones a la documentación

> ✅ **Hecha el 2026-09-25** (v1.8.0).

- [x] **F1. El menú contextual sí es accesible con teclado.** Shift+F10 o la tecla Menú, con el foco
      en la casilla o el Kill de la fila, lo abren (probado). El 7.4b de este documento y la fila de
      CONTEXT del 2026-07-27 dicen que copiar PID, puerto y URL es solo de ratón; lo que falta es que
      se sepa.
  > ✅ **Vuelto a probar antes de escribirlo**, con teclas reales (`keybd_event`) y después de las
  > fases D y E, que cambiaron la fila: Shift+F10 sobre el Kill y la tecla Menú sobre la casilla
  > abren el menú con sus seis entradas, y Escape lo cierra. Corregidos el 7.4b y la fila de CONTEXT
  > del 2026-07-27, y el README lo dice donde describe el menú.
- [x] **F2. Anotar en T3-10** que el `aria-label` del recuento no llega a anunciarse (ver B6).
  > ✅ Anotado en `docs/REVISION-2026-08-18.md`, con lo que se hizo en B6.

---


## 🔍 Tier 12: Re-auditoría completa — 🟡 **abierto el 2026-09-25**
*Objetivo: cerrar lo que encontró la tercera revisión amplia del repositorio, la primera sobre el código de los Tiers 10 y 11 y el modo administrador.*

> **Sale de una re-auditoría del 2026-09-25 sobre la v1.8.0** (HEAD `33e0c20`), con nueve áreas
> acordadas con el usuario: código, seguridad, arquitectura, QA, refactorización, ortografía,
> documentación, DevOps y legal (acotada a licencias y a qué sale del equipo). Quedaron fuera
> rendimiento, accesibilidad y UI/UX —auditadas en el Tier 11 hace dos días— y SEO, que no aplica.
> **Estática y en vivo**: se leyó entero el código propio (~20.000 líneas con pruebas), se pasaron
> ESLint, clippy, las dos suites, la cobertura y las dos auditorías, y se condujo el **binario de
> release** por CDP —CSP servido, consola, superficie IPC, la interfaz en inglés, lo desplegado—.
> **No se pulsó ningún Kill, Nuke All, Arrancar ni Detener, ni se cambió ningún arranque**; el
> idioma se cambió y se devolvió, y `settings.json`, `history.json`, `service-changes.json` y el log
> se restauraron byte a byte al terminar. El informe completo, con problema, impacto y solución de
> cada punto, está en un [artifact](https://claude.ai/artifact/UqPcdMRZ8vRhrFWqJcXmRM); lo
> accionable está aquí.
>
> **Ningún hallazgo crítico ni alto.** Nueve son de severidad media y treinta bajos. Desde el Tier 5
> los Tiers son tandas temáticas, así que la severidad va escrita en cada tarea: una media de la
> fase F pesa lo mismo que una de la A.
>
> Esfuerzo: **bajo** = una sesión corta; **medio** = una sesión larga o dos.

| Fase | Qué | Tareas | Media | Baja | Esfuerzo |
|---|---|---|---|---|---|
| A | Seguridad | 4 | 2 | 2 | 1 medio, 3 bajos |
| B | Código | 10 | 2 | 8 | 2 medios, 8 bajos |
| C | Arquitectura | 3 | 1 | 2 | 1 medio, 2 bajos |
| D | Pruebas | 3 | 0 | 3 | 1 medio, 2 bajos |
| E | DevOps y corte de versión | 8 | 3 | 5 | 8 bajos |
| F | Documentación y legal | 5 | 1 | 4 | 1 medio, 4 bajos |
| G | Redacción | 3 | 0 | 3 | 3 bajos |
| H | Encontrado de paso, fuera del alcance acordado | 3 | 0 | 3 | 3 bajos |
| | **Total** | **39** | **9** | **30** | |

**Nuevos, ya conocidos y cierres en falso.** Treinta y cuatro hallazgos son nuevos. Uno ya era
conocido —el propio `THIRD-PARTY-NOTICES.txt` declara en su «alcance honesto» que no reproduce los
avisos de copyright—, pero no tenía tarea: la tiene en T12-30. Y cuatro son **tareas dadas por
cerradas que no lo estaban del todo**, lo que se dice aquí a propósito:

- **T3-09** (revisión del 2026-08-18) pedía nombre accesible «en el buscador y en el campo de
  ejecutable». El commit que la cerró (`870c8e7`) solo tocó el buscador; la v1.4.0 ya salió sin el
  otro. → T12-37.
- **T2-02**: «las herramientas que faltan avisan, no abortan». Falta `cargo-audit` y el corte
  **aborta**: reproducido en PowerShell 5.1. → T12-21.
- **T3-19**: `-SkipTests` compara el `HEAD`, pero el commit del release incluye lo modificado sin
  commitear. → T12-22.
- **Tier 11 · D4**: «con la app elevada, la RAM que falta dice "no se pudo leer"». El componente lo
  sabe hacer, pero `App.tsx` nunca le pasa si la app está elevada. → T12-07.

### Fase A — Seguridad

- [x] **[T12-01] Que ningún proceso crítico de Windows pueda entrar en la lista de vigilados**
  - **Severidad:** media · **Área:** Seguridad
  - **Ubicación:** `src-tauri/src/processes.rs:285-315` (`classify`), `src-tauri/src/storage.rs:198-223`, `src/components/SettingsView.tsx:232-246`
  - **Qué hacer:** una lista cerrada de ejecutables que la app no vigila aunque se añadan a mano
    (`smss`, `csrss`, `wininit`, `winlogon`, `services`, `lsass`, `lsaiso`, `svchost`, `system`,
    `registry`, `memcompression`, `dwm`, `fontdrvhost`, `sihost`, `explorer`…), aplicada en
    `classify` —por donde pasan las cinco vías— y avisada en Ajustes al intentar añadirlos. Hoy
    `normalize` solo pasa a minúsculas: con `svchost` vigilado, Nuke All y el atajo los cerrarían, y
    con la app elevada (v1.7.0) eso es un pantallazo azul.
  - **Criterio de aceptación:** prueba negativa: con `custom = ["csrss", "svchost", "lsass"]`,
    `classify` devuelve `None` y `kill_many` rechaza un PID de esos; la UI no deja añadirlos.
  - **Esfuerzo:** bajo · **Depende de:** ninguna
  - **Hecho el 2026-09-25.** `CRITICOS` en `processes.rs` (18 nombres, con los tres pseudoprocesos
    que sysinfo nombra con espacio) y su copia `PROCESOS_CRITICOS` en `types.ts`, atadas por
    `types.test.ts`. La prueba de `kill_many` no usa un `svchost` de verdad: lanza **una copia de
    `PING.EXE` renombrada a `svchost.exe`** en una carpeta temporal, para que un fallo de la guardia
    no pudiera cerrar un proceso del sistema. **Con la guardia desactivada, las dos pruebas de Rust
    fallan**: miden lo que tienen que medir. Ajustes rechaza el nombre con un aviso `role="alert"`
    bajo el campo. Probado en las suites, no en vivo.

- [ ] **[T12-02] Volver a verificar el instalador justo antes de ejecutarlo**
  - **Severidad:** media · **Área:** Seguridad
  - **Ubicación:** `src-tauri/src/update.rs:379-447`, `:475-481`, `:530-541`
  - **Qué hacer:** el hash se comprueba al descargar, pero entre `download_update` e
    `install_update` —lo que tarde el usuario en pulsar «Instalar»— el `.exe` está en `%TEMP%`,
    escribible por cualquier proceso del usuario. Con la app **elevada**, el instalador se lanza
    elevado: un programa sin privilegios puede cambiarlo y ejecutarse con integridad alta sin UAC.
    Guardar en Rust la ruta y el hash que devolvió la descarga, y en `install_update` abrir el archivo
    sin compartir escritura ni borrado (`share_mode(FILE_SHARE_READ)`), recalcular el hash sobre ese
    handle y lanzar con el handle abierto.
  - **Criterio de aceptación:** prueba que modifica el archivo tras la descarga: `install_update` se
    niega y lo borra. `install_update` no acepta una ruta que no sea la que devolvió la descarga.
  - **Esfuerzo:** medio · **Depende de:** ninguna

- [ ] **[T12-03] Quitarle a la ventana los permisos que no usa**
  - **Severidad:** baja · **Área:** Seguridad
  - **Ubicación:** `src-tauri/capabilities/default.json:9-10`
  - **Qué hacer:** fuera `notification:default` —verificado en vivo: la ventana puede usar las
    notificaciones, que solo manda Rust— y `global-shortcut:default`, que no concede nada (el atajo
    lo registra Rust). Menos superficie para un script inyectado.
  - **Criterio de aceptación:** `plugin:notification|notify` desde la ventana responde «not allowed
    by ACL», y las notificaciones de la bandeja, el atajo y el Auto-Kill siguen saliendo, probado en
    vivo.
  - **Esfuerzo:** bajo · **Depende de:** ninguna

- [ ] **[T12-04] Que la guardia del proceso elevado no prometa más de lo que hace**
  - **Severidad:** baja · **Área:** Seguridad / Documentación
  - **Ubicación:** `src-tauri/src/service_control.rs:19-30`, `:251-263`, `:617-646`; `CONTEXT.md:79-84`; `ROADMAP.md:1107-1113`
  - **Qué hacer:** el hijo elevado relee `customServices` de `settings.json`, que cualquier programa
    del mismo usuario puede escribir: la guardia no frena a «cualquier programa sin privilegios»,
    como dicen los tres sitios. Reescribir lo que sí hace (rechaza nombres que el usuario no añadió y
    los errores propios) y lo que no (un programa que ya corre como el usuario, que además puede
    pedir `runas` sobre binarios firmados por Microsoft). De paso, rechazar `\` y `/` en `vigilado`
    (el SCM no los admite y `\"` rompe el entrecomillado).
  - **Criterio de aceptación:** los tres textos dicen lo mismo y nada más; prueba de `vigilado` con
    `MiMotor\`.
  - **Esfuerzo:** bajo · **Depende de:** ninguna

### Fase B — Código

- [ ] **[T12-05] Todo el texto de Rust que llega a la ventana, en `textos.rs`**
  - **Severidad:** media · **Área:** Código / i18n
  - **Ubicación:** `src-tauri/src/processes.rs:604`, `:610`, `:615`, `:625`; `src-tauri/src/update.rs:171-480` (27 mensajes); `src-tauri/src/storage.rs:339`, `:344`; `src-tauri/src/logging.rs:175`, `:179`
  - **Qué hacer:** hay ~35 mensajes en español fijo fuera del catálogo, y llegan a pantalla: el
    toast de un Kill fallido (`App.tsx:577`) y el error del actualizador (`Actualizaciones.tsx:57`).
    Verificado en vivo: con la app en inglés, Rust contesta «El proceso … ya no existe» y «La
    descarga no viene de github.com.». Contradice la regla de CLAUDE.md.
  - **Criterio de aceptación:** con `language: en`, esos dos casos contestan en inglés; una prueba
    recorre los errores en inglés y no encuentra letras del español (como
    `el_catalogo_ingles_no_tiene_letras_del_espanol`).
  - **Esfuerzo:** medio · **Depende de:** ninguna

- [x] **[T12-06] Arrancar, detener y cambiar el arranque, fuera del hilo principal**
  - **Severidad:** media · **Área:** Código / Arquitectura
  - **Ubicación:** `src-tauri/src/service_control.rs:284-338`, `:351-414`; `src-tauri/src/commands.rs:118-133`
  - **Qué hacer:** en Tauri 2 un comando síncrono corre en el hilo principal (documentación oficial),
    y estos esperan al UAC, hasta 30 s al hijo y hasta 10 s sondeando: la ventana se congela todo
    ese rato. `restart_as_admin` ya es `async` por eso mismo. Marcar `#[tauri::command(async)]`
    los dos, y también `get_services`, que consulta el SCM.
  - **Criterio de aceptación:** durante una acción sobre un servicio la ventana se mueve y cambia de
    vista, probado en vivo (con la app elevada no hay UAC de por medio).
  - **Esfuerzo:** bajo · **Depende de:** ninguna
  - **Hecho el 2026-09-25**: los tres comandos llevan `#[tauri::command(async)]`. **Probado en vivo
    con el usuario**, sobre el binario de release y MySQL80. Una sonda por CDP lanza
    `control_service` sin esperar la respuesta y, mientras tanto, cronometra `get_settings` cada
    medio segundo:
    - **Con la corrección**, el usuario aprobó el UAC y el servicio se detuvo de verdad. El ciclo
      entero duró 6,8 s, y las 14 muestras contestaron en 1-2 ms.
    - **Sin ella** (los tres atributos quitados y recompilado), pidiendo «Detener» sobre el servicio
      ya detenido para que no pudiera cambiar nada, **todo comando quedó bloqueado 45 s**: el UAC
      más la espera.
  - **Lo que no discriminó, y se dice:** un `SendMessageTimeout(WM_NULL)` a la ventana contestó en
    los dos casos. `ShellExecuteEx` sigue atendiendo los mensajes mientras espera el UAC, así que la
    ventana se podía mover; lo que se congelaba era el IPC. La interfaz no podía hacer nada, ni
    cambiar de vista con datos nuevos. La prueba que cuenta es la del IPC.

- [ ] **[T12-07] Pasarle a Servicios si la app está elevada** — *cierre en falso parcial de Tier 11 · D4*
  - **Severidad:** baja · **Área:** Código
  - **Ubicación:** `src/App.tsx:822-832`, `src/components/ServicesView.tsx:376-389`
  - **Qué hacer:** `ServicesView` elige entre «no se pudo leer» y «necesita administrador» según la
    prop `elevated`, pero `App` no se la pasa (sí a `Sidebar` y a `SettingsView`): en producción
    siempre pide administrador, también elevada. La prueba del componente pasa la prop a mano.
  - **Criterio de aceptación:** prueba de `App` con `get_elevation: true` y un servicio corriendo sin
    RAM: su «—» dice «No se pudo leer la RAM de este servicio.».
  - **Esfuerzo:** bajo · **Depende de:** ninguna

- [ ] **[T12-08] «Protegido» solo cuando de verdad se ha guardado**
  - **Severidad:** baja · **Área:** Código
  - **Ubicación:** `src/App.tsx:471-484`, `:529-542`
  - **Qué hacer:** `protegerFila` enseña el toast de éxito antes de saber si `save_settings` fue
    bien; si falla, salen dos avisos contradictorios y el proceso **no** queda protegido.
    `saveSettings` devuelve si guardó, y el toast espera.
  - **Criterio de aceptación:** prueba con `save_settings` rechazado: no sale «protegido», sí el error.
  - **Esfuerzo:** bajo · **Depende de:** ninguna

- [ ] **[T12-09] La guardia de PID reciclado, con la hora de arranque**
  - **Severidad:** baja · **Área:** Código
  - **Ubicación:** `src-tauri/src/processes.rs:582-627`, `src-tauri/src/lib.rs:218-265`
  - **Qué hacer:** `kill_one` relee el PID y compara solo el **nombre**: un PID reutilizado por otro
    `node.exe` pasa, aunque el comentario diga que «el nombre ya no coincidirá». Comparar también la
    hora de arranque con la de la última lista publicada.
  - **Criterio de aceptación:** prueba con dos procesos del mismo nombre: un PID con otra hora de
    arranque que la de la lista se rechaza.
  - **Esfuerzo:** medio · **Depende de:** ninguna

- [ ] **[T12-10] El script de cada fila, sin tomar el valor de una opción por el script**
  - **Severidad:** baja · **Área:** Código
  - **Ubicación:** `src-tauri/src/processes.rs:121-139`
  - **Qué hacer:** el primer argumento que no empieza por `-` se toma como script, así que
    `node -r ts-node/register app.ts` sale «register» y `python -X utf8 app.py` sale «utf8»: la
    etiqueta equivocada en la columna que existe para no cerrar a ciegas (Tier 11 · A2). Saltar el
    valor de las opciones que lo llevan (`-r`, `--require`, `--import`, `--loader`, `-X`, `-W`…).
  - **Criterio de aceptación:** pruebas de `describe` con esos dos casos devuelven `app.ts` y `app.py`.
  - **Esfuerzo:** bajo · **Depende de:** ninguna
  - **Ojo al cerrarla** (anotado el 2026-09-25, al hacer T12-29): saltar las opciones conocidas no
    cubre una desconocida con su valor aparte (`node --token abc123 server.js` seguiría enseñando
    `abc123`). El README lo avisa en Privacidad; esa frase solo se quita si se resuelve también ese
    caso.

- [ ] **[T12-11] Servicios: filtrar antes de consultar, y sin memoria sin inicializar**
  - **Severidad:** baja · **Área:** Código
  - **Ubicación:** `src-tauri/src/services.rs:429-501`, `:463-464`
  - **Qué hacer:** `enumerar` consulta el tipo de arranque de **cada** servicio de Windows (unos 300,
    con dos o tres llamadas al SCM cada uno) antes de quedarse con los de desarrollo. Filtrar
    primero. Y el buffer se pasa como `&mut [u8]` sobre capacidad sin inicializar, que en Rust es
    comportamiento indefinido aunque hoy no rompa nada: usar un buffer inicializado.
  - **Criterio de aceptación:** `tipo_de_arranque` solo se llama para los que pasan `classify_service`
    (prueba o recuento); ningún `from_raw_parts_mut` sobre memoria sin inicializar.
  - **Esfuerzo:** bajo · **Depende de:** ninguna

- [ ] **[T12-12] Conservar un `settings.json` ilegible antes de pisarlo**
  - **Severidad:** baja · **Área:** Código
  - **Ubicación:** `src-tauri/src/storage.rs:303-314`
  - **Qué hacer:** con un solo campo inválido —una errata a mano, un valor de una versión más nueva—
    se usan los valores de fábrica y el siguiente guardado sobrescribe el original: se pierden los
    vigilados y **los protegidos**. Copiarlo a `settings.json.ilegible-<ms>` y anotarlo en el log.
  - **Criterio de aceptación:** prueba con un campo inválido: tras leer existe la copia con el
    contenido original.
  - **Esfuerzo:** bajo · **Depende de:** ninguna

- [ ] **[T12-13] Escrituras del historial y del registro de servicios, de una en una**
  - **Severidad:** baja · **Área:** Código
  - **Ubicación:** `src-tauri/src/storage.rs:334-346`, `:361-375`, `:392-427`
  - **Qué hacer:** leer-modificar-escribir sin candado, con un `.json.tmp` de nombre fijo: un cierre
    del Auto-Kill (hilo del poller) y uno manual (hilo principal) a la vez pierden entradas. Un
    `Mutex` en `Storage`.
  - **Criterio de aceptación:** prueba con dos hilos añadiendo a la vez: no se pierde ninguna entrada.
  - **Esfuerzo:** bajo · **Depende de:** ninguna

- [ ] **[T12-14] Que un pánico deje rastro en el log**
  - **Severidad:** baja · **Área:** Código / Observabilidad
  - **Ubicación:** `src-tauri/src/lib.rs:318-328`, `:414-415`; `src-tauri/src/ports.rs:15-21`
  - **Qué hacer:** no hay `std::panic::set_hook`, y en release no hay consola: si falla la bandeja
    al arrancar, la app no abre sin dejar línea; si muere el hilo del poller, se quedan congelados la
    lista y el Auto-Kill sin aviso. Un gancho que escriba el pánico en el log. De paso, limitar el
    aviso de puertos ilegibles, que con un fallo persistente saldría cada 2 s y rotaría el log.
  - **Criterio de aceptación:** un pánico provocado en una prueba deja su línea; el aviso repetido
    sale como mucho una vez por minuto.
  - **Esfuerzo:** bajo · **Depende de:** ninguna

### Fase C — Arquitectura

- [ ] **[T12-15] Partir `App.tsx`**
  - **Severidad:** media · **Área:** Arquitectura / Refactorización
  - **Ubicación:** `src/App.tsx` (918 líneas; el Tier 7.6 lo dejó en 367): servicios en `:196-399`, cierres en `:565-659`
  - **Qué hacer:** sacar `useServices` (estado, acciones, dependencias, arranque y deshacer) y los
    cierres (`killMany`, `askNuke`, proteger). Y escribir en CLAUDE.md para `App.tsx` la misma regla
    de tamaño que tiene `lib.rs`.
  - **Criterio de aceptación:** `App.tsx` por debajo de ~450 líneas; las 299 pruebas en verde sin
    tocar aserciones.
  - **Esfuerzo:** medio · **Depende de:** ninguna

- [ ] **[T12-16] `lib.rs`: o arranque y nada más, o la regla dice lo que hay**
  - **Severidad:** baja · **Área:** Arquitectura
  - **Ubicación:** `src-tauri/src/lib.rs:154-265`; `.claude/CLAUDE.md` (sección Backend)
  - **Qué hacer:** CLAUDE.md dice que `lib.rs` es «arranque y `AppState`, y nada más», pero ahí
    viven `kill_and_record`, `read_list`, `publish` y `measure_usage`: el camino de cierre. Llevarlos
    a su módulo o precisar la regla.
  - **Criterio de aceptación:** regla y código coinciden.
  - **Esfuerzo:** bajo · **Depende de:** ninguna

- [ ] **[T12-17] La descarga del instalador, con plazo por lectura y no total**
  - **Severidad:** baja · **Área:** Arquitectura / Resiliencia
  - **Ubicación:** `src-tauri/src/update.rs:166-172`, `:402-434`
  - **Qué hacer:** el cliente lleva `timeout(30 s)`, que en reqwest es un plazo **total** hasta el
    final del cuerpo (documentación oficial), y el instalador son 4.119.125 bytes: por debajo de
    ~1,2 Mbit/s la actualización falla siempre. Para la descarga, `connect_timeout` y
    `read_timeout`; la consulta a la API se queda como está.
  - **Criterio de aceptación:** prueba con el `TcpListener` de la casa mandando en trozos lentos más
    de 30 s en total: la descarga termina.
  - **Esfuerzo:** bajo · **Depende de:** ninguna

### Fase D — Pruebas

- [ ] **[T12-18] Que las pruebas que se saltan en silencio fallen en la CI**
  - **Severidad:** baja · **Área:** QA
  - **Ubicación:** `src-tauri/src/processes.rs:872-875`, `:891-900`, `:966-969`, `:987-992`, `:1190-1193`, `:1517-1520`, `:1537-1542`; `.github/workflows/ci.yml:76-78`; `release.ps1:314-319`
  - **Qué hacer:** la guardia de PID, los protegidos, los puertos del lote y la CPU salen con
    `return` —y cuentan como superadas— si falta `node` o el proceso no llega a verse. Con
    `PDK_EXIGIR_NODE=1` en la CI y en el corte, esas salidas pasan a ser un fallo.
  - **Criterio de aceptación:** con la variable puesta y sin `node` en el PATH, `cargo test` falla.
  - **Esfuerzo:** bajo · **Depende de:** ninguna

- [ ] **[T12-19] Probar la entrada del proceso elevado**
  - **Severidad:** baja · **Área:** QA
  - **Ubicación:** `src-tauri/src/service_control.rs:516-559`, `:761-766`
  - **Qué hacer:** `intercept`, lo primero que ejecuta el proceso con privilegios, lee
    `std::env::args` y no tiene pruebas de sus ramas. Pasarlo a un iterador, como
    `elevation::pid_del_padre`, y probar los argumentos de más y de menos y los verbos desconocidos.
  - **Criterio de aceptación:** una prueba por rama de `intercept`.
  - **Esfuerzo:** bajo · **Depende de:** ninguna

- [ ] **[T12-20] Recuperar la cobertura donde se cierra y se eleva**
  - **Severidad:** baja · **Área:** QA
  - **Ubicación:** `src/App.tsx` (70,91 %), `src/i18n.tsx` (64,92 %), `src/components/SettingsView.tsx` (74,62 %)
  - **Qué hacer:** la cobertura bajó del 89,61 % al **81,41 %** con los Tiers 10 y 11. Cubrir las
    acciones de Servicios de `App`, pintar cada vista en inglés y los caminos de fallo de Ajustes.
  - **Criterio de aceptación:** ≥ 85 % de sentencias en total e `i18n.tsx` ≥ 80 %.
  - **Esfuerzo:** medio · **Depende de:** T12-15

### Fase E — DevOps y corte de versión

- [x] **[T12-21] Que falte `cargo-audit` avise y no aborte** — *regresión de T2-02*
  - **Severidad:** media · **Área:** DevOps
  - **Ubicación:** `release.ps1:341`, `:331-337`, `:271`, `:279`
  - **Qué hacer:** `& cargo audit --version *> $null` con `$ErrorActionPreference = "Stop"` **aborta**
    en PowerShell 5.1 si falta la herramienta (`NativeCommandError`, reproducido aparte): justo lo
    contrario de lo que decidió T2-02. Clippy ni se comprueba: si falta, dice «Clippy encontró
    avisos». Comprobar la presencia con `Invoke-Nativo`, y cambiar igual las redirecciones de las
    líneas 271 y 279.
  - **Criterio de aceptación:** con un PATH sin `cargo-audit` el dry run llega al final con su aviso.
  - **Esfuerzo:** bajo · **Depende de:** ninguna
  - **Hecho el 2026-09-25**, con una función nueva, `Test-Nativo`, para las tres preguntas de
    «¿está?» del script (el repositorio, clippy y cargo-audit) y la preferencia bajada en `ls-remote`. **El
    criterio se probó a medias, y se dice:** en este equipo `cargo-audit` está instalado, y quitarlo
    del PATH sin quitar cargo no se puede (cargo lo busca también en `~/.cargo/bin`). Se probó
    aparte, con el mismo mecanismo: `Test-Nativo cargo @('noexiste-audit','--version')` devuelve 101
    sin abortar, mientras el patrón viejo sobre el mismo comando aborta con `RemoteException`; y el
    dry run entero, con todo presente, llega al final.

- [x] **[T12-22] Árbol limpio de verdad, y el dry run atado al contenido** — *hueco de T3-19*
  - **Severidad:** media · **Área:** DevOps
  - **Ubicación:** `release.ps1:282-292`, `:296-312`, `:445-451`, `:510-521`
  - **Qué hacer:** solo se paran los archivos **sin rastrear**; lo modificado entra en el commit
    «release» por `git add -u`, y `-SkipTests` compara solo el `HEAD`. Se puede publicar código que
    ni el dry run ni la CI vieron. Abortar con cambios rastreados salvo `-AllowDirty`, y que la marca
    del dry run guarde también el hash de `git diff HEAD`.
  - **Criterio de aceptación:** tocar un archivo después del dry run hace que `-SkipTests` se niegue.
  - **Esfuerzo:** bajo · **Depende de:** ninguna
  - **Hecho el 2026-09-25.** La marca guarda en su segunda línea el SHA-256 de `git diff HEAD
    --binary`, escrito con `--output` para que no pase por la tubería de PowerShell; una marca vieja,
    de una sola línea, no vale. Probado con `-DryRun -SkipTests`, que recorre la comprobación sin
    poder publicar: con el mismo código pasa; tras añadir una línea a `format.ts`, se niega; y en un
    clon con un archivo rastreado modificado y sin `-AllowDirty`, el corte para antes de las pruebas.

- [ ] **[T12-23] Las notas del release, desde `CHANGELOG.md`**
  - **Severidad:** baja · **Área:** DevOps
  - **Ubicación:** `release.ps1:79-80`, `:395-426`
  - **Qué hacer:** sin `-NotesFile` se publican notas genéricas. Tomar la sección `## [X.Y.Z]` del
    CHANGELOG, añadirle la tabla de descarga que ya genera el script, y abortar si no existe.
    Escribir sin BOM: `Out-File -Encoding utf8` lo pone en PowerShell 5.1.
  - **Criterio de aceptación:** sin la sección, el dry run aborta; con ella, `--notes-file` es esa
    sección.
  - **Esfuerzo:** bajo · **Depende de:** ninguna

- [ ] **[T12-24] Comprobar lo publicado al terminar el corte**
  - **Severidad:** baja · **Área:** DevOps
  - **Ubicación:** `release.ps1:562-569`
  - **Qué hacer:** lo que CONTEXT §3 repite a mano en cada versión —4 assets, el `tag_name` de la
    API y el instalador descargado contra su `.sha256`— lo hace el script. Esta re-auditoría lo hizo
    para la v1.8.0: coincide (`d3a4dbd7…`).
  - **Criterio de aceptación:** el corte termina con las tres comprobaciones hechas y falla si alguna
    no cuadra.
  - **Esfuerzo:** bajo · **Depende de:** ninguna

- [ ] **[T12-25] El aviso de `THIRD-PARTY-NOTICES.txt`, por contenido y no por fecha**
  - **Severidad:** baja · **Área:** DevOps
  - **Ubicación:** `release.ps1:368-379`
  - **Qué hacer:** compara fechas, y el propio corte toca `package.json` y `Cargo.lock` al subir la
    versión: el aviso salta **siempre** («espurio» en CONTEXT de la v1.5.x a la v1.8.0). Un aviso
    que siempre salta enseña a ignorarlo. Comparar la huella de dependencias y licencias.
  - **Criterio de aceptación:** un corte sin cambios de dependencias no avisa; uno con una crate
    nueva, sí.
  - **Esfuerzo:** bajo · **Depende de:** T12-30

- [ ] **[T12-26] CI: acciones fijadas, toolchain declarado y dependencias vigiladas**
  - **Severidad:** baja · **Área:** DevOps
  - **Ubicación:** `.github/workflows/ci.yml:40-51`, `:86-103`
  - **Qué hacer:** fijar las acciones por SHA, añadir `rust-toolchain.toml` y activar Dependabot
    (npm, cargo y github-actions, solo seguridad). El árbol de desarrollo tiene 7 avisos —2 altos,
    `fast-uri` y `js-yaml`— que por política no mira nadie: un informe no bloqueante en el trabajo
    semanal.
  - **Criterio de aceptación:** ninguna acción por etiqueta, Dependabot activo y el informe semanal
    visible.
  - **Esfuerzo:** bajo · **Depende de:** ninguna

- [ ] **[T12-27] La inspección en vivo, sin arrancar elevada con el puerto abierto**
  - **Severidad:** media · **Área:** DevOps / Seguridad del proceso de trabajo
  - **Ubicación:** `tools/capture-screenshots.ps1:365-387`; `.claude/CLAUDE.md:122`
  - **Qué hacer:** con `runAsAdmin` encendido, la build con `--remote-debugging-port` **arranca
    elevada**, y el CDP de `127.0.0.1:9222` no tiene autenticación: cualquier proceso local la
    conduce con privilegios. Pasó en esta re-auditoría —salió un UAC—, y una consola sin elevar no
    puede cerrarla. El script comprueba `runAsAdmin` y se niega antes de abrir el puerto. La trampa
    ya está anotada en CLAUDE.md.
  - **Criterio de aceptación:** con `runAsAdmin: true` el script aborta con un mensaje claro.
  - **Esfuerzo:** bajo · **Depende de:** ninguna

- [ ] **[T12-28] El script de capturas: respaldar los ajustes y no depender del idioma**
  - **Severidad:** baja · **Área:** DevOps
  - **Ubicación:** `tools/capture-screenshots.ps1:432-481`
  - **Qué hacer:** cambia el tema del usuario por la interfaz —guarda `settings.json` de verdad— y lo
    devuelve igual. Si falla a medias, se queda cambiado. Respaldarlo byte a byte y restaurarlo en
    el `finally`, como ya hace con `tauri.conf.json`. Busca los botones por su texto en español: con
    la app en inglés aborta.
  - **Criterio de aceptación:** con la app en inglés las capturas salen, y el `settings.json` final
    es idéntico byte a byte al inicial.
  - **Esfuerzo:** bajo · **Depende de:** ninguna

### Fase F — Documentación y legal

- [x] **[T12-29] La sección de privacidad del README, que diga lo que se lee**
  - **Severidad:** media · **Área:** Legal / Documentación
  - **Ubicación:** `README.md:178-179`; `src-tauri/src/processes.rs:371-391`
  - **Qué hacer:** dice «No lee la línea de comandos», y desde la v1.6.0 la app lee la línea de
    comandos y la carpeta de cada proceso vigilado para enseñar el script y el proyecto. Contar qué
    lee, qué enseña —nunca la línea entera— y que no sale del equipo.
  - **Criterio de aceptación:** el párrafo describe lo que hace el código y no promete nada que no
    cumpla.
  - **Esfuerzo:** bajo · **Depende de:** ninguna
  - **Hecho el 2026-09-25**, contrastado con `describe`, `script_of` y `HistoryEntry`. Al escribirlo
    salió que la primera redacción también prometía de más: «un token pasado por parámetro no
    aparece» es falso (`node --token abc123 server.js` enseña `abc123`), y **T12-10 no lo arregla
    del todo**, porque solo salta las opciones conocidas. El README cuenta la limitación tal cual.

- [ ] **[T12-30] Avisos de terceros generados por herramienta y con los avisos de copyright** — *requiere revisión legal*
  - **Severidad:** baja · **Área:** Legal
  - **Ubicación:** `THIRD-PARTY-NOTICES.txt` (secciones 3 y 4)
  - **Qué hacer:** el archivo reconoce que no reproduce los avisos de copyright de los crates, y MIT,
    BSD-3-Clause, ISC y Unicode-3.0 los piden en una distribución binaria; los textos BSD y Unicode
    van como enlace a spdx.org. Generarlo con `cargo about` o similar, filtrando lo que de verdad va
    en el binario de Windows (326 crates, no los 566 del lockfile).
  - **Criterio de aceptación:** el archivo sale de un comando documentado e incluye licencia y aviso
    de cada componente distribuido.
  - **Esfuerzo:** medio · **Depende de:** ninguna

- [ ] **[T12-31] Poder apagar la comprobación de actualizaciones del arranque**
  - **Severidad:** baja · **Área:** Legal / Producto
  - **Ubicación:** `src/App.tsx:438-469`; `src-tauri/src/storage.rs:82-145`; `src/components/SettingsView.tsx:764-771`
  - **Qué hacer:** cada arranque consulta `api.github.com` (IP y User-Agent con la versión). Está
    dicho en el README y en Ajustes, pero no se puede desactivar. Un ajuste, encendido de fábrica. Si
    hace falta más según la jurisdicción, es cosa de la revisión legal.
  - **Criterio de aceptación:** con el ajuste apagado no sale ninguna petición al arrancar, probado
    en vivo; «Buscar actualizaciones» sigue funcionando.
  - **Esfuerzo:** bajo · **Depende de:** ninguna

- [ ] **[T12-32] Documentación y comentarios que se quedaron atrás**
  - **Severidad:** baja · **Área:** Documentación
  - **Ubicación:** `README.md:51`, `:91` («matarlo», «matar»), `:125` («todavía no lo tiene»: la firma no llegará), `:341` (falta `hotkey.rs`), `:379-380` («todas son permisivas»: 5 son MPL-2.0); `CONTEXT.md:15` («macOS después»), `:27-28`, `:167` (la v1.4.0 se publicó el 2026-08-20); `src-tauri/src/services.rs:9-10`, `:236` («el poller lo llama»); `src-tauri/src/update.rs:873` («nada de CI»); `src/App.tsx:44-50`, `:201`; `src-tauri/src/textos.rs:11`; `src/i18n.tsx:843`
  - **Qué hacer:** cada frase, corregida para que diga lo que hay hoy.
  - **Criterio de aceptación:** un grep de cada una ya no la encuentra, y nada contradice CLAUDE.md.
  - **Esfuerzo:** bajo · **Depende de:** ninguna

- [ ] **[T12-33] Decidir y escribir la convención de tildes en los comentarios**
  - **Severidad:** baja · **Área:** Refactorización / Redacción
  - **Ubicación:** `.claude/CLAUDE.md:29` (Comentarios); `ROADMAP.md:408-410`
  - **Qué hacer:** el Tier 7.3 dejó los comentarios «sin tildes de forma sistemática», y hoy conviven
    los dos estilos (`textos.rs` y `lib.rs` sin; `service_control.rs` y `elevation.rs` con). Elegir
    uno para lo nuevo y escribirlo en CLAUDE.md, **sin reformatear lo existente**.
  - **Criterio de aceptación:** la convención está en CLAUDE.md.
  - **Esfuerzo:** bajo · **Depende de:** ninguna

### Fase G — Redacción

- [ ] **[T12-34] Ortografía y concordancia en los dos catálogos**
  - **Severidad:** baja · **Área:** Ortografía
  - **Ubicación:** `src-tauri/src/textos.rs:49` («encontro»); `src/i18n.tsx:336-337` y `:799-800` (servicio bloqueado); `src/i18n.tsx:103`, `:623` (origen «Ctrl+Alt+K»)
  - **Qué hacer:** «No se encontró». Con varios dependientes, «siguen corriendo A y B» y «A and B are
    still running»: hoy dice «sigue corriendo A, B» e «is still running», la clase de fallo de plural
    que el proyecto ya arregló tres veces. Y el origen del Historial se llama «Ctrl+Alt+K» aunque la
    combinación se elija desde el Tier 11: «Atajo» y «Shortcut».
  - **Criterio de aceptación:** pruebas de la frase con uno y con dos nombres en los dos idiomas, y
    del rótulo del origen.
  - **Esfuerzo:** bajo · **Depende de:** ninguna

- [ ] **[T12-35] Repaso del inglés**
  - **Severidad:** baja · **Área:** Redacción
  - **Ubicación:** `src/i18n.tsx:696`, `:965`, `:991` (rayas y coma a la española), `:956-957` (licence/License), `:827` («closes recorded»), `:715` («neither … nor» con cinco), `:933` («on their own»), `:815`; `src-tauri/src/textos.rs:79-80` («Close all Node»)
  - **Qué hacer:** cada frase, en el inglés que escribiría un nativo y con una sola variante (en-US).
  - **Criterio de aceptación:** las pruebas que fijan esos textos, actualizadas y en verde.
  - **Esfuerzo:** bajo · **Depende de:** ninguna

- [ ] **[T12-36] Las notas del release dentro de la app**
  - **Severidad:** baja · **Área:** Redacción / UI
  - **Ubicación:** `src/components/Actualizaciones.tsx:68-72`
  - **Qué hacer:** se pintan como texto plano, y las publicadas llevan Markdown y `<kbd>`: quien
    actualice desde la v1.8.0 las verá en crudo, y solo en español. O un subconjunto de Markdown sin
    HTML, o un resumen con enlace a la página del release.
  - **Criterio de aceptación:** las notas de la v1.8.0 se leen limpias en la ventana.
  - **Esfuerzo:** bajo · **Depende de:** ninguna

### Fase H — Encontrado de paso, fuera del alcance acordado

> Accesibilidad e i18n de la interfaz no entraban en esta re-auditoría. Estos tres se encontraron
> leyendo el código de otras áreas, y se anotan para no perderlos.

- [ ] **[T12-37] Nombre accesible en los campos de vigilados y servicios** — *cierre en falso de T3-09*
  - **Severidad:** baja · **Área:** Accesibilidad
  - **Ubicación:** `src/components/SettingsView.tsx:523-530`, `:571-578`
  - **Qué hacer:** `aria-label` en los dos, como ya lleva el de protegidos (`:626`). T3-09 los pedía y
    solo se hizo el buscador.
  - **Criterio de aceptación:** los dos campos se encuentran por su nombre accesible en las pruebas,
    no por el placeholder.
  - **Esfuerzo:** bajo · **Depende de:** ninguna

- [ ] **[T12-38] `<html lang>` que siga al idioma de la app**
  - **Severidad:** baja · **Área:** Accesibilidad / i18n
  - **Ubicación:** `index.html:2`; `src/i18n.tsx:1046-1067`
  - **Qué hacer:** se queda en `es` con la interfaz en inglés (visto en vivo): un lector de pantalla
    lee el inglés con voz española. Una línea en `I18nProvider`.
  - **Criterio de aceptación:** prueba: con `language: en`, `document.documentElement.lang === "en"`.
  - **Esfuerzo:** bajo · **Depende de:** ninguna

- [ ] **[T12-39] La hora exacta del Historial, en el idioma de la app**
  - **Severidad:** baja · **Área:** i18n
  - **Ubicación:** `src/lib/format.ts:29-31`; `src/components/HistoryView.tsx:133-139`
  - **Qué hacer:** `formatTimestamp` usa el idioma del sistema y la hora relativa el de la app: el
    `title` puede salir en el otro idioma. Pasarle el `locale` del catálogo.
  - **Criterio de aceptación:** prueba con `language: en` y sistema en español: el `title` sale en inglés.
  - **Esfuerzo:** bajo · **Depende de:** ninguna

### Lo que este Tier no propone, y por qué

Decisiones cerradas que la re-auditoría respetó a sabiendas. Solo se reabrirían con un hecho nuevo,
y no ha aparecido ninguno:

- **Firma Authenticode** (T4-02), **dividir el bundle** (T4-05), **pruebas end-to-end sobre la
  ventana o FlaUI** (2026-07-24/25: aquí el equivalente es Vitest y CDP), **foco en la fila de la
  tabla** (2026-07-27), **minisign** (2026-07-26), **publicar desde la CI** (2026-07-24 y 2026-09-23)
  y **detectar el idioma del sistema** (2026-08-21).
- **Elevar la app entera de fábrica, o un servicio broker**: el Tier 10 los descartó, y desde la
  v1.7.0 elevarse es opcional y apagado de fábrica.

Y dos que salen de esta re-auditoría:

- **Nada de canal autenticado ni firma entre la app y su proceso elevado.** UAC no es una frontera
  de seguridad para el mismo usuario: un programa que ya corre como él puede pedir `runas` sobre
  `sc.exe`, firmado por Microsoft. Se corrige lo que se dice (T12-04) en vez de construir una defensa
  que no defiende.
- **La licencia OpenSSL no es un problema.** Se sospechó de `aws-lc-sys`, que llega por reqwest y
  rustls, y se comprobó con `cargo metadata`: la 0.45 ya no incluye esa licencia, y su expresión
  —ISC, Apache-2.0, MIT, BSD-3-Clause— es compatible con la GPLv3.

### Progreso

- **2026-09-25** — Tier abierto con **0 de 39** tareas hechas. Estado de partida, medido ese día:
  299 pruebas del frontend y 117 de Rust (+3 ignoradas) en verde, cobertura del 81,41 %, ESLint y
  clippy limpios, `npm audit --omit=dev` y `cargo audit` sin avisos.
- **2026-09-25 (segunda sesión)** — **4 de 39**: T12-21, T12-22, T12-01 y T12-29. Y luego
  **5 de 39**, con T12-06 probada en vivo con el usuario. 301 pruebas del frontend y 120 de Rust
  (+3 ignoradas) en verde; ESLint, clippy y el dry run entero, limpios.

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
| CI en cada commit | ✅ Válido (desde 2026-09-23) | Solo comprueba, en `windows-latest`; el release sigue siendo local con `release.ps1` (ver Tier 5.6 y CONTEXT §4) |

---

---

## 🔎 Revisión 2026-08-18 — **cerrada, y movida a `docs/`**

Una auditoría estática completa del repositorio sobre la v1.3.1 —doce áreas: código, seguridad,
rendimiento, SEO, accesibilidad, UI/UX, arquitectura, QA, limpieza, ortografía, documentación y
DevOps— dejó **37 tareas y ningún hallazgo crítico**. Se cerraron las 37, la última el 2026-08-21.

| Severidad | Qué era | Tareas |
|---|---|---|
| **T0 — Crítico** | Nada: ninguna vulnerabilidad explotable ni pérdida de datos | **0** |
| **T1 — Alta** | Las dos guardias que la doctrina del proyecto exige y no estaban | **2** ✅ |
| **T2 — Sustanciales** | Observabilidad, integridad en disco, dependencias, accesibilidad, publicación | **10** ✅ |
| **T3 — Pulido** | Redacción, etiquetas, documentación desfasada, detalles de código | **20** ✅ |
| **T4 — Futuro** | Explícitamente fuera del alcance inmediato | **5** ✅ |

**Cuatro se cerraron por decisión o por medición, no escribiendo código**: no hay CI (T4-04), no
habrá firma Authenticode (T4-02), el bundle no se divide porque se midió que no compensa (T4-05) y
el rendimiento se midió en vez de suponerse (T4-03). Tres siguen vigentes y son la razón de
conservar el documento. **T4-04 se revocó el 2026-09-23**: con el repositorio público hay CI en
GitHub Actions (`.github/workflows/ci.yml`), que comprueba pero no publica —ver CONTEXT §4—.

> **El detalle entero —problema, impacto y solución de cada tarea— está en
> [docs/REVISION-2026-08-18.md](docs/REVISION-2026-08-18.md).** Salió de aquí el 2026-08-23, al
> quedar cerrado: mientras fue accionable su sitio era el ROADMAP; cerrado es historia, y este
> documento es el plan por fases. Es el mismo criterio que sacó la bitácora de CONTEXT.md.
>
> **Los dos numerados se distinguen por el prefijo:** `Tier 4` es una fase de este documento,
> `T4-01` es una tarea de aquel.
