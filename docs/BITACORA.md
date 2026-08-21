# 📓 Bitácora — ProcessDevKill

> Una entrada por sesión de trabajo, la más reciente arriba. **Es historia, no estado**: lo que
> está vigente hoy vive en [CONTEXT.md](../CONTEXT.md) y lo que falta, en [ROADMAP.md](../ROADMAP.md).
>
> Se separó de CONTEXT.md el 2026-07-27 (Tier 7.7): eran 180 líneas creciendo por sesión dentro del
> documento que alguien abre para saber en qué punto está el proyecto.

---

### 2026-08-18 — v1.4.0 publicada

- **Cortada con `release.ps1`**, dry run primero como manda la casa. Minor y no parche: trae
  funcionalidad nueva de cara al usuario (el registro de avisos, la pantalla de error) y cambia
  comportamiento (un solo aviso por acción).
- **El mecanismo de T3-19 se estrenó en el camino real**: el dry run anotó el `HEAD` `5c643c9`, y el
  corte con `-SkipTests` lo reconoció y omitió las pruebas nombrando ese commit. Es justo para lo
  que se escribió, unas horas antes.
- Verificado sobre los archivos reales del release, con el mismo criterio de siempre: 4 assets, la
  API que consulta la app devuelve `v1.4.0`, y **el instalador descargado de GitHub coincide con su
  `.sha256`** (`a8738197…`, 4.040.227 bytes). Comprobado además que **las URLs reales de los assets
  pasan la guardia de origen** de T1-01 — es lo único que podría romper la actualización entera sin
  notarse hasta el siguiente release.
- Notas del release escritas a mano, no la plantilla: la versión lo merecía.

### 2026-08-18 (madrugada) — Tier 3 entero, y tres arreglos que no eran lo que decía la ficha

- **Las 16 tareas del Tier 3, cerradas.** Con los Tiers 1 y 2 ya enteros, quedan **33 de 37**; lo
  que falta es solo Tier 4, lo explícitamente aplazado.
- **T3-05 no se arreglaba con lo que pedía la ficha.** Añadir `vitest.config.ts` al `include` de
  `tsconfig.node.json` no cambiaba nada: **`tsc` a secas no construye las referencias de proyecto**,
  así que el error de tipos inyectado a propósito seguía sin romper `npm run build`. Se comprobó
  inyectándolo, no leyendo. El build pasa a `tsc -b`, y de ahí salieron dos cosas más: el
  `@ts-expect-error` de `vite.config.ts` ya sobraba —con `-b` es **error** TS2578, no aviso— y
  `composite: true` **obliga a emitir**, así que `tsc -b` dejaba un `.js` y un `.d.ts` junto a cada
  config en la raíz. Eso no era ruido cosmético: **son archivos sin rastrear y `release.ps1` aborta
  con el árbol sucio**, o sea que el arreglo habría roto el corte de versión. `noEmit` no vale
  (TS6310 en un proyecto referenciado), así que la emisión va a `node_modules/.tmp/`.
- **T3-18 no era una versión desfasada: al documento legal le faltaban cuatro dependencias
  directas.** `reqwest`, `futures-util`, `sha2` y `tauri-plugin-single-instance`, todas dentro del
  binario, entraron con el actualizador y la instancia única después de generarse el archivo.
  Regenerado contra `cargo metadata` y los `package.json` **instalados**, no contra lo declarado:
  566 crates, no 515. Aparecieron dos familias de licencia sin declarar —**CDLA-Permissive-2.0**
  (`webpki-root-certs`) y la LGPL como una de tres opciones en `r-efi`, que se toma bajo MIT— y se
  anotaron. La versión de `shadcn` que declaraba el archivo, 4.14.1, **nunca estuvo instalada**.
  Atado al corte: `release.ps1` avisa si `package.json` o `Cargo.lock` son más recientes.
- **T3-19 se resuelve negándose, no avisando**, que la ficha dejaba a elección. El dry run anota el
  `HEAD` en `%TEMP%` y `-SkipTests` lo compara: sin marca o con otro `HEAD`, aborta. Un aviso se lo
  lleva el scroll y al otro lado está publicar código sin probar, que es lo único que no se deshace.
  Probados los tres casos de verdad ejecutando el script.
- **T3-12: dos notificaciones de Windows por un clic.** La bandeja y el atajo global sacaban la de
  puertos liberados y la del recuento, justo en los caminos que se usan sin ventana delante. La
  guarda de `kill_and_record` pasa de «todos menos el Auto-Kill» a **«solo la ventana»**.
- **T3-01 comprobado en los dos casos**, y con la trampa de PowerShell delante: `$env:VAR = ""`
  **borra** la variable, así que restaurar asignando no es simétrico y hay que distinguir «no
  existía» de «existía». ⚠️ Solo se ejercitó por el camino del dry run: el del release real, que es
  el único que llega a escribir el token, pediría publicar una versión.
- Un `cargo test` murió con **error 1114 del enlazador**, que es de entorno y no del código —clippy
  compiló lo mismo sin quejarse—. Repetido y en verde; se anota para no confundirlo con un fallo
  real la próxima vez.
- 175 pruebas de frontend (antes 170) y 65 de `cargo test` (antes 61). Clippy y ESLint limpios.

### 2026-08-18 (noche) — Tier 2 cerrado, y dos cosas que las pruebas no veían

- **Decisión del usuario: todo el testing es local, nada de CI, workflows ni GitHub Actions.** Para
  lo que necesite un servidor, Docker está autorizado. Cierra **T4-04** con la decisión tomada, no
  como pendiente de revisar. Anotado lo que deja descubierto: nadie comprueba que el proyecto
  compile en un equipo limpio.
- **T3-02, el tope de la descarga.** Llevaba escrito sin marcar desde la auditoría, y el obstáculo
  no era el servidor: el bucle vivía **dentro de `download_and_verify`, detrás de la validación de
  URL contra github.com**, así que ninguna prueba lo alcanzaba. Extraído a `volcar_con_tope` con el
  tope por parámetro. El servidor de prueba es un `TcpListener` en un hilo, no un contenedor —
  Docker está disponible pero aquí habría sido peor: ataría el corte de versión a que alguien
  recuerde levantar el daemon. **Necesitó un `set_write_timeout` o la prueba se colgaba**: cuando el
  tope corta, el cliente deja de leer pero el socket no se cierra hasta que el runtime vuelve a
  moverse, y para entonces el hilo del servidor ya está bloqueado con los buffers de TCP llenos.
  Se vio colgado más de un minuto antes de entender por qué.
