# 🚀 Roadmap: ProcessDevKill

> Responde a **qué falta por hacer**. Lo abierto está aquí entero, con su criterio de aceptación;
> lo cerrado, en una línea por Tier y con su detalle en [docs/TIERS-1-11.md](docs/TIERS-1-11.md),
> [docs/TIER-12.md](docs/TIER-12.md) y [docs/TIER-13.md](docs/TIER-13.md). **Las tareas hechas del
> Tier 14, que sigue abierto, están en [docs/History.md](docs/History.md)**: aquí solo las abiertas.
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
| 13 | [Más runtimes y lo que el Tier 12 dejó suelto](docs/TIER-13.md): **Java, Deno y Bun** de fábrica, las notas de versión en inglés, el ajuste de los filtros y lo que nunca se había visto en marcha | v1.10.0 y v1.10.1 |
| — | [Revisión del 2026-08-18](docs/REVISION-2026-08-18.md): 37 tareas, cerradas | v1.3.2 a v1.5.0 |

---

## 🎛 Tier 14: Auditoría de diseño UI/UX — abierto el 2026-10-03
*Objetivo: que se sienta una aplicación de Windows y no una página, que «¿quién tiene el puerto?» se
resuelva sin leer de más, y que con teclado, con zoom o con un tema de contraste no se pierda nada.*

> **Sale de una auditoría de diseño del 2026-10-03 sobre el código de la v1.10.1**, con la app en
> marcha: la copia de prueba (`target/envivo`, con su propia carpeta de datos) conducida por CDP.
> **186 capturas** —las cuatro vistas en claro y oscuro, en español e inglés, a 900×480, 1000×680,
> 1280×800, 1600×1000 y 1920×1080; zoom al 125, 150 y 200 %; menús, diálogos, avisos, selección y
> búsqueda; el foco de teclado de cada control; `forced-colors` emulado; y la ventana entera con
> `PrintWindow`— y **26 archivos de medidas**: axe-core 4.13, el contraste de cada texto y cada
> borde, el tamaño de cada control, lo que se recorta, lo que hace scroll y el orden real de
> tabulación.
>
> **Solo se cerraron procesos que lanzó el propio guion**, buscados por PID. Los diálogos se
> cancelaron, salvo uno: el de un lote de dos procesos del guion. No se encendieron el atajo global,
> el Auto-Kill ni el arranque como administrador, y no se pulsó Arrancar, Detener, Deshacer,
> Instalar ni Reiniciar como administrador. La carpeta de datos de la copia se borró al terminar.
>
> **Lo que el Tier 11 dejó bien sigue bien**: axe da cero violaciones y cero incompletos en las
> cuatro vistas, los dos temas y los dos idiomas a 1000×680; el anillo de foco mide 4,76:1; y Escape
> cierra el desplegable del arranque en menos de 100 ms sin cambiar nada. Lo de aquí es lo que
> aquella auditoría no miró: el marco de la ventana, los tamaños fuera del de fábrica, el zoom por
> encima del 125 %, los temas de contraste, adónde va el foco y lo que el género da por hecho —el
> Administrador de tareas, Process Explorer, Docker Desktop—.
>
> ⚠️ **Es una sola pasada, sin segunda opinión.** Se lanzaron cuatro auditores en paralelo —flujos,
> visual, accesibilidad y contenido— y los cuatro se cortaron al llegar al límite de uso de la
> sesión, sin devolver nada. Lo que hay aquí salió de quien condujo la app, mirando las capturas y
> midiendo. Por eso cada tarea dice **lo medido** y lo que no se vio: para poder discutirla.
>
> **La segunda opinión llegó el 2026-11-11**, con `/impeccable critique` sobre la vista de
> Procesos de la v1.10.7: dos evaluadores separados, uno de diseño y otro con el detector de la
> skill, uno detrás de otro sobre la copia de prueba. **27/40**, «aceptable». El detector salió
> limpio; lo que encontró la revisión es la fase I. Un límite: la copia corrió dentro del sandbox
> de la sesión y ninguna fila enseñó puerto, así que lo del puerto se juzgó por el código y las
> capturas del README.
>
> ⚠️ **Siete tareas reabren o precisan decisiones de [CONTEXT §4](CONTEXT.md)**, y lo dicen en su
> línea «Reabre»: T14-04, T14-14, T14-16, T14-17, T14-26, T14-28 y T14-36. Si se adoptan, la
> decisión nueva va allí con su fecha.
>
> Esfuerzo: **bajo** = una sesión corta; **medio** = una sesión larga o dos; **alto** = varias.

