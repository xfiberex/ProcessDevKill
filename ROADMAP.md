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

---


## 🔎 Revisión 2026-08-18 — backlog por severidad

> Sale de una **auditoría estática completa** del repositorio sobre el commit `15d3004` (v1.3.1),
> con las doce áreas del guion de revisión: código, seguridad, rendimiento, SEO, accesibilidad,
> UI/UX, arquitectura, QA, limpieza, ortografía, documentación y DevOps. El informe entero, con el
> problema, el impacto y la solución de cada punto, está en el
> [artifact de la auditoría](https://claude.ai/code/artifact/7e41ed95-15a4-4112-9958-71a6255c51ac).
>
> **Los Tiers 1-9 de arriba no se tocan.** Aquellos son fases de desarrollo ya completadas y
> verificadas; esto es deuda encontrada, ordenada por severidad y no por orden de trabajo. Los dos
> numerados se distinguen por el prefijo: `Tier 4` es una fase, `T4-01` es una tarea de esta lista.
>
> Herramientas ejecutadas, no solo lectura: `cargo test` (49 ✓), `npm test` (160 ✓),
> `cargo clippy --all-targets -- -D warnings` (limpio), `npm audit`, `npm run test:coverage`
> (86,14 % de sentencias) y `git grep` sobre todo lo versionado buscando secretos (ninguno).

### Índice

| Tier | Qué es | Tareas | Cerradas | Esfuerzo agregado |
|---|---|---|---|---|
| **T0 — Crítico / bloqueante** | Nada. No se encontró ninguna vulnerabilidad explotable ni pérdida de datos en curso | **0** | — | — |
| **T1 — Alta prioridad** | Las dos guardias que la doctrina del proyecto exige y no están | **2** | **2** ✅ | 2 bajo |
| **T2 — Mejoras sustanciales** | Observabilidad, integridad en disco, dependencias, accesibilidad y publicación | **10** | **10** ✅ | 7 bajo · 3 medio |
| **T3 — Pulido y mantenimiento** | Redacción, etiquetas, documentación desfasada y detalles de código | **20** | **20** ✅ | 20 bajo |
| **T4 — Futuro / opcional** | Explícitamente fuera del alcance inmediato | **5** | 2 | 1 bajo · 3 medio · 1 alto |
| | | **37** | **34** | 30 bajo · 6 medio · 1 alto |

**Por qué no hay ningún T0.** El hallazgo más grave (T1-01) acaba en ejecución de código, pero
**no es alcanzable hoy**: la CSP fija `script-src 'self'`, no hay un solo `dangerouslySetInnerHTML`
en `src/`, las notas del release se pintan como texto y no se carga contenido remoto. Hace falta que
algo ejecute JavaScript dentro del webview para llegar ahí. Es defensa en profundidad, y por eso va
en T1 y no en T0 — pero es lo primero que se hace.

---

### T1 — Alta prioridad

- [x] **[T1-01] Validar en Rust el origen de las URLs del actualizador** — hecho el 2026-08-18
  - **Área:** Seguridad
  - **Ubicación:** `src-tauri/src/update.rs:409-418`, `src-tauri/src/update.rs:284-362`
  - **Qué hacer:** `download_update` recibe el `ReleaseInfo` entero del frontend, con `asset_url` y
    `checksum_url`, y no mira a qué dominio apuntan. Como el hash esperado sale de esa segunda URL,
    quien componga la llamada aporta **las dos mitades** de la verificación y esta pasa siempre; el
    archivo aterriza justo en la carpeta que `install_update` tiene en su lista blanca. Añadir una
    función pura que exija el prefijo `https://github.com/{REPO}/releases/download/` en las dos, al
    lado de `ruta_de_instalador_valida` y con el mismo criterio. Alternativa mejor si se quiere ir a
    fondo: que el comando reciba solo la etiqueta y vuelva a consultar la API él mismo, con lo que
    el frontend deja de poder inyectar nada.
  - **Criterio de aceptación:** una prueba negativa —como la de la guardia de rutas— comprueba que
    una URL de otro dominio se rechaza sin descargar nada, y que la del repositorio se acepta. La
    actualización real sigue funcionando de v1.3.1 a la siguiente.
  - **Verificado:** `url_de_release_valida` (`update.rs:204-238`) compara sobre la URL **parseada**,
    no sobre la cadena, y se llama en `download_and_verify` **antes de pedir nada**. Dos pruebas
    nuevas: `solo_se_descarga_de_un_release_de_este_repositorio` cubre los ocho casos, incluidos los
    dos que un `starts_with` de texto sí se habría tragado —el `..` que normaliza a
    `/xfiberex/evil.exe` y el `https://github.com@malo.example/…`—, y
    `una_url_ajena_no_llega_ni_a_descargarse` fija que la comprobación va antes de la descarga.
    **Comprobado que la prueba falla si se quita la guardia** (mutación aplicada y revertida). Y
    comprobado contra la API real que las dos URLs que devuelve GitHub hoy
    (`…/releases/download/v1.3.1/…exe` y su `.sha256`) pasan la validación: era lo único que podía
    romper la actualización entera sin que se notara hasta el siguiente release.
  - **Esfuerzo:** bajo
  - **Depende de:** ninguna

- [x] **[T1-02] Prueba negativa de la guardia de PID** — hecho el 2026-08-18
  - **Área:** QA y testing
  - **Ubicación:** `src-tauri/src/processes.rs:393-395`
  - **Qué hacer:** `kill_one` comprueba con `classify` que el PID sea de un runtime vigilado, y es lo
    único que separa un comando expuesto al frontend de un «mata lo que quieras». Hoy las pruebas
    solo ejercitan `kill_many` en positivo. Añadir un test que lance un proceso **no vigilado** desde
    el propio test (`cmd /c timeout /t 30`), compruebe que `kill_many` devuelve `killed: false` con
    el error que menciona «vigilado», y lo recoja él mismo al terminar.
  - **Criterio de aceptación:** el test falla si se quita la comprobación de `classify` en
    `kill_one`. Ningún proceso del usuario se toca: el que se lanza lo mata quien lo lanzó.
  - **Verificado:** `la_guardia_se_niega_a_matar_lo_que_no_esta_vigilado` (`processes.rs:716-806`).
    **Comprobado que falla si se quita la comprobación de `classify`** (mutación aplicada y
    revertida). Prueba las dos mitades a propósito: con `cmd.exe` sin vigilar, `kill_many` devuelve
    `killed: false` con el error que menciona «vigilado», sin liberar puertos, y **el proceso sigue
    vivo** —se comprueba antes de limpiar—; declarando `cmd` como nombre vigilado, el mismo PID
    muere. Sin esa segunda mitad, la prueba pasaría igual si el proceso resultara inmatable por
    cualquier otro motivo, que es la forma de que este test no probara nada.
  - **Esfuerzo:** bajo
  - **Depende de:** ninguna

---

### T2 — Mejoras sustanciales

- [x] **[T2-01] `shadcn` a `devDependencies`** — hecho el 2026-08-18
  - **Área:** Seguridad · Limpieza
  - **Ubicación:** `package.json:22`, `src/index.css:3`
  - **Qué hacer:** las 7 alertas de `npm audit` (5 altas, 2 moderadas) cuelgan **todas** de
    `shadcn@3.8.3`, declarado como dependencia de producción; arrastra `@modelcontextprotocol/sdk`,
    el servidor HTTP `hono`, `ts-morph` y `cosmiconfig`. No se puede quitar del todo —`index.css`
    importa `shadcn/tailwind.css`, que vive en el paquete—, pero es una herramienta de compilación y
    su sitio es `devDependencies`. Después, `npm audit fix`.
  - **Criterio de aceptación:** `npm audit --omit=dev` no devuelve ninguna alerta y `npm run build`
    sigue generando el mismo CSS.
  - **Verificado:** `npm audit --omit=dev` devuelve **0 vulnerabilidades** (antes las 7), y
    `npm audit fix` cerró también las del árbol de herramientas sin tocar la versión de `shadcn`
    (sigue en 3.8.3; se movieron 7 transitivas). El CSS compilado sale **idéntico byte a byte**
    —mismo hash de contenido, 90.986 bytes—, que es la prueba de que mover el paquete no cambió
    nada de lo que se distribuye.
  - **Esfuerzo:** bajo
  - **Depende de:** ninguna

- [x] **[T2-02] Análisis de dependencias y clippy dentro de `release.ps1`** — hecho el 2026-08-18
  - **Área:** DevOps · Seguridad
  - **Ubicación:** `release.ps1:235-257`
  - **Qué hacer:** el corte ejecuta `cargo test`, `npm test` y `npm run build`, pero no `cargo
    clippy`, ni `npm audit`, ni `cargo audit` —que además no está instalado en el equipo—. Las 566
    entradas de `Cargo.lock` no se han contrastado nunca contra RustSec. Instalar `cargo-audit` y
    añadir los tres pasos al bloque de pruebas, con `npm audit --audit-level=high` como aviso
    mientras T2-01 no esté hecho.
  - **Criterio de aceptación:** un `-DryRun` enseña los tres pasos nuevos, y clippy sigue pasando
    limpio con `-D warnings`.
  - **Verificado:** los tres pasos están en el bloque de pruebas (`release.ps1:238-277`) y se
    ejecutaron a mano antes de atarlos. **`cargo audit` encontró una vulnerabilidad real a la
    primera**: `h2` 0.4.15, RUSTSEC-2026-0258 (DoS por *DATA frames* vacíos), publicada el día
    anterior y en el árbol vía `reqwest`. Arreglada con `cargo update -p h2` → 0.4.16; la
    auditoría queda limpia salvo 18 avisos de crates sin mantener, casi todos *bindings* de GTK
    que en Windows ni se compilan. **Las herramientas que faltan avisan en vez de abortar**: el
    proyecto se trabaja desde varios equipos y que un `cargo-audit` sin instalar impida cortar
    una versión sería peor que el riesgo que cubre.
  - **Esfuerzo:** bajo
  - **Depende de:** T2-01 (para que `npm audit` pueda bloquear en vez de solo avisar)

- [x] **[T2-03] Log en archivo: en release, los `eprintln!` no llegan a ningún sitio** — hecho el 2026-08-18
  - **Área:** Código · Observabilidad
  - **Ubicación:** `src-tauri/src/main.rs:2`; llamadas en `lib.rs:162,179,227,340`,
    `storage.rs:171,189`, `ports.rs:18`, `notify.rs:20`
  - **Qué hacer:** el binario de release se compila con `windows_subsystem = "windows"`
    —obligatorio, si no aparece una consola—, así que no hay stderr al que escribir. Los nueve
    avisos del proyecto son la única señal cuando falla guardar el historial, escribir los ajustes o
    leer los puertos, y en la versión que usa la gente no los ve nadie. Escribir a un archivo en
    `app_data_dir()`, junto a `settings.json`, con tope de tamaño y rotación simple; o
    `tauri-plugin-log`, que ya trae las dos cosas. Mencionar la ruta en Ajustes → Acerca de para
    poder pedirlo.
  - **Criterio de aceptación:** sobre el binario de release, provocar un fallo de escritura de
    ajustes deja una línea fechada en el archivo de log, y el archivo no crece sin límite.
  - **Cómo se hizo:** módulo propio `src-tauri/src/logging.rs`, no `tauri-plugin-log`. Mismo
    criterio con el que aquí se escribió el actualizador en vez de usar `tauri-plugin-updater`: son
    ~100 líneas, la rotación se puede probar con `cargo test` sin montar una `App` —y todo el
    testing de este proyecto es local—, y no añade una dependencia que habría que declarar en
    `THIRD-PARTY-NOTICES.txt` por viajar dentro del instalador. Los 8 `eprintln!` pasan a un macro
    `avisar!` que escribe **a los dos sitios**: al archivo y a stderr, que en `tauri dev` sí existe.
  - **Rotación:** una sola generación (`processdevkill.log` + `.log.1`), 512 KB cada una, así que lo
    que ocupa está acotado a 1 MB **pase lo que pase**. Se rota **antes** de escribir, no después:
    rotar después dejaría el archivo por encima del tope durante todo el rato que va de una línea a
    la siguiente, que en una app que puede estar horas sin avisar de nada es casi todo el tiempo.
  - **Marca de tiempo en UTC, con la `Z` puesta.** La hora local exigiría preguntarle a Windows por
    la zona horaria —otra dependencia, o `unsafe`— para un archivo que lee quien desarrolla. La `Z`
    evita el malentendido de leerlo como hora local y situar un aviso dos horas antes de cuando
    ocurrió. La conversión es el `civil_from_days` de Hinnant, ~12 líneas, en vez de `chrono`
    entero para formatear una fecha; probada contra el epoch, un 29 de febrero y una fecha real.
  - **También lo alimenta el frontend:** el *error boundary* de T2-06 llamaba a `console.error`, que
    en release no la ve nadie — el mismo agujero. Ahora invoca `log_error`, que **recorta a 2.000
    caracteres**: una pila de React ocupa kilobytes, y un componente fallando en bucle rotaría el
    log entero llevándose por delante los avisos anteriores, que son los que explican cómo se llegó
    ahí. Si el puente con Rust es justo lo que falló, la llamada se traga el error: lo que el
    usuario necesita ver es la pantalla, no un fallo encima del fallo. Hay prueba de las dos cosas.
  - **La ruta se enseña en Ajustes → Acerca de**, con botón para abrir **la carpeta** —un `.log` no
    tiene asociación en Windows y abrirlo sacaría el diálogo de «cómo quieres abrir esto», el mismo
    motivo por el que la licencia se empaqueta como `.txt`— y otro para copiarla. Se dice ahí mismo
    que **no se envía a ninguna parte**, porque en un gestor de procesos esa duda es razonable.
  - **Verificado:** 5 pruebas nuevas de Rust y 6 de frontend. La de la rotación, **comprobada con
    una mutación**: anulada la comparación con el tope, falla solo esa y las otras cuatro siguen
    pasando.
  - **Y verificado sobre el binario de release el 2026-08-18**, con la v1.4.0 ya instalada: el
    archivo existe en `%APPDATA%\com.processdevkill.app\`, la sección de Ajustes → Acerca de enseña
    su ruta real, y dentro está la línea fechada que escribió la app al arrancar. La escribe **el
    mismo `escribir_en`** que usan los avisos de fallo, así que el camino de escritura está
    ejercitado de punta a punta fuera de las pruebas. Lo único que no se ha provocado es un fallo
    de verdad —hacer que falle guardar los ajustes— y por eso no se marca como comprobado eso.
  - **La `Z` del UTC demostró servir para algo:** la línea del arranque de la v1.4.0 dice
    `02:32:19Z` y el archivo se escribió a las **22:32 locales**. Cuatro horas de diferencia; sin la
    marca, cualquiera situaría los avisos en otro momento del día.
  - **Esfuerzo:** medio
  - **Depende de:** ninguna

- [x] **[T2-04] Escritura atómica de `settings.json` e `history.json`** — hecho el 2026-08-18
  - **Área:** Código · Integridad de datos
  - **Ubicación:** `src-tauri/src/storage.rs:197-200`
  - **Qué hacer:** `write_json` hace `fs::write` directo sobre el archivo final: primero lo trunca y
    luego lo rellena. Un corte a mitad deja un JSON truncado; el arranque siguiente lo detecta y no
    tumba la app —bien—, pero **vuelve a los valores de fábrica sin avisar**, perdiendo los nombres
    vigilados, el umbral del Auto-Kill y hasta 200 entradas de historial. Escribir a un temporal y
    renombrar encima (en Windows `fs::rename` sobre un archivo existente falla: hace falta
    `ReplaceFileW`, borrar-y-renombrar, o `tempfile::persist`). De paso, conservar el original como
    `.corrupto` antes de sobrescribirlo con los valores por defecto.
  - **Criterio de aceptación:** una prueba que interrumpe la escritura deja el archivo anterior
    íntegro, y `un_archivo_corrupto_no_tumba_la_app` sigue en verde.
  - **Verificado:** `write_json` escribe en un `.tmp` y renombra encima
    (`storage.rs:197-228`), con la prueba `guardar_encima_de_lo_guardado_funciona_y_no_deja_temporales`.
  - ⚠️ **La prueba desmintió a la implementación, que es para lo que está.** La primera versión
    borraba el destino antes de renombrar, dando por hecho que en Windows `fs::rename` falla si
    existe. Se quitó el borrado para verla fallar y **siguió pasando**: el `rename` de Rust usa
    `MoveFileExW` con `MOVEFILE_REPLACE_EXISTING` y reemplaza sin quejarse. O sea que el borrado
    no defendía de nada y **abría justo el hueco que esto venía a cerrar** —un instante sin
    ningún archivo bueno en disco—. Se quitó.
  - **Esfuerzo:** bajo
  - **Depende de:** ninguna

- [x] **[T2-05] ESLint para TypeScript y React** — hecho el 2026-08-18
  - **Área:** Código · Limpieza
  - **Ubicación:** raíz del repositorio, `package.json:7-15`
  - **Qué hacer:** no hay configuración de ESLint, Biome ni Prettier, ni script de `lint`. Rust sí
    tiene clippy y pasa limpio, así que la asimetría es solo del frontend: unas 4.000 líneas de TSX
    con `tsc --strict` como única red. Añadir `typescript-eslint`, `eslint-plugin-react-hooks` y
    `eslint-plugin-jsx-a11y`, y meterlo en el bloque de pruebas de `release.ps1`.
  - **Criterio de aceptación:** `npm run lint` pasa limpio con las reglas recomendadas, y la primera
    pasada de arreglos va en su propio commit, separada de la configuración. ✅
  - **Resultado de la primera pasada:** 148 avisos, de los que **142 eran de `.claude/skills/**`** —
    los `.cjs` de los packs, código de terceros mirado con reglas de navegador—. Ignorados: qué
    hacer con esos 271 archivos es T2-09, pero mientras tanto no pueden tapar lo del código propio.
    Quedaron **5 reales, todos `react-hooks/set-state-in-effect`**, una regla que `tsc --strict` no
    puede ver ni de lejos. Tres eran estado derivado de una prop sincronizado con un `useEffect`
    —el diálogo de confirmación y los dos campos de Ajustes—: pintaban el valor viejo y solo después
    el nuevo, un render de más por cada apertura o cada cambio. Reescritos al patrón que React
    documenta, ajustando el estado **durante el render**. Los otros dos son cargas asíncronas al
    montar (`refresh`, `loadHistory`), donde la regla es un falso positivo: el estado se toca
    después de un `await`, no en el cuerpo del efecto. Silenciados uno a uno con su motivo, nunca
    la regla entera.
  - **Notas:** ESLint **9, no 10**: `eslint-plugin-jsx-a11y` 6.10.2 declara como peer `eslint@^3 …
    ^9` y npm aborta con la 10; forzarlo con `--legacy-peer-deps` dejaría el plugin sobre una API
    que no dice soportar. Sin comprobación con tipos, que multiplicaría el tiempo de cada corte y
    aporta poco sobre `tsc --strict`. Atado a `release.ps1`, y este **aborta** en vez de avisar
    —a diferencia de clippy o `cargo audit`—: ESLint viaja en `devDependencies`, así que si falta
    es que falta `npm install`, y entonces tampoco iban a correr los tests.
  - **Esfuerzo:** medio
  - **Depende de:** ninguna

- [x] **[T2-06] Error boundary alrededor de la app** — hecho el 2026-08-18
  - **Área:** Código · UI/UX
  - **Ubicación:** `src/main.tsx:6-10`
  - **Qué hacer:** no hay ninguno, así que una excepción no capturada en el render desmonta el árbol
    entero. En el navegador eso se ve en la consola; aquí es una ventana de escritorio en release,
    sin devtools y sin consola (ver T2-03): el usuario ve un rectángulo vacío y solo puede cerrar la
    app. Pintar el error, ofrecer recargar la vista y —cuando exista T2-03— apuntar al log.
  - **Criterio de aceptación:** una prueba que hace lanzar a un componente hijo enseña la pantalla de
    error en vez de dejar el DOM vacío.
  - **Verificado:** `src/components/ErrorBoundary.tsx`, montado **fuera de `App`** en `main.tsx`
    —una barrera dentro no se montaría si el fallo estuviera en el propio `App`—. Cuatro pruebas
    en `ErrorBoundary.test.tsx`: que no estorba sin fallo, que ante uno enseña la salida con el
    mensaje del error, que **dice explícitamente que no se ha cerrado ningún proceso** —es un
    gestor de procesos: ese es el susto por defecto— y que el botón recarga la ventana.
  - **Esfuerzo:** bajo
  - **Depende de:** ninguna (mejora con T2-03)

- [x] **[T2-07] Respetar `prefers-reduced-motion`** — verificado el 2026-08-18
  - **Área:** Accesibilidad
  - **Ubicación:** `src/components/ProcessTable.tsx:103-121`, `src/index.css`
  - **Qué hacer:** no hay una sola aparición de `prefers-reduced-motion` ni de `MotionConfig` en todo
    el proyecto. Las filas entran, salen desplazándose 24 px y tiñéndose de rojo, y las barras
    animan su anchura cada dos segundos. Windows tiene su interruptor de «Efectos de animación» y
    WebView2 lo traslada a esa media query. Envolver en `<MotionConfig reducedMotion="user">` y
    añadir la regla equivalente en CSS para las transiciones de las barras.
  - **Criterio de aceptación:** con la preferencia activada en Windows, las filas aparecen y
    desaparecen sin desplazamiento y las barras saltan a su valor sin transición. ✅
  - **Cómo está resuelto:** `<MotionConfig reducedMotion="user">` envolviendo la app para lo que
    anima Motion, y la regla `@media (prefers-reduced-motion: reduce)` en `index.css` para las
    transiciones de CSS de las barras, que Motion no gobierna. **Ninguna de las dos vale por la
    otra**, y por eso están las dos.
  - **⚠️ El ajuste de Windows va al revés de como suena, y esto costó una vuelta:**
    `prefers-reduced-motion: reduce` se activa cuando **«Efectos de animación» está APAGADO**.
    Encendido —el estado normal— significa «sí quiero animaciones» y la app debe animar como
    siempre. Esta ficha decía «encender» y era incorrecto; el usuario lo comprobó con el ajuste
    encendido, vio que todo animaba y lo reportó, que es exactamente lo que tenía que pasar.
  - **Verificado el 2026-08-18 por el usuario, apagando el ajuste en la app en marcha:** las barras
    de la tabla y del medidor **saltan** al valor nuevo en vez de deslizarse, y las filas filtradas
    **desaparecen de golpe** sin desvanecerse en rojo. Al volver a encenderlo, las dos cosas
    animan otra vez. Se comprobaron las dos mitades a propósito: las barras son CSS y las filas son
    Motion, así que un solo síntoma no habría distinguido cuál de las dos piezas funciona.
  - **No se puede verificar desde las pruebas ni emulando:** el doble de Motion quita las
    animaciones, y por CDP solo se puede *leer* la media query, no imponerla (`emulate` cubre el
    modo claro/oscuro, no esta). Y lo que de verdad había que probar era el eslabón que ninguna
    emulación demuestra: **que WebView2 traduzca el ajuste de Windows a la media query**.
  - **Esfuerzo:** bajo
  - **Depende de:** ninguna

- [x] **[T2-08] Excluir dobles de prueba y código generado de la cobertura** — hecho el 2026-08-18
  - **Área:** QA y testing
  - **Ubicación:** `vitest.config.ts:17-25`
  - **Qué hacer:** el 86,14 % actual incluye en el denominador `src/test/tauri-mock.ts` (65,62 %, que
    es un doble: su código sin ejecutar son ramas de simulación que nadie pidió) y
    `src/components/ui/` (68,57 %, con `context-menu.tsx` al 33,33 %, generado por shadcn). La cifra
    infravalora el código propio y a la vez invita a escribir pruebas de componentes generados para
    subir un número. Añadir `coverage.exclude` con `src/test/**`, `src/components/ui/**` y
    `**/*.test.*`.
  - **Criterio de aceptación:** el informe solo lista código propio, y el porcentaje resultante queda
    anotado como referencia real en CONTEXT §3.
  - **Verificado:** con `coverage.exclude` puesto (`vitest.config.ts:27-45`), la cobertura real del
    código propio es **89,61 % de sentencias y 90,21 % de líneas**, frente al 86,14 / 86,41 que
    salía mezclando los dobles de Tauri y los componentes generados por shadcn.
  - **Esfuerzo:** bajo
  - **Depende de:** ninguna

- [x] **[T2-09] Decidir qué se hace con los packs de skills de agente** — decidido el 2026-08-18
  - **Área:** Limpieza · Licencias
  - **Ubicación:** `.claude/skills/`, `.agents/skills/`, `skills-lock.json`
  - **Qué hacer:** de los 373 archivos versionados, **271 son packs de skills** —CSV de paletas,
    scripts de Python para generar logos, plantillas de presentaciones— que no intervienen en
    compilar, probar ni publicar. Además, dos traen licencia propia
    (`.claude/skills/ui-styling/LICENSE.txt`, `.agents/skills/frontend-design/LICENSE.txt`) que ni el
    README ni `THIRD-PARTY-NOTICES.txt` mencionan. Elegir una de tres: sacarlos a `.gitignore` (se
    reinstalan desde `skills-lock.json`), traerlos como submódulo, o dejarlos y documentar en el
    README y en los avisos qué son y bajo qué licencia.
  - **Criterio de aceptación:** la decisión está tomada y anotada en CONTEXT §4 con su fecha, y no
    queda material de terceros sin declarar en un repositorio GPLv3. ✅
  - **Decisión del usuario (2026-08-18): se quedan**, «porque puede servir en caso de necesitarlos».
    Ni `.gitignore` ni submódulo: la tercera opción, dejarlos y documentarlos.
  - **Lo que apareció al documentarlos, y respalda la decisión:** `skills-lock.json` **solo registra
    los 11 packs de `.agents/skills/`**. Los **7 de `.claude/skills/`** —`banner-design`, `brand`,
    `design`, `design-system`, `slides`, `ui-styling`, `ui-ux-pro-max`— no están en el lock, así que
    la opción de ignorarlos **no era reversible para ellos**: se habrían perdido sin forma de
    reinstalarlos. La tarea daba por hecho que el lock los cubría todos y no era cierto.
  - **Licencias, declaradas en la sección 5 de `THIRD-PARTY-NOTICES.txt`** —sección aparte, porque
    las otras cuatro cubren solo lo que el instalador empaqueta y esto no viaja con la app—: dos
    traen texto propio y los dos son **Apache-2.0** (`frontend-design`, `ui-styling`), nueve
    declaran `license: MIT` en el frontmatter sin adjuntar el texto, y **ocho no declaran licencia
    en ninguna parte**. `ui-styling` se contradice a sí mismo: dice MIT en el SKILL.md y trae un
    LICENSE.txt de Apache-2.0; se anota la contradicción en vez de elegir una. Se ha leído lo que
    hay en el repositorio, sin consultar los repos de origen — dicho así en el propio archivo.
  - **Esfuerzo:** bajo la decisión; medio si se opta por documentarlos
  - **Depende de:** ninguna

- [x] **[T2-10] Escribir el procedimiento para revertir un release malo** — hecho el 2026-08-18
  - **Área:** DevOps
  - **Ubicación:** `release.ps1` (cabecera), `src-tauri/src/update.rs:76-83`
  - **Qué hacer:** `is_newer` es estrictamente mayor —correcto, evita el bucle de reinstalación—, así
    que republicar la versión buena con un número anterior no llega a nadie: quien ya instaló la
    mala no recibe la oferta. La única salida es cortar una versión superior, y eso no está escrito
    en ningún sitio. Agrava el caso que desde la v1.3.1 la instalación es silenciosa y el usuario
    tiene menos ocasiones de frenarla. Documentar: cortar X.Y.Z+1 con el código bueno, despublicar
    el release malo para que `/releases/latest` deje de servirlo, y verificar después que la API
    devuelve la etiqueta correcta.
  - **Criterio de aceptación:** el procedimiento está en el README o en la cabecera de `release.ps1`,
    con los tres pasos y en ese orden.
  - **Verificado:** en la cabecera de `release.ps1`, que es donde mira quien va a publicar. Tres
    pasos en orden: cortar X.Y.Z+1 con el código bueno —lo único que alcanza a quien ya
    actualizó—, despublicar el release malo para que `/releases/latest` deje de servirlo, y
    comprobar con `gh api … --jq .tag_name` que la API devuelve ya la etiqueta correcta. Esa
    última llamada es la misma que hace la app, y se ejecutó al verificar la v1.3.2.
  - **Esfuerzo:** bajo
  - **Depende de:** ninguna

---

### T3 — Pulido y mantenimiento

- [x] **[T3-01] Restaurar `GH_TOKEN` al terminar el release** — restaurado y comprobado el 2026-08-18
  - **Área:** Seguridad · DevOps
  - **Ubicación:** `release.ps1:406-415`
  - **Qué hacer:** cuando `gh` no está autenticado, el script saca la credencial cacheada de git y la
    deja en `$env:GH_TOKEN`. Un script de PowerShell corre en el proceso de la consola que lo lanza,
    así que la variable sobrevive al script y queda a la vista de todo lo que se ejecute después en
    esa terminal — con alcance `repo` y `workflow`. Guardar el valor anterior y restaurarlo en el
    `finally` que ya existe.
  - **Criterio de aceptación:** tras un release, `Test-Path Env:\GH_TOKEN` devuelve lo mismo que
    antes de lanzarlo. ✅ Probados los dos casos: sin la variable de antes, después sigue sin
    existir; con un valor puesto, vuelve con ese mismo valor.
  - **Se distingue «no existía» de «existía vacía»** porque en PowerShell `$env:VAR = ""` **borra**
    la variable, así que restaurar asignando no es simétrico: si no existía se usa `Remove-Item`.
    ⚠️ Lo ejercitado es el camino del *dry run*; el del release real, que es el único que llega a
    escribir el token, no se ha corrido — haría falta publicar una versión.
  - **Esfuerzo:** bajo
  - **Depende de:** ninguna

- [x] **[T3-02] Techo de tamaño en la descarga del instalador** — probado el 2026-08-18
  - **Área:** Seguridad
  - **Ubicación:** `src-tauri/src/update.rs:329-345`
  - **Qué hacer:** el bucle de `bytes_stream()` escribe lo que llegue hasta que el flujo termine, sin
    comparar con `asset_size` ni con un máximo absoluto. Abortar y borrar si se supera `asset_size`
    por un margen razonable, o un tope fijo.
  - **Criterio de aceptación:** una descarga que se pasa del tope se corta, borra el archivo parcial
    y devuelve un error legible. ✅ **Comprobado con una mutación:** se anuló la comparación
    (`if false && bajado > tope`), la prueba negativa falló y la positiva siguió pasando — o sea que
    lo que corta es el tope y no otra cosa. Restaurada después.
  - **Estado:** código escrito el 2026-08-18 junto con T1-01, que toca el mismo bucle (tope de
    100 MB frente a los ~4 MB que ocupa el instalador). Estuvo sin marcar hasta tener prueba, y
    **el obstáculo no era el servidor sino dónde vivía el bucle:** dentro de `download_and_verify`,
    que valida la URL contra github.com antes de pedir nada —y debe seguir haciéndolo—, así que
    ningún servidor local llegaba a ejercitarlo. Extraído a `volcar_con_tope` con el tope **por
    parámetro**: la prueba usa 64 KB contra un servidor que escupe 512 KB y verifica el mecanismo
    —contar, cortar y borrar el parcial— sin mover 100 MB por el loopback ni escribirlos en el
    disco de nadie. Tres pruebas: la negativa, la positiva (el tope no puede romper la descarga
    normal) y el valor de producción. El servidor es un `TcpListener` en un hilo, **no un
    contenedor**: treinta líneas, arranca en microsegundos y no pide daemon. Docker queda para
    cuando haga falta un servicio de verdad (ver T4-04).
  - **Esfuerzo:** bajo
  - **Depende de:** T1-01 (se toca el mismo camino)

- [x] **[T3-03] Revertir los ajustes en la ventana si no se pudieron guardar** — hecho el 2026-08-18
  - **Área:** Código · UI/UX
  - **Ubicación:** `src/App.tsx:165-172`
  - **Qué hacer:** `saveSettings` aplica el cambio de forma optimista y, si `invoke` lanza, enseña un
    toast pero no revierte. Con el Auto-Kill de por medio esa divergencia importa: la ventana puede
    decir 4096 MB mientras Rust sigue vigilando con 2048, y el toast se va en segundos. Recordar los
    ajustes anteriores y restaurarlos en el `catch`.
  - **Criterio de aceptación:** con `save_settings` rechazando, el control vuelve visualmente a su
    valor anterior y el mensaje dice que no se guardó.
  - **Esfuerzo:** bajo
  - **Depende de:** ninguna

- [x] **[T3-04] Capturar el fallo al vaciar el historial** — hecho el 2026-08-18
  - **Área:** Código
  - **Ubicación:** `src/App.tsx:375-378`
  - **Qué hacer:** es el único `invoke` del frontend sin `try/catch`. Si la escritura falla salta una
    promesa rechazada sin gestionar y el diálogo se cierra como si hubiera funcionado. Envolverlo
    igual que `refresh` y `loadHistory`.
  - **Criterio de aceptación:** con `clear_history` rechazando, aparece un `toast.error` y el
    historial sigue en pantalla.
  - **Esfuerzo:** bajo
  - **Depende de:** ninguna

- [x] **[T3-05] `vitest.config.ts` no lo comprueba ningún `tsconfig`** — hecho el 2026-08-18
  - **Área:** Código
  - **Ubicación:** `tsconfig.json:36`, `tsconfig.node.json:9`
  - **Qué hacer:** el principal incluye solo `src` y el de Node solo `vite.config.ts`, así que la
    configuración de Vitest queda sin verificar. Añadirla al `include` de `tsconfig.node.json`.
  - **Criterio de aceptación:** un error de tipos introducido a propósito en `vitest.config.ts` hace
    fallar `npm run build`. ✅ Comprobado inyectando `const x: number = "texto"`: el build sale con
    código 2 y lo nombra. Restaurado después.
  - **⚠️ El `include` no bastaba, y ese era el arreglo que pedía la ficha.** `tsc` a secas **no
    construye las referencias de proyecto**: con `vitest.config.ts` ya incluido, el error inyectado
    seguía sin romper nada. El build pasa a `tsc -b`, y eso arrastró dos cosas más: un
    `@ts-expect-error` que ya sobraba en `vite.config.ts` (con `-b` es error TS2578, no aviso), y
    que `composite: true` **obliga a emitir** — `tsc -b` dejaba un `.js` y un `.d.ts` junto a cada
    config, en la raíz. Eso no es solo ruido: son archivos sin rastrear, y `release.ps1` aborta con
    el árbol sucio, así que **el arreglo habría roto el corte de versión**. `noEmit` no vale
    (TS6310 en un proyecto referenciado); la emisión se manda a `node_modules/.tmp/`.
  - **Esfuerzo:** bajo
  - **Depende de:** ninguna

- [x] **[T3-06] Quitar el `unwrap()` del icono al construir la bandeja** — hecho el 2026-08-18
  - **Área:** Código
  - **Ubicación:** `src-tauri/src/tray.rs:74`
  - **Qué hacer:** `app.default_window_icon().unwrap()` entra en pánico si el icono no está, y un
    pánico en el `setup` es una app que no arranca y no dice por qué. El resto del arranque degrada
    con elegancia (`app_data_dir` cae a `temp_dir`, los ajustes corruptos a los de fábrica); esto
    rompe esa coherencia. Propagar con `ok_or` hacia el `tauri::Result` que la función ya devuelve.
  - **Criterio de aceptación:** `cargo build` sin `unwrap` en ese camino y la bandeja sigue
    apareciendo.
  - **Esfuerzo:** bajo
  - **Depende de:** ninguna

- [x] **[T3-07] `HashSet` en la poda del Zombie Finder** — hecho el 2026-08-18
  - **Área:** Rendimiento
  - **Ubicación:** `src-tauri/src/processes.rs:305-306`
  - **Qué hacer:** `retain` hace una búsqueda lineal en un `Vec` por cada entrada del mapa, en cada
    refresco. Despreciable con decenas de procesos; se anota porque el arreglo es una palabra y el
    bucle corre cada dos segundos durante días. Construir `vivos` como `HashSet<u32>`.
  - **Criterio de aceptación:** `olvida_los_pids_que_desaparecen` sigue en verde.
  - **Esfuerzo:** bajo
  - **Depende de:** ninguna

- [x] **[T3-08] «En pausa» y «Midiendo…» por debajo del contraste mínimo** — hecho el 2026-08-18
  - **Área:** Accesibilidad
  - **Ubicación:** `src/components/UsageMeter.tsx:29`
  - **Qué hacer:** es el único texto de la app con la opacidad rebajada (`text-muted-foreground/70`,
    12 px). Calculado sobre los tokens de `index.css`, el contraste en tema claro ronda **2,9:1**,
    por debajo del 4,5:1 de WCAG 2.2 AA — *pendiente de verificación con una herramienta sobre la
    app en marcha; el cálculo es a mano desde los valores OKLCH*. Quitar el `/70`, que es el mismo
    criterio que ya se aplicó al guion de «sin puertos».
  - **Criterio de aceptación:** medido con una herramienta de contraste sobre la ventana, los dos
    textos pasan de 4,5:1 en tema claro y oscuro.
  - **Esfuerzo:** bajo
  - **Depende de:** ninguna

- [x] **[T3-09] Etiqueta accesible en el buscador y en el campo de ejecutable** — hecho el 2026-08-18
  - **Área:** Accesibilidad
  - **Ubicación:** `src/App.tsx:307-312`, `src/components/SettingsView.tsx:179-186`
  - **Qué hacer:** los dos se apoyan solo en el `placeholder`, que desaparece al escribir y no es
    fiable como nombre accesible (WCAG 3.3.2). Los dos campos numéricos de la misma vista sí llevan
    `aria-label` y `aria-describedby`, con su comentario, así que es un descuido y no un criterio.
    Añadir `aria-label` a ambos.
  - **Criterio de aceptación:** los dos campos se anuncian con su nombre aunque tengan texto escrito.
  - **Esfuerzo:** bajo
  - **Depende de:** ninguna

- [x] **[T3-10] El contador de la cabecera es un número sin nombre** — hecho el 2026-08-18
  - **Área:** Accesibilidad
  - **Ubicación:** `src/App.tsx:314-316`
  - **Qué hacer:** entre el buscador y «Refrescar» hay un `<span>` con `{visible.length}` y nada más;
    leído en voz alta es un número suelto, y además cambia al filtrar sin anunciarse. Añadir un
    `aria-label` del tipo «12 procesos en la lista» y `aria-live="polite"`.
  - **Criterio de aceptación:** al filtrar, el lector de pantalla anuncia el recuento nuevo.
  - **Esfuerzo:** bajo
  - **Depende de:** ninguna

- [x] **[T3-11] `caption` en las tablas y rol en la barra de descarga** — hecho el 2026-08-18
  - **Área:** Accesibilidad
  - **Ubicación:** `src/components/ProcessTable.tsx:59`, `src/components/HistoryView.tsx:35`,
    `src/components/Actualizaciones.tsx:87-100`
  - **Qué hacer:** ninguna de las dos tablas tiene `<caption>` ni `aria-label`, así que se anuncian
    como «tabla, 8 columnas» sin decir de qué. La barra de descarga es un `div` con la anchura
    animada, sin `role="progressbar"`. Añadir un `<caption class="sr-only">` a cada tabla y el rol
    con `aria-valuenow/min/max` cuando hay porcentaje.
  - **Criterio de aceptación:** las dos tablas se anuncian con nombre y la barra reporta su avance.
  - **Esfuerzo:** bajo
  - **Depende de:** ninguna

- [x] **[T3-12] Un solo aviso por acción desde la bandeja y el atajo global** — hecho el 2026-08-18
  - **Área:** UI/UX
  - **Ubicación:** `src-tauri/src/lib.rs:232-240`, `src-tauri/src/tray.rs:44-49`
  - **Qué hacer:** «Cerrar todos los Node» pasa por `kill_and_record`, que notifica los puertos
    liberados, y al volver notifica otra vez el recuento: dos toasts de Windows para un clic, y
    justo en el camino que se usa sin ventana delante. El Auto-Kill ya evita el duplicado con una
    guarda explícita; extender ese mismo criterio, componiendo el mensaje completo con
    `notify::freed_ports_sentence`.
  - **Criterio de aceptación:** cerrar desde la bandeja o con Ctrl+Alt+K saca **un** aviso que
    incluye el recuento y los puertos liberados. ✅ Con prueba de la frase compuesta.
  - La guarda pasa de «todos menos el Auto-Kill» a **«solo la ventana»**: los otros tres caminos
    componen su mensaje entero. Con la ventana delante sí tiene sentido el aviso suelto de puertos,
    porque el recuento ya se ve en pantalla. El `dedup` de puertos sale a `processes::freed_ports`
    para que los cuatro caminos usen el mismo, con su prueba de que no repite un puerto que dos
    procesos soltaron a la vez.
  - **Esfuerzo:** bajo
  - **Depende de:** ninguna

- [x] **[T3-13] Pruebas de los caminos de fallo del frontend** — hecho el 2026-08-18
  - **Área:** QA y testing
  - **Ubicación:** `src/App.test.tsx`, `src/components/SettingsView.test.tsx`
  - **Qué hacer:** hay pruebas del caso feliz y del parcial de `kill_processes`, pero ninguna simula
    que `save_settings` o `clear_history` fallen — que son justo los caminos de T3-03 y T3-04.
    Añadir dos con el `invoke` doblado rechazando.
  - **Criterio de aceptación:** las dos fallan si se quitan los arreglos de T3-03 y T3-04.
  - **Esfuerzo:** bajo
  - **Depende de:** T3-03, T3-04

- [x] **[T3-14] Singular y plural en las notificaciones de Rust** — hecho el 2026-08-18
  - **Área:** Ortografía y redacción
  - **Ubicación:** `src-tauri/src/tray.rs:46-49`, `src-tauri/src/lib.rs:364-366`
  - **Qué hacer:** cerrar un único Node desde la bandeja produce «1 procesos Node cerrados.». Es el
    mismo descuido que el frontend ya arregló dos veces —hay una prueba llamada «usa el singular al
    cerrar un solo proceso» y un comentario sobre «1 cierre registrados»—. Aplicar el patrón de
    `freed_ports_sentence`, que ya resuelve las dos formas con su prueba al lado.
  - **Criterio de aceptación:** una prueba fija las dos redacciones, en singular y en plural.
  - **Esfuerzo:** bajo
  - **Depende de:** ninguna

- [x] **[T3-15] Las dos tildes que faltan en los avisos del Auto-Kill** — hecho el 2026-08-18
  - **Área:** Ortografía y redacción
  - **Ubicación:** `src-tauri/src/auto_kill.rs:65`, `src-tauri/src/auto_kill.rs:71`
  - **Qué hacer:** «por encima del limite de …. Cerrado automaticamente.» y «… cerrados
    automaticamente por pasar de …». Faltan «límite» y «automáticamente», en el aviso de la única
    función que cierra procesos sin preguntar. El resto de cadenas de cara al usuario sí las llevan
    (`update.rs` las acentúa todas), así que es una inconsistencia y no un criterio.
  - **Criterio de aceptación:** las dos cadenas acentuadas y `cargo test` en verde (las pruebas
    comparan fragmentos que no incluyen esas palabras).
  - **Esfuerzo:** bajo
  - **Depende de:** ninguna

- [x] **[T3-16] README: el recuento de pruebas del backend** — hecho el 2026-08-18 (48 -> 52)
  - **Área:** Documentación
  - **Ubicación:** `README.md:238`
  - **Qué hacer:** la v1.3.1 añadió `el_instalador_se_lanza_en_silencio` y el número no se actualizó.
    El de frontend (160) sí está bien.
  - **Criterio de aceptación:** la cifra coincide con la salida de `cargo test`.
  - **Verificado:** dice 52, que es lo que devuelve `cargo test` tras cerrar el Tier 1.
  - **Esfuerzo:** bajo
  - **Depende de:** ninguna

- [x] **[T3-17] README: contar que la actualización ya es silenciosa** — hecho el 2026-08-18
  - **Área:** Documentación
  - **Ubicación:** `README.md:118`
  - **Qué hacer:** «Al terminar, la app se cierra para que el instalador la reemplace» era exacto
    hasta la v1.3.1, que hizo el proceso silencioso y añadió la reapertura automática. Ajustes ya lo
    dice dentro de la app; el README no, y es lo que lee quien decide si instalar. Añadir la frase,
    con la nota de que quien venga de la v1.3.0 aún verá las ventanas una última vez.
  - **Criterio de aceptación:** la sección describe el comportamiento real de la v1.3.1 en adelante.
  - **Verificado:** `README.md:114-125`, con la advertencia de que quien venga de la v1.3.0 verá las
    ventanas una última vez porque el instalador lo lanza la versión ya instalada.
  - **Esfuerzo:** bajo
  - **Depende de:** ninguna

- [x] **[T3-18] Regenerar `THIRD-PARTY-NOTICES.txt`** — regenerado el 2026-08-18
  - **Área:** Documentación · Licencias
  - **Ubicación:** `THIRD-PARTY-NOTICES.txt:51`, `THIRD-PARTY-NOTICES.txt:19`
  - **Qué hacer:** declara `shadcn 4.14.1` cuando la instalada y la declarada en `package.json` es la
    **3.8.3**, y habla de «los 515 crates del árbol de Rust» cuando `Cargo.lock` tiene 566 entradas.
    Es un documento legal que viaja dentro del instalador como recurso y al que la app enlaza desde
    Ajustes: su valor entero está en ser exacto. Regenerarlo con los comandos que el propio archivo
    documenta y añadir el paso a `release.ps1`, o al menos un aviso si `package.json` cambió desde la
    última regeneración. Con T2-01 hecho, `shadcn` deja además de tener que aparecer.
  - **Criterio de aceptación:** cada versión listada coincide con la instalada, y la fecha de
    generación es la del último corte. ✅ Regenerado contra `cargo metadata` y los `package.json`
    instalados, no contra lo declarado.
  - **⚠️ Lo desfasado no era lo peor: al documento le faltaban cuatro dependencias directas** que
    sí van dentro del binario — `reqwest`, `futures-util`, `sha2` y `tauri-plugin-single-instance`,
    que entraron con el actualizador y la instancia única después de generarse el archivo. También
    aparecieron dos familias de licencia que no estaban declaradas: **CDLA-Permissive-2.0**
    (`webpki-root-certs`, la lista de CA raíz de reqwest) y la LGPL **como una de tres opciones**
    en `r-efi` — se toma bajo MIT, así que no aporta requisitos de enlazado. Ambas anotadas.
  - `shadcn` se queda declarado pese a ser `devDependency`: `src/index.css` importa su
    `tailwind.css`, así que sus reglas acaban en el CSS empaquetado. La versión que declaraba el
    archivo (4.14.1) **nunca estuvo instalada**; es y era la 3.8.3.
  - **Atado al corte:** `release.ps1` avisa —no aborta— si `package.json` o `Cargo.lock` son más
    recientes que el archivo de avisos. Nada relacionaba las dos cosas, y por eso se quedó viejo.
  - **Esfuerzo:** bajo
  - **Depende de:** T2-01

- [x] **[T3-20] `coverage/` ignorado por git** — hecho el 2026-08-18
  - **Área:** DevOps
  - **Ubicación:** `.gitignore:13-19`
  - **Qué hacer:** salió al ejecutar `npm run test:coverage` durante la propia auditoría: la carpeta
    que genera **no estaba ignorada**. Dos problemas, y el segundo muerde: es un informe distinto en
    cada equipo —el proyecto se trabaja desde varios—, y `release.ps1` **aborta el corte** al
    encontrar archivos sin rastrear, así que medir la cobertura antes de publicar dejaba el release
    bloqueado hasta borrar la carpeta a mano.
  - **Criterio de aceptación:** tras `npm run test:coverage`, la carpeta existe en disco y
    `git status --porcelain` no devuelve ninguna entrada `??`.
  - **Verificado:** generada la cobertura (86,41 % de líneas) y comprobado que `git status` solo ve
    los archivos editados a mano. El corte de versión ya no se bloquea.
  - **Esfuerzo:** bajo
  - **Depende de:** ninguna

- [x] **[T3-19] Atar `-SkipTests` al `-DryRun` que lo justifica** — hecho y probado el 2026-08-18
  - **Área:** DevOps
  - **Ubicación:** `release.ps1:70`, `release.ps1:235-237`
  - **Qué hacer:** el modificador existe para no repetir las pruebas cuando el *dry run* acaba de
    pasarlas —así se cortó la v1.3.1— pero nada relaciona las dos ejecuciones: el script no recuerda
    que hubo un *dry run*, ni sobre qué commit. Un `-SkipTests` sobre un árbol que cambió después
    publica sin haber probado ese código. Que el *dry run* deje una marca con el `HEAD` sobre el que
    corrió y que `-SkipTests` avise —o se niegue— si no coincide. Como mínimo, documentar la
    condición en la ayuda del parámetro.
  - **Criterio de aceptación:** `-SkipTests` sobre un `HEAD` distinto del último *dry run* avisa
    antes de compilar nada. ✅ Probados los tres casos: sin marca previa se niega, con un `HEAD`
    que no coincide se niega diciendo ambos, y con el correcto sigue adelante nombrándolo.
  - **Se niega en vez de avisar**, que la ficha dejaba a elección: un aviso se lo lleva el scroll y
    al otro lado está publicar código sin haberlo probado — lo único que no se puede deshacer,
    porque `is_newer` es estrictamente mayor. Salir de ahí cuesta quitar el modificador.
  - La marca va en `%TEMP%`, no en el repositorio: es estado de una máquina y un momento, y en el
    árbol ensuciaría justo lo que el propio script exige limpio.
  - **Esfuerzo:** bajo
  - **Depende de:** ninguna

---

### T4 — Futuro / opcional

Explícitamente fuera del alcance inmediato. Están aquí para no perderlos, no para hacerlos ahora.

- [ ] **[T4-01] Internacionalización**
  - **Área:** UI/UX
  - **Ubicación:** todo `src/`, `src-tauri/src/{lib,tray,auto_kill,notify,update}.rs`
  - **Qué hacer:** todo el texto está incrustado en español, en los dos lados. Es coherente con el
    producto tal como está; sacar las cadenas a un catálogo solo tiene sentido si se decide publicar
    en más idiomas.
  - **Criterio de aceptación:** decisión tomada y anotada; si se hace, ninguna cadena de cara al
    usuario queda incrustada.
  - **Esfuerzo:** alto
  - **Depende de:** ninguna

- [x] **[T4-02] Firma de código Authenticode** — ❌ **descartada** el 2026-08-18
  - **Área:** Seguridad · Distribución
  - **Ubicación:** `src-tauri/tauri.conf.json` (`bundle.windows.certificateThumbprint`)
  - **Qué hacer:** es lo que quitaría el aviso de SmartScreen y lo que permitiría una verificación
    fuerte de origen, con el SHA-256 como respaldo. Requiere un certificado de pago. Ya está
    contemplado en el roadmap histórico y en el README; se repite aquí para que la lista de deuda
    esté completa.
  - **Criterio de aceptación:** el instalador firmado no dispara el aviso de editor desconocido.
  - **Decisión (2026-08-18): descartada.** No se va a comprar certificado, así que la tarea se cierra
    en vez de quedarse abierta fingiendo que algún día se hará. Es la única de la lista cuyo
    obstáculo no es técnico: el código está previsto —`bundle.windows.certificateThumbprint` en
    `tauri.conf.json`, sin llamar a `signtool` a mano— y lo que falta es el gasto recurrente.
  - **Consecuencias, que conviene tener escritas:**
    - **SmartScreen seguirá avisando** de «editor desconocido» en cada instalación. No es un fallo
      ni una detección: le pasa a cualquier ejecutable sin certificado.
    - **El `.sha256` se queda como único mecanismo de integridad**, y eso lo hace *más* importante,
      no menos: es lo que detecta una descarga corrupta o manipulada en tránsito. Su límite sigue
      siendo el de siempre —instalador y hash salen del mismo release, así que no protege frente a
      un compromiso de la cuenta de GitHub— y por eso `release.ps1` publica el `.sha256` de cada
      instalador y la app se niega a actualizarse a un release que no lo traiga.
    - La comprobación fuerte de origen (`WinVerifyTrust`) **no se implementa**: sin certificado sería
      código muerto, y una comprobación que siempre falla enseña a ignorarla. Está dicho así en la
      cabecera de `update.rs` desde el principio.
  - **Si alguna vez cambia la decisión**, lo que hay que tocar está identificado y es poco: el
    `certificateThumbprint` del bundle y volver a redactar lo que el README promete.
  - **Esfuerzo:** medio (más el coste del certificado)
  - **Depende de:** ninguna

- [ ] **[T4-03] Medir el rendimiento de verdad**
  - **Área:** Rendimiento
  - **Ubicación:** `src-tauri/src/poller.rs`, arranque de `lib.rs`
  - **Qué hacer:** no hay ninguna medición propia del coste del ciclo (que enumera todos los procesos
    del sistema y toda la tabla de sockets cada dos segundos), del tiempo de arranque, ni del
    consumo con la app viviendo días en la bandeja. Las decisiones de diseño son correctas, pero
    nadie ha puesto una cifra.
  - **Criterio de aceptación:** las tres cifras medidas y anotadas en CONTEXT §3, con el método y la
    máquina en que se midieron.
  - **Esfuerzo:** medio
  - **Depende de:** ninguna

- [x] **[T4-04] Revisitar la decisión de no tener CI** — *revisada y confirmada el 2026-08-18*
  - **Área:** DevOps
  - **Ubicación:** CONTEXT §4 (2026-07-24, ratificada el 2026-08-18)
  - **Qué hacer:** la publicación local con `release.ps1` está asumida y documentada. Su coste real:
    nada garantiza que las pruebas pasen fuera de este equipo, y el corte depende de un entorno
    concreto (MSVC, Windows SDK) documentado solo en prosa. Un workflow que solo ejecute
    `cargo test` y `npm test` en cada push cubriría lo primero sin tocar el corte de versión.
  - **Decisión:** **no hay CI, y no la va a haber.** Todo el testing se hace en local. La tarea
    pedía revisar y anotar, no montar nada, así que se cierra con la decisión tomada en vez de
    quedarse abierta esperando un cambio de idea. Lo que el workflow habría cubierto —que las
    pruebas pasen antes de publicar— ya lo cubre el corte: desde T2-02, `release.ps1` ejecuta
    `cargo test`, `npm test`, clippy y las dos auditorías, y **aborta** si algo falla. Lo que
    queda sin cubrir es honesto decirlo: nadie comprueba que el proyecto compile en un equipo
    limpio. Cuando algo necesite un servicio de verdad para probarse, se levanta con Docker en
    local; un servidor HTTP de usar y tirar dentro de una prueba sale más barato como
    `TcpListener` (ver T3-02).
  - **Criterio de aceptación:** decisión revisada y anotada con su fecha, se cambie o no. ✅
  - **Esfuerzo:** medio
  - **Depende de:** ninguna

- [ ] **[T4-05] Dividir el bundle, solo si la medición lo justifica**
  - **Área:** Rendimiento
  - **Ubicación:** `vite.config.ts`
  - **Qué hacer:** el bundle sale en 574,92 kB de JavaScript (185,98 kB comprimido) y Vite avisa de
    que pasa de 500 kB. En una app de escritorio con los assets embebidos no hay descarga que
    optimizar: solo cuenta el parseo local. Hacerlo únicamente si T4-03 demuestra que el arranque lo
    nota.
  - **Criterio de aceptación:** o bien se mide que no importa y se cierra la tarea con esa nota, o
    bien se divide y se mide la mejora.
  - **Esfuerzo:** bajo
  - **Depende de:** T4-03

---

### Progreso

Se marca `[x]` **solo cuando está probado**, no cuando está escrito — la regla de la casa. Si algo se
probó a medias, se dice aquí qué quedó fuera.

| Fecha | Tareas cerradas | Nota |
|---|---|---|
| 2026-08-18 | — | Auditoría completada; backlog abierto con 37 tareas (0 T0 · 2 T1 · 10 T2 · 20 T3 · 5 T4) |
| 2026-08-18 | T3-20 | `coverage/` ignorado. Apareció ejecutando la cobertura durante la propia auditoría: sin ignorar, bloqueaba el corte de versión en cualquier equipo que la midiera antes de publicar |
| 2026-08-18 | T3-16, T3-17 | El README, al día antes de publicar: 52 pruebas de backend y la actualización silenciosa contada donde la lee quien decide si instalar |
| 2026-08-18 | **T2-01, T2-02, T2-04, T2-06, T2-08, T2-10** | **Seis de las diez de T2.** `shadcn` fuera de producción (0 alertas de npm), clippy y las dos auditorías atadas al corte —y `cargo audit` **encontró una vulnerabilidad real a la primera**, `h2` RUSTSEC-2026-0258, arreglada—, escritura atómica de los ajustes, error boundary, cobertura real del código propio (89,61 %) y el procedimiento de reversión escrito |
| 2026-08-18 | **Tier 9 verificado** | La actualización silenciosa, comprobada por el usuario actualizando de la v1.3.1 a la v1.3.2. Cierra además **la última salvedad abierta del proyecto**: lanzar el instalador era el único paso del actualizador que nunca había corrido de principio a fin |
| 2026-08-18 | **T1-01, T1-02** | **Tier 1 cerrado entero.** Las dos guardias que faltaban, cada una con su prueba negativa, y **las dos pruebas comprobadas con una mutación**: se quitó la guardia, se vio fallar el test y se restauró. 52 de `cargo test` (antes 49) y clippy limpio. Publicado en la v1.3.2 |

| 2026-08-18 | **T2-05, T3-02, T4-04** | **ESLint**, que el frontend no tenía y el backend sí (clippy): 148 avisos en la primera pasada, **142 de los packs de skills** y 5 reales, todos de una regla de hooks que `tsc` no puede ver. **El tope de la descarga**, que llevaba escrito sin marcar desde la auditoría: el obstáculo no era el servidor sino que el bucle vivía dentro de `download_and_verify`, detrás de la validación de URL, así que ninguna prueba lo alcanzaba. Y **la decisión de no tener CI, ratificada**: todo el testing es local, por decisión del usuario. 56 de `cargo test` (antes 53) |

| 2026-08-18 | **T2-09** | Los packs de skills **se quedan**, por decisión del usuario, y quedan documentados con sus licencias. Documentarlos destapó que `skills-lock.json` solo cubre 11 de los 18: ignorarlos habría perdido los otros 7 sin forma de reinstalarlos |

| 2026-08-18 | **T2-03** | **El log en archivo**, que era el ultimo agujero de observabilidad: en release no hay stderr, asi que los 8 avisos del proyecto no los leia nadie. Modulo propio en vez de `tauri-plugin-log`, con rotacion acotada a 1 MB y marca en UTC. Lo alimenta tambien el *error boundary* del frontend, que hasta ahora escribia a una consola que en release no existe. Rotacion comprobada con mutacion |

| 2026-08-18 | **T2-07** | **Tier 2 cerrado entero (10 de 10).** `prefers-reduced-motion`, verificado por el usuario apagando «Efectos de animación» en Windows: las barras saltan y las filas desaparecen de golpe. De paso se corrigió la ficha, que decía «encender» el ajuste cuando lo que activa la media query es **apagarlo** |

| 2026-08-18 | **Tier 3 entero (16 tareas)** | Cerrado de una tanda. Lo que no estaba en las fichas: **`tsc` a secas no construye las referencias de proyecto**, asi que meter `vitest.config.ts` en el `include` no bastaba para T3-05 — hubo que pasar el build a `tsc -b`, y eso destapo un `@ts-expect-error` que ya sobraba en `vite.config.ts` y una emision de `.js`/`.d.ts` en la raiz que **habria abortado el propio `release.ps1`**. Y T3-18 no era solo una version desfasada: al documento legal **le faltaban cuatro dependencias directas** que si van dentro del binario |

| 2026-08-18 | **v1.4.0 verificada en sitio** | El usuario actualizó de la v1.3.2 a la v1.4.0: **silenciosa**, y el registro de avisos aparece en Acerca de con su ruta real. **El propio log documenta el salto** —`v1.3.2 arrancando` y después `v1.4.0 arrancando`—, escrito por el binario instalado |
| 2026-08-18 | **v1.4.0 publicada** | Sale con la revisión entera dentro: 33 de 37. Verificada como las anteriores sobre los archivos reales del release — 4 assets, la API devuelve `v1.4.0`, y el instalador **descargado de GitHub** coincide con su `.sha256` (`a8738197…`). Comprobado además que las URLs reales de los assets pasan la guardia de origen de T1-01 |

| 2026-08-18 | **T4-02 descartada** | La firma Authenticode **no se va a hacer**: pide un certificado de pago y no se va a comprar. Se cierra con la decisión escrita en vez de quedarse abierta fingiendo que algún día se hará. Quedan anotadas las consecuencias — SmartScreen seguirá avisando y el `.sha256` es el único mecanismo de integridad, lo que lo hace más importante, no menos |

**Pendientes: 3 de 37.** Los Tiers 1, 2 y 3 están cerrados enteros; del 4 solo quedan las dos de
medición (T4-03 y T4-05, que depende de ella) y T4-01. **Dos de las cerradas del Tier 4 lo están
por decisión, no por trabajo**: no hay CI (T4-04) y no habrá firma de código (T4-02). Una tarea que
se decide no hacer está tan cerrada como una hecha, siempre que quede dicho por qué.
