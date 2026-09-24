# 📋 CONTEXT.md — ProcessDevKill

> **Documento vivo.** Responde a **en qué estado está el proyecto y por qué se decidió así**, para
> poder retomarlo desde cualquier equipo sin perder información. Se actualiza al final de cada sesión
> o cuando se toma una decisión relevante.
>
> Los otros tres: el plan por fases y lo que enseñó cada uno, en [ROADMAP.md](ROADMAP.md); las
> convenciones de trabajo, en [.claude/CLAUDE.md](.claude/CLAUDE.md); y la historia sesión a sesión,
> en [docs/BITACORA.md](docs/BITACORA.md). **Cada cosa vive en uno solo**, y los demás enlazan.

---

## 1. Qué es este proyecto

**ProcessDevKill** es una aplicación de escritorio (Windows primero, macOS después) para desarrolladores que lista los procesos de desarrollo activos (`node`, `python`, `dotnet`, …), muestra su consumo de CPU/RAM y **qué puerto local ocupa cada uno**, y permite matarlos individualmente o en lote. Resuelve el clásico "el puerto 3000 está ocupado y no sé por quién".

## 2. Stack tecnológico

| Capa | Tecnología | Notas |
|---|---|---|
| Shell de escritorio | **Tauri 2** | Rust backend + webview |
| Frontend | **React + TypeScript + Vite** | Plantilla oficial de `create tauri-app` |
| Estilos | **Tailwind CSS v4** | Vía plugin `@tailwindcss/vite` (sin config file) |
| Animaciones | **Motion** (`motion/react`) | Ex Framer Motion |
| Componentes UI | **shadcn/ui** (estilo `base-nova`) | Sobre **Base UI**, no Radix; Toast = **Sonner** |
| Info de procesos | crate **`sysinfo`** | Lista, CPU, RAM, kill |
| Puertos por PID | crate **`listeners`** (o `netstat2`) | `sysinfo` no cubre puertos |
| Plugins Tauri | `notification`, `global-shortcut`, `clipboard-manager` | + feature `tray-icon` |
| Publicación | `release.ps1` local + `gh` | El corte es local; ver §4 (2026-07-24) |
| CI | **GitHub Actions** (`.github/workflows/ci.yml`) | Solo comprueba, no publica; ver §4 (2026-09-23) |

## 3. Estado actual

**Tiers 1 a 10 completos y verificados. El 11 —la auditoría de UX/UI del 2026-09-23— lleva
hechas las fases A, B y C.** La A, la de riesgo, el 2026-09-23: el atajo global apagado y con dos
pulsaciones, cada fila con su script y su carpeta, procesos protegidos, el tipo de arranque que ya
no cambia con una flecha, el orden de la tabla congelado bajo el puntero y «Matar proceso» al final
del menú. La B, la de accesibilidad, el 2026-09-24: **axe da cero violaciones en las cuatro vistas
y los dos temas**, bordes y anillos de foco a 3:1, el rojo de Kill a 4,5:1 y lo elegido distinto
de lo demás por algo más que el color. La C, la de maquetación, también el 2026-09-24 y publicada
como v1.6.2: la tabla de procesos con anchos fijos y la barra bajo la cifra, el sidebar entero a 480
px de alto y el diálogo de confirmación con mensaje, aviso y nota, y en rojo solo lo peligroso. Las
fases D a F siguen pendientes (ver [ROADMAP.md](ROADMAP.md)).

El 7 se abrió el 2026-07-27 con una revisión completa del
repositorio sobre la v1.1.1 ya publicada —código, seguridad, rendimiento, estructura, accesibilidad,
responsividad, ortografía y documentación— y se cerró entero el mismo día: seguridad, arreglos
rápidos, ortografía, comportamiento de la ventana y accesibilidad, rendimiento, refactor,
compactación de los documentos y los tres puntos de producto.

Nada de lo que recogía esa revisión era un fallo de funcionamiento —la app hace lo que promete—
**salvo la guardia de rutas de `install_update`**, que se saltaba con un `..`; arreglada en el 7.1.

**El backlog de la revisión está cerrado entero: 37 de 37**, desde el 2026-08-21 con T4-01, la
internacionalización; su detalle vive desde el 2026-08-23 en
[docs/REVISION-2026-08-18.md](docs/REVISION-2026-08-18.md). **Cuatro de esas 37 se cerraron por decisión o por medición, no escribiendo
código**: no había CI (T4-04, **revocada el 2026-09-23**: ver §4), no habrá firma Authenticode (T4-02), el bundle no se divide porque se
midió que no compensa (T4-05) y el rendimiento se midió en vez de suponerse (T4-03).

**Cerrado: [Tier 10 — Servicios de desarrollo](ROADMAP.md), las tres fases hechas y verificadas**
—la A el 2026-08-22; la B y la C el 2026-08-23—. Un panel para los servicios de Windows que son de desarrollo —SQL Server, PostgreSQL,
MySQL, Docker— con su estado, su tipo de arranque y **el puerto que ocupan**. Encaja porque el 1433
y el 5432 son puertos igual que el 3000, y la app hoy solo ve los procesos que lanza el usuario, no
los que lanza Windows por él. La app sigue instalando en `currentUser` y **sin elevar nunca**, y con la fase B ya escrita eso no
ha cambiado: `services.rs` abre el SCM con `SC_MANAGER_CONNECT | SC_MANAGER_ENUMERATE_SERVICE` y no
puede tocar nada aunque quisiera. Lo que actúa vive aparte, en `service_control.rs`, y **eleva solo
la acción**: relanza el propio ejecutable con `runas`, ese hijo hace una llamada al SCM y muere.

> ⚠️ **Decidido el 2026-08-23, construyendo la fase B: la guardia va dentro del proceso elevado.**
> El hijo revalida el nombre que recibe contra el catálogo más los `customServices` que **relee del
> disco**, en vez de aceptar una lista de permitidos por parámetro —que sería validarse contra su
> propia entrada—. Sin eso, cualquier programa sin privilegios podría usar el UAC de esta app, con
> su nombre y su icono, para detener un servicio del sistema. Es el mismo criterio que la guardia de
> PIDs de `kill_process`.
>
> **Y no hay cascada:** Windows no detiene un servicio con dependientes vivos, y la app **no los
> detiene por su cuenta** aunque `services.msc` lo ofrezca. Serían servicios que nunca pasaron por
> la guardia ni por el diálogo. Se enseñan los nombres y el usuario decide.

> ⚠️ **Decidido el 2026-08-23, con la fase C: el registro de deshacer guarda el original, no el
> historial.** `service-changes.json` tiene **una entrada por servicio**, con el valor que tenía
> antes de que la app lo tocara la primera vez, y **la entrada se borra al volver a él**. Un
> registro que guardara cada paso obligaría a deshacer tres veces para desandar tres cambios, y a
> que el usuario llevara la cuenta. Así, deshacer y volver a ponerlo son el mismo camino.
>
> El cambio de arranque es **lo único que hace esta app que sobrevive a un reinicio y vive fuera de
> su propio `settings.json`**, y por eso es lo único con registro de deshacer. Los tipos que se
> ofrecen son cuatro: `boot` y `system` no están, y el proceso elevado también valida eso.

> ⚠️ **La RAM de un servicio no se puede leer sin ser administrador**, y se descubrió construyendo
> la Fase A. `OpenProcess` devuelve acceso denegado incluso con `PROCESS_QUERY_LIMITED_INFORMATION`.
> Por eso `memory_mb` es `Option` y la columna pinta «—» con su explicación, nunca un «0 MB» que el
> usuario se creería. Es el mismo criterio que el «En pausa» del medidor: decir lo que no se sabe.

**Publicado:** **v1.6.2** (2026-09-24), la **Fase C del Tier 11**: maquetación, sin cambiar
permisos, acciones ni datos. La tabla de procesos con anchos fijos y la barra bajo la cifra, el
sidebar entero a 480 px de alto y el diálogo de confirmación con partes y tono. CI en verde y dry
run sobre el mismo commit antes del corte; 4 assets, hash comprobado tras publicar: `2fa0564a…`.

Antes: la **v1.6.1** (2026-09-24), la **Fase B del Tier 11**: accesibilidad, sin cambiar
permisos, acciones ni datos, y por eso sube a parche. axe pasa a cero violaciones en las cuatro
vistas y los dos temas. El corte avisó de que `package.json` y `Cargo.lock` eran más recientes que
`THIRD-PARTY-NOTICES.txt`; comprobado antes de seguir: siguen siendo 566 crates y 14 dependencias
npm con las mismas versiones directas —la subida de `rustls` del 2026-09-23 solo movió
transitivas, con las mismas licencias—. 4 assets, hash comprobado tras publicar: `4afe55fc…`.

Antes: la **v1.6.0** (2026-09-23), la **Fase A del Tier 11** entera: que no se cierre lo que
no se quería. Sube a minor porque trae funcionalidad nueva —procesos protegidos, la segunda línea de
cada fila, la combinación del atajo— y cambia comportamiento: **el atajo global viene apagado** y,
encendido, **pide dos pulsaciones**, lo que sí alcanza a quien ya lo tenía activo. Antes de cortar,
la CI en verde sobre el mismo commit y el dry run anotado para `-SkipTests`. 4 assets, hash
comprobado tras publicar: `b7bd48c3…`.

Antes: la **v1.5.3** (2026-08-23), un añadido pequeño: el botón **Apoyar el proyecto** en
Ajustes → Acerca de. El repositorio tenía `.github/FUNDING.yml` desde el 2026-07-25, pero eso solo
pinta el botón de patrocinio **en la página de GitHub**, por donde no pasa quien instala la app. El
enlace queda ahora en dos sitios sin nada que los ate, y por eso la prueba comprueba **la URL
exacta** y no solo que se llame a `openUrl`: un enlace de dinero equivocado abre el navegador igual
y no falla por ningún lado. Debajo del botón, una línea que dice que la app es gratis y que apoyarla
no desbloquea nada. 4 assets, hash comprobado tras publicar: `504bed6a…`.

Antes: la **v1.5.2** (2026-08-23), segundo arreglo de interfaz de la misma tanda y con el mismo
alcance: **no cambia permisos, acciones ni datos**. Va al desplegable de arranque, que en el tema
oscuro pintaba la lista blanca con el texto casi blanco encima. Las dos causas desmienten lo que
parecía obvio y están en §4: **lo que colorea la lista es el fondo del control**, no las variables
del tema, y **Chromium ignora `padding-right` para la flecha nativa**, que ahora es la nuestra. De
paso se fue un texto que sobrevivía desde antes de la Fase C —«el tipo de arranque todavía no se
puede cambiar desde aquí», con la columna que lo cambia debajo—, en los dos idiomas. 4 assets, hash
comprobado tras publicar: `7e4be6a5…`.

Antes: la **v1.5.1** (2026-08-23), un arreglo de interfaz sobre la 1.5.0 que **no cambia el
comportamiento de nada**: mismos permisos, mismas acciones, mismos datos. Con las seis columnas que
trajo el panel de servicios, la tabla no cabía en la ventana y la barra horizontal se llevaba fuera
de pantalla **la columna del nombre**, que es lo que identifica cada fila; ahora las columnas llevan
anchos medidos (§4, 2026-08-23). Van con ella tres detalles de la misma vista —la RAM ya no parte en
dos líneas, el desplegable enseña «Automático (retrasado)» entero y usa el foco de la app— y dos de
accesibilidad: los tipos de arranque ya no parecen desactivados, y el motivo de los «—» lo anuncian
también los lectores de pantalla. 4 assets, con el hash comprobado tras publicar: `b764f7ef…`.