| Fase | Qué | Tareas | Alta | Media | Baja | Esfuerzo |
|---|---|---|---|---|---|---|
| A | La herramienta de medir | 1 | 0 | 0 | 1 | 1 medio |
| B | Que se sienta una app de Windows | 4 | 0 | 1 | 3 | 1 medio, 3 bajos |
| C | Encontrar y cerrar sin dudar | 7 | 0 | 4 | 3 | 4 medios, 3 bajos |
| D | Teclado y avisos | 3 | 0 | 3 | 0 | 1 alto, 1 medio, 1 bajo |
| E | Tamaños de ventana y zoom | 6 | 0 | 4 | 2 | 1 medio, 5 bajos |
| F | Temas de contraste de Windows | 2 | 1 | 0 | 1 | 1 medio, 1 bajo |
| G | Ajustes y contenido | 5 | 0 | 1 | 4 | 1 medio, 4 bajos |
| H | Ideas del género | 2 | 0 | 0 | 2 | 2 medios |
| I | La segunda opinión (2026-11-11) | 8 | 2 | 4 | 2 | 1 alto, 4 medios, 3 bajos |
| | **Total** | **38** | **3** | **17** | **18** | |

**Lo que se miró y se deja como está**, para que no vuelva como hallazgo: que Kill cierre sin
confirmar; que el diálogo arranque con el foco en el botón destructivo; que los avisos salgan abajo
a la derecha; que «Kill» y «Nuke All» vayan en inglés; que las barras se escalen al mayor de la
lista; y que la combinación del atajo se pueda preparar con el atajo apagado. Todo eso está
decidido en CONTEXT §4 y la auditoría no encontró motivo para reabrirlo. **Nuke All en rojo lleno**
se volvió a mirar el 2026-11-11 y se queda, por decisión del usuario. **La fuente Geist** también
estaba en esta lista; el usuario la reabrió el 2026-11-11 para probarla contra la del sistema
(T14-36).

### Fase A — La herramienta de medir

Todas hechas: están en [docs/History.md](docs/History.md).

### Fase B — Que se sienta una app de Windows

- [ ] **[T14-03] La barra de título no sigue al tema de la app**
  - **Severidad:** baja · **Tipo:** problema
  - **Ubicación:** `src-tauri/src/commands.rs` (`save_settings`), `src-tauri/src/lib.rs` (arranque),
    `src-tauri/src/storage.rs` (`Theme`)
  - **Lo medido:** con Windows en oscuro y la app en «Claro», la barra de título sigue negra sobre
    una ventana blanca: `DWMWA_USE_IMMERSIVE_DARK_MODE` vale 1 en los dos temas de la app. El tema
    solo se aplica dentro del WebView; nada llama a `set_theme`.
  - **Qué hacer:** que Rust le pase el tema a la ventana al arrancar y al guardar los ajustes
    (`WebviewWindow::set_theme`): claro, oscuro, o `None` con «Sistema», que es dejar que mande
    Windows.
  - **Criterio de aceptación:** en vivo, con la captura de la ventana entera y Windows como esté:
    la barra de título coincide con la app en «Claro» y en «Oscuro» (`DWMWA_USE_IMMERSIVE_DARK_MODE`
    a 0 y a 1), y con «Sistema» no se fuerza nada. Cambiar el tema en Ajustes la cambia sin
    reiniciar. La otra mitad —Windows en el otro tema— no la puede poner el guion: la mira el
    usuario, o se dice que quedó sin ver.
  - **Esfuerzo:** bajo · **Depende de:** ninguna