- **T2-05, ESLint.** 148 avisos en la primera pasada, **142 de los `.cjs` de `.claude/skills/`** —
  código de terceros mirado con reglas de navegador—. Los 5 reales, todos `set-state-in-effect`.
  Tres eran estado derivado de props sincronizado con `useEffect`; reescritos al patrón que React
  documenta (ajustar durante el render). Los otros dos son cargas asíncronas al montar, donde la
  regla se equivoca. **ESLint 9 y no 10**: `jsx-a11y` declara peer hasta la 9.
- **Clippy corrigió una prueba mía:** la del tope de producción comparaba dos constantes, así que va
  en un bloque `const` y ahora **falla al compilar**, no al ejecutar.
- **T2-09: los packs de skills se quedan**, por decisión del usuario. Documentarlos destapó que
  **`skills-lock.json` solo cubre 11 de los 18**: ignorarlos —la opción que se vendía como
  reversible— habría perdido los 7 de `.claude/skills/` sin forma de reinstalarlos. Licencias en una
  sección 5 aparte de `THIRD-PARTY-NOTICES.txt`: dos Apache-2.0, nueve MIT declarado sin texto,
  **ocho sin declarar nada**, y `ui-styling` contradiciéndose consigo mismo.
- **T2-03, el log en archivo**, el último agujero de observabilidad: en release no hay stderr, así
  que los 8 avisos del proyecto no los leía nadie. Módulo propio en vez de `tauri-plugin-log`, por
  el mismo criterio con el que aquí se escribió el actualizador a mano. Rotación acotada a 1 MB, y
  **se rota antes de escribir**, porque hacerlo después dejaría el archivo por encima del tope todo
  el rato que va de un aviso al siguiente. Marca en UTC con la `Z` puesta.
- ⚠️ **El botón «Abrir la carpeta» habría fallado en la app real y las pruebas no lo habrían visto.**
  `opener:allow-open-path` está acotado a los dos avisos legales, y en las pruebas `openPath` está
  doblado. En vez de ensanchar el permiso a `$APPDATA`, lo abre Rust con una ruta que calcula él:
  la ventana no gana ningún permiso nuevo. La prueba comprueba además que `openPath` **no** se use.
- **T2-07, `prefers-reduced-motion`, verificado — y el ajuste va al revés de como suena.** La ficha
  decía «encender Efectos de animación» para comprobarlo, y es al contrario: la media query se
  activa cuando ese interruptor está **apagado**. El usuario lo comprobó con el ajuste encendido y
  reportó que todo animaba, que es exactamente lo correcto. Apagándolo, las barras saltan y las
  filas desaparecen de golpe. Corregida la redacción de la ficha. **No es verificable desde las
  pruebas ni emulando**: el doble de Motion quita las animaciones, y por CDP solo se puede leer la
  media query, no imponerla — y lo que había que probar era el eslabón que ninguna emulación
  demuestra, que WebView2 traduzca el ajuste del sistema.
- Cuatro guardias comprobadas con mutación en total esta sesión. 61 de `cargo test` (antes 53) y
  170 de frontend (antes 164). **Tier 2 cerrado entero, 10 de 10: van 17 de 37**, y no queda
  ninguna tarea con el código escrito pendiente de verificar.

### 2026-08-18 — Auditoría del repositorio, Tiers 1 y 2, y la v1.3.2 publicada

- **Revisión completa de las doce áreas** sobre el commit `15d3004` (v1.3.1): además de leer el
  código se ejecutaron `cargo test`, `npm test`, `cargo clippy -D warnings`, `npm audit`, la
  cobertura y un `git grep` de secretos. 36 hallazgos, **ninguno crítico**. El backlog quedó como
  sección de ROADMAP.md —no como documento aparte, que habría abierto un quinto sitio donde mirar—
  con IDs T0-T4 para poder citarlos en commits.
- **El patrón que salió de la revisión:** la doctrina de «un comando de Tauri acepta lo que le
  manden» estaba aplicada en dos de los tres sitios que la necesitan. Faltaba la tercera, y era la
  única que acaba ejecutando un binario.
- **T1-01.** `download_update` se fiaba de las URLs que le pasaba la ventana: el instalador se
  verificaba contra un hash que venía en el mismo mensaje, o sea que quien compusiera la llamada
  aportaba las dos mitades de la comprobación. **La validación va sobre la URL parseada, no sobre la
  cadena**: `Url::parse` normaliza los `..` y resuelve la autoridad, así que ni
  `…/releases/download/../../../evil.exe` ni `https://github.com@malo.example/…` pasan. Un
  `starts_with` de texto se habría tragado los dos — que es exactamente el fallo que ya tuvo la
  guardia de rutas con `Path::starts_with` en julio.
- **T1-02.** La guardia de PID no tenía prueba negativa: solo se ejercitaba en positivo, así que un
  refactor podía desactivarla dejando los 49 tests en verde. La prueba nueva comprueba las dos
  mitades, y la segunda es la que da valor a la primera: sin vigilar, `kill_many` se niega y el
  proceso **sigue vivo**; declarando el nombre, el mismo PID muere. Sin eso, la prueba pasaría igual
  si el proceso resultara inmatable por cualquier otro motivo.
- **Las dos pruebas se validaron con una mutación**: quitar la guardia, ver fallar el test,
  restaurarla. Una prueba negativa que nunca se ha visto fallar no prueba nada, y las dos anteriores
  de esta familia se escribieron sin ese paso.
- Comprobado contra la API real que las URLs que devuelve GitHub hoy pasan la guardia nueva. Era lo
  único que podía romper la actualización entera sin notarse hasta el siguiente release, igual que
  pasó con la canonicalización de rutas.
- 52 de `cargo test` (antes 49) y 160 de frontend. **v1.3.2 publicada** con `release.ps1` (dry run
  antes, como siempre). Patch: refuerzo sin funciones nuevas. Verificado tras publicar que el
  instalador descargado coincide con su `.sha256` (`d4030bb7…`).
- Un hallazgo salió de la propia auditoría al ejecutar la cobertura: `coverage/` no estaba ignorada,
  y `release.ps1` **aborta el corte** al encontrar archivos sin rastrear. Con el proyecto trabajándose
  desde varios equipos, era cuestión de tiempo.
- **La actualización silenciosa quedó verificada en la app en marcha**, actualizando de la v1.3.1 a
  la v1.3.2. Con eso se cierra **la última salvedad abierta del proyecto entero**: lanzar el
  instalador era el único paso del actualizador que nunca había corrido de principio a fin, y lo
  arrastrábamos desde julio porque hacía falta un release posterior al instalado.
