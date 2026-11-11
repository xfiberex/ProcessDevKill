# Product

<!-- impeccable:product-schema 1 -->

> Para quién es ProcessDevKill y qué la hace distinta: lo que leen las herramientas de diseño
> antes de tocar la interfaz. Los títulos de sección van en inglés porque la skill `impeccable`
> los lee por su nombre. Lo confirmado con el usuario el 2026-11-11 lo dice; el resto sale del
> README, de CONTEXT y del ROADMAP.

## Platform

web

## Users

**Desarrolladores en Windows, de cualquier stack y nivel**: es un producto público, no la
herramienta de un equipo concreto (confirmado el 2026-11-11). Lo que tienen en común es levantar
procesos de desarrollo —un servidor de Vite o Next, `uvicorn`, `dotnet watch`, un backend en
Java, Deno o Bun— que se quedan vivos y ocupando puertos. Saben qué es un proceso y qué es un
puerto; no se puede dar por sabido que conocen `netstat`, que recuerdan un PID o que saben cómo
arranca un servicio de Windows.

**Las dos situaciones de uso pesan igual** (confirmado el 2026-11-11):

- **De rescate.** Algo choca —`EADDRINUSE :::3000`—, se abre la app, se encuentra quién tiene el
  puerto, se cierra y se vuelve al editor. Sesiones de segundos, con prisa y con el error todavía
  en la terminal de al lado.
- **De fondo.** La app se queda abierta todo el día en un lateral o en un segundo monitor, y se
  mira de reojo qué corre y cuánto gasta.

## Product Purpose

Responder a «¿quién tiene el puerto?» sin leer de más, y cerrar lo que sobra sin equivocarse.

ProcessDevKill lista los procesos de desarrollo activos —Node, Python, .NET, Java, Deno, Bun y los
ejecutables que añada el usuario— con su CPU, su RAM, su tiempo activo y sus puertos TCP en
escucha, y los cierra de uno en uno, por selección o todos a la vez («Nuke All»). Con los
servicios de desarrollo de Windows —SQL Server, PostgreSQL, MySQL, MongoDB, Redis, Docker e IIS—
hace lo mismo: los arranca, los detiene y les cambia el tipo de arranque, y anota lo que cambió
para poder deshacerlo.

**El éxito** es ir del síntoma al proceso cerrado en segundos, sin abrir una terminal, y no cerrar
nunca algo que no se quería cerrar.

## Positioning

El Administrador de tareas enseña veinte `node.exe` idénticos y no dice cuál escucha en el 3000.
ProcessDevKill pone **el puerto en su columna** y, debajo de cada proceso, **el script y la carpeta
del proyecto** (`vite · mi-web`), con el botón de cerrar al lado.

Su medidor no repite el del sistema: dice **cuánto de la CPU y la RAM del equipo pone el entorno de
desarrollo**. Y Zombie Finder resalta lo que lleva minutos sin usar CPU **y sigue ocupando un
puerto**.

## Operating Context

- **App de escritorio solo para Windows 10 y 11 (x64)**: Tauri 2, con la interfaz en WebView2. La
  interfaz es web por dentro, pero quien la usa espera una aplicación de Windows. Las referencias
  del género son el Administrador de tareas, Process Explorer y Docker Desktop.
- La ventana abre a 1000×680 y no baja de 900×480. Se usa también maximizada en monitores anchos,
  y con el zoom de la ventana entre el 125 y el 200 %.
- Cuatro vistas: **Procesos, Servicios, Historial y Ajustes**, esta última en seis secciones.
- Fuera de la ventana: el icono de la bandeja, un atajo global y el Auto-Kill por umbral de RAM,
  los tres apagados de fábrica. Lo que se cierra desde ahí avisa con una notificación nativa de
  Windows.
- Convive con la terminal y el editor: se llega desde un error de puerto en otra ventana y se
  vuelve a ella.
- Instancia única. Cerrar la ventana cierra la app, salvo que el usuario active la bandeja.
- Corre sin privilegios. Windows pide administrador (UAC) solo al tocar un servicio, y sin elevar
  la app dice lo que no puede ver.
- Tema claro, oscuro o el de Windows, y compatible con los temas de contraste.

## Capabilities and Constraints

- **Cerrar un proceso no se deshace**, y buena parte de la interfaz existe para no equivocarse: el
  lote y Nuke All piden confirmación; Supr sobre una fila pregunta antes de cerrar; mientras el
  puntero o el teclado están en la tabla, las filas no cambian de sitio; y los **procesos
  protegidos** —por ejecutable, script o carpeta— no los cierra nada de la app. Los críticos de
  Windows (`svchost`, `csrss`, `explorer`…) ni siquiera se pueden vigilar.