- [ ] **[T14-04] La ventana no recuerda su tamaño ni su sitio**
  - **Severidad:** baja · **Tipo:** mejora
  - **Ubicación:** `src-tauri/tauri.conf.json` (`width`, `height`, `center`), `src-tauri/src/lib.rs`,
    `src-tauri/src/storage.rs`
  - **Lo medido:** cada arranque abre a 1000×680 y centrada, se dejara como se dejara. A ese tamaño
    caben 11 de las 26 filas del equipo de pruebas; quien la agranda lo hace cada vez.
  - **Qué hacer:** guardar tamaño, posición y si estaba maximizada al cerrar, y restaurarlos al
    abrir. Con un archivo propio junto a los demás, como el resto de la persistencia, o con
    `tauri-plugin-window-state`, que obliga a regenerar los avisos de terceros.
  - **Criterio de aceptación:** cerrar a 1400×900 en una esquina y abrir deja la ventana igual. Si la
    posición guardada cae fuera de las pantallas que hay —un monitor desenchufado—, se centra. El
    primer arranque sigue siendo 1000×680 centrada, y el mínimo de 900×480 se respeta.
  - **Esfuerzo:** medio · **Depende de:** ninguna
  - **Reabre:** precisa CONTEXT §4 del 2026-07-24 (`"center": true`): centrar queda para el primer
    arranque y para cuando lo guardado no vale.

- [ ] **[T14-05] Las barras de scroll son las clásicas, con flechas**
  - **Severidad:** baja · **Tipo:** mejora
  - **Ubicación:** `src/index.css`
  - **Lo medido:** las tres zonas con scroll —la navegación del sidebar, el cuerpo de cada vista y
    las notas de versión— pintan la barra clásica de 15 px con botones de flecha, que es lo que más
    delata al WebView en una app de Windows 11.
  - **Qué hacer:** `scrollbar-width: thin` y `scrollbar-color` con el token `--control`, que ya da
    3,6:1 en claro y 3,9:1 en oscuro. Con `forced-colors`, la del sistema.
  - **Criterio de aceptación:** en las capturas de las cuatro vistas y los dos temas la barra es fina
    y sin flechas, y el pulgar llega a 3:1 contra su fondo. axe sigue en cero.
  - **Esfuerzo:** bajo · **Depende de:** ninguna

### Fase C — Encontrar y cerrar sin dudar

- [ ] **[T14-07] El diálogo de un lote no dice qué va a cerrar**
  - **Severidad:** media · **Tipo:** problema
  - **Ubicación:** `src/hooks/useKills.ts` (`askNuke`), `src/components/ConfirmDialog.tsx`,
    `src/i18n.tsx:417-428`
  - **Lo medido:** «Cerrar 3 procesos. Se cerrarán los 3 procesos seleccionados», con la tabla
    desenfocada detrás: no se ve cuáles son, y los marcados pueden estar fuera de la vista. Con uno
    solo y un filtro puesto, el español dice **«Se cerrará todos los procesos de la lista
    filtrada»**: el verbo va en singular y el ámbito en plural.
  - **Qué hacer:** que el diálogo liste lo que va a cerrar —nombre, script, carpeta y puertos—,
    hasta seis líneas y «y 20 más» detrás. Con uno solo, nombrarlo en la frase. El foco inicial y
    los botones no cambian.
  - **Criterio de aceptación:** con tres procesos marcados, el diálogo los nombra a los tres con sus
    puertos; con 26, enseña seis y cuántos quedan; con uno, la frase concuerda en los dos idiomas,
    con prueba de cada caso. Sigue siendo la descripción del diálogo para el lector de pantalla.
  - **Esfuerzo:** medio · **Depende de:** ninguna