- **Seis tareas más, del Tier 2.** La que más enseñó no fue ninguna de las que estaban en la lista:
  al atar `cargo audit` al corte de versión (T2-02) y correrlo por primera vez, **apareció una
  vulnerabilidad de verdad** —`h2` 0.4.15, RUSTSEC-2026-0258, publicada el día anterior y en el
  árbol vía `reqwest`—. 567 crates que nunca se habían contrastado contra RustSec; a la primera,
  algo. Arreglada con `cargo update -p h2`.
- **La escritura atómica de los ajustes (T2-04) se escribió mal y lo destapó su propia prueba.** La
  primera versión borraba el destino antes de renombrar, dando por hecho que en Windows
  `fs::rename` falla si el archivo existe. Se quitó el borrado para ver fallar la prueba y **siguió
  pasando**: el `rename` de Rust usa `MoveFileExW` con `MOVEFILE_REPLACE_EXISTING`. O sea que el
  borrado no defendía de nada y encima abría un instante sin ningún archivo bueno en disco — justo
  lo que la atomicidad venía a cerrar. Tercera vez en el proyecto que una suposición sobre la API
  del sistema resulta falsa al medirla, después de las dos de sysinfo.
- Las 7 alertas de `npm audit` salían todas de `shadcn`, declarado en `dependencies` (T2-01). No se
  puede quitar —`index.css` importa su `tailwind.css`— pero sí mover a `devDependencies`: el árbol
  de producción queda a cero y **el CSS compilado sale idéntico byte a byte**, que es la prueba de
  que no cambió nada de lo que se distribuye.
- El *error boundary* (T2-06) va **fuera** de `App`: dentro no se montaría si el fallo estuviera en
  el propio `App`. Y dice explícitamente que no se ha cerrado ningún proceso, porque en un gestor
  de procesos ese es el susto por defecto de una ventana que se rompe.
- La cobertura contaba los dobles de Tauri y los componentes de shadcn. Excluidos (T2-08), el código
  propio está al **89,61 %**, no al 86,14 %.
- Dos tareas se quedan **sin marcar aunque el código esté escrito**, y se dice por qué: el tope de
  descarga (T3-02) pediría un servidor de mentira que devuelva 100 MB, y `prefers-reduced-motion`
  (T2-07) pide encender el ajuste de Windows y mirar la app. Marcar `[x]` algo comprobado solo
  leyéndolo es justo lo que prohíbe la regla de la casa.

---

### 2026-08-14 — La actualización deja de pedir clics, y la v1.3.1 publicada

- El usuario reportó que al pulsar «Instalar» **salían dos ventanas**: el desinstalador de la
  versión anterior y el asistente de instalación. La app prometía en Ajustes que «volverá a abrirse
  sola» y en realidad lo dejaba haciendo clic en «Siguiente».
- La respuesta no salió de la documentación de Tauri sino **del `installer.nsi` que genera este
  propio proyecto** (`target/release/nsis/x64/`): ahí están el `${GetOptions} $CMDLINE "/UPDATE"`, el
  `${If} $UpdateMode = 1 → Goto reinst_done` que **salta la desinstalación previa** —la primera de
  las dos ventanas— y el `/R` de `.onInstSuccess`. Leerlo evitó tener que adivinar cuál de los flags
  hacía qué.
- Dos detalles que solo se ven en la plantilla: **`/R` únicamente se mira en modo silencioso o
  pasivo**, así que sin `/S` no serviría de nada; y el instalador silencioso **mata la app él mismo**
  (`CheckIfAppIsRunning`), por lo que no hay carrera con el `app.exit(0)` de `install_update`.
- **El arreglo no se puede probar en la versión que lo trae**, y se dijo antes de cortar: el
  instalador lo lanza la app instalada, así que actualizar desde la v1.3.0 aún enseña las ventanas.
  Se verá actualizando desde la v1.3.1.
- 49 pruebas de `cargo test` (antes 48) y 160 de frontend. **v1.3.1 publicada** con `release.ps1`
  (dry run antes, como siempre). Patch y no minor: arregla un comportamiento y no añade nada.
  Verificado tras publicar que el instalador descargado del release coincide con su `.sha256`
  (`121b228e…`).
- La verificación del hash falló a la primera **por el guion, no por el release**: en PS 5.1
  `Invoke-WebRequest` devolvió el `.sha256` como `byte[]` y la comparación leyó `49` —el byte de
  `'1'`— en vez del hash. Decodificando a UTF-8, coincide.

---

### 2026-08-07 — Tier 8: el medidor del entorno

- El usuario propuso llenar el hueco del sidebar con **CPU y RAM en tiempo real**. De las dos formas
  posibles se le planteó que la obvia —un medidor del equipo— **duplica el Administrador de tareas**,
  y que lo que nadie más da es cuánto de eso pone su entorno de desarrollo. Eligió esa.
- **La suposición de partida sobre sysinfo era falsa, y el primer test no lo cazó.** Se escribió el
  calentamiento del CPU global creyendo que sin muestra previa la lectura sale a 0 %, y el test de
  regresión comprobaba `> 0.0`. Al quitar el calentamiento para verlo fallar, **pasó igual**: la
  lectura real es **100 %**, que también es mayor que cero. Se midió en vez de deducirlo (100,000 %
  con la máquina al 10 %) y se reescribió el test a `< 100.0`, que sí falla.
- Medir dos veces seguidas da el mismo 100 %. De ahí que el medidor salga **solo del hilo del
  poller** —el único con ritmo conocido— y no de los demás caminos que publican la lista: emitirlo
  desde `kill_and_record` habría disparado el medidor al tope en cada cierre.
- **Cuarta vez que un fallo del guion de pruebas se lee como fallo de la app.** Dos comprobaciones en
  rojo (la RAM del entorno no subía, la fila del `node` no aparecía) eran el `Start-Process` que une
  argumentos sin entrecomillar, ya documentado en el Tier 6. El `node -e` moría al instante.
- Al escribir la verificación, el paso «matar un proceso» pulsaba «Kill» a secas, que habría cerrado
  **la primera fila de la tabla — un proceso del usuario**. Se corrigió a buscar la fila por el PID
  del `node` que lanza el propio guion. La regla no se rompe ni en un guion de usar y tirar.
- **El rótulo se leía mal, y lo cazó el usuario en el primer minuto.** «1008 MB de 15.6 GB» —lo suyo
  frente a lo que usa la máquina— con el total solo en el tooltip. Lo leyó como su RAM instalada:
  tiene 31,9 GB. Era la ambigüedad que se había identificado al diseñarlo y resuelto mal por ahorrar
  una línea. Corregido a tres líneas por métrica, con «Equipo» nombrado y la instalada a la vista.
- 160 pruebas de frontend (antes 147) y 48 de `cargo test` (antes 44), más la verificación en vivo
  sobre el binario de release por CDP.