Antes: la **v1.5.0** (2026-08-23), la versión más grande desde la 1.0: trajo el **Tier 10
entero** —el panel de servicios de desarrollo, con arrancar, detener, cambiar el tipo de arranque y
deshacerlo— y la app **en español e inglés**, bandeja y notificaciones incluidas. Subió a minor:
funcionalidad nueva, sin romper nada de lo anterior. Fue también la primera versión que **actúa
fuera de sus propios procesos**: eleva de forma puntual para hablar con el SCM, y por eso lleva la
guardia dentro del proceso elevado y un registro de lo que cambió. Antes: la **v1.4.0** (2026-08-18), la que recogió la revisión hasta ese punto: **33 de
las 37 tareas**, con los Tiers 1, 2 y 3 cerrados enteros. Sube a minor y no a parche porque trae
funcionalidad nueva de cara al usuario —el **registro de avisos** en Ajustes → Acerca de y la
pantalla de error en vez de la ventana en blanco— y cambia comportamiento: **un solo aviso** por
acción desde la bandeja y el atajo, donde antes salían dos. 4 assets: NSIS y MSI con sus `.sha256`.
Sin firma de código, así que SmartScreen sigue avisando. Antes: la v1.3.2 (Tier 1 de la revisión),
la v1.3.1 con la **actualización silenciosa** (`/S /UPDATE /R`) y la v1.3.0 con el medidor del
entorno. La primera versión pública fue la v1.1.1.

> Verificado tras publicar, en las diez versiones con el mismo criterio: los 4 assets están en el
> release, la API que consulta la app devuelve el `tag_name` correcto, y **el instalador descargado
> del release coincide con el `.sha256` publicado** — la cadena entera que recorre la
> auto-actualización, sobre los archivos reales. Para la v1.6.1, `4afe55fc…`; para la v1.6.0,
> `b7bd48c3…`; para la v1.5.3,
> `504bed6a…`; para la v1.5.2,
> `7e4be6a5…`; para la v1.5.1,
> `b764f7ef…`; para la v1.5.0,
> `21fad0ad…`; para la v1.4.0, `a8738197…`; para la v1.3.2,
> `d4030bb7…`; para la v1.3.1,
> `121b228e…`; para la v1.3.0, `0050ae80…`. En la v1.3.2 se comprobó además que **las URLs reales que
> devuelve la API pasan la guardia nueva**: era lo único que podía romper la actualización entera sin
> notarse hasta el siguiente release.
>
> ✅ **Y la actualización silenciosa quedó verificada con esta misma versión**: actualizar de la
> v1.3.1 a la v1.3.2 es el primer caso en que el instalador lo lanza una app que ya lleva los flags,
> y salió sin una sola ventana. Ver la nota de más abajo.

**Pruebas:** 175 de frontend (Vitest + Testing Library, en jsdom) y 65 de `cargo test`. La
cobertura medida fue del **89,61 %** de sentencias sobre el código propio —sin contar los dobles de
prueba ni los componentes que genera shadcn, que antes diluían la cifra al 86,14 %—; es de antes de
las últimas tandas, así que hoy será otra. **Cinco pruebas de guardia se han comprobado con una
mutación**: las dos del Tier 1, la del tope de la descarga y la de la rotación del log. Se quita la
guardia, se ve fallar el test y se restaura — una prueba negativa que nunca se ha visto fallar no
prueba nada.

**Comprobaciones del corte:** `cargo test`, `npm test`, clippy, **ESLint**, `cargo audit` y
`npm audit --omit=dev`, todas dentro de `release.ps1`, que aborta si algo falla. Además avisa si
`package.json` o `Cargo.lock` son más recientes que `THIRD-PARTY-NOTICES.txt`, y `-SkipTests` se
niega si el `HEAD` no es el del último *dry run*.

**Y en cada push y pull request, las mismas en GitHub Actions** (desde el 2026-09-23, con el
repositorio público): `.github/workflows/ci.yml` corre ESLint, `npm test`, `npm run build`, clippy
y `cargo test` en `windows-latest`, y las dos auditorías en Ubuntu —estas también cada lunes,
porque un aviso nuevo sale sin que nadie haga push—. Cubre el hueco que antes quedaba dicho aquí:
**que el proyecto compile y pase en un equipo limpio**. No publica nada ni tiene secretos; el corte
sigue siendo `release.ps1`. ✅ **Verificado en el runner el 2026-09-23**: las pruebas de los dos
lados pasan en una máquina sin los servicios ni los procesos de este equipo. La primera ejecución
paró en `cargo audit` por RUSTSEC-2026-0285 (`rustls`), que se arregló en el mismo día: justo lo
que se esperaba de ella.

### Rendimiento medido (2026-08-18)

Hasta esta fecha **nadie había puesto una cifra** al coste de la app: las decisiones de diseño eran
correctas pero no estaban respaldadas por ninguna medición propia. Estas se tomaron en **AMD Ryzen 7
5800XT (8 núcleos / 16 hilos), 32 GB de RAM, Windows 11 Pro 26200**, con unos 360-400 procesos vivos
en el equipo y 26 vigilados por la app.

| Qué | Cifra | Cómo se midió |
|---|---|---|
| **Ciclo del poller** (enumerar procesos + tabla de sockets) | **~16 ms** en release, **el 0,8 % de un núcleo** con el refresco a 2 s | Deducido de la CPU real consumida: 2,86 s en 6 minutos = 180 ciclos. En *debug* son 25,6 ms de media y 34,6 el peor (`cargo test --lib medicion -- --ignored --nocapture`), de los cuales **8,9 ms son leer los sockets** |
| **Arranque** | **31-152 ms** hasta el handle de ventana en caliente; **632 ms** la primera vez en frío | Lanzar el .exe instalado y esperar a `MainWindowHandle` |
| **Memoria viviendo en la bandeja** | proceso Rust **41,0 → 41,5 MB en 6 minutos** (180 ciclos). Con los 6 procesos de WebView2, el árbol entero oscila entre **440 y 480 MB** sin tendencia | Muestreo cada 30 s del árbol completo, atado por PID de padre |
| **El árbol de sysinfo no crece** | 359 procesos conocidos antes y después de **100 refrescos seguidos** | Prueba `el_arbol_de_procesos_no_crece_con_los_refrescos` |
| **Compilar el bundle de JS** (565 kB) | **~12,5 ms** en frío, forzando compilación completa | `new vm.Script(src, {produceCachedData:true})` en V8 |

⚠️ **Lo que estas cifras NO dicen**, para no leerlas de más:

- El arranque medido es **hasta que existe la ventana, no hasta que la interfaz está pintada**. El
  handle aparece antes de que el webview renderice nada, y el JavaScript lo ejecuta el proceso hijo
  de WebView2, así que la CPU del proceso de Rust tampoco lo captura. Intentarlo por ahí dio
  resultados incoherentes entre vueltas, y por eso no se usa.
- **Seis minutos no son días.** Lo que se puede afirmar es que en 180 ciclos no hay una tendencia de
  crecimiento, no que no la haya en una semana.
- Es **una máquina**. En un equipo más lento el ciclo costará más, aunque el margen sobre 2 s es
  amplio.

### Lo que está verificado sobre la app en ejecución

Todo lo del producto se ha comprobado con la app corriendo, no solo con pruebas: la lista de
procesos reales con su puerto, buscar por puerto y liberarlo al matar, el refresco por eventos desde
Rust, los ajustes y el historial sobreviviendo al reinicio, el tema siguiendo a Windows, el menú
contextual copiando al portapapeles real, Escape cancelando el diálogo destructivo, el Auto-Kill
cerrando un proceso de 651 MB sin tocar los 7 `node` reales de la máquina, `Ctrl+Alt+K` pulsado de
verdad (con `keybd_event`, no `SendKeys`), los toast apareciendo en pantalla, y —desde el Tier 7— el
CSP activo, la X cerrando la app, la instancia única, el poller despertando al instante y la tabla
ordenándose por columna sin que las filas bailen entre refrescos, y el sidebar plegándose
sin sacar al usuario de la vista; y —desde el Tier 8— el medidor del entorno moviéndose entre ciclos,
subiendo con un `node` de 380 MB levantado a propósito y poniéndose en pausa con el refresco en
"Off"; y —desde la revisión— **la app respetando «Efectos de animación» de Windows**: con el ajuste
apagado, las barras saltan a su valor sin deslizarse y las filas filtradas desaparecen sin
desvanecerse; al encenderlo, las dos vuelven a animar.