- [ ] **[T14-08] Buscar «3000» también encuentra el PID 13000**
  - **Severidad:** baja · **Tipo:** mejora
  - **Ubicación:** `src/hooks/useProcessList.ts` (`visible`), `src/components/ProcessesHeader.tsx:110-116`
  - **Lo medido:** el buscador compara por trozos en el nombre, el script, la carpeta, el PID y los
    puertos a la vez: «3000» encuentra el puerto 3000, el 30001 y el PID 13000. Y el recuento de la
    cabecera es un número suelto, «26», o «2» con un filtro, sin decir de cuántos; Servicios dice
    «9 servicios» y el Historial «27 cierres registrados».
  - **Qué hacer:** `:3000` busca el puerto exacto, y nada más. El recuento pasa a «26 procesos» y,
    con filtro o búsqueda, «2 de 26».
  - **Criterio de aceptación:** pruebas del filtro: `:3000` no deja pasar el puerto 30001 ni el PID
    13000; sin los dos puntos, todo sigue como ahora. El recuento dice el total cuando hay filtro,
    en los dos idiomas, y cabe en la ventana mínima.
  - **Esfuerzo:** bajo · **Depende de:** ninguna

- [ ] **[T14-09] El menú de la fila no se descubre, y no abre el puerto en el navegador**
  - **Severidad:** baja · **Tipo:** mejora
  - **Ubicación:** `src/components/ProcessTable.tsx:326-351` (la celda de Kill) y `:357-414` (el menú)
  - **Lo medido:** el menú tiene seis entradas —copiar PID, nombre, puerto y URL, proteger y
    cerrar— y solo sale con clic derecho o Mayús+F10: nada en la fila dice que existe. La URL se
    copia, pero no se abre, que es lo siguiente que se hace con ella.
  - **Qué hacer:** «Abrir http://localhost:3000» encima de «Copiar», con el `opener` que ya abre el
    repositorio desde Ajustes; se comprueba que su permiso cubre `http://localhost` sin ampliarlo. Y
    un botón «⋯» junto a Kill que abre el mismo menú, fuera del orden de tabulación para no sumar
    una parada por fila, y con nombre para el lector de pantalla.
  - **Criterio de aceptación:** en vivo, con un servidor del guion, la entrada abre su URL en el
    navegador del equipo; sin puertos, no sale. El «⋯» abre el menú con el ratón, la tabulación de
    Procesos no gana ninguna parada, y axe sigue en cero.
  - **Esfuerzo:** bajo · **Depende de:** ninguna

- [ ] **[T14-10] Desde la fila no se puede abrir la carpeta del proyecto**
  - **Severidad:** baja · **Tipo:** idea
  - **Ubicación:** `src-tauri/src/processes.rs`, `src-tauri/src/commands.rs`,
    `src/components/ProcessTable.tsx`
  - **Lo medido:** la fila enseña el nombre de la carpeta, pero la ventana no recibe su ruta: con
    dos proyectos llamados igual en sitios distintos no hay forma de saber cuál es cuál.
  - **Qué hacer:** un comando de Rust que abre en el Explorador la carpeta de trabajo de un PID
    **vigilado**, como `open_log_dir` abre la del log. La ruta no viaja a la ventana. Con la app sin
    elevar y el proceso elevado no hay ruta: la entrada sale apagada, con el motivo.
  - **Criterio de aceptación:** la prueba negativa: el comando se niega con un PID que no se vigila.
    En vivo, con un servidor del guion, abre su carpeta.
  - **Esfuerzo:** medio · **Depende de:** T14-09

- [ ] **[T14-11] El Historial no dice de qué proyecto era cada proceso**
  - **Severidad:** media · **Tipo:** mejora
  - **Ubicación:** `src-tauri/src/storage.rs:263-273` (`HistoryEntry`), `src-tauri/src/lista.rs`
    (`kill_and_record`), `src/types.ts`, `src/components/HistoryView.tsx`
  - **Lo medido:** una entrada guarda el PID, el nombre, los puertos, la hora y el origen. Una tanda
    de doce se resume como «node.exe ×8 · python.exe ×2 · dotnet.exe · java.exe»: si no liberó un
    puerto, no hay forma de saber qué se cerró. La tabla de Procesos lo resolvió con el script y la
    carpeta (Tier 11, A2); el Historial se quedó atrás.
  - **Qué hacer:** guardar el script y la carpeta de cada cierre, opcionales para que el
    `history.json` de antes se siga leyendo, y pintarlos como segunda línea, igual que en Procesos.
    El resumen de una tanda nombra las carpetas.
  - **Criterio de aceptación:** un `history.json` sin esos campos se lee entero y sus filas salen
    como hoy. Un cierre nuevo enseña «server.js · tienda-api»; `types.test.ts` vigila el espejo; y
    en vivo, el cierre de un servidor del guion sale en el Historial con su carpeta.
  - **Esfuerzo:** medio · **Depende de:** ninguna