- **v1.3.0 publicada** con `release.ps1` (dry run antes, como siempre). Minor y no patch: función
  nueva y ningún cambio de comportamiento. Verificado tras publicar que el instalador descargado del
  release coincide con su `.sha256` (`0050ae80…`).

---

### 2026-07-27/28 — Tier 7 entero, y la v1.2.0 publicada

- **Revisión completa del repositorio** sobre la v1.1.1 publicada (código, seguridad, rendimiento,
  estructura, accesibilidad, responsividad, ortografía y documentación), de la que sale el Tier 7.
  Se cerró entero: 7.1 a 7.9.
- **Un fallo de seguridad real**: la guardia de `install_update` se saltaba con un `..`, porque
  `Path::starts_with` compara componentes literales y no normaliza. Comprobado antes de tocar nada.
- **Dos fallos que encontró el usuario usando la app**: cerrar la ventana la escondía siempre en la
  bandeja, y relanzarla abría otra instancia. Se retroalimentaban — llegó a haber cuatro iconos de
  bandeja a la vez.
- `lib.rs` volvió a partirse (860 → 635 líneas) en `auto_kill`, `notify` y `poller`, y los comandos
  del actualizador se fueron a `update.rs`.
- **Documentación compactada**: el registro de sesiones salió a este archivo y CONTEXT.md bajó de 427
  líneas a 220. Una de las filas podadas afirmaba que se descartaba el modelo SHA-256 del
  actualizador — decisión revertida el 2026-07-26, o sea que describía como descartado justo lo que
  hoy se usa.
- Producto: **ordenación por columna**, estado vacío que orienta, `minWidth` de 720 a 900 px (medido:
  a 720 la tabla escondía un 26 %), y **sidebar vertical con «Procesos» plegable**, a petición del
  usuario.
- **Tres veces se leyó como fallo de la app algo que era del guion de pruebas**: usar la columna
  "Activo" como latido cuando `formatUptime` da minutos, mandar `WM_CLOSE` antes de que la app
  terminara de arrancar, y verificar sobre un binario de `cargo build --release`, que no embebe
  `dist/` y arranca apuntando al `devUrl`. Mirar qué pinta la ventana antes de creerse nada.
- **La sugerencia del IDE sobre `tsconfig.json` rompía el build.** Añadir `"ignoreDeprecations":
  "6.0"` es válido en TS 6+, pero aquí se compila con 5.8.3: `error TS5103`, salida 2, y como
  `npm run build` es `tsc && vite build`, dejaba a `release.ps1` sin poder cortar. Se quitó `baseUrl`,
  que era lo que el aviso pedía silenciar.
- **v1.2.0 publicada** con `release.ps1`. Verificado tras publicar que el instalador descargado del
  release coincide con su `.sha256`. Minor y no patch: funciones nuevas y dos cambios de
  comportamiento.
- Balance de pruebas: **101 → 147** de frontend y **35 → 44** de `cargo test`.


### 2026-07-25 (noche) — Tier 6.4, 6.5 y 6.6: se cierra el ROADMAP

- **Tier 6.4 — 98 pruebas de frontend** donde antes había cero, con Vitest + Testing Library en jsdom. La que más importa: *Escape cancela el diálogo destructivo sin confirmar*, verificada a mano en tres tiers y por fin fijada. También la búsqueda por puerto, la poda de la selección, el suelo de 256 MB y que se copia con el plugin de Tauri.
  - `src/types.test.ts` **lee el fuente de Rust** y compara las constantes espejo. `types.ts` decía ser un espejo sin que nada lo obligara.
  - **Fallo real encontrado:** los dos campos numéricos de Ajustes no tenían nombre accesible, solo `aria-describedby`. Se les añadió `aria-label`.
  - Dos tropiezos, ambos anotados en `src/test/setup.ts`: las fábricas de `vi.mock` se izan por encima de los imports (de ahí `tauri-mock.ts` aparte), y `AnimatePresence` mantiene montada la fila que sale, así que sin doblar Motion las aserciones median la animación en vez del filtro.
- **Tier 6.5 — auto-actualización** con `tauri-plugin-updater`, firma minisign y `latest.json` publicado por `release.ps1`. La comprobación del arranque va en silencio; descargar e instalar exige pulsarlo.
  - **Corregida una afirmación falsa del README**: la sección de privacidad decía que la app no tiene concedido ningún permiso de red, enlazando al `capabilities/default.json` como prueba. Con el actualizador eso quedaba desmentido por el propio archivo que se citaba.
  - El modelo de confianza se documenta con lo que **no** cubre: no sustituye a la firma de código, no protege una instalación manual, no alcanza a la v1.0.0 y depende de que la clave privada siga existiendo.
- **Tier 6.6 — `.claude/CLAUDE.md` y `.mcp.json`.** El CLAUDE.md recoge las convenciones y, sobre todo, las cinco cosas que cuestan una sesión si no se saben (PowerShell y el UTF-8, CDP, `SendKeys`, los toast y BitBlt, una sesión por repositorio).
  - **La suposición del roadmap sobre codegraph era incorrecta:** daba por hecho que el índice existía y solo faltaba conectarlo. `.codegraph/` contiene únicamente su `.gitignore`. El `.mcp.json` queda puesto, pero el índice hay que construirlo con `codegraph init`, y eso se deja al usuario.
- Verificado antes de cortar: 98 pruebas de frontend, 22 de `cargo test`, `tsc` sin errores y `release.ps1` sin errores de sintaxis.

### 2026-07-26 — Fuera minisign: el actualizador pasa a SHA-256, como FormatDiskPro

- **Decisión del usuario, y bien tomada.** Tras dos días de fricción con la clave de firma —se filtró, hubo que rotarla, la regeneración falló por estar en el directorio equivocado, y el prompt de contraseña resultó impegable— se cambia al modelo que ya funciona en FormatDiskPro: **GitHub Releases + verificación SHA-256 antes de ejecutar**.
  - El hash es **criptográficamente más débil**: no demuestra quién publicó el archivo, porque viaja en el mismo release. Está dicho tal cual en el README y en el propio `update.rs`.
  - A cambio, el esquema entero cabe en la cabeza, no hay secretos que custodiar y **no puede dejar tirados a los usuarios instalados**. Un mecanismo que nadie consigue operar acaba desactivado, y ése es el fallo más caro de los dos.