> ✅ **El log en archivo, verificado sobre el binario de release (2026-08-18).** Con la v1.4.0 ya
> instalada: el archivo está en `%APPDATA%\com.processdevkill.app\`, Ajustes → Acerca de enseña su
> ruta real, y dentro está la línea del arranque — escrita por el mismo camino que usan los avisos
> de fallo. **El propio log documenta la actualización en sitio**: `v1.3.2 arrancando` y luego
> `v1.4.0 arrancando`. Y confirmó que la `Z` del UTC sirve: `02:32:19Z` es un `22:32` local, cuatro
> horas de diferencia que sin la marca despistarían a quien lea el archivo.

El detalle de cada verificación, con su fecha y lo que costó, está en [ROADMAP.md](ROADMAP.md) junto
al tier correspondiente y en la [bitácora](docs/BITACORA.md).

> ✅ **La auto-actualización ya ha corrido de principio a fin, el 2026-08-18.** Era la última
> salvedad abierta del proyecto y llevaba así desde julio: lanzar el instalador para que reemplace
> la app es el único paso que no se puede simular, porque hace falta un release posterior al
> instalado. El usuario actualizó de la **v1.3.1 a la v1.3.2** desde *Ajustes → Actualizaciones* y
> **la instalación fue silenciosa**: sin asistente, sin ventana de desinstalación y con la app
> volviendo a abrirse sola.
>
> Eso cierra de golpe las dos cosas: la cadena entera del actualizador —consulta, elección de
> assets, descarga, verificación del hash, ejecución y reapertura— y los flags `/S /UPDATE /R` del
> Tier 9, que hasta ahora solo estaban respaldados por la plantilla NSIS generada y no por la app en
> marcha.


## 4. Decisiones tomadas

| Fecha | Decisión | Motivo |
|---|---|---|
| 2026-07-23 | Tauri 2 (no Electron) | Binario ligero, backend Rust necesario para `sysinfo` |
| 2026-07-23 | Tailwind v4 con plugin de Vite | Setup actual oficial; v3 quedó obsoleto |
| 2026-07-23 | Crate `listeners` para puertos | `sysinfo` no mapea PID→puerto |
| 2026-07-23 | Polling frontend en Tier 2, eventos Rust en Tier 4 | Simplicidad primero, rendimiento después |
| 2026-07-23 | `sysinfo` solo con la feature `system` | No usamos discos, red ni componentes; acorta la compilación |
| 2026-07-23 | Clasificar procesos por nombre exacto o sufijo de versión, no por prefijo | Un prefijo simple capturaría `nodemon` como si fuera Node |
| 2026-07-23 | `kill_process` valida que el PID sea de un runtime vigilado | Un comando de Tauri acepta cualquier entrada; sin la guardia sería un "mata lo que quieras" |
| 2026-07-23 | Normalizar el % de CPU dividiendo por núcleos lógicos | `cpu_usage()` suma todos los núcleos y devuelve hasta 400 en un equipo de 4 hilos |
| 2026-07-23 | Crear el `System` con `RefreshKind::nothing().with_cpu(CpuRefreshKind::nothing())` | **Obligatorio**: sysinfo multiplica el uso de CPU por `cpus.len()`, y con `System::new()` esa lista queda vacía → todos los procesos reportan 0 % |
| 2026-07-23 | Calentar la CPU con **tres** muestras, en un hilo aparte | sysinfo descarta la primera lectura sin guardar líneas base y la segunda las compara contra cero; solo la tercera es real. En un hilo para no retrasar la ventana |
| 2026-07-23 | Separar `collect_processes()` del comando de Tauri | Permite probar la lógica contra el sistema real sin montar una `App` |
| 2026-07-23 | Barras de consumo escaladas al mayor de la lista, no al total del equipo | Un Node de 300 MB sobre 32 GB daría una barra invisible; lo útil es comparar procesos entre sí. El número sigue siendo absoluto |
| 2026-07-23 | `kill_processes` devuelve un resultado por PID, no `Result` global | En un lote es normal que algún proceso muera solo entre el refresco y el clic; eso no debe impedir matar los demás |
| 2026-07-23 | Auto-refresco con guardia `inFlight` y poda de la selección | Evita encolar peticiones si una tarda más que el intervalo, y que un PID muerto siga contando para "matar seleccionados" |
| 2026-07-23 | Iconos como SVG inline, no imágenes | La app funciona offline y así heredan el color del runtime sin peticiones de red |
| 2026-07-23 | Filtrar los sockets por `TCP` + `Listen` | `listeners::get_all()` también devuelve conexiones salientes; sin el filtro la UI mostraría puertos efímeros aleatorios en vez del puerto del servidor |
| 2026-07-23 | Emitir las notificaciones desde Rust, no desde el frontend | El menú de la bandeja mata procesos con la ventana oculta; ahí la notificación es el único feedback que recibe el usuario |
| 2026-07-23 | Añadir "Salir" al menú de la bandeja (no estaba en el plan) | Al esconder la ventana en vez de cerrarla, sin esa opción la app no se puede terminar |
| 2026-07-23 | No conceder `core:window:allow-close` al frontend | La app no necesita cerrarse a sí misma desde JS; el botón X pasa por el sistema y lo intercepta `CloseRequested` |
| 2026-07-23 | Dividir `lib.rs` en `processes`/`ports`/`storage`/`tray` | Pasaba de 450 líneas y el Tier 4 la habría llevado a 900 |
| 2026-07-23 | Persistencia con archivos JSON propios, no `tauri-plugin-store` | La bandeja y el atajo escriben historial sin que la ventana exista; el store es una API de frontend |
| 2026-07-23 | Guardar el timestamp como epoch en ms y formatearlo en JS | Evita meter `chrono` solo para esto, y `toLocaleString()` respeta el idioma y la zona del usuario |
| 2026-07-23 | Toda muerte pasa por `kill_and_record` | Ventana, bandeja y atajo registran historial, notifican y refrescan igual; tres caminos separados se habrían desincronizado |
| 2026-07-23 | Interruptor para desactivar `Ctrl+Alt+K` (no estaba en el plan) | **Precisada el 2026-09-23**: ahora viene apagado, con la combinación elegible y dos pulsaciones (ver esa fila). Dispara un cierre masivo sin confirmación; un atajo global mal pulsado no debería ser irreversible |
| 2026-07-23 | Los nombres personalizados se comparan exactos, no por prefijo | Añadir `go` no debe capturar `golang`, ni `docker` capturar `dockerd` |
| 2026-07-23 | Copiar los ajustes y soltar su candado antes de bloquear `sys` | Evita anidar candados y con ello cualquier riesgo de deadlock entre el hilo emisor y los comandos |
| 2026-07-24 | **Nombre definitivo: ProcessDevKill** | Cierra la decisión pendiente. Cambia también el identificador a `com.processdevkill.app`: se hace ahora, antes del primer instalador, porque mover el identificador después dejaría huérfanos los ajustes e historial de los usuarios |
| 2026-07-24 | El tema se guarda en `settings.json`, no en `localStorage` | Vive junto al resto de ajustes, en un archivo que el usuario puede ver, copiar entre equipos o borrar. En `localStorage` queda solo una **copia** para pintar sin parpadeo antes de que Rust conteste |
| 2026-07-24 | La clase `dark` la aplica JS, no la media query de CSS | Si la decidiera el CSS, elegir "Claro" con Windows en oscuro no tendría ningún efecto. Con "Sistema" se escucha `prefers-color-scheme` en vivo |
| 2026-07-24 | Paleta propia en `.dark`, no la neutra de shadcn | Conserva el azul oscuro de los Tiers 1-4 (`#0f1115`); el gris neutro por defecto borraba la identidad de la app |
| 2026-07-24 | Forzar el foco en el botón destructivo del diálogo (`initialFocus`) | Base UI enfoca "Cancelar" por defecto; se mantiene el comportamiento verificado en el Tier 2 (confirmar con Enter). Escape sigue cancelando, que es la salida crítica |
| 2026-07-24 | `tauri-plugin-clipboard-manager` en vez de `navigator.clipboard` | La API web exige que el documento tenga el foco: falla con `NotAllowedError` justo cuando la ventana vuelve de la bandeja. Se concede solo `clipboard-manager:allow-write-text`, no lectura |
| 2026-07-24 | Rojo sólido para la acción destructiva principal | El `variant="destructive"` de este estilo de shadcn es un rojo tenue, pensado para acciones secundarias; el botón que cierra toda la lista tiene que verse que quema |
| 2026-07-24 | **Releases con `release.ps1` local, sin GitHub Actions** | La app es solo Windows por ahora y la build de Tauri en CI tarda minutos por plataforma. Se compila en la misma máquina donde se prueba, sin secretos en la nube ni minutos de CI. Si algún día se publica para macOS, entonces sí hará falta CI (no se puede compilar `.dmg` desde Windows) |
| 2026-07-24 | Se descarta `navigator.clipboard.readText()` incluso para depurar | Abre un diálogo de permiso **dentro** de la ventana de WebView2 que bloquea la evaluación por CDP; la app solo necesita escribir |
| 2026-07-24 | Tier 6 recoge solo parte de lo que tiene FormatDiskPro | De la comparación se descartan a propósito **CI** (ya decidido: `release.ps1` local) y los **UI tests con FlaUI** (es una app WinForms; aquí el equivalente es Vitest + pruebas por CDP). También se descartó su modelo de confianza SHA-256, por preferir minisign — **decisión revertida el 2026-07-26**, ver la fila de esa fecha |
| 2026-07-24 | El menú de la bandeja llama a `pids_of_runtime` en vez de repetir el filtro | El test `selecciona_solo_los_pids_del_runtime_pedido` decía cubrir la bandeja, pero la bandeja tenía su propia copia del filtro: el test protegía código que nadie usaba |
| 2026-07-24 | Una sola sesión de Claude Code por repositorio | Dos trabajando a la vez se sobrescriben los archivos, y el `tauri dev` de una reinicia la app que la otra está inspeccionando por CDP |
| 2026-07-24 | El Auto-Kill nace apagado y con suelo de 256 MB en el umbral | Es lo único de la app que mata sin que nadie se lo pida. Un umbral bajo por descuido (o heredado de un `settings.json` editado a mano) cerraría el entorno de desarrollo entero, así que el suelo se aplica también al leer del disco |
| 2026-07-24 | El Auto-Kill sigue vigilando con el auto-refresco en "Off" | Una red de seguridad que deja de mirar porque la ventana no se refresca no es una red de seguridad. Se vigila cada 2 s sin publicar la lista, que es lo que el usuario pidió al apagar el refresco |
| 2026-07-24 | El umbral se guarda al salir del campo, no al teclear | Escribir "2048" pasa por "2"; guardando en cada pulsación el umbral bajaría al mínimo un instante con el vigilante en marcha |
| 2026-07-24 | `watch_cycle` lee la lista una vez y luego publica | Vigilar y refrescar por separado enumeraba procesos y sockets dos veces por ciclo, que es justo el trabajo que el Tier 4 sacó del frontend |
| 2026-07-24 | Un zombi tiene que ocupar un **puerto**, no solo estar parado | Casi todo proceso de desarrollo en reposo marca 0 % de CPU (7 de 10 en la máquina de pruebas). Sin esa condición se resaltaría la tabla entera, que es igual que no resaltar nada |
| 2026-07-24 | El corte de "sin actividad" es 0,5 % de CPU, no 0 | Un servidor parado sigue despertando por sus temporizadores y el recolector de basura, y marca décimas sueltas |
| 2026-07-24 | Apagar el Zombie Finder borra las rachas acumuladas | Mientras estuvo apagado nadie miraba; contar ese rato al reactivarlo sería inventárselo |
| 2026-07-24 | `"center": true` en la ventana | Sin ello Windows coloca la ventana donde le parece y cada arranque aparecía en un sitio distinto. Tauri centra sobre el **área de trabajo**, no sobre la pantalla completa: el centro vertical queda unos píxeles más arriba, que es lo correcto para no quedar bajo la barra de tareas |
| 2026-07-24 | `ZombieWatch` olvida los PIDs que desaparecen | La app vive días en la bandeja: el mapa crecería sin fin, y un PID reciclado por Windows heredaría la racha del proceso anterior |
| 2026-07-25 | Las capturas del README salen del **webview** por CDP, no de la pantalla | Sin barra de título ni fondo de escritorio, y con `Emulation.setDeviceMetricsOverride` miden lo mismo las genere quien las genere, sin depender de la resolución ni del escalado de Windows. Van a x2 para que aguanten el zoom de GitHub. Capturar la pantalla ya se descartó en el Tier 5.5: BitBlt no recoge lo que compone DWM |
| 2026-07-25 | El script de capturas levanta **sus propios servidores Node** (3000 y 8080) | La columna de puertos es lo que justifica la app: una captura con la columna vacía no vale. Y sin nada consumiendo CPU las barras salen todas a cero, que parece un fallo. Son procesos reales escuchando de verdad, no datos inventados; se cierran al terminar |
| 2026-07-25 | La captura de Ajustes usa una ventana más alta que la de por defecto, y va la última | En 640 px solo se ve hasta el Auto-Kill, y las dos funciones estrella quedarían fuera; la app es redimensionable, así que sigue siendo una ventana posible. Va la última porque `setDeviceMetricsOverride` **no encoge** el viewport si ya había uno mayor: así el resto se capturan siempre al tamaño por defecto |
| 2026-07-25 | El README dice qué **no** protege el `.sha256` | Publicar un hash junto al archivo que valida invita a leerlo como una garantía de origen. Detecta una descarga corrupta y poco más; sin firma no demuestra quién publicó el instalador. Decirlo cuesta dos líneas y evita una falsa sensación de seguridad |
| 2026-07-25 | Vitest + Testing Library, y **no** end-to-end sobre la ventana | El 80 % del valor está en las pruebas de componente: corren en dos segundos, se mantienen solas y no necesitan compilar Tauri. Montar la ventana en cada corte de release para repetir lo que ya se verificó por CDP no compensa hoy |
| 2026-07-25 | Los dobles de Tauri viven en `tauri-mock.ts`, no en `setup.ts` | Las fábricas de `vi.mock` **se izan por encima de los imports** del archivo: unos `vi.fn()` declarados arriba del propio setup serían `undefined` al ejecutarse la fábrica. Con un `await import` dentro, el problema desaparece |
| 2026-07-25 | Motion se dobla en las pruebas | `AnimatePresence` mantiene montada la fila que sale hasta que acaba su animación. Al filtrar la tabla seguían contándose las filas de antes: la aserción medía la animación, no el filtro. La animación es presentación pura y ya se verificó a ojo en el Tier 2 |
| 2026-07-25 | `types.test.ts` lee el fuente de Rust y compara | `types.ts` se declaraba "espejo" de los tipos de Rust, pero nada lo obligaba: cambiar `MIN_AUTO_KILL_MB` en `storage.rs` y olvidarse aquí no rompía ni el build ni `cargo test`. Ahora falla una prueba |
| 2026-07-25 | `aria-label` en los dos campos numéricos de Ajustes | Lo encontraron las pruebas al no poder pedirlos por nombre: solo tenían `aria-describedby`, que **describe pero no nombra**. Un lector de pantalla los anunciaba sin decir qué eran |
| 2026-07-25 | La comprobación al arrancar va **en silencio** | Un equipo sin red o una VPN levantándose es lo normal, y un error nada más abrir la app parecería un fallo de la app. Solo se habla cuando de verdad hay versión nueva |
| 2026-07-25 | Descargar e instalar **solo a petición** | Es lo único que la app puede traerse de internet y ejecutar. Que ocurra sin pedirlo convertiría una herramienta local en algo que se modifica solo, y eso hay que pedirlo |
| 2026-07-26 | **Auto-actualización con SHA-256, como FormatDiskPro** | Decisión del usuario tras dos días peleándose con la clave minisign: se filtró, la rotación se atascó y el prompt de contraseña resultaba impegable. El hash es más débil —no prueba origen— pero **el esquema entero cabe en la cabeza**, no hay secretos que custodiar y no puede dejar tirados a los usuarios instalados. Un mecanismo de seguridad que nadie consigue operar acaba desactivado, y ése es el fallo más caro de los dos. **Se borran de esta tabla las 8 filas que describían el mecanismo de minisign** (2026-07-27): narraban un camino que ya no existe en el código. La lección que sí sigue valiendo —nunca volcar un archivo de clave a la consola, porque son una sola línea de base64 y `head -1` la imprime entera— está en [CLAUDE.md](.claude/CLAUDE.md), y el recorrido, en la [bitácora](docs/BITACORA.md) |
| 2026-07-26 | Se descarta implementar la verificación **Authenticode** | FormatDiskPro la intenta antes del hash, pero allí ya existe el código. Aquí, sin certificado de firma, ningún instalador propio la pasaría: sería código muerto, y una comprobación que siempre falla acaba ignorándose |
| 2026-07-26 | `install_update` solo acepta rutas de su carpeta de descargas | El comando queda expuesto al frontend y sin la guardia sería un "ejecuta lo que quieras". Mismo criterio que la guardia de PID de `kill_process` del Tier 1 |
| 2026-07-26 | La red la usa **solo Rust**, no el frontend | Las capabilities gobiernan la superficie JS↔Rust, así que el frontend sigue sin ningún permiso que le deje salir a internet. Un XSS en la ventana no puede hacer peticiones arbitrarias en nombre de la app |
| 2026-07-27 | **La tabla de sockets se lee una vez por lote** (`kill_many`) | `kill_one` la enumeraba por cada PID: un "Nuke All" de quince procesos recorría todos los sockets del sistema quince veces. Leerlos antes de matar sigue siendo obligatorio; repetir la lectura, no. De paso la foto se toma con todo el lote aún vivo, en vez de degradarse conforme caen |
| 2026-07-27 | **El poller espera en un `Condvar`, no sondeando cada 300 ms** | Con el refresco en "Off" y el Auto-Kill apagado, el hilo despertaba tres veces por segundo para nada; en una app que vive días en la bandeja son cientos de miles de despertares diarios. Guardar ajustes le avisa, así que reactivarlo sigue siendo instantáneo (medido: 2,2 s) |
| 2026-07-27 | El testigo del `Condvar` se marca **dentro del candado** | Un `notify` a secas se pierde si llega entre que el poller lee los ajustes y entra a esperar, y entonces el hilo se queda los 60 s enteros. Es la carrera clásica del `Condvar`, y el `bool` es lo que la cierra. La cubre `un_aviso_anterior_a_la_espera_no_se_pierde` |
| 2026-07-27 | `selecciona_solo_los_pids_del_runtime_pedido` pasa a comprobar el criterio negativo | Comparaba dos fotos del sistema exigiendo que cuadraran, y eso no se sostiene en una máquina donde los procesos van y vienen: falló (15 contra 13) en cuanto otro test empezó a lanzar servidores `node` en paralelo. Lo que importa es a quién **no** se mata |
| 2026-07-27 | **Cerrar la ventana cierra la app; la bandeja es opcional y apagada de fábrica** | Desde el Tier 3, la X escondía la ventana **siempre**. Visto en uso es lo contrario de lo que espera cualquiera, y tenía una consecuencia peor que la sorpresa: el usuario daba la app por cerrada, la volvía a abrir y **acumulaba instancias**. Lo reportó con una captura de tres ventanas y cuatro iconos de bandeja a la vez. Ajuste `closeToTray`, `false` de fábrica |
| 2026-07-27 | Ante un candado envenenado, `CloseRequested` **cierra** | Dejar la app viva e invisible es peor que cerrarla de más: sin ventana ni forma de darse cuenta salvo el Administrador de tareas |
| 2026-07-27 | **Instancia única con `tauri-plugin-single-instance`** | La segunda instancia trae al frente la ventana de la primera y se cierra. No avisa con un toast: es lo que hace cualquier app de Windows bien educada, y el usuario lo interpreta solo al ver aparecer la ventana. Un aviso de "ya estaba abierta" sería ruido para algo que se ve en pantalla. Se reaprovecha `tray::show_main_window`, cuyo `show` es imprescindible: si estaba escondida en la bandeja, enfocarla no la enseña |
| 2026-07-27 | El botón "Kill" gana nombre accesible con proceso y PID | Veinte filas son veinte botones que se anunciaban "Kill" a secas. El checkbox de la misma fila ya se nombraba bien desde el Tier 6; el botón que **mata** un proceso es el que menos se puede fallar. El texto visible no cambia |
| 2026-07-27 | **El menú contextual se queda solo con clic derecho** | Decisión del usuario tras ver las alternativas. Se descarta `tabIndex` en la fila **por las veinte paradas de tabulación** que añadiría: empeora la navegación por teclado de todo el mundo para arreglar un camino que casi nadie usa. Lo que deja fuera, asumido a sabiendas: copiar PID, puerto y URL siguen siendo solo de ratón. "Matar proceso" no, que ese está en el botón Kill |
| 2026-07-27 | `aria-current` en la navegación de vistas, no `aria-pressed` | Procesos/Historial/Ajustes son vistas excluyentes: es navegación, no un interruptor. Los otros tres `aria-pressed` (tema, intervalo, filtros) se quedan: son grupos de selección dentro de una vista, donde lo ideal sería un `radiogroup`, pero el cambio es mayor y la ganancia pequeña |
| 2026-07-27 | **La guardia de `install_update` canonicaliza antes de comparar** | `Path::starts_with` compara componentes **literales y no normaliza**: `…\ProcessDevKill_update\..\..\Windows\System32\calc.exe` la pasaba tan campante, y el comando está expuesto al frontend. Era justo lo que la guardia decía impedir. Se ejecuta la ruta **canónica que devuelve la comprobación**, no la que llegó: validar una y lanzar otra sería reabrir el agujero por detrás |
| 2026-07-27 | La comprobación vive en `update.rs`, no dentro del comando | Misma razón que `collect_processes` frente a `get_processes`: se prueba sin montar una `App`. El test de regresión afirma primero que la ruta de escape **sí** pasa el `starts_with` crudo, para que quede constancia de que cubre el fallo real y no una versión cómoda de él |
| 2026-07-27 | `carpeta_descargas()` es el único sitio donde se nombra la carpeta | El literal estaba duplicado entre `lib.rs` y `update.rs`. Dos copias de la ruta contra la que se valida es un agujero esperando a que alguien cambie una sola |
| 2026-07-27 | El nombre del asset se reduce a su último componente antes de usarlo como archivo | Viene de la API de GitHub y se pega con `join`. Hoy GitHub no admite separadores en el nombre de un asset, así que no era explotable, pero es la misma clase de descuido que la guardia de arriba y cuesta una línea |
| 2026-07-27 | **CSP restrictivo en vez de `null`** | Es la barrera que impide que una inyección en el webview cargue o ejecute algo de fuera; sale barata porque todos los recursos son locales. **Verificado sobre el binario de release**, que es donde aplica: en `tauri dev` el HTML lo sirve Vite y Tauri no llega a inyectarlo |
| 2026-07-27 | `style-src` lleva `'unsafe-inline'`, y además `style-src-attr` | No es dejadez: Motion, `UsageBar` y el color de los iconos por runtime pintan con **atributos `style`**. Y como Tauri añade su propio nonce a `style-src`, el `'unsafe-inline'` de ahí queda anulado para los elementos `<style>`; `style-src-attr` es lo que garantiza que los atributos sigan aplicándose. Comprobado en la app: el icono de Node mide `rgb(108, 184, 90)`, que es `--runtime-node` exacto |
| 2026-07-27 | **`lib.rs` se parte otra vez: `auto_kill`, `notify`, `poller` y los comandos del actualizador a `update.rs`** | Mismo criterio que en el Tier 4, un tier después: había vuelto a 860 líneas. `lib.rs` queda como arranque, `AppState` y comandos, que es lo que dice esta misma sección desde el 2026-07-23 |
| 2026-07-27 | El Auto-Kill tiene **módulo propio** aunque sean 50 líneas de código | Es lo único de la app que cierra procesos sin que nadie se lo pida. Que sea fácil de encontrar y de leer entero de una vez vale más que ahorrarse un archivo; suelto entre las cien líneas de arranque no lo era |
| 2026-07-27 | Los comandos del actualizador se registran como `update::check_update` en `generate_handler!` | El nombre del comando por IPC lo da el **último segmento** de la ruta, así que `invoke("check_update")` no cambia. Es lo único que el refactor podía romper en silencio —compila igual y `cargo test` pasa igual—, así que se comprobó en vivo sobre el binario de release |
| 2026-07-27 | **`cargo build --release` no sirve para verificar en vivo**: hay que usar `npx tauri build --no-bundle` | Los assets de `dist/` los embebe el CLI de Tauri, no `cargo`. El binario que sale de `cargo` solo arranca apuntando al `devUrl` y la ventana enseña `ERR_CONNECTION_REFUSED`. Costó leer como fallo de la app lo que era del guion de pruebas, por tercera vez en este tier |
| 2026-07-27 | Los formateadores van a `src/lib/format.ts`, **no a `lib/utils.ts`** | `utils.ts` lo genera el CLI de shadcn con `cn` dentro, y `shadcn init` lo reescribe. El CLI está en las dependencias del proyecto, así que no es hipotético. Salen de `types.ts` porque ese archivo tiene un test que lo declara **espejo** de Rust, y cuanto menos contenido no-espejo arrastre, más claro queda el contrato |
| 2026-07-27 | Los mapas de etiquetas (`RUNTIMES`, `THEMES`, `KILL_SOURCES`) **se quedan** en `types.ts` | Cada uno es un `Record` indexado por un tipo espejo: TypeScript obliga a completarlos cuando Rust gana una variante. Separarlos perdería esa comprobación a cambio de un archivo más |
| 2026-07-27 | `Sidebar.tsx` se lleva los tipos `View` y `Filter` | Es el componente que gobierna las dos cosas. `App` los importa de ahí en vez de declararlos y pasarlos |
| 2026-07-27 | **Cada documento responde a una pregunta, y solo a una** | README: qué es y cómo se usa. `.claude/CLAUDE.md`: cómo se trabaja aquí. CONTEXT: en qué estado está y por qué se decidió así. ROADMAP: qué falta y qué enseñó lo hecho. [`docs/BITACORA.md`](docs/BITACORA.md): cómo se llegó hasta aquí. Lo que estaba contado en varios sitios pasa a estar en uno y enlazado desde los demás |
| 2026-07-27 | **El registro de sesiones sale a `docs/BITACORA.md`** | 180 líneas creciendo por sesión dentro del documento que uno abre para saber en qué punto está el proyecto. Es historia, no estado; separarlo deja CONTEXT.md en la mitad y otra vez legible de un tirón |
| 2026-07-27 | La documentación **se poda, no se archiva entera** | El criterio: no se borra información, se borra **repetición**. Lo que explica por qué algo raro está como está se queda íntegro; lo que narra un camino que ya no existe se va, conservando la lección si la tenía |
| 2026-07-27 | El `baseUrl` de `tsconfig.json` **se quita, en vez de silenciar el aviso** | El IDE avisa de que está deprecado y deja de funcionar en TS 7, y **sugiere `"ignoreDeprecations": "6.0"`. Seguir esa sugerencia rompe el build**: ese valor solo lo acepta TS 6+, y aquí se compila con **TypeScript 5.8.3**, que responde `error TS5103: Invalid value for '--ignoreDeprecations'` y sale con código 2. Como `npm run build` es `tsc && vite build`, y `tauri build` lo invoca como `beforeBuildCommand`, eso deja **`release.ps1` sin poder cortar una versión**. Comprobado ejecutándolo, no deducido. La salida buena es quitar `baseUrl`: desde TS 4.1 los `paths` se resuelven contra la carpeta del propio `tsconfig.json`, y ningún import del proyecto usaba resolución no relativa contra la base. Verificado con `--traceResolution` que `@/` sigue resolviendo, y con `tsc`, `vite build` y las 115 pruebas en verde |
| 2026-07-27 | **La tabla se ordena por columna**, con el desempate por PID sin invertir | El orden de fábrica sigue siendo el que manda Rust (RAM desc), pero el Administrador de tareas ordena por lo que quieras y por CPU era lo primero que se iba a pedir. **El desempate es lo que impide que las filas bailen**: Rust reenvía la lista cada 2 s ya ordenada por RAM, la RAM fluctúa, y ordenando por CPU —con media tabla a 0,0 %— sin desempatar las filas saltan de sitio solas. No se invierte con la dirección, o el problema volvería en descendente |
| 2026-07-27 | El estado del orden vive en `App`, no en `ProcessTable` | La tabla se desmonta al filtrar a cero y al cambiar de vista; dentro, la elección del usuario se perdería cada vez que pasa por Historial y vuelve. Dos pruebas lo fijan |
| 2026-07-27 | Los procesos **sin puerto** se van al final en las dos direcciones | Ordenar por puerto ascendente empezaría si no por veinte guiones, y habría que bajar hasta el final para ver el 3000 — justo lo que se venía a buscar |
| 2026-07-27 | **El estado vacío distingue "no hay nada" de "tu filtro no deja pasar nada"** | Se parecen en pantalla y no tienen nada que ver. Con cero procesos se explica que Node, Python y .NET se vigilan siempre pero el resto hay que añadirlo, y se lleva a Ajustes de un clic: es lo primero que ve quien acaba de instalar la app, y quien trabaje con Go o Docker no vería nunca nada sin adivinarlo. Cuando es el filtro, **no** se ofrece Ajustes: mandaría a arreglar algo que no está roto |
| 2026-07-27 | **`minWidth` sube de 720 a 900 px** | Decisión del usuario tras medirlo sobre el binario de release con 16 filas reales: a 720 px el sidebar se lleva 208 fijos y a la tabla le quedan **497** cuando necesita **672** — un 26 % del ancho detrás de un scroll lateral. Cabe entera a partir de 896. Se descartó colapsar el sidebar: recuperaría el espacio, pero es funcionalidad nueva (estados responsive, control para plegar, reubicar los filtros y el auto-refresco que viven ahí) para un tamaño que un gestor de procesos de escritorio casi nunca necesita. **El 900 sale de una medición, no de una estimación** |
| 2026-07-28 | **El sidebar pasa a vertical y los filtros cuelgan de «Procesos»** | Petición del usuario viendo la app. Las tres pestañas en fila ya venían con un `px-1` a mano porque no cabían en 208 px, y los filtros por runtime flotaban debajo sin decir de qué dependían. El mismo botón navega y pliega según dónde estés: desde otra vista **navega y respeta el pliegue** —si volver de Ajustes lo desplegara, plegar no serviría de nada—; ya estando en Procesos, pliega |
| 2026-07-28 | El pliegue vive en `Sidebar`; el orden de la tabla, en `App` | Parece incoherente y no lo es: el sidebar **no se desmonta nunca**, así que su estado no corre peligro y subirlo sería pasarle a `App` un detalle que no le importa. La tabla **sí** se desmonta al filtrar a cero y al cambiar de vista, y por eso el orden tuvo que subir |
| 2026-07-28 | Plegado, «Procesos» recoge el total de procesos | Desplegado lo dice «Todos»; repetirlo dos líneas seguidas sobra. ⚠️ Eso hace que el **texto del botón cambie según el estado**, y rompió dos pruebas y el `Invoke-Boton` del script de capturas, que lo buscaban por texto exacto. Las pruebas pasan a expresión regular (como ya hacía la de `Node.js`) y el script prueba exacto y solo después por prefijo |
| 2026-07-28 | **El script de capturas ordena por Puerto antes de capturar** | Al regenerar las capturas salió la principal con un solo puerto y trece guiones: los servidores de demostración son pequeños y con el orden de fábrica (RAM desc) se hunden en cuanto la máquina tiene unos cuantos `node` sueltos —18 ese día frente a 13 cuando se generaron las anteriores—. La columna de puertos es lo que justifica la app. Ordenando por puerto la captura deja de depender del estado de la máquina |
| 2026-08-07 | **El medidor del sidebar enseña el entorno contra el equipo, no el equipo a secas** | Petición del usuario, elegida entre las dos opciones. Un medidor de CPU/RAM de la máquina duplica el Administrador de tareas; lo que nadie más da es **cuánto de eso lo pone tu entorno de desarrollo**. Y de paso tapa un hueco real: por la decisión del 2026-07-23 las barras de la tabla se escalan al mayor de la lista, así que una barra llena puede ser un proceso gastando el 2 % del equipo. El medidor es el denominador que faltaba |
| 2026-08-07 | **La primera lectura de CPU global de un `System` no da 0, da 100** | Se dio por hecho lo contrario al escribir el código, y el primer test de regresión —que comprobaba `> 0.0`— **pasaba igual con el calentamiento quitado**, porque 100 también es mayor que cero. Medido: un `System` recién creado responde `100.000 %` a la primera con la máquina al 10 % real, y **da igual cuánto se espere antes de preguntar**: no es cuestión de dejar pasar `MINIMUM_CPU_UPDATE_INTERVAL`, es que falta la muestra anterior. Sin calentarlo, el sidebar se abre diciendo que el equipo está al tope, que es la cifra más alarmante posible. `warm_up_cpu` mide ahora también el equipo, y el test comprueba `< 100.0` |
| 2026-08-07 | **El medidor se emite solo desde el hilo del poller**, no desde los otros caminos que publican la lista | Un porcentaje de CPU es el promedio entre dos muestras, no una foto: el poller es el único que corre a un ritmo conocido. Medir desde `kill_and_record` —milisegundos después de un ciclo— da otra vez **100 %**, así que el medidor se iría al tope cada vez que se mata un proceso. Medido repitiendo la medida a distintos plazos: 0 ms → 100 %; 10 ms → 11,6 %; 50 ms → 7,3 %; 100 ms → 3,3 %; 200 ms → 12,2 % |
| 2026-08-07 | Con el auto-refresco en **"Off" el medidor dice "En pausa"**, no la última cifra | Rust deja de medir, y una cifra vieja con pinta de actual es peor que ninguna. No hace falta estado nuevo: lo decide `refreshMs`, que es el mismo ajuste que para al poller |
| 2026-08-07 | **La cifra del equipo va nombrada y en su propia línea, con la RAM instalada a la vista** | El primer rótulo la pegaba a la del entorno —«1008 MB de 15.6 GB»— y dejaba el total solo en el tooltip, para ahorrar una línea. **El usuario lo leyó como su RAM instalada en el primer minuto**: tiene 31,9 GB, y 15,6 era lo que la máquina estaba usando. Ahora cada métrica lleva tres líneas —la tuya, la barra, y «Equipo» con su cifra—, y en RAM se enseñan las dos: `15.5 / 31.9 GB`. La unidad no se repite si ambas caen en la misma, que en 208 px se nota. Medido en la ventana: 154 px de alto, cero recortes | 
| 2026-08-07 | La guarda del intervalo vive como **variable local del hilo del poller** | Es el único sitio que mide, así que no hay nada que compartir. La alternativa —meterla en `AppState`— obligaba a elegir entre anidar candados o meter el `System` y la marca de tiempo en la misma estructura, tocando los cinco sitios que bloquean `sys`, incluidos los que matan procesos |
| 2026-08-07 | `SystemUsage` viaja en un **evento propio** (`system-usage`), no dentro de `processes-updated` | No se publican desde los mismos sitios (ver arriba), y meterlo en la lista habría cambiado un contrato del que dependen la ventana y sus pruebas. `types.test.ts` compara ahora los campos del struct de Rust con los del tipo de TypeScript: si Rust renombra uno, el frontend recibiría `undefined` y pintaría la barra a cero **sin romper nada** |
| 2026-08-18 | **`shadcn` sale de `dependencies`, pero no del proyecto** | Era el origen de las **7 alertas de `npm audit`** —arrastra un SDK de MCP, el servidor HTTP `hono` y `ts-morph`—, y sin embargo no se puede quitar: `src/index.css` importa `shadcn/tailwind.css`, que vive dentro del paquete. Movido a `devDependencies`, el árbol de producción queda a cero y el CSS compilado sale idéntico byte a byte |
| 2026-08-18 | **Las herramientas que faltan avisan; lo que encuentran, aborta** | `release.ps1` pasa ahora clippy, `cargo audit` y `npm audit --omit=dev`. Pero **el proyecto se trabaja desde varios equipos** y `cargo-audit` puede no estar instalado en uno: que eso impida cortar una versión sería peor que el riesgo que cubre. Se avisa y se sigue. Lo que sí aborta es una herramienta presente que encuentra algo — y encontró: `h2` 0.4.15 (RUSTSEC-2026-0258) la primera vez que se corrió |
| 2026-08-18 | **Los ajustes se escriben en un `.tmp` y se renombra encima** | `fs::write` trunca el destino antes de rellenarlo: un corte ahí dejaba el JSON a medias y el arranque siguiente volvía a los valores de fábrica **en silencio**, perdiendo los nombres vigilados, el umbral del Auto-Kill y hasta 200 entradas de historial. ⚠️ **Sin borrar el destino antes**, aunque la primera versión lo hacía: se creía que en Windows `fs::rename` falla si el destino existe y **es falso** —usa `MoveFileExW` con `MOVEFILE_REPLACE_EXISTING`—. Lo destapó la prueba, que siguió pasando al quitar el borrado; o sea que el borrado no defendía de nada y abría un instante sin ningún archivo bueno en disco |
| 2026-08-18 | El *error boundary* va **fuera** de `App`, en `main.tsx` | Si el fallo estuviera en el propio `App` —o en el `ThemeProvider` que lo envuelve—, una barrera puesta dentro no llegaría a montarse. Y es el único componente de clase del proyecto porque React no da equivalente en hooks para `getDerivedStateFromError` |
| 2026-08-18 | **La URL de la descarga se valida sobre la URL parseada, no sobre la cadena** | Tercera guardia de la misma familia que la de PID y la de rutas: `download_update` recibe el `ReleaseInfo` desde la ventana, así que la URL del instalador y la del `.sha256` son entrada del frontend — y verificar un archivo contra un hash que trae el mismo mensaje no verifica nada. **Se compara con `reqwest::Url::parse` y no con `starts_with` sobre el texto**, porque `Url::parse` normaliza los `..` del camino y resuelve la autoridad: sin eso, `…/releases/download/../../../evil.exe` y `https://github.com@malo.example/…` pasaban los dos. Es literalmente el fallo que ya tuvo la guardia de rutas con `Path::starts_with` el 2026-07-27, y por eso las dos están en los tests. Se valida **la URL que se pide, no a dónde acaba llevando**: GitHub redirige las descargas a `objects.githubusercontent.com`, así que exigir que el destino final sea github.com rompería la actualización entera |
| 2026-08-21 | **La app habla dos idiomas, y el idioma llega hasta Rust** | T4-01. El catálogo de la ventana está en `src/i18n.tsx` y el de Rust en `src-tauri/src/textos.rs`. **Rust necesita el suyo** porque el menú de la bandeja y las notificaciones de Windows son texto que la ventana no pinta, y son lo único que se ve con la app escondida. En los dos lados, **una clave sin traducir es un error de compilación**: en TypeScript porque `Catalogo` es `typeof es`, en Rust porque `Textos` es un `struct` con una constante por idioma. Las frases con número van como funciones y no como plantillas, porque los dos idiomas no ordenan igual —«3 procesos Node cerrados» frente a «3 Node processes closed»—. El texto con énfasis viaja marcado con `**negrita**` en vez de como JSX, para no escribir cada párrafo dos veces. **El español se copió carácter a carácter** y por eso las 175 pruebas anteriores siguen pasando sin tocar una aserción: el contexto arranca en español. El idioma **no se detecta del sistema** a propósito, y el selector se rotula «Idioma / Language» y va el primero de Ajustes |
| 2026-08-18 | **El backlog de la auditoría vive como una sección de ROADMAP.md, no como documento aparte** | Salió de una revisión completa del repositorio (12 áreas, 36 hallazgos, ninguno crítico) que pedía un ROADMAP por severidad —Tiers 0-4—, mientras que el de aquí son fases de desarrollo ya verificadas a las que apuntan CLAUDE.md y este mismo archivo. Sobrescribirlo habría borrado esa historia; un documento aparte habría abierto un quinto sitio donde mirar, en contra de la regla de «cada cosa vive en uno solo». Se añade al final, sin tocar una línea de los Tiers 1-9. **Los dos numerados se distinguen por el prefijo:** `Tier 4` es una fase, `T4-01` es una tarea del backlog. El informe completo, con problema, impacto y solución de cada punto, está en un [artifact](https://claude.ai/code/artifact/7e41ed95-15a4-4112-9958-71a6255c51ac); lo accionable está en el ROADMAP, que es lo que se mantiene |
| 2026-08-18 | **`npm run build` pasa a `tsc -b`, y la emisión va a `node_modules`** | `vitest.config.ts` no lo comprobaba ningún tsconfig, pero **meterlo en el `include` no arreglaba nada**: `tsc` a secas no construye las referencias de proyecto, así que el error inyectado a propósito seguía sin romper el build. Con `-b` sí. Eso arrastró dos cosas: el `@ts-expect-error` de `vite.config.ts` ya sobraba y con `-b` es **error** TS2578, no aviso; y `composite: true` **obliga a emitir** —`noEmit` da TS6310 en un proyecto referenciado—, así que `tsc -b` dejaba un `.js` y un `.d.ts` junto a cada config en la raíz. Eso **habría roto el corte de versión**: son archivos sin rastrear y `release.ps1` aborta con el árbol sucio. La emisión se redirige a `node_modules/.tmp/` |
| 2026-08-18 | **`-SkipTests` se niega si el `HEAD` no es el del último dry run** | El modificador existía para no repetir las comprobaciones tras un dry run, pero nada relacionaba las dos ejecuciones: sobre un árbol que cambió después, publicaba sin haber probado ese código. El dry run anota el `HEAD` en `%TEMP%` y `-SkipTests` lo compara. **Se niega en vez de avisar**, que la ficha dejaba a elección: un aviso se lo lleva el scroll y al otro lado está lo único que no se puede deshacer —`is_newer` es estrictamente mayor, así que una versión anterior ya no alcanza a quien instaló la mala— |
| 2026-08-18 | **Un solo aviso por acción: la guarda pasa a «solo la ventana»** | La bandeja y el atajo global sacaban **dos notificaciones de Windows por un clic**: la de puertos liberados que suelta `kill_and_record` y la del recuento al volver, justo en los caminos que se usan sin la ventana delante. Ahora los tres caminos sin ventana componen su mensaje entero, como ya hacía el Auto-Kill, y `kill_and_record` solo notifica cuando la orden viene de la ventana —donde el recuento ya se ve en pantalla y la notificación solo aporta los puertos—. El `dedup` de puertos sale a `processes::freed_ports` para que los cuatro usen el mismo |
| 2026-08-18 | **`prefers-reduced-motion` se cubre por duplicado, y el ajuste de Windows va al revés de como suena** | Hacen falta **las dos piezas y ninguna vale por la otra**: `<MotionConfig reducedMotion="user">` gobierna lo que anima Motion (las filas que entran y salen) y la regla `@media (prefers-reduced-motion: reduce)` de `index.css` cubre las transiciones de CSS (las barras de RAM, que animan su anchura en cada refresco). ⚠️ **La media query se activa cuando «Efectos de animación» está APAGADO** en Accesibilidad de Windows; encendido —el estado por defecto— significa «sí quiero animaciones». La ficha del ROADMAP decía lo contrario y llevó a comprobarlo al revés. **No es verificable desde las pruebas ni emulando**: el doble de Motion quita las animaciones, y por CDP solo se puede leer la media query, no imponerla — y lo que había que probar era justo lo que ninguna emulación demuestra, que WebView2 traduzca el ajuste del sistema |
| 2026-08-18 | **El log lo abre Rust, no la ventana** | El botón «Abrir la carpeta» de Ajustes → Acerca de **habría fallado en la app real** y las pruebas no lo habrían visto: `opener:allow-open-path` está acotado a los dos avisos legales en `capabilities/default.json`, y en las pruebas `openPath` está doblado. Se podía arreglar de dos formas y se eligió la que no ensancha nada: en vez de añadir `$APPDATA` al permiso —con él, todo lo que la ventana podría pedirle al sistema que abra—, un comando `open_log_dir` donde **la ruta la calcula Rust** a partir de la que fijó el arranque, así que no viene del frontend y no hay nada que validar. Mismo criterio que las guardias de PID y de rutas del instalador. La prueba comprueba además que `openPath` **no** se llame |
| 2026-08-18 | **Log en archivo propio, no `tauri-plugin-log`, en UTC y con rotación de una generación** | En release no hay stderr —`windows_subsystem = "windows"`—, así que los 8 `eprintln!` del proyecto no los leía nadie. Módulo propio por el mismo criterio con el que aquí se escribió el actualizador en vez de usar `tauri-plugin-updater`: ~100 líneas, la rotación se prueba con `cargo test` sin montar una `App` —y todo el testing es local—, y no añade una dependencia que declarar en `THIRD-PARTY-NOTICES.txt`. **Se rota antes de escribir, no después**: rotar después dejaría el archivo por encima del tope todo el rato que va de un aviso al siguiente, que en esta app es casi todo el tiempo. Acotado a 1 MB pase lo que pase (512 KB × 2). **Marca en UTC con la `Z` puesta**: la hora local pediría otra dependencia o `unsafe`, y sin la `Z` se leería como local situando los avisos horas antes de cuando pasaron. El *error boundary* del frontend también escribe aquí, **recortado a 2.000 caracteres**, porque un componente fallando en bucle rotaría el log entero llevándose los avisos que explican cómo se llegó ahí |
| 2026-08-18 | **Los packs de skills se quedan en el repositorio, documentados** | Decisión del usuario: pueden hacer falta. Ni `.gitignore` ni submódulo. Al documentarlos apareció lo que la tarea daba por sabido y no era cierto: **`skills-lock.json` solo registra los 11 de `.agents/skills/`**, no los 7 de `.claude/skills/`, así que ignorarlos habría sido irreversible para esos siete —no hay de dónde reinstalarlos—. Sus licencias van en una **sección 5 aparte** de `THIRD-PARTY-NOTICES.txt`, porque las otras cuatro cubren solo lo que el instalador empaqueta y esto no viaja con la app: dos son Apache-2.0, nueve declaran MIT en el frontmatter sin adjuntar texto, **ocho no declaran nada**, y `ui-styling` se contradice (MIT en el SKILL.md, Apache-2.0 en su LICENSE.txt). Se anota la contradicción en vez de elegir por el autor |
| 2026-08-18 | **ESLint 9 —no 10— y el estado derivado se ajusta durante el render** | El frontend no tenía linter y el backend sí (clippy). La 10 no se puede usar: `eslint-plugin-jsx-a11y` declara como peer `eslint@^3 … ^9`, npm aborta, y forzarlo con `--legacy-peer-deps` dejaría el plugin sobre una API que no dice soportar. De los 148 avisos de la primera pasada, **142 eran de `.claude/skills/**`** —código de terceros, ignorado— y los 5 reales eran todos `react-hooks/set-state-in-effect`. Tres eran estado derivado de una prop sincronizado con un `useEffect`: ahora se ajusta **durante el render**, que es el patrón que React documenta y evita el render intermedio con el valor viejo. En los campos de Ajustes se compara contra **el valor anterior del ajuste, no contra el borrador**: son cosas distintas, y compararlos pisaría lo tecleado en cada pulsación. Los otros dos son cargas asíncronas al montar y la regla es un falso positivo —el `setState` cae tras un `await`—, así que se silencian uno a uno con su motivo, nunca la regla entera |
| 2026-08-18 | **No habrá firma de código Authenticode** | Descartada T4-02: exige un certificado de pago y no se va a comprar. Se cierra con la decisión escrita en vez de dejarla abierta fingiendo que algún día se hará — es la única tarea de la lista cuyo obstáculo no era técnico. Consecuencias asumidas: **SmartScreen seguirá avisando** de «editor desconocido» en cada instalación, y **el `.sha256` pasa a ser el mecanismo de integridad definitivo y no un respaldo provisional**, lo que lo hace más importante, no menos. `WinVerifyTrust` sigue sin implementarse porque sin certificado sería código muerto, y una comprobación que siempre falla enseña a ignorarla. El README deja de insinuar que la firma está en el plan |
| 2026-08-18 | **No hay CI, y no la va a haber: todo el testing se hace en local** | ⚠️ **Revocada el 2026-09-23**, ver la fila de esa fecha: la CI existe desde entonces; el corte local, no. Ratifica la decisión del 2026-07-24 y cierra T4-04, que pedía revisitarla. Nada de workflows ni de GitHub Actions. Lo que un runner habría cubierto —que las pruebas pasen antes de publicar— ya lo cubre el corte desde T2-02: `release.ps1` ejecuta `cargo test`, `npm test`, clippy y las dos auditorías, y **aborta** si algo falla. Lo que queda descubierto, dicho sin adornos: **nadie comprueba que el proyecto compile en un equipo limpio**. Cuando una prueba necesite un servicio de verdad —una API, una base de datos—, se levanta con **Docker en local**; para un servidor HTTP de usar y tirar dentro de una prueba, un `TcpListener` en un hilo cuesta menos y no pide daemon (ver la fila del tope de descarga) |
| 2026-08-18 | **El bucle de descarga sale de `download_and_verify` para poder probarlo** | El tope de 100 MB estaba escrito desde la auditoría pero **sin prueba, y por eso sin marcar**: era inalcanzable desde un test, porque `download_and_verify` valida la URL contra github.com antes de pedir nada —y debe seguir haciéndolo—, así que ningún servidor local llegaba al bucle. Extraído a `volcar_con_tope`, con el tope **por parámetro**: la prueba usa 64 KB contra un servidor que escupe 512 KB, y no hay que mover 100 MB por el loopback ni escribirlos en el disco de nadie. El servidor es un `TcpListener` en un hilo, **sin `Content-Length` a propósito**, que es el caso peor: una respuesta que no dice cuánto ocupa no deja nada que comparar por adelantado, solo contar lo que llega |
| 2026-08-14 | **El instalador se lanza con `/S /UPDATE /R`: la actualización es silenciosa** | Reportado por el usuario probándolo: al pulsar «Instalar» salían dos ventanas seguidas, la del desinstalador de la versión anterior y la del asistente de instalación. Los tres flags son de la plantilla NSIS de Tauri (`installer.nsi`, verificados en el `.nsi` generado en `target/release/nsis/x64/`) y cada uno quita una parte: `/S` el asistente, **`/UPDATE` la desinstalación previa** —la plantilla salta ese paso en modo actualización, y de paso conserva los accesos directos y no reinstala WebView2—, y `/R` vuelve a abrir la app al terminar, vía `RunAsUser`. `/R` **solo se mira en modo silencioso o pasivo**, así que sin `/S` no serviría de nada. No hay carrera con el `app.exit(0)` de `install_update`: el instalador silencioso mata la app él mismo si aún la encuentra viva (`CheckIfAppIsRunning` en `utils.nsh`) |
| 2026-08-23 | **El backlog cerrado sale de ROADMAP.md a `docs/REVISION-2026-08-18.md`** | **Revoca la decisión del 2026-08-18 de la fila de arriba, y por el mismo criterio que la sostenía.** Aquella decía que el backlog vivía en el ROADMAP porque *lo accionable* se mantiene ahí, y que un documento aparte abriría «un quinto sitio donde mirar». Con las 37 cerradas ya no hay nada accionable: son 834 líneas de historia dentro del documento que uno abre para ver el plan por fases, el 40 % del archivo. Es exactamente lo que llevó la bitácora fuera de este archivo el 2026-07-27 —«es historia, no estado»— y ahora aplica igual. En el ROADMAP queda el resumen por severidad y el enlace, que es lo que sigue siendo estado; el detalle de cada tarea, aparte. **Se conserva y no se borra** porque cuatro de las 37 se cerraron con una decisión escrita —sin CI, sin Authenticode, sin dividir el bundle, rendimiento medido— y esas siguen vigentes |
| 2026-08-23 | **La tabla de servicios lleva anchos declarados y medidos, no automáticos** | Con seis columnas la tabla automática pedía ~980 px y en la ventana mínima hay 692: desbordaba, y como el contenedor solo controla el eje Y el sobrante se escapaba al documento, dejando fuera de pantalla la cabecera y **la columna del nombre**. Con `table-fixed` lo que sobra se trunca y el nombre corto —la clave— se ve siempre. **Los anchos se miden en la ventana en marcha, no se estiman**: al estimarlos, «123 MB» partía en dos líneas y el desplegable cortaba «Automático (retrasa». Un `select` nativo **no** pone puntos suspensivos, corta la palabra a media letra, así que ahí no hay margen |
| 2026-08-23 | **La lista de un `select` toma el fondo del control, no las variables del tema** | ⚠️ **Sin efecto desde el 2026-09-23**: el arranque ya no es un `select` nativo (ver la fila de esa fecha). Se conserva porque vale para cualquier `select` nativo que vuelva. En el tema oscuro salía blanca, con el texto heredado de `--foreground` —casi blanco ahí— encima: ilegible. **Se arregló dos veces mal antes de acertar, y las dos por verificar el CSS y no el efecto.** Declarar `color-scheme: dark` es correcto y se queda (vale para las barras de scroll y el resto de controles nativos), pero **no basta**: lo que el navegador usa para pintar la lista es el `background-color` del propio `select`, y el nuestro era `bg-transparent` → blanco. Con `bg-card` queda resuelto en los dos temas. No se había visto nunca porque **solo pasa con la lista desplegada**, que es una ventana del sistema: no sale en una captura de la app, igual que los toast de Windows |
| 2026-08-23 | **La flecha del `select` es nuestra, no la nativa** | ⚠️ **Sin efecto desde el 2026-09-23**, por lo mismo que la fila de arriba. Chromium dibuja la flecha nativa contra el borde de la caja e **ignora `padding-right`**: subirlo de 8 a 12 px para despegarla del borde no la movió ni un pixel, aunque el relleno sí quedara aplicado en el DOM. La única forma de colocarla es `appearance-none` y poner la nuestra —el `ChevronDownIcon` de lucide, el mismo juego que el resto de la app— con `pointer-events-none` para que el clic siga llegando al control. Con la flecha propia, el hueco reservado es nuestro: `pr-7`, y la columna se queda en **200** con el texto en 133,3 de 138 disponibles |
| 2026-07-25 | El build se lanza con `ProcessStartInfo`, no con `& npm` | **En PowerShell `$env:VAR = ""` borra la variable en vez de dejarla vacía.** Con la clave sin contraseña hay que pasar un `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` vacío; al desaparecer, Tauri decide preguntar por consola y el build **se cuelga indefinidamente sin dar error**. `ProcessStartInfo.Environment` sí admite el valor vacío, y de paso la clave no toca la sesión de quien ejecuta el script |
| 2026-09-23 | **Hay CI en GitHub Actions: comprueba, pero no publica** | **Revoca T4-04 (fila del 2026-08-18)**, decisión del usuario con el repositorio ya público. Aquella se sostenía en que el corte local ya aborta si algo falla, y eso sigue siendo verdad; lo que no cubría —lo decía la propia fila— es que el proyecto compile en un equipo limpio, y con un repositorio público eso deja de ser teórico: un PR de alguien de fuera no pasa por `release.ps1`. Un repositorio público además tiene los runners gratis, que era parte del coste. `ci.yml` repite las comprobaciones de `release.ps1` —ESLint, `npm test`, `npm run build`, clippy y `cargo test` en **`windows-latest`**, porque `windows`, el SCM y `listeners` solo se prueban de verdad ahí— y las auditorías en Ubuntu, también **cada lunes**. **Lo que no cambia:** el corte de versión sigue siendo local (fila del 2026-07-24), el workflow no tiene secretos y corre con `contents: read`. `release.ps1` mantiene sus propias comprobaciones: la CI no sustituye al dry run, lo adelanta |
| 2026-09-23 | **El atajo global viene apagado, con la combinación elegible y dos pulsaciones** | Tier 11, A1; **precisa la fila del 2026-07-23**, que añadió el interruptor pero lo dejó encendido. Cierra todo lo vigilado sin confirmar y, al ser `RegisterHotKey`, se lo quita a todas las apps: en los IDE de JetBrains Ctrl+Alt+K es *Commit and Push* (comprobado en su documentación), así que quien lo pulsaba ahí cerraba sus servidores y el IDE ni recibía la tecla. El Auto-Kill nace apagado por matar sin preguntar, y esto por lo mismo. **Tres cambios:** `hotkeyEnabled` a `false` de fábrica —solo alcanza a quien no tenga el campo guardado—; la combinación se elige entre **una lista cerrada** (Ctrl+Alt+K, Ctrl+Alt+Shift+K, Ctrl+Alt+F12), no una tecla libre, que pediría un capturador para algo que se elige una vez; y **dos pulsaciones en 3 s**, encendido de fábrica. Esto último sí llega a quien ya tenía el atajo activo, porque su `settings.json` no trae el campo: es la mitad del arreglo que alcanza a los usuarios ya expuestos. La primera pulsación avisa por notificación de **cuántos** caerían. El atajo sale de `lib.rs` a `hotkey.rs` |
| 2026-09-23 | **El tipo de arranque es el `Select` de Base UI, y solo cambia al elegir una entrada** | Tier 11, A4; **deja sin efecto las dos filas del 2026-08-23 sobre el `select` nativo** (fondo de la lista y flecha propia), que eran arreglos de un control que ya no está. En WebView2 un `<select>` cerrado lanza `change` **con cada flecha** (medido: 1 flecha → 1 `change`): sobre «Automático», ↓ abría la confirmación para «Automático (retrasado)» con el foco en «Cambiar arranque», y un Enter confirmaba lo que no se quería, en la única acción que sobrevive al reinicio. En el de Base UI las flechas abren la lista. **Pero Base UI también cambia el valor tecleando una letra con la lista cerrada**, como el nativo, así que `onValueChange` solo acepta `reason === "item-press"` —clic o Enter sobre una entrada—. Verificado en la app en marcha: letra y flecha con el control cerrado no abren ningún diálogo |
| 2026-09-23 | **Procesos protegidos: nada de la app los cierra, y se comparan exactos** | Tier 11, A3. Cada entrada se compara **exacta**, sin distinguir mayúsculas, con el ejecutable, el script o la carpeta del proceso: por contenido, proteger `api` salvaría también a `rapid-api`. **Dos capas:** cada vía deja fuera a los protegidos al elegir —la bandeja, el atajo, el Auto-Kill y Nuke All—, para que los recuentos digan la verdad; y `kill_one` los rechaza otra vez, porque es la única puerta por la que pasan las cuatro y un comando de Tauri acepta los PIDs que le manden. **También el Kill de la fila**: un protegido no se cierra desde ningún sitio hasta que se le quita la protección, que es una regla sola en vez de «protegido salvo si». Desde el menú de la fila se protege **por la carpeta** (o el script, o el ejecutable, por ese orden): proteger `node` de un clic salvaría todos los Node, y eso se escribe en Ajustes. Prueba obligatoria, el criterio negativo: un proceso real lanzado por la prueba no cae por ninguna vía |
| 2026-09-23 | **Cada fila enseña su script y su carpeta, nunca la línea de comandos** | Tier 11, A2. En la auditoría, 13 de 15 filas eran `node.exe`. Se enseña el script reducido a un nombre —el paquete si está en `node_modules`, `-m módulo` en Python, `-e` para el código en línea— y el último tramo de la carpeta. **La línea entera no**, porque puede llevar tokens o URLs con credenciales y acabaría en una captura. La línea de comandos y la carpeta se leen **solo de los vigilados** y con `OnlyIfNotSet`: leerlas obliga a abrir cada proceso y copiar un trozo de su memoria, y no cambian mientras vive. **Los lanzadores de npm pasan por `node_modules\.bin\..\paquete`** y salían como `.bin` hasta resolver el `..`: visto en la verificación en vivo. La segunda línea lleva tope de ancho, porque sin él una como `@colbymchenry/codegraph-win32-x64 · ProcessDevKill` sacaba la tabla de la ventana a 1000 px (medido) |
| 2026-09-23 | **El orden de la tabla se congela con el puntero encima o un menú abierto** | Tier 11, A5. Kill cierra sin confirmar —bien, como el Administrador de tareas—, pero con el orden por RAM las filas se movían solas: un refresco movió 5 filas a la vez en reposo, y el botón bajo el cursor pasaba a ser el de otro. Se congela **la posición**, no los valores; los que mueren salen sin dejar hueco y los nuevos van al final. Congelar lo decide la tabla y ordenar lo hace App (`freezeOrder` en `lib/sort.ts`). Verificado en vivo: 8 refrescos seguidos con el puntero encima sin que se mueva una fila |
| 2026-09-24 | **Bordes de control y texto rojo tienen token propio; el anillo de foco es opaco** | Tier 11, B1 y B2. **`--control`** pinta los bordes de lo que se pulsa o se rellena —casillas, interruptores, campos, desplegables— a 3,6:1 en claro y 3,9:1 en oscuro, donde `--input` daba 1,26 y 1,74. Es un token aparte y no un `--input` más oscuro porque ese también pinta fondos (`bg-input/30`). **`--destructive-text`** es el rojo como texto, aparte del rojo de fondo, para subir el Kill a 5,5 / 6,3:1 sin apagar el Nuke All claro, que ya pasaba; el `--destructive` oscuro baja a 0,56 para que el blanco de Nuke All llegue a 4,9. **El anillo de foco va opaco** en todos los componentes —sin el `/50` que trae shadcn, ni el rojo al 20 % que tenía Kill—: 4,76:1 y 7,13:1, medidos en vivo. **Se editaron a mano componentes de shadcn** (`button`, `checkbox`, `input`, `select`, `switch`, `context-menu`), y el motivo queda en los comentarios de `index.css`, que es donde vive el token: si se regeneran con `shadcn add`, hay que volver a cambiar `border-input` por `border-control` y quitar los `/50` |
| 2026-09-24 | **Las opciones excluyentes de ajustes son un `radiogroup`: las flechas eligen** | Tier 11, B4. Idioma, Tema, la combinación del atajo y el Auto-refresco pasan de botones con `aria-pressed` a `Segmented.tsx`: un solo tabulador por grupo y flechas, Inicio y Fin para moverse. **Las flechas eligen al moverse**, que es lo que hace un grupo de radios en Windows. Es justo lo que se le quitó al tipo de arranque en A4, y la diferencia es deliberada: aquí cada opción se cambia y se deshace sin coste, allí el cambio sobrevive al reinicio. Por eso este control no se usa nunca para algo que cierre o que dure fuera de la app. Lo elegido se distingue por tres cosas y no solo por el color —fondo, borde a 3:1 y seminegrita—, y en el sidebar la vista activa lleva barra de acento |
| 2026-09-24 | **La casilla de «Seleccionar todos» se resuelve con espacio, no con tamaño** | Tier 11, B3. WCAG 2.5.8 admite un objetivo de 16 px si un círculo de 24 px centrado en él no pisa otro objetivo. Agrandar la casilla la habría dejado distinta de las de las filas, y ensanchar la columna habría sacado la tabla de la ventana a 1000 px, donde va justa desde A2. Lo que se hizo es pasar el hueco de dentro del botón «Proceso» a su celda: el texto no se mueve y el botón empieza fuera del círculo. axe ya no lo marca |
| 2026-09-24 | **La tabla de procesos va en `table-fixed`, y la barra de CPU y RAM, debajo de la cifra** | Tier 11, C1. Con anchos declarados el nombre es la única columna que crece y lo largo se trunca, como en Servicios. Pero con la barra al lado de la cifra, las columnas fijas sumaban 612 px y a 900 px al nombre le quedaban 65: medido. Debajo, CPU y RAM caben en 76 y 88 px y el nombre tiene 157 en la ventana mínima y 257 en la de fábrica. **La fila no crece** porque la segunda línea del nombre ya daba ese alto. Cada ancho sale de medir en la app lo que pide la columna en español, que tiene los rótulos más largos: si se añade una columna o se alarga un rótulo, hay que volver a medir. En las columnas alineadas a la derecha, la flecha de orden va delante del rótulo (C2) |
| 2026-09-24 | **Por debajo de 600 px de alto, el sidebar se compacta** | Tier 11, C3. Variante `short:` en `index.css`, `@media (max-height: 600px)`. Se esconden el subtítulo, el título del medidor y sus cifras del equipo. Esas dos últimas van a `sr-only` y no a `hidden`, porque un lector de pantalla sin ellas no sabe de qué son las cifras. Se eligió compactar antes que dejar solo el scroll de la navegación, porque con scroll «Ajustes» quedaba debajo del borde a 480 px. El scroll se queda igualmente, por si otro idioma o tamaño de letra lo pasa: **lo que no puede quedar fuera es el auto-refresco**. Compactado pide 469 px de 480 |
| 2026-09-24 | **El diálogo de confirmación tiene partes y tono** | Tier 11, C4. `ConfirmRequest` pasa a tener `message` (`Rico`), `warning` (recuadro), `note` (letra pequeña), `name` (lo que no se parte en el título) y `tone`. **`danger` es el valor por defecto**, así que una confirmación nueva sale en rojo salvo que se diga lo contrario; `change` —neutro— es solo para lo que cambia algo sin destruirlo. Hoy son los arranques que no dejan el servicio deshabilitado: pintar «Manual → Automático» igual que cerrar procesos enseña a no mirar el color. Las tres partes van dentro de la descripción del diálogo, un `div` en vez del `p` de fábrica, para que el lector de pantalla las lea al abrirlo. Ancho 448 px en vez de 384 |

## 5. Decisiones pendientes

**Solo lo que sigue abierto.** Las que se cerraron —el nombre, el repositorio, su renombrado, el
índice de `codegraph`— estaban aquí tachadas y se han quitado el 2026-08-23: una lista de pendientes
donde la mayoría son cosas hechas obliga a leerla entera para encontrar las dos que quedan. Están en
§4 si se cerraron con un motivo, y en la [bitácora](docs/BITACORA.md) si solo se hicieron.

- [ ] Lista inicial de procesos vigilados por defecto (¿incluir `java`, `deno`, `bun` desde el inicio?).
- [ ] Ampliar el catálogo de servicios de fábrica según lo que aparezca en equipos reales. Hoy son
      siete familias; lo que falte se puede añadir a mano en Ajustes, así que no bloquea a nadie.

> **La firma de código Authenticode ya no está aquí, y es a propósito.** Figuraba como pendiente
> hasta el 2026-08-23 aunque estuviera **decidida** desde el 2026-08-18: no la va a haber. Tenerla
> en las dos listas era el peor de los dos sitios —quien leyera esta la creería en el plan, y
> `release.ps1` y el README dicen lo contrario—. El motivo y sus consecuencias, en §4.

## 6. Cómo retomar el proyecto en otro equipo

1. Clonar el repositorio: `git clone https://github.com/xfiberex/ProcessDevKill.git`
2. Instalar prerequisitos: [Rust](https://rustup.rs) (`rustup`), Node.js LTS, y en Windows los **Microsoft C++ Build Tools**. WebView2 ya viene en Windows 11.
3. `npm install` en la raíz.
4. `npm run tauri dev` para desarrollo; `npm run tauri build` para generar el instalador.
5. `npm test` (frontend) y `cd src-tauri && cargo test` (backend) para comprobar que todo sigue en pie.
6. Leer este archivo (estado y decisiones) y el [ROADMAP.md](ROADMAP.md) (siguiente checkbox pendiente).

> **Cortar un release desde otro equipo no necesita ningún secreto**: basta con `gh` autenticado y el
> entorno de compilación. Lo único que hay que saber es que **el `.sha256` del instalador NSIS no es
> decorativo** —es lo que la app compara antes de ejecutar una actualización, y sin él se niega a
> actualizarse a esa versión—. Qué garantiza ese hash y qué no, en el
> [README](README.md#el-modelo-de-confianza-y-qué-no-cubre).

### Si el entorno de compilación falla: el toolset MSVC

Pasó en este equipo y cuesta un rato averiguarlo. Visual Studio 18 Community estaba instalado con
`cl.exe` y `link.exe`, pero **sin directorio `VC\include`** (cero headers de C) y solo con librerías
`lib\onecore\`, sin las de escritorio `lib\x64`. Síntomas: `LNK1104: no se puede abrir el archivo
'msvcrt.lib'` y, al forzar rutas OneCore a mano, `C1083: no se puede abrir el archivo incluir
'excpt.h'`.

Se resuelve añadiendo el componente que falta, desde PowerShell **como administrador**:

```powershell
& "C:\Program Files (x86)\Microsoft Visual Studio\Installer\setup.exe" modify `
  --installPath "C:\Program Files\Microsoft Visual Studio\18\Community" `
  --add Microsoft.VisualStudio.Component.VC.Tools.x86.x64 --passive --norestart
```

Comprobación rápida de que está sano: debe existir `…\VC\Tools\MSVC\<versión>\include\excpt.h`.

> `vswhere.exe` de este equipo no reporta VS 18 (`-products *` devuelve vacío) aunque la instalación
> sí esté registrada. No impidió compilar, pero puede confundir a herramientas que dependan de él.

## 7. Convenciones

**Están en [.claude/CLAUDE.md](.claude/CLAUDE.md), y solo ahí.**

Desde el 2026-07-25 esta sección las repetía, con una nota que pedía «cambiarlas en los dos sitios».
Eso es una promesa que nadie cumple: la lista de aquí ya se había quedado corta. `CLAUDE.md` es la
fuente única porque es lo que se carga solo al abrir una sesión de agente — el sitio donde una
convención sirve de algo es aquel donde se lee sin buscarla.

## 8. Registro de sesiones

Vive en [docs/BITACORA.md](docs/BITACORA.md), una entrada por sesión y la más reciente arriba.

Se separó de aquí el 2026-07-27: eran 180 líneas —más que el resto de este archivo— creciendo por
sesión dentro del documento que uno abre para saber en qué punto está el proyecto. **Es historia, no
estado.** Lo que sigue vigente está en las secciones de arriba; lo que narra cómo se llegó ahí, allí.