### Fase D — Teclado y avisos

Todas hechas: están en [docs/History.md](docs/History.md).

### Fase E — Tamaños de ventana y zoom

- [ ] **[T14-21] En el Historial, «hace 3 minutos» y «Auto-Kill» parten en dos líneas**
  - **Severidad:** baja · **Tipo:** problema
  - **Ubicación:** `src/components/HistoryView.tsx:77`
  - **Lo medido:** la tabla es automática, y «Cuándo» se queda en 121 px: «hace 3 / minutos», «hace
    41 / minutos». «Auto-Kill» parte por el guion. Las filas miden entre 36,8 y 60,8 px según lo que
    les toque.
  - **Qué hacer:** anchos declarados, como en las otras dos tablas, y esas dos columnas sin salto de
    línea.
  - **Criterio de aceptación:** medido a 900×480 y a 1000×680, en los dos idiomas: todas las filas
    de un solo cierre miden lo mismo y ninguna hora ni ningún origen ocupa dos líneas.
  - **Esfuerzo:** bajo · **Depende de:** ninguna

### Fase F — Temas de contraste de Windows

Todas hechas: están en [docs/History.md](docs/History.md).

### Fase G — Ajustes y contenido

- [ ] **[T14-25] Ocho textos de ayuda de Ajustes pasan de 200 caracteres**
  - **Severidad:** baja · **Tipo:** mejora
  - **Ubicación:** `src/i18n.tsx` (`ajustes`), `src/components/SettingsView.tsx`
  - **Lo medido:** el de «Procesos protegidos» tiene 383 caracteres; los de los filtros, el atajo,
    «Al cerrar la ventana» y los permisos de administrador, unos 250. Son buena parte de los
    2.724 px, y lo que importa —«cierra sin pedir confirmación»— va a mitad de párrafo.
  - **Qué hacer:** una frase a la vista con lo que hace y su riesgo, y el resto en un «Más
    información» plegado, como ya se hizo con Servicios (Tier 11, D1). Sin quitar ningún aviso de
    los que van en negrita.
  - **Criterio de aceptación:** ningún texto a la vista pasa de 160 caracteres en ninguno de los dos
    idiomas; los avisos en negrita siguen a la vista; y Ajustes baja de 2.724 px.
  - **Esfuerzo:** bajo · **Depende de:** T14-24

- [ ] **[T14-26] Las notas de versión enseñan dentro de la app lo que es de puertas adentro**
  - **Severidad:** baja · **Tipo:** mejora
  - **Ubicación:** `src/lib/notas.ts`, `src/components/Actualizaciones.tsx`
  - **Lo medido:** las notas de la v1.10.1, leídas en Ajustes, terminan una frase con «(T13-07)» y
    traen un apartado «Interno» sobre las pruebas del proyecto. Quien va a pulsar «Descargar e
    instalar» no sabe qué es T13-07 ni le hace falta.
  - **Qué hacer:** que `leerNotas` quite las referencias a tareas y se salte los apartados «Interno»
    e «Internal». En GitHub y en el CHANGELOG siguen enteras.
  - **Criterio de aceptación:** pruebas de `notas.test.ts` con una sección real: sin «(T13-07)», sin
    el apartado interno, y los demás, intactos en los dos idiomas.
  - **Esfuerzo:** bajo · **Depende de:** ninguna
  - **Reabre:** precisa CONTEXT §4 del 2026-10-01 (T12-23 y T12-36): la app sigue leyendo las notas
    del release, pero ya no tal cual.

### Fase H — Ideas del género