- **`src-tauri/src/update.rs`**, calcado de `UpdateService.cs`: consulta la API, elige el instalador NSIS y su `.sha256`, descarga con progreso, **verifica y solo entonces ejecuta**. Si el hash no cuadra, borra el archivo.
- Fuera `tauri-plugin-updater` y `tauri-plugin-process`; dentro `reqwest` (rustls) y `sha2`. La red la usa **solo Rust**: el frontend no tiene ningún permiso que le deje salir a internet.
- **13 pruebas nuevas de Rust** (35 en total) sobre la lógica pura, y 11 de frontend reescritas (101 en total). Las que más valen: que `is_newer` no diga que sí ante una etiqueta ilegible, y que un `.sha256` que no sea un hash de 64 hexadecimales se rechace en vez de compararse —un "404: Not Found" guardado como hash daría "no coincide", pero por el motivo equivocado—.
- **`sha2` 0.11 no vale**: es una preliberación cuya API ya no implementa `io::Write` ni `LowerHex` sobre la salida. Se fija la 0.10.
- **El `.sha256` deja de ser cortesía y pasa a ser el mecanismo.** Anotado en `release.ps1`: un release sin él hace que la app se niegue a actualizarse a esa versión.
- La clave minisign queda borrada del disco: ya no hay nada que firmar ni que custodiar.
- **Fallo latente que salió al probarlo:** el dry run murió en `cargo test` **con los 35 tests en verde**. `cargo` emite un aviso del enlazador por stderr y PS 5.1 lo convierte en `NativeCommandError` cuando la salida está capturada. El script documentaba ese peligro desde el primer día y tenía `Invoke-Git` para git, pero cargo y npm estaban desprotegidos; ahora hay `Invoke-Nativo`.
  - ⚠️ El primer arreglo **no funcionaba**: pasar un scriptblock y bajar `$ErrorActionPreference` dentro de la función no sirve, porque un scriptblock se evalúa con las variables de preferencia del ámbito donde se **definió**, no donde se invoca. Hay que ejecutar el comando dentro de la función, como hace `Invoke-Git`.
- **v1.1.1 publicada y verificada contra el release real**: 4 assets, la API responde 200, la elección de assets acierta el `-setup.exe` y su `.sha256` (no el del MSI), y el instalador descargado coincide con el hash publicado.
- **Retiradas la v1.0.0 y la v1.1.0**, releases y tags, por decisión del usuario: **la v1.1.1 pasa a ser la primera versión pública**. Ninguna de las dos podía actualizarse sola —una sin actualizador, la otra con el de minisign ya inexistente—, así que dejarlas descargables solo habría servido para instalar algo condenado a quedarse atrás. Sus URLs devuelven 404; los commits siguen en el historial y las entradas de este registro se conservan como tal.

### 2026-07-26 — Rotación de la clave de firma (histórico, ya superado)

> Se conserva porque explica por qué se abandonó el esquema de firma, y porque la lección sobre volcar secretos a la consola sigue valiendo.

- **La clave privada de la v1.1.0 quedó expuesta y hubo que rotarla.** El agente ejecutó `head -1` sobre el archivo creyendo que leería solo la línea de comentario; el archivo es **una sola línea de base64**, así que volcó el secreto entero a la conversación. Sin contraseña —como se había decidido el día anterior— tener el archivo es poder firmar.
  - **Riesgo real, medido:** para empujar una actualización maliciosa hacía falta *además* poder publicar assets en el repo de GitHub, porque el endpoint va por HTTPS contra `github.com`. La clave sola no bastaba. Pero la firma existe justo para el caso en que los archivos de GitHub sí se manipulen, y esa capa dejó de valer.
  - **Se rotó de inmediato** porque el coste crece con el tiempo: cada instalación lleva grabada la pública con la que nació, así que rotar obliga a reinstalar a mano. Con la v1.1.0 recién publicada, eso era casi nadie.
- **La clave nueva lleva contraseña**, que es la lección: el esquema anterior confiaba todo a que el archivo no se filtrara, y se filtró. `release.ps1` la pide por consola sin eco y la valida firmando un archivo de prueba antes de compilar.
- **Tres cosas que costaron encontrarse durante la rotación**, y que no eran lo que parecían:
  - El primer intento de regenerar **no llegó a ejecutarse**: la terminal estaba en `C:\WINDOWS\system32` y `npm run` no encontró el `package.json`. El error de npm es de ruta, no de la clave, y despista.
  - Aun así el archivo de la clave **había cambiado y contenía 500 bytes que no eran una clave válida** (no empezaba por el `untrusted comment:` que debe). Se detectó comparando el formato, no el tamaño.
  - Y sobre todo: la **`.pub` conservaba la fecha vieja**. Comprobar eso fue lo que evitó escribir en `tauri.conf.json` la clave pública del par comprometido, que habría dejado a la app rechazando sus propias actualizaciones. Se verificó en un directorio temporal que `-f` sí regenera la pública, así que la causa era el intento fallido, no el flag.
- **Regla nueva, en CLAUDE.md:** nunca volcar el archivo de la clave a la consola. Para identificarla está el `key id` de la **pública**, que no es secreto.

### 2026-07-26 — v1.1.0 publicada, con dos tropiezos que casi la estropean

- **v1.1.0 publicada** con 6 assets. El corte falló **dos veces** antes de salir, y las dos merecen quedar escritas porque ninguna daba un error claro:
  - **`createUpdaterArtifacts` viene a `false` de fábrica.** Con el plugin configurado y la clave en el entorno, `tauri build` compiló los dos instaladores **sin firmar y sin quejarse**. Lo cazó la comprobación de `release.ps1` («si no aparece el `.sig`, para»), con el release ya a medio camino. Sin esa guardia se habría publicado un `latest.json` cuya firma no existía, y no se habría notado hasta que alguien intentara actualizarse.
  - **En PowerShell, `$env:VAR = ""` borra la variable.** No la deja vacía: la elimina, porque `SetEnvironmentVariable` trata la cadena vacía como `$null`. Como la clave se generó sin contraseña, Tauri necesitaba un `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` vacío; al desaparecer, el CLI decidió preguntar por consola y **el build se quedó colgado indefinidamente**, sin error y sin salir. Se arregla lanzando el build con `ProcessStartInfo.Environment`, que sí admite el valor vacío; de paso la clave ya no toca la sesión de quien ejecuta el script.
- Antes de reintentar se **borró a mano el `.sig`** creado durante el diagnóstico: dejarlo habría hecho pasar la comprobación sobre un artefacto viejo, que es una verificación falsa.
- **Verificación posterior a la publicación** (detalle en ROADMAP §Tier 6.5): endpoint 200 con la versión correcta, URL del instalador 200 con el tamaño exacto, las tres copias de la firma idénticas, el `key id` de la firma igual al de la clave pública compilada en el binario, y la app en ejecución contestando «Ya tienes la última versión».
- Para esa última prueba se abrió el puerto de depuración en `tauri.conf.json`, y se restauró después **cerrando antes la app**: al revés, Tauri detecta el cambio y la reinicia en mitad de la limpieza. `git status` quedó limpio.