- Historial de cierres con su origen: la ventana, la bandeja, el atajo o el Auto-Kill.
- La lista la empuja el backend cada pocos segundos; la interfaz escucha, no pregunta.
- La app avisa de las versiones nuevas, pero descargar e instalar lo lanza siempre el usuario, con
  las notas delante; el instalador se comprueba contra su SHA-256. Los instaladores no están
  firmados, y está decidido que no lo estarán.
- **Privacidad visible, obligatoria** (confirmado el 2026-11-11): nada de lo que la app lee sale
  del equipo —la única petición propia es la comprobación de actualizaciones, y se puede apagar—,
  y la interfaz **nunca enseña la línea de comandos entera**, solo el nombre del script y el último
  tramo de la carpeta.
- **Un solo vocabulario en los dos idiomas, obligatorio** (confirmado el 2026-11-11): «Kill» y
  «Nuke All» en inglés también en español, y «cerrar» / «close» para todo lo demás. La regla exacta
  vive en [.claude/CLAUDE.md](.claude/CLAUDE.md); aquí solo consta que es vinculante.
- Solo Windows: no hay versión de macOS ni de Linux, y no se planea.

## Brand Commitments

- Nombre: **ProcessDevKill**. Icono: [app-icon.svg](app-icon.svg).
- El lema del README: «El puerto 3000 está ocupado y no sé por quién.»
- **La voz** es directa y concreta, sin adornos: dice qué pasa y también qué no se sabe. Sin
  permiso para leer la RAM de un servicio, la columna enseña «—» con su explicación, nunca un
  «0 MB» que el usuario se creería.
- **Español e inglés en igualdad**, en la ventana, la bandeja, las notificaciones y los errores. El
  inglés es en-US y tiene su propia puntuación; las reglas, en `.claude/CLAUDE.md`.
- **Se tiene que sentir una aplicación de Windows, no una página web** (obligatorio, confirmado el
  2026-11-11; es el objetivo del Tier 14 del ROADMAP).

## Evidence on Hand

- Capturas reales en [docs/screenshots/](docs/screenshots/): procesos en claro y en oscuro, el menú
  contextual, servicios y ajustes. Las genera `tools/capture-screenshots.ps1` con los procesos y
  servicios del equipo, sin retocar.
- [README.md](README.md) y los dos CHANGELOG, en español y en inglés, describen cada función.
- Medidas de la interfaz reproducibles con `tools/auditoria-ui.mjs`: tamaños de ventana, zoom,
  orden de tabulación, `forced-colors`, axe y recortes. La auditoría de diseño del 2026-10-03 está
  en el Tier 14 del [ROADMAP](ROADMAP.md).
- **No hay** testimonios, cifras de usuarios ni de descargas, comparativas con otras herramientas
  ni prensa. No se inventan.

## Product Principles

1. **El puerto, a la vista.** Lo que no da nadie más —qué proceso tiene qué puerto y de qué
   proyecto es— se ve sin buscarlo.
2. **No cerrar lo que no se quería.** Lo irreversible pregunta, lo protegido queda fuera y la
   tabla no se mueve debajo del puntero.
3. **Una app de Windows antes que una página.** Lo que el sistema y el género dan por hecho
   —teclado, menús, tamaños de ventana, temas de contraste, barra de título— va por delante de
   cualquier expresión propia.
4. **Decir lo que no se sabe.** Sin permiso o sin dato, la interfaz lo dice en vez de enseñar un
   cero.
5. **De rescate y de fondo.** Se lee en segundos y con prisa, y aguanta abierta todo el día sin
   cansar.

## Accessibility & Inclusion

Obligatorio para cualquier trabajo de diseño (confirmado el 2026-11-11):

- **WCAG 2.x AA como suelo**: texto a 4,5:1, y bordes de control y anillo de foco a 3:1.
- **Todo se hace con teclado.** La tabla de procesos es una sola parada de tabulador y dentro se
  anda con las flechas. Lo que hace desaparecer el elemento con el foco lo lleva a otro sitio,
  nunca a `body`.
- **Zoom hasta el 200 %** sin que la acción de cada fila quede detrás del scroll.
- **Temas de contraste de Windows** (`forced-colors`): nada se comunica solo con un color de fondo.
- **Lector de pantalla**: cada fila se anuncia con su nombre, su script y sus puertos.

Cómo se cumple cada punto en el código, en [.claude/CLAUDE.md](.claude/CLAUDE.md) (Frontend).