- [ ] **[T14-29] El menú de la bandeja ofrece cerrar runtimes que no tienen ningún proceso**
  - **Severidad:** baja · **Tipo:** idea
  - **Ubicación:** `src-tauri/src/tray.rs`, `src-tauri/src/textos.rs`, `src-tauri/src/poller.rs`
  - **Lo medido:** el menú lista siempre los siete «Cerrar todos los…», haya procesos o no, sin
    decir cuántos caerían, y cada uno cierra sin preguntar. El sidebar ya esconde los filtros vacíos
    (T13-01); la bandeja, no. La pista del icono dice solo «ProcessDevKill».
  - **Qué hacer:** que el menú enseñe solo los runtimes con procesos, con su recuento —«Cerrar los
    17 de Node.js»—, y que la pista del icono diga cuántos procesos y cuántos puertos hay. El menú se
    rehace cuando cambian los recuentos, no en cada ciclo.
  - **Criterio de aceptación:** prueba de Rust de la lista de entradas a partir de unos recuentos:
    los vacíos no salen y los protegidos no cuentan. Los textos, en los dos idiomas y con su
    singular. **Lo que no se puede ver desde el guion** —el menú es nativo— se mira a mano y se dice.
  - **Esfuerzo:** medio · **Depende de:** ninguna

- [ ] **[T14-30] Filas compactas, para quien tiene veinte procesos**
  - **Severidad:** baja · **Tipo:** idea
  - **Ubicación:** `src/components/ProcessTable.tsx`, `src/components/SettingsView.tsx`,
    `src-tauri/src/storage.rs`
  - **Lo medido:** cada fila mide 52,4 px: caben 11 de 26 a 1000×680 y 7 en la ventana mínima, dos
    pantallas y media de scroll con la lista del equipo de pruebas. Las herramientas del género
    enseñan del orden del doble en el mismo alto.
  - **Qué hacer:** un ajuste de densidad, apagado de fábrica: el nombre y su detalle en una sola
    línea, y la barra de uso como fondo de la cifra. El objetivo de Kill no baja de 24 px.
  - **Criterio de aceptación:** medido con el ajuste encendido: la fila baja de 40 px y a 1000×680
    caben al menos 15. axe sigue en cero y ningún objetivo baja de 24 px. Apagado, nada cambia.
  - **Esfuerzo:** medio · **Depende de:** T14-06

### Fase I — La segunda opinión (2026-11-11)

Todas hechas: están en [docs/History.md](docs/History.md).

### Lo que queda suelto

Cosas que los Tiers 12 y 13 dejaron dichas y sin hacer, y lo que ha ido saliendo de la CI y de
Dependabot después. No son del Tier 14, y siguen aquí hasta que alguien las haga o las descarte.

- **La revisión legal de `THIRD-PARTY-NOTICES.txt` no se ha hecho** (T12-30). El archivo
  reproduce lo que se podía reproducir y dice lo que no. Por dónde empezaría: el cargador de
  WebView2 de Microsoft, enlazado en el binario y sin su licencia reproducida, y los 13
  componentes que no publican archivo de licencia. Con ella iría también si el ajuste de
  T12-31 basta en todas las jurisdicciones.