### 2026-07-25 — Tier 6.3: README de producto, capturas y FUNDING

- **README reescrito de 5 a 12 secciones**: el problema que resuelve (con el `EADDRINUSE` delante), qué hace, capturas, descarga e instalación, SmartScreen, verificación del `.sha256` —diciendo también qué **no** protege—, privacidad, arquitectura con diagrama Mermaid, stack, desarrollo, estructura, estado y licencia.
- **`tools/capture-screenshots.ps1`**: lanza `tauri dev` con el puerto de depuración, conduce la ventana por CDP y guarda cuatro PNG en `docs/screenshots/`. Toca `tauri.conf.json` para abrir el puerto y restaura los bytes originales en el `finally`; **cierra la app antes de restaurar**, porque si no Tauri detecta el cambio y reinicia la app en mitad de la limpieza.
- El script levanta dos servidores Node de verdad (3000, y 8080 con carga) para que la columna de puertos y las barras de CPU enseñen algo, y los cierra al acabar. También devuelve el tema a como estaba: cambiarlo es un ajuste del usuario, no un efecto secundario aceptable.
- Cuatro tropiezos que costaron sus vueltas, todos anotados en el propio script:
  - `Emulation.setDeviceMetricsOverride` **no encoge** el viewport si ya había uno más alto: la captura en claro salió con el alto de la de Ajustes. Se limpia el override antes de fijar el nuevo y la única captura alta va la última.
  - `Start-Process` une los argumentos con espacios y **no entrecomilla nada**: el `node -e "…const t=…"` llegaba partido por el primer espacio y moría con *Unexpected end of input*.
  - `.GetAwaiter().GetResult()` sobre un `Task` no genérico **emite un `VoidTaskResult`**: `return $ws` devolvía un array de dos elementos y el `SendAsync` fallaba con un error incomprensible.
  - Para el clic derecho se usan eventos de ratón de CDP, pero para pulsar botones se usa `element.click()`: React responde igual y no hay que acertarle a un botón que puede estar fuera del área visible, que es el fallo de la sesión anterior.
- **`.github/FUNDING.yml`** con el mismo destino que FormatDiskPro.
- Verificado: 22 pruebas de `cargo test` en verde, la app queda como estaba (`tauri.conf.json` sin tocar según `git status`, `settings.json` con `"theme": "system"`) y no sobrevive ningún proceso del script.
- **Detalle que faltaba del Tier 6.2:** el remoto local de esta carpeta seguía apuntando a la URL vieja. Queda anotado en §3 con el comando; el intento de cambiarlo desde la sesión lo bloqueó el clasificador de permisos.

### 2026-07-24 (noche) — Tier 6.1: licencia GPL-3.0 y avisos de terceros

- **GPL-3.0** elegida por el usuario, la misma que FormatDiskPro. `LICENSE` en la raíz, `license = "GPL-3.0-only"` en `package.json` y `Cargo.toml`, y sección de licencia en el README.
- `THIRD-PARTY-NOTICES.txt` con lo que el instalador **empaqueta**, no con todo `node_modules`: las herramientas de compilación no viajan dentro del binario y meterlas solo habría inflado el archivo.
- Dos cosas que salieron al reunir los datos y que no se sabían:
  - La tipografía **Geist va embebida** en la app y su **OFL-1.1 obliga** a distribuir el aviso de copyright con ella. Es la única dependencia con una obligación que no se cumple sola.
  - De los **515 crates** del árbol, **5 son MPL-2.0**. Es compatible con GPLv3 y su copyleft es por archivo; se usan sin modificar, así que no arrastran nada. Ninguna licencia del árbol es incompatible con la GPLv3, y como Apache-2.0 solo es compatible con la **v3** (no con la v2), la elección queda confirmada.
- **Los avisos viajan ya dentro del instalador**: `LICENSE` y `THIRD-PARTY-NOTICES.txt` como `bundle.resources`, más una sección **Acerca de** en Ajustes que los abre y enlaza al repositorio. Dos cosas que costaron encontrarlas:
  - La licencia se empaqueta renombrada a **`LICENSE.txt`**. Sin extensión, Windows no tiene asociación y pulsar el botón no hacía nada visible; el formato de mapa de `resources` permite renombrar al copiar, y el repositorio conserva `LICENSE` como espera GitHub.
  - **`opener:default` no incluye `open_path`**, solo `open_url`. Se concede aparte y con ámbito acotado a esos dos archivos.
- Aviso para verificar por CDP: la sección quedaba **por debajo del área visible** y los clics sintéticos no llegaban al botón. Hay que hacer `scrollIntoView` antes de calcular las coordenadas; si no, parece que la app no responde cuando el problema es la prueba.

### 2026-07-24 (noche) — Tier 5.6: v1.0.0 publicada, y Tier 6 abierto

- **`release.ps1` reescrito para este proyecto.** Se conserva del de FormatDiskPro lo que valía —`Invoke-Git` con su lección del `NativeCommandError`, validación de tags, rechazo de archivos sin rastrear, `-DryRun`, reutilización de la credencial de `gh`— y se cambia lo propio de Tauri: bump en los **tres** sitios más `cargo check` para que `Cargo.lock` no ensucie el árbol, `cargo test` + `npm run build` en vez de `dotnet test`, `npm run tauri build` en lugar del `build-installer.ps1` y los `.sha256` generados por el propio script. Fuera el bloque de `-UiTests`, la elevación y la USB.
- Corregido el texto heredado: aquí el `.sha256` es **cortesía**, no un requisito, porque no hay auto-actualización que lo verifique.
- **v1.0.0 publicada** (0.1.0 → 1.0.0: primera versión pública de una app completa y verificada en Windows). Commit `073209b`, tag `v1.0.0`, cuatro assets.
- Tres tropiezos, todos de PowerShell 5.1, anotados en el propio script: escapar comillas con `\"` cierra la cadena; las comillas tipográficas `“ ”` **también** las trata como delimitador; y un `.ps1` sin BOM se lee como ANSI, pero añadir el BOM dos veces deja un `U+FEFF` suelto que rompe el parser.
- **Tier 6 creado** tras comparar el repo con FormatDiskPro. Lo que falta, por orden: licencia y avisos de terceros (bloqueante), renombrar el repositorio, README de producto con capturas, pruebas del frontend, auto-actualización y herramientas del repo.

### 2026-07-24 (noche) — Tier 5.5: instaladores

- Metadatos de paquete en `tauri.conf.json` (`publisher`, `copyright`, `category`, descripciones) y autor real en `Cargo.toml`: **Ricky Angel Jiménez Bueno**. Sin esto el instalador sale sin autor.
- NSIS en modo `currentUser`: instala en `%LOCALAPPDATA%\ProcessDevKill` sin UAC. `npm run tauri build` produce el `.exe` de NSIS (2,44 MB) y el `.msi` de WiX (3,54 MB).
- Instalada y probada de verdad: arranca con su icono, lista procesos y responde.
- **Cerrada la salvedad del atajo global** pulsándolo de verdad (ver §3). El detalle que costó descubrirlo: `SendKeys` no dispara un atajo de `RegisterHotKey`, hace falta `keybd_event`.
- **Cerrada también la salvedad de las notificaciones**: el toast se ve, con icono y texto correctos. Antes se concluyó en falso que no salía, por comprobarlo con capturas por código; BitBlt no recoge los toast (ver §3).
- Aviso para futuras sesiones: **no reescribir estos `.md` con PowerShell 5.1**. `Get-Content -Raw` los lee con la página de códigos ANSI y, al guardarlos como UTF-8, deja todos los acentos y emojis destrozados. Pasó en esta sesión y hubo que revertir el doble encoding a mano. Para editarlos, herramientas que respeten UTF-8.
- La app quedó **instalada** en el equipo. Para quitarla: *Configuración → Aplicaciones → ProcessDevKill*, o el `uninstall.exe` de `%LOCALAPPDATA%\ProcessDevKill`.

### 2026-07-24 (noche) — Tier 5.4: Zombie Finder

- `ZombieWatch` en `processes.rs` recuerda desde cuándo lleva cada PID sin consumir CPU. Era lo que le faltaba a la app: cada `collect_processes` es una foto sin pasado.
- Un proceso es zombi si lleva parado los minutos configurados **y además ocupa un puerto**. Sin la segunda condición la función no sirve: en la máquina de pruebas, 7 de 10 procesos `node` marcan 0 % de CPU estando perfectamente sanos.
- `ProcessInfo` gana `idleSecs` y `zombie`; la regla la decide Rust y la UI solo la pinta (fila en ámbar + insignia con el tiempo y el puerto en el `title`).
- `read_list` unifica lectura y marcado, así que el refresco manual, el hilo y el evento posterior a un cierre pintan lo mismo.
- Seis tests nuevos (22 en total). Uno de ellos cazó un fallo real: `track` no limpiaba la marca anterior, de modo que un proceso que volvía a trabajar seguiría resaltado si la lista se reutilizaba. La marca es un dato calculado, no acumulado.
- Verificado en vivo el ciclo entero, con el umbral en 1 minuto: se marca al cumplirlo, un proceso ocupado al 9,4 % nunca se marca, y al darle 65 000 peticiones al servidor parado pierde la marca en el refresco siguiente. Detalle en ROADMAP §Tier 5.4.

### 2026-07-24 (noche) — Tier 5.4: Auto-Kill por umbral de RAM

- Ajustes nuevos `autoKillEnabled` (false de fábrica) y `autoKillMb` (2048), con sección propia en Ajustes: interruptor, campo de MB y la advertencia de que cierra sin preguntar.
- La vigilancia vive en el hilo que ya emitía `processes-updated`: `watch_cycle` lee la lista una vez, deja actuar al Auto-Kill y publica. Con el refresco en "Off" se sigue vigilando cada 2 s sin publicar nada.
- Todo cierre automático pasa por `kill_and_record` con el origen nuevo `KillSource::Auto`, así que registra historial y refresca la UI como el resto. La notificación la compone el Auto-Kill (motivo, MB y puertos liberados) y por eso se calla la de puertos, que si no saldrían dos seguidas.
- Tres tests nuevos (16 en total): el criterio del umbral con números exactos, el suelo de 256 MB y el formato de memoria de la notificación, que debe coincidir con el de la tabla.
- Verificado con procesos `node` de mentira de 600 MB creados a propósito: mueren solos, los 7 `node` reales de la máquina no se tocan, el puerto se libera y el historial lo marca como Auto-Kill. Detalle en ROADMAP §Tier 5.4.
- Un fallo de diseño detectado al probarlo: el campo del umbral estaba deshabilitado hasta encender el interruptor, lo que obligaba a armar el Auto-Kill con el valor por defecto para poder cambiarlo. Ahora es editable siempre.
- Falsa alarma que conviene no repetir: los interruptores parecían no moverse al encenderse. Tailwind v4 usa la propiedad CSS `translate`, no `transform`; medido en el DOM, el pulsador pasa de 1 px a 15 px y cambia de color.

### 2026-07-24 (tarde) — Cierre del Tier 5.1-5.3: segunda verificación y pulido

> Sesión de repaso: dos sesiones de Claude Code trabajaron el mismo tier a la vez sobre este repo y se pisaron los archivos. Quedó una sola y esta entrada recoge lo que se comprobó y arregló después. **Lección: una sesión por repositorio**; dos agentes editando en paralelo se sobrescriben sin darse cuenta y el `tauri dev` de uno reinicia la app que el otro está inspeccionando.

- **Verificación repetida desde cero** sobre la app recién compilada, porque los componentes se habían tocado después de la primera pasada. Detalle en ROADMAP §Tier 5.7. Lo que más importa: Escape sigue cancelando el diálogo destructivo sin matar nada, y confirmar mata de verdad, libera el puerto, avisa con el toast y lo registra en el historial.
- **La bandeja ya usa `pids_of_runtime`.** Repetía el filtro por su cuenta, así que la función —y el test que la cubre— no protegían realmente al menú de la bandeja, que es el camino que mata procesos sin ventana delante. Ahora el test vale para lo que dice que vale.
- **Textos en singular.** Cerrar un solo proceso decía "Se terminaran los 1 procesos seleccionados".
- **`Checkbox` de shadcn** en la tabla: la casilla nativa era un cuadrado blanco macizo sobre el tema oscuro.
- `cargo build` queda sin avisos de código muerto (`BUILT_INS` es de test, y `Runtime` solo lo usaba el módulo de tests de `lib.rs`).
- Retirado de `tauri.conf.json` el `additionalBrowserArgs` con el puerto 9222 que hacía falta para inspeccionar la UI.