- **Los PR de Dependabot se miran y se fusionan a mano.** Los siete que abrió al encenderlo
  (`undici`, `hono`, `brace-expansion`, `ip-address`, `fast-uri`, `js-yaml` y `vitest`) se
  fusionaron el 2026-10-02. Seguirá abriendo otros: cada uno se lee, se comprueba que solo toca
  dependencias de desarrollo —o se regeneran los avisos de terceros si no— y se fusiona con la
  CI en verde. La alerta de `glib` (#36) se descartó el 2026-10-03 como «código que no se usa»:
  es un crate de Linux, no va en el binario de Windows, y su arreglo (0.20.0) no lo admite el
  `gtk` 0.18 que trae Tauri. `cargo audit` la sigue enseñando como aviso. Se vuelve a mirar en la
  próxima auditoría, o antes si la app saliera para Linux. El 2026-10-26 se fusionaron otros
  siete (#8 a #14), tras un rebase para que recogieran el `Cargo.lock` arreglado. **Cuando
  Dependabot falla en «Dependabot Updates» sin abrir PR**, suele ser una dependencia transitiva
  que su padre fija a versión exacta: pasó con `@vitest/mocker`, que solo se arregló subiendo
  `vitest`.
- **El inglés no lo ha leído un hablante nativo** (T12-35), y desde la v1.10.0 hay más: las
  notas de cada versión, en `CHANGELOG.en.md` (T13-04).
- **Un aviso alto en las dependencias de desarrollo: `zod` 3.25.76**
  ([GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5)), que llega por
  `shadcn` y por `eslint-plugin-react-hooks`. El arreglo (`zod` ≥ 4.6.6) pide `shadcn` 4.22, que
  rompe compatibilidad con el 3.8 que usamos: subirlo es una tarea, no un `npm audit fix`, y hay
  que mirar antes qué cambia en `shadcn add` y en los dos retoques obligatorios (Tier 11, B1). No
  viaja en el instalador y solo corre con el CLI de `shadcn` o con ESLint. El de `braces` que
  había aquí (T13-02) ya no lo da `npm audit` a 2026-10-26.
- **Las acciones de la CI corren en Node 20, que GitHub da por obsoleto.** `actions/checkout` y
  `actions/setup-node` están fijadas a la v4.4.0 y el runner las fuerza a Node 24 con un aviso;
  por ahora no falla. Se suben a una versión con Node 24, fijadas por SHA con la versión en un
  comentario (T12-26), en `ci.yml` y en `en-marcha.yml`, y se pasa la CI.
- **Las pruebas con la app en marcha siguen fuera de la CI de cada push** (T13-03). El runner
  las aguanta, en unos 10 minutos, y se pueden lanzar a mano con `gh workflow run
  en-marcha.yml`. Falta decidir si compensa pasarlas a cada push. Y un camino del guion no ha
  corrido nunca: el que deja «sin comprobar» un paso cuando GitHub contesta 403 al runner.
- **La CI está fijada a Node 24** (2026-11-17, CONTEXT §4). Con Node 26 —la LTS actual— el
  `localStorage` de Node tapa el de jsdom y las pruebas del frontend no arrancan. Para subir: que
  `src/test/setup.ts` o `vitest.config.ts` den a jsdom su propio almacenamiento (o lanzar Vitest
  sin el de Node), probarlo con Node 26 en local y volver a `lts/*` en `ci.yml` y `en-marcha.yml`.
- **Lo que sigue sin verse en vivo**, con sus pruebas pero sin haber pasado en la app:
  - un instalador cambiado tras la descarga **en la app instalada y elevada**, que es el caso
    exacto de T12-02; se vio en la copia de prueba, sin elevar (T13-05);
  - la descripción de la fila de un Java, un Deno o un Bun **de verdad**: en marcha solo se
    han visto copias de `PING.EXE` con esos nombres (T13-01);
  - un PID reciclado y una conexión lenta, que no se pueden provocar (T13-06).

---

## 🔎 Revisión 2026-08-18 — cerrada

Auditoría estática del repositorio sobre la v1.3.1, en doce áreas: **37 tareas y ningún hallazgo
crítico**, cerradas las 37 el 2026-08-21. Cuatro se cerraron por decisión o por medición, no
escribiendo código: no habrá firma Authenticode (T4-02), el bundle no se divide porque no compensa
(T4-05), el rendimiento se midió (T4-03) y no había CI (T4-04, **revocada el 2026-09-23**: ver
CONTEXT §4). El detalle, en [docs/REVISION-2026-08-18.md](docs/REVISION-2026-08-18.md).

> **Los numerados se distinguen por el prefijo:** `Tier 4` es un Tier de este documento, `T4-01`
> una tarea de aquella revisión, `T12-01` una del [Tier 12](docs/TIER-12.md), `T13-01` una del
> [Tier 13](docs/TIER-13.md) y `T14-01` una del Tier 14, que es el que está abierto arriba.