### 2026-07-24 — Tier 5 (puntos 1-3): nombre, tema, shadcn/ui e icono
- **La app pasa a llamarse ProcessDevKill.** Cambiados `productName`, título de ventana, menú y tooltip de la bandeja, título de la notificación, crate de Rust (`processdevkill_lib`), paquete npm e identificador (`com.processdevkill.app`). Los ajustes viven ahora en `%APPDATA%\com.processdevkill.app\`.
- **Tema claro/oscuro** con las variables de shadcn, pero con paleta propia para conservar el azul oscuro de los tiers anteriores. Selector Sistema/Claro/Oscuro en Ajustes, persistido en `settings.json`; `src/theme.tsx` aplica la clase `dark` y escucha `prefers-color-scheme` cuando el modo es "Sistema".
- **shadcn/ui** inicializado (estilo `base-nova`, sobre **Base UI**, no Radix). El diálogo de confirmación pasa a `AlertDialog`, cada fila tiene `ContextMenu` y los avisos van por **Sonner**. Se reescribió `sonner.tsx` para no depender de `next-themes`.
- **Portapapeles:** el menú contextual copia PID, nombre, puertos y `http://localhost:PUERTO`. Se descubrió al probarlo que `navigator.clipboard.writeText` falla con `NotAllowedError: Document is not focused`, así que se añadió `tauri-plugin-clipboard-manager` (solo permiso de escritura).
- **Icono propio** desde `app-icon.svg`. Dos tropiezos: un degradado no pinta sobre una línea de ancho cero (hay que usar `gradientUnits="userSpaceOnUse"`), y el adorno `>` que llevaba la primera versión era un borrón a 16 px.
- Dos ajustes de estética salidos de mirar la captura: las tres pestañas del sidebar no cabían en 208 px y "Ajustes" se salía por el borde; y el rojo del `variant="destructive"` de shadcn es demasiado tenue para el botón que cierra toda la lista.
- Verificado sobre la app en ejecución (ver ROADMAP §Tier 5.7): tema en los dos sentidos y persistido en disco, menú contextual con sus cinco opciones, copia real al portapapeles de Windows (`Get-Clipboard` lo confirma) y **Escape sigue cancelando el diálogo sin matar ningún proceso**.
- 13 tests de `cargo test` (antes 12): el nuevo fija que un `settings.json` de una versión anterior, sin el campo `theme`, se sigue leyendo en vez de descartarse entero.

### 2026-07-23 (noche) — Tier 4 completo
- `lib.rs` dividido en cuatro módulos antes de crecer más; los tests subieron de 7 a 12 al poder probar cada pieza por separado.
- Persistencia propia en `%APPDATA%\com.processvisor.app\{settings,history}.json`. Un JSON corrupto degrada a valores por defecto en vez de impedir el arranque, con test que lo cubre.
- Vistas nuevas de Historial y Ajustes, con navegación en el sidebar.
- El frontend ya no hace polling: Rust emite `processes-updated` desde un hilo propio.
- Atajo `Ctrl+Alt+K` con interruptor en Ajustes. Verificado por registro/liberación, sin dispararlo (habría matado los procesos reales del equipo).

### 2026-07-23 (noche) — Tier 3 completo
- Puertos por PID con el crate `listeners` 0.6, filtrando TCP en escucha y deduplicando IPv4/IPv6. Columna "Puerto" en la tabla y búsqueda por número de puerto.
- Notificaciones nativas desde Rust al liberar puertos; plugin registrado y permiso `notification:default` añadido.
- System tray con menú (Mostrar / Cerrar todos los Node·Python·.NET / Salir), clic izquierdo restaura la ventana, y cerrar la ventana la esconde en la bandeja.
- Verificado que la detección de puertos distingue escucha de conexión saliente, y que `WM_CLOSE` esconde la app sin matarla.
- Dos tests nuevos: puertos sobre sockets reales y selección de PIDs por runtime (la del menú de la bandeja, que si se equivoca mata procesos sin ventana abierta para verlo).

### 2026-07-23 (noche) — Tier 2 completo
- Backend: comando `kill_processes` para lotes, con resultado por PID.
- Frontend: iconos SVG por runtime, barras de CPU/RAM, animaciones de salida con Motion, auto-refresco conmutable (Off/2s/5s), buscador por nombre o PID, selección múltiple y "Nuke All" con diálogo de confirmación.
- Código repartido en `src/icons.tsx`, `src/components/{UsageBar,ConfirmDialog,ProcessTable}.tsx` y `src/types.ts` (helpers de formato compartidos).
- Verificado end-to-end vía CDP, incluida la parte que más importa: **Escape cancela el diálogo sin matar nada**, y confirmar sí mata los procesos de verdad.

### 2026-07-23 (tarde) — Tier 1 desbloqueado, verificado y con un bug corregido
- Reparado el toolset MSVC añadiendo el componente de C++ (ver §3). `cargo` ya compila.
- **Bug encontrado y corregido: todos los procesos reportaban 0 % de CPU.** Los tests iniciales no lo cazaron porque los procesos de la máquina estaban ociosos y 0 % parecía plausible; se descubrió al lanzar un proceso `node` quemando un núcleo a propósito. Causa: `System::new()` deja vacía la lista de CPUs y sysinfo multiplica por `cpus.len()`. Añadido `reporta_cpu_de_un_proceso_ocupado` como test de regresión.
- Descubierto además que sysinfo necesita **tres** muestras para dar un porcentaje real; el calentamiento pasó de una a dos muestras previas.
- Añadidos tests de lectura del sistema real y del contrato JSON con `src/types.ts`. Total: 5 tests en verde.
- Verificación end-to-end sobre la app en ejecución, inspeccionando el DOM real vía CDP: la tabla lista 13 procesos `node` con datos correctos y el botón "Kill" mata un proceso de verdad.

### 2026-07-23 — Tier 1 implementado, bloqueado en compilación
- Instalado Rust 1.97.1 vía `rustup` (no estaba en el equipo).
- Proyecto creado con `create-tauri-app` (React + TS + Vite), renombrado a ProcessVisor (nombre provisional; en el Tier 5 pasó a ProcessDevKill), y Tailwind v4 configurado. `npm run build` pasa.
- Backend `src-tauri/src/lib.rs`: comandos `get_processes` y `kill_process` con `sysinfo` 0.39, más dos tests de la función `classify`.
- Frontend `src/App.tsx`: sidebar con filtros por runtime, botón de refresco y tabla con nombre, PID, CPU, RAM, tiempo activo y botón Kill.
- `git init` + primer commit.
- **La API de `sysinfo` que devolvió la documentación indexada era incorrecta** (mostraba `System::new_all()` devolviendo `Result`). Se verificó contra el código fuente real del crate en `~/.cargo/registry`. Conviene repetir esa comprobación en futuras actualizaciones del crate.
- 🚧 Bloqueado: el toolset MSVC del equipo está incompleto y `cargo` no enlaza. Ver §3.

### 2026-07-23 — Planificación inicial
- Se revisó y verificó técnicamente la idea original del roadmap (correcciones: Tailwind v4, Motion, crate para puertos, estrategia de CI).
- Se crearon `ROADMAP.md` (plan verificado) y `CONTEXT.md` (este documento).
