# 🚀 Roadmap: ProcessDevKill

> Responde a **qué falta por hacer**. Lo abierto está aquí entero, con su criterio de aceptación;
> lo cerrado, en una línea por Tier y con su detalle en [docs/TIERS-1-11.md](docs/TIERS-1-11.md),
> [docs/TIER-12.md](docs/TIER-12.md) y [docs/TIER-13.md](docs/TIER-13.md).
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
> ⚠️ **Seis tareas reabren o precisan decisiones de [CONTEXT §4](CONTEXT.md)**, y lo dicen en su
> línea «Reabre»: T14-04, T14-14, T14-16, T14-17, T14-26 y T14-28. Si se adoptan, la decisión nueva
> va allí con su fecha.
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
| | **Total** | **30** | **1** | **13** | **16** | |

**Lo que se miró y se deja como está**, para que no vuelva como hallazgo: que Kill cierre sin
confirmar; que el diálogo arranque con el foco en el botón destructivo; que los avisos salgan abajo
a la derecha; que «Kill» y «Nuke All» vayan en inglés; que las barras se escalen al mayor de la
lista; que la combinación del atajo se pueda preparar con el atajo apagado; y la fuente Geist. Todo
eso está decidido en CONTEXT §4 y la auditoría no encontró motivo para reabrirlo.

### Fase A — La herramienta de medir

- [x] **[T14-01] El guion de la auditoría, en `tools/`, para poder repetir cada medida**
  - **Severidad:** baja · **Tipo:** herramienta
  - **Ubicación:** `tools/` (nuevo `auditoria-ui.mjs`), `.claude/CLAUDE.md` («Pruebas»)
  - **Lo medido:** las 186 capturas y las medidas salieron de un guion que vive en la carpeta
    temporal de la sesión y se pierde con ella. Casi todos los criterios de aceptación de este Tier
    piden volver a medir lo mismo.
  - **Qué hacer:** llevarlo a `tools/auditoria-ui.mjs`, sobre lo que ya comparte con
    `prueba-en-marcha.mjs` (la copia `envivo`, la clase `Cdp`, los procesos disfrazados). Fases
    elegibles por argumento: vistas, tamaños, zoom, foco, `forced-colors`, medidas (axe, contraste,
    objetivos, recortes, scroll, tabulación) y ventana entera. Con sus mismas reglas escritas arriba
    del archivo: solo cierra lo que lanza, comprueba que todo lo visible es suyo antes de abrir un
    Nuke, cancela los diálogos y no enciende nada que cierre procesos solo.
  - **Criterio de aceptación:** `node tools/auditoria-ui.mjs` deja las capturas y las medidas en
    una carpeta **fuera del repositorio** —enseñan los procesos reales del equipo—, sin tocar
    ningún proceso del usuario y borrando la carpeta de datos de la copia. CLAUDE.md dice cuándo se
    usa y que no sustituye a `prueba-en-marcha.mjs`. ESLint pasa sobre el archivo.
  - **Esfuerzo:** medio · **Depende de:** ninguna
  - **Hecho el 2026-10-05.** `tools/auditoria-ui.mjs`, con ocho fases elegibles por `--fases`:
    `vistas`, `tamanos`, `zoom`, `estados`, `foco`, `contraste`, `medidas` y `ventana`. Lo que
    comparte con `prueba-en-marcha.mjs` —la copia, la clase `Cdp`, los procesos propios— salió a
    `tools/envivo.mjs`, movido tal cual; las 28 comprobaciones en marcha pasan igual después.
    **Vuelve a escribirse, no se recuperó**: el guion de la auditoría se perdió con su sesión. Lo
    que da confianza en que mide lo mismo es que **repite sus cifras**: una pasada entera, 2 min
    10 s, dejó 185 capturas y 13 archivos de medidas, con la fila de seis puertos a 157 px frente
    a 52,5, la columna «Proceso» a 1.177 px a 1920×1080, Kill fuera por la derecha al 125 %, los
    interruptores a 1:1 con `forced-colors`, la barra de título en oscuro con la app en claro, 13
    y 10 paradas de tabulador en el sidebar y la cabecera, y axe 4.13 con cero violaciones en 16
    pasadas.
    - **No cierra nada desde la app**: no pulsa Kill ni confirma ningún diálogo, y solo usa
      Tabulador y Escape. Antes de abrir el diálogo de un lote compara los PID visibles con los
      que lanzó; se vio abrirlo con ocho procesos, los ocho suyos, y cancelarlo. `ajustar` se
      niega a cambiar otro ajuste que el tema, el idioma y los filtros del sidebar.
    - Se niega a escribir dentro del repositorio; por defecto, una carpeta temporal.
    - El color de cada estado se lee **de los píxeles de la captura**, no de los estilos: con
      `forced-colors`, `getComputedStyle` dice lo que pide la hoja y no lo que se pinta. El lector
      de PNG y el cálculo de contraste tienen seis pruebas.
    - **Lo que no trae y la auditoría sí hizo:** contar las ventanas del proceso tras un clic
      derecho (T14-02) y las teclas reales con `keybd_event`. Entran con las tareas que las piden.
    - **De paso, un fallo de `prueba-en-marcha.mjs` que en este equipo salía siempre:** el paso
      del pánico cerraba la app a los dos segundos de abrirla, con WebView2 a medio arrancar, y la
      carpeta de la copia no se podía borrar (`EPERM`): la prueba entera caía en la preparación.
      Ahora los guiones cierran la app con su árbol de procesos (`taskkill /T`).

### Fase B — Que se sienta una app de Windows

- [x] **[T14-02] El clic derecho fuera de una fila saca el menú del navegador**
  - **Severidad:** media · **Tipo:** problema
  - **Ubicación:** `src/App.tsx:76-86` (el único `keydown` global), `src/main.tsx`,
    `tools/prueba-en-marcha.mjs`
  - **Lo medido:** un clic derecho sobre el sidebar abre una ventana nueva del WebView
    (`Chrome_WidgetWin_1`, 439×270) con «Atrás · Actualizar (Ctrl+R) · Guardar como · Imprimir
    (Ctrl+P) · Más herramientas», en el idioma de Windows y no en el de la app. El evento
    `contextmenu` no se cancela ni en el sidebar ni en la cabecera. «Actualizar» recarga la ventana
    entera: se pierden la búsqueda, el filtro, el orden, la selección y la vista, y vuelve a salir la
    consulta a GitHub del arranque (`App.tsx:155-180`). **Lo que no se vio:** F5 con la tecla de
    verdad; enviado como mensaje a la ventana no recargó, y eso no prueba nada.
  - **Qué hacer:** cancelar `contextmenu` en toda la ventana salvo dentro de un campo de texto,
    donde copiar y pegar sí hacen falta; el menú de la fila sigue siendo el de la app. Y las teclas
    del navegador: F5 y Ctrl+R refrescan **la lista**, que es lo que hacen en el Administrador de
    tareas; Ctrl+P, Ctrl+G, F3, F7 y Ctrl+U no hacen nada.
  - **Criterio de aceptación:** en vivo, un clic derecho sobre el sidebar, la cabecera, el cuerpo
    vacío y un diálogo no abre ninguna ventana nueva del WebView (la misma comprobación de la
    auditoría, que ahora la encuentra), y dentro del buscador sí. Con teclas reales (`keybd_event`,
    con la ventana de la app delante), F5 y Ctrl+R dejan la búsqueda y el filtro como estaban y
    piden `get_processes`. El paso queda en `prueba-en-marcha.mjs`.
  - **Esfuerzo:** bajo · **Depende de:** ninguna
  - **Hecho el 2026-10-05.** `hooks/useVentana.ts`: el clic derecho se cancela en toda la ventana
    salvo en un campo de texto, F5 y Ctrl+R (también con Mayús) refrescan **lo que se mira** —la
    lista, los servicios o el historial— y Ctrl+P, Ctrl+G, Ctrl+U, F3 y F7 no hacen nada. El
    Ctrl+F de `App.tsx` se fue al mismo hook.
    - **En vivo, con ratón y teclas de verdad** (`prueba-en-marcha.mjs`, dos pasos): clic derecho
      sobre el sidebar, la cabecera, el cuerpo de Ajustes y un diálogo, contando las ventanas del
      proceso antes y después: ninguna nueva. En el buscador sí sale una (`Chrome_WidgetWin_1`,
      401×400), que es además lo que acredita que esa forma de mirar ve el menú. F5 y Ctrl+R con
      `keybd_event`: la búsqueda y el filtro siguen puestos, una marca en `window` sobrevive y se
      pide `get_processes`. **Con su control**: con el oyente de la app tapado, el mismo F5
      recarga la ventana, así que la tecla llega al navegador y es la app la que la para.
    - Las teclas reales las pulsa `tools/ventana-real.ps1`, que **solo pulsa si la ventana de
      delante es la de la copia** y lo vuelve a mirar antes de cada tecla; si Windows no cede el
      foco, el paso queda «sin comprobar». Es lo que quedaba dicho en T14-01.
    - **Lo que no se probó en vivo:** Ctrl+P, Ctrl+G, Ctrl+U, F3 y F7 con teclas reales; tienen
      su prueba de componente (el evento se cancela) y pasan por el mismo oyente que F5.

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

- [x] **[T14-06] Un proceso con varios puertos triplica el alto de su fila**
  - **Severidad:** media · **Tipo:** problema
  - **Ubicación:** `src/components/ProcessTable.tsx:120-129` (anchos) y `:277-295` (la celda)
  - **Lo medido:** la columna Puerto mide 92 px y en ella cabe una etiqueta por línea. Con seis
    puertos la fila mide **156,7 px frente a 52,4**: una sola fila se lleva el sitio de tres, y la
    tabla deja de leerse en columna.
  - **Qué hacer:** una sola línea de etiquetas: el primer puerto y un «+5» que dice cuántos más
    hay, con la lista entera al pasar el puntero, en el menú de la fila («Copiar puertos») y para el
    lector de pantalla. El buscador sigue encontrando la fila por cualquiera de ellos.
  - **Criterio de aceptación:** medido en vivo con el proceso de seis puertos del guion, su fila
    mide lo mismo que las demás (52,4 px); el nombre conserva al menos 150 px en la ventana mínima;
    buscar el sexto puerto encuentra la fila; el lector anuncia los seis.
  - **Esfuerzo:** medio · **Depende de:** ninguna
  - **Hecho el 2026-10-05.** La celda pinta el primer puerto y un «+5»; la lista entera va en el
    `title`, en «Copiar puertos» y en un texto oculto para el lector de pantalla.
    - **Medido** con el proceso de seis puertos del guion: su fila mide 52,5 px, como las demás
      (eran 157); buscando el sexto puerto sale su fila; a la vista «61113 +5» y para el lector
      «61113+5, 61114, 61115, 61116, 61117, 61118». El nombre sigue en 157 px en la ventana
      mínima: la columna no se ensanchó, se le quitó relleno a la celda.
    - **Lo que no se probó:** un lector de pantalla de verdad; lo que se comprueba es el texto
      accesible de la celda. Tampoco un «+12» en pantalla: está calculado para caber, no visto.

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

- [x] **[T14-12] El aviso de versión nueva lleva al principio de Ajustes, a tres pantallas del botón**
  - **Severidad:** media · **Tipo:** problema
  - **Ubicación:** `src/App.tsx:155-180`, `src/components/Sidebar.tsx` (`NavItem`),
    `src/components/SettingsView.tsx`
  - **Lo medido:** el botón «Ajustes» del aviso solo cambia de vista. «Descargar e instalar» queda
    más de 2.000 px más abajo, en una vista de 2.724 px con 623 a la vista. El aviso de administrador
    sí lleva a su sección (`irAAdmin`). Y pasados los 12 s del aviso, nada dice que hay una versión
    esperando.
  - **Qué hacer:** que el aviso lleve al grupo «Actualizaciones» con el foco en su título, por el
    mismo camino que `irAAdmin`, y que «Ajustes» lleve una marca en el sidebar mientras haya versión
    nueva, con su texto para el lector de pantalla.
  - **Criterio de aceptación:** en vivo, después de un corte —cuando la copia de prueba encuentra
    versión nueva—, pulsar el botón del aviso deja «Descargar e instalar» dentro de la ventana, y la
    marca de «Ajustes» sigue ahí al cambiar de vista. Prueba de componente de las dos cosas.
  - **Esfuerzo:** bajo · **Depende de:** ninguna
  - **Hecho el 2026-10-05.** El botón del aviso lleva al grupo «Actualizaciones» con el foco en su
    título, por el camino de `irAAdmin`, que pasa a ser `irA` con un destino. «Ajustes» lleva un
    punto en el sidebar mientras el actualizador tenga una versión disponible, y el botón se lee
    «Ajustes, hay una versión nueva»; con `forced-colors` el punto usa el color del sistema.
    - **Visto en vivo sin esperar al corte**: la copia de prueba se compiló una vez con la
      versión de `Cargo.toml` bajada a la 1.10.1, y encontró la v1.10.2. El aviso salió al
      arrancar, su botón dejó «Descargar e instalar» a 515 px en una ventana de 680, con el foco
      en «Actualizaciones», y la marca seguía en el Historial. El paso queda en el guion y se
      repite solo cuando la copia va por detrás de lo publicado. Tres pruebas de componente.

### Fase D — Teclado y avisos

- [x] **[T14-13] Tras un Kill con el teclado, el foco se pierde**
  - **Severidad:** media · **Tipo:** problema
  - **Ubicación:** `src/components/ProcessTable.tsx`, `src/hooks/useKills.ts`, `src/App.tsx`
  - **Lo medido:** con el foco en el Kill de una fila e Intro, la fila sale en 558 ms y el foco
    queda en `body`. Tras confirmar un lote, lo mismo. Volver a la primera fila son más de veinte
    tabuladores. Cancelar el diálogo sí devuelve el foco al botón que lo abrió.
  - **Qué hacer:** al salir la fila que tenía el foco, llevarlo al Kill de la que ocupa su sitio; si
    era la última, al de la anterior; si no queda ninguna, al buscador. Tras un lote, a la casilla de
    la primera fila que quede. Solo cuando el foco estaba dentro de la tabla: un cierre desde la
    bandeja o el Auto-Kill no mueve nada.
  - **Criterio de aceptación:** en vivo y con teclado de verdad, sobre procesos del guion: tras
    Intro en un Kill, el elemento activo es el Kill de la fila siguiente; tras confirmar un lote, una
    casilla o el buscador, nunca `body`. Un cierre desde fuera de la ventana no cambia el foco.
    WCAG 2.4.3.
  - **Esfuerzo:** medio · **Depende de:** ninguna
  - **Hecho el 2026-10-05.** La tabla recuerda en qué fila empezó un cierre pedido desde la
    ventana y, cuando la fila sale, lleva el foco al Kill de la que ocupa su sitio —a su casilla si
    está protegida—; tras un lote, a la casilla de la primera que queda; sin filas, al buscador.
    **Solo si el foco se ha quedado sin dueño**: si ya está en otro sitio, no se toca.
    - **En vivo, con Intro de verdad** sobre cuatro servidores del guion y el buscador puesto en
      su carpeta, para que la tabla solo tenga filas suyas: tras Intro en un Kill, el foco está en
      el Kill de la fila siguiente; tras confirmar un lote de dos, en la casilla de la que queda;
      y al cerrar esa desde fuera de la ventana, la app no lo lleva a ningún sitio. Ocho pruebas
      de componente, con los tres criterios negativos.
    - **Va algo más lejos que la tarea:** actúa también tras un Kill con el ratón, porque el clic
      deja el foco en el botón que desaparece. No se ve —no hay anillo de foco tras un clic—, y el
      siguiente Tab sale de la fila siguiente y no del principio.

- [x] **[T14-14] La tabla son dos paradas de tabulador por fila, y las flechas no hacen nada**
  - **Severidad:** media · **Tipo:** mejora
  - **Ubicación:** `src/components/ProcessTable.tsx`
  - **Lo medido:** con 26 procesos, una vuelta de tabulador por Procesos son **74 paradas**: 13 del
    sidebar, 10 de la cabecera y los encabezados, y 51 de las filas. Flecha abajo y Supr sobre una
    fila no hacen nada. En el Administrador de tareas y en Process Explorer la lista es una sola
    parada: las flechas eligen fila y Supr la cierra.
  - **Qué hacer:** la tabla como una sola parada, con la fila activa: flechas, Inicio y Fin la
    mueven; Espacio marca la casilla; Supr hace lo mismo que el Kill de esa fila, y nada si está
    protegida; Mayús+F10 sigue abriendo el menú. **A decidir con el usuario:** si Supr cierra sin
    preguntar, como Kill, o pide una segunda pulsación.
  - **Decidido el 2026-10-05:** Supr **pregunta** antes de cerrar. El botón Kill de la fila sigue
    cerrando sin preguntar; la tecla, que se pulsa sin mirar, no.
  - **Criterio de aceptación:** una vuelta de tabulador por Procesos baja de 74 paradas a menos de
    30 con los mismos 26 procesos. Con teclas de verdad y procesos del guion: las flechas mueven la
    fila activa, Supr cierra la suya y no la protegida. El lector anuncia cada fila con su nombre, su
    script y sus puertos, y axe sigue en cero.
  - **Esfuerzo:** alto · **Depende de:** T14-13
  - **Reabre:** CONTEXT §4 del 2026-07-27, que descartó el `tabIndex` en la fila «por las veinte
    paradas de tabulación que añadiría». Esto no añade: quita las dos que cada fila ya tiene.
  - **Hecho el 2026-10-05.** La fila es la parada: una sola con `tabindex="0"` —la última que tuvo
    el foco, o la primera— y las casillas y los Kill fuera del tabulador, aunque siguen ahí para el
    ratón. Flechas, Inicio y Fin mueven el foco; Espacio marca; Supr abre la confirmación de un
    cierre con el nombre y el PID, y sobre una fila protegida o que ya se cierra no hace nada.
    - **Medido:** una vuelta de tabulador por Procesos son **24 paradas** (eran 74 con 26
      procesos): las 13 del sidebar, las 10 de la cabecera y los encabezados, y una de la tabla.
      axe sin violaciones en las 16 pasadas y al 200 %.
    - **En vivo, con teclas de verdad** sobre cinco servidores del guion: Flecha abajo, Fin e
      Inicio mueven la fila activa; Supr abre la confirmación, Escape la cancela sin cerrar e
      Intro cierra, con el foco en la fila que ocupa su sitio; sobre la protegida, Supr no abre
      nada; dos filas marcadas con Espacio se cierran en lote y el foco va a la primera que
      queda; y un cierre desde fuera de la ventana no lo mueve. Doce pruebas de componente.
    - **Cambia lo de T14-13:** tras un cierre el foco va a la fila, no a su Kill ni a su casilla,
      que ya no son paradas.
    - **Mientras el foco de teclado está en la tabla, el orden se congela**, como con el puntero
      encima: sin eso, la fila de debajo cambiaba entre una flecha y la siguiente.
    - **Lo que no se probó:** un lector de pantalla de verdad. Lo comprobado es el nombre
      accesible de cada fila —«node.exe, server.js · tienda, puerto 3000, PID 101»— y que la tabla
      describe sus teclas. Tampoco Mayús+F10 con teclas reales: el menú se abre con el evento
      `contextmenu`, que ahora sale de la fila enfocada.
    - **De paso, un fallo del paso de F5 del guion:** comparaba el filtro con su recuento
      («Node.js21»), y fallaba si el usuario abría o cerraba un Node en ese instante.

- [x] **[T14-15] Un aviso de error dura cuatro segundos y no se puede cerrar ni releer**
  - **Severidad:** media · **Tipo:** problema
  - **Ubicación:** `src/components/ui/sonner.tsx`, `src/hooks/useKills.ts`, `src/hooks/useSettings.ts`
  - **Lo medido:** el aviso de «No se pudieron guardar los ajustes» trae 150 caracteres —la ruta
    del archivo y el error de Windows— y desaparece a los **4,3 s**, sin botón de cerrar: no da
    tiempo a leerlo, y no queda en ningún sitio de la ventana. Los de éxito duran 4,5 s, que para
    «bun.exe cerrado» está bien. La región que los contiene se llama «Notifications alt+T», en
    inglés, con la app en español.
  - **Qué hacer:** los de error y los de advertencia se quedan hasta que se cierran, con su botón;
    los de éxito siguen yéndose solos. La región, con nombre en el idioma de la app.
  - **Criterio de aceptación:** en vivo, con el guardado fallando: el aviso sigue ahí a los 15 s y
    se va con su botón, que tiene nombre en los dos idiomas. El de éxito se va solo. La región se
    llama «Avisos» o «Notifications» según el idioma. WCAG 2.2.1.
  - **Esfuerzo:** bajo · **Depende de:** ninguna
  - **Hecho el 2026-10-05.** `lib/avisos.ts` envuelve el `toast` de sonner: `error` y `warning`
    salen sin caducidad y con botón de cerrar, `success` e `info` como antes. Todo el código
    importa de ahí, y `avisos.test.ts` falla si alguien importa de `sonner`. La región y el botón
    toman su nombre del catálogo.
    - **En vivo** (dos pasos nuevos): con el guardado fallando, el aviso sigue a los 15 s, su
      botón se llama «Cerrar aviso» y se va al pulsarlo; la región se anuncia «Avisos alt+T» —el
      atajo lo añade sonner—. El de éxito, el cierre de un servidor del guion, se va solo antes
      de 10 s.
    - **Lo que no se hizo:** que un aviso cerrado se pueda releer después. El criterio no lo pide
      y haría falta un sitio donde guardarlos; ahora no caduca, que es lo que impedía leerlo.

### Fase E — Tamaños de ventana y zoom

- [x] **[T14-16] Con cinco runtimes vivos, «Ajustes» queda detrás del scroll del sidebar**
  - **Severidad:** media · **Tipo:** problema
  - **Ubicación:** `src/components/Sidebar.tsx:112-183`
  - **Lo medido:** los filtros van dentro de la misma lista con scroll que las cuatro vistas, entre
    «Procesos» y las otras tres. Con seis runtimes con procesos, la navegación pide 332 px y tiene
    292, tanto a 1000×680 con el aviso de administrador como a 900×480: «Ajustes» queda fuera. Cada
    filtro son 26 px, así que pasa desde cinco runtimes vivos a la vez. Con «mostrar siempre todos»,
    también se esconde «Historial».
  - **Qué hacer:** las cuatro vistas no hacen scroll nunca. Lo que se desplaza, si no cabe, es la
    lista de filtros, con su propio alto máximo.
  - **Criterio de aceptación:** medido en vivo con los siete filtros a la vista y el aviso de
    administrador, a 1000×680 y a 900×480: los cuatro botones de vista se ven enteros sin desplazar
    nada, y lo único que hace scroll son los filtros. Sale de «Lo que queda suelto» la nota de
    T13-07.
  - **Esfuerzo:** bajo · **Depende de:** ninguna
  - **Reabre:** precisa CONTEXT §4 del 2026-10-02 y del 2026-10-03 (T13-01 y T13-07): esconder los
    filtros vacíos y avisar del scroll ya no hacen falta para proteger la navegación.
  - **Hecho el 2026-10-05.** La lista de filtros es lo único que cede dentro de la `nav`: hace
    scroll ella, y las cuatro vistas no. No baja de tres filtros de alto.
    - **Medido** (`auditoria-ui.mjs`, con «mostrar siempre todos» y el aviso de administrador): a
      1000×680, ocho filtros en 139 px de 210, las cuatro vistas enteras y el aviso a la vista; a
      900×480, lo mismo con el aviso escondido, como ya hacía por debajo de 620 px de alto.
    - **Al 200 % de zoom** (500×340) no caben ni las cuatro vistas con tres filtros: ahí la que
      hace scroll vuelve a ser la `nav` entera. Es el caso que tenía antes cualquier ventana.
    - La nota de T13-07 sale de «Lo que queda suelto».

- [x] **[T14-17] Con zoom, Kill se va detrás del scroll horizontal**
  - **Severidad:** media · **Tipo:** problema
  - **Ubicación:** `src/components/ProcessTable.tsx:99-129`
  - **Lo medido:** al 125 % en la ventana de fábrica la tabla tiene 577 px y pide 620: sale scroll
    horizontal, del botón Kill se ve la «K» y el nombre se queda en 100 px («node.e…»). Al 150 %
    hay 444 px; al 200 %, 277, y axe marca `target-size`. Lo que se sacrifica es la acción para la
    que se abrió la app.
  - **Qué hacer:** antes de recortar el nombre o esconder Kill, se van las columnas secundarias
    según el ancho que haya —primero «Activo», luego «PID»—, que siguen en el menú de la fila. Y la
    columna de Kill se queda pegada a la derecha cuando aun así hay scroll.
  - **Criterio de aceptación:** medido en vivo: al 125 % en la ventana de fábrica no hay scroll
    horizontal y el nombre tiene al menos 140 px; al 150 % y al 200 %, Kill se ve entero sin
    desplazar la tabla y el nombre no baja de 100 px. axe sin `target-size` al 200 %.
  - **Esfuerzo:** medio · **Depende de:** T14-06
  - **Reabre:** precisa CONTEXT §4 del 2026-09-25 (Tier 11, E), que resolvió el zoom con un ancho
    mínimo y scroll horizontal.
  - **Hecho el 2026-10-05.** El cuerpo de la vista es un contenedor: por debajo de 660 px se va
    «Activo», por debajo de 572 también «PID», y los dos están en la primera línea del menú de la
    fila. El ancho mínimo baja de 620 a 468 px, y por debajo de 572 la columna de Kill va pegada a
    la derecha.
    - **Medido:** al 125 % no hay scroll horizontal y el nombre mide 145 px (eran 100, con Kill
      cortado); al 150 % y al 200 % hay scroll, el nombre mide 100 px y Kill se ve entero. axe sin
      violaciones al 200 %. A 900×480 y a 1000×680 sin zoom, las ocho columnas, como antes.
    - **Lo que cuesta:** con Kill pegado, su celda lleva el fondo de la vista y no el de la fila,
      así que el resaltado de la fila bajo el puntero o seleccionada no llega a ese trozo.

- [x] **[T14-18] Con zoom, la pista «Ctrl F» pisa el texto del buscador**
  - **Severidad:** media · **Tipo:** problema
  - **Ubicación:** `src/components/ProcessesHeader.tsx:59-101`, `src/components/ViewHeader.tsx`
  - **Lo medido:** al 125 % el texto de ejemplo queda debajo de la pista: «…carpeta, PID» y encima
    «Ctrl F». Al 200 % el buscador se queda sin sitio entre el título, el recuento, Refrescar y
    Nuke All, y la pista cae sobre el título «Procesos»: el campo no se puede usar.
  - **Qué hacer:** la pista se esconde cuando el campo no da para las dos cosas, y el texto de
    ejemplo se recorta con puntos suspensivos. Con la cabecera estrecha, el buscador baja a una
    segunda fila, a todo el ancho.
  - **Criterio de aceptación:** en las capturas al 125, 150 y 200 % nada se pisa, y el buscador mide
    al menos 180 px en las tres. A 1000×680 sin zoom, la cabecera sigue midiendo 57 px. WCAG 1.4.4.
  - **Esfuerzo:** bajo · **Depende de:** ninguna
  - **Hecho el 2026-10-05.** La cabecera es un contenedor (`@container/cabecera`): por debajo de
    520 px el buscador baja a una segunda fila a todo el ancho. La pista «Ctrl F» solo sale con
    440 px de campo o más, y el texto de ejemplo acaba en puntos suspensivos si no cabe.
    - **Medido:** al 125 % el buscador mide 307 px, sin la pista, y el texto de ejemplo se
      recorta (pide 314 y tiene 263); al 150 %, 419 px en su segunda fila, y cabe entero; al 200 %,
      252 px, recortado. Nada se pisa en las tres capturas. A 1000×680 sin zoom la cabecera sigue
      en 57 px y la pista sigue ahí. **A 900×480 la pista ya no sale**: el campo mide 407 px y el
      umbral es uno solo para los dos tamaños de letra.
    - **Un dato que no estaba en la tarea:** por debajo de 768 px de ventana el campo sube a
      16 px de letra, y el texto de ejemplo pasa de pedir 314 px a 359.

- [ ] **[T14-19] En una ventana ancha, el puerto queda a más de mil píxeles de su proceso**
  - **Severidad:** baja · **Tipo:** mejora
  - **Ubicación:** `src/components/ProcessTable.tsx:102`
  - **Lo medido:** el nombre es la única columna que crece. A 1920×1080 mide **1.177 px** y el resto
    queda pegado al borde derecho: entre «node.exe» y su puerto hay una franja vacía que el ojo
    tiene que cruzar fila a fila.
  - **Qué hacer:** un tope de ancho para la columna del nombre, con la tabla alineada a la
    izquierda. El sitio que sobra se queda en blanco, o lo aprovecha más adelante una columna con la
    ruta (T14-10).
  - **Criterio de aceptación:** medido a 1600×1000 y a 1920×1080, la columna «Proceso» no pasa de
    560 px. A 1000×680 y a 900×480, nada cambia.
  - **Esfuerzo:** bajo · **Depende de:** ninguna

- [x] **[T14-20] En la ventana mínima, el nombre de un servicio se queda en siete letras**
  - **Severidad:** media · **Tipo:** problema
  - **Ubicación:** `src/components/ServicesView.tsx:180-197`
  - **Lo medido:** a 900×480 las cinco columnas fijas suman 568 px y al nombre le quedan 124; con el
    icono y el relleno, unos 70 de texto: «com.doc…», «MSSQL$…», «postgre…». Es lo que identifica
    la fila. Mientras, «Arranque» ocupa 200 px y el botón de la acción, 116. El comentario del
    archivo dice que al nombre le quedan 152: se quedó viejo.
  - **Qué hacer:** repartir de otra forma: «Arranque» a lo que pide «Automático (retrasado)», y el
    botón de la acción, solo con su icono por debajo de cierto ancho, con el nombre accesible que ya
    tiene. El comentario, al día.
  - **Criterio de aceptación:** medido a 900×480, la columna del nombre mide al menos 200 px y
    «postgresql-x64-17» se lee entero. El desplegable sigue enseñando «Automático (retrasado)» sin
    recortar. A 1000×680 no hay ningún nombre corto recortado de los nueve servicios del equipo de
    pruebas, salvo el de 26 caracteres.
  - **Esfuerzo:** bajo · **Depende de:** ninguna
  - **Hecho el 2026-10-05.** «Arranque» baja de 200 a 184 px —el `Select` va con el relleno
    apretado—, RAM y Puertos a 72 y 68, y por debajo de 760 px de cuerpo el botón de la acción se
    queda en su icono, con su nombre accesible y un `title`. El comentario, al día.
    - **Medido:** a 900×480 la columna del nombre mide 201 px (eran 124) y «postgresql-x64-17» se
      lee entero; a 1000×680, 252 px y ningún nombre corto recortado, tampoco el de 26 caracteres.
      «Automático (retrasado)» pide 128,5 px y el desplegable le deja 132 —medido sobre el control,
      porque ningún servicio de este equipo arranca así—. 201 es con la barra de scroll de la
      vista puesta: no sobra nada.
    - Con zoom la tabla sigue en su ancho mínimo y con scroll horizontal: eso es T14-17.

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

- [x] **[T14-22] Con un tema de contraste no se sabe qué interruptor está encendido**
  - **Severidad:** alta · **Tipo:** problema
  - **Ubicación:** `src/components/ui/switch.tsx`, `src/components/Segmented.tsx`,
    `src/components/Sidebar.tsx` (`BarraActiva`), `src/components/ProcessTable.tsx` (la fila
    marcada), `src/index.css`
  - **Lo medido:** con `forced-colors: active`, que es como llegan al WebView los temas de contraste
    de Windows, los ocho interruptores de Ajustes son una cápsula vacía: el pulgar, la pista y el
    fondo salen los tres en `#000000` —**1:1**—, encendido o apagado, y solo queda el borde. No se
    sabe si el Auto-Kill o el atajo están puestos. La opción elegida de Idioma, Tema y Auto-refresco
    solo se distingue por el grosor de la letra (600 frente a 500). La vista activa, el filtro
    activo y la fila marcada no se distinguen de las demás. En el código no hay ni una regla para
    `forced-colors`.
  - **Qué hacer:** variantes `forced-colors:` con los colores del sistema: el interruptor encendido
    en `Highlight` y con el pulgar a la vista en los dos estados; la opción elegida, la vista activa,
    el filtro activo y la fila marcada, con `Highlight` y `HighlightText` o con un borde.
  - **Criterio de aceptación:** en las capturas con `forced-colors`, cada uno de esos estados se
    distingue de su vecino por algo más que el grosor de la letra, y encendido frente a apagado
    llega a 3:1. **La emulación no basta:** se mira una vez con un tema de contraste de Windows de
    verdad (Configuración → Accesibilidad → Temas de contraste), o se dice que quedó sin ver.
    WCAG 1.4.11.
  - **Esfuerzo:** medio · **Depende de:** T14-01
  - **Hecho el 2026-10-05**, con un bloque `@media (forced-colors: active)` en `index.css` y no
    con variantes en cada componente: los de `ui/` los regenera shadcn, y las reglas tienen que
    ganar a las variantes `dark:`. Solo colores del sistema. **Medido sobre las capturas, con la
    emulación** (`auditoria-ui.mjs --fases contraste`), igual en los dos temas de la app:
    - los ocho interruptores: encendido, pista en `Highlight` frente al negro del apagado,
      **14,37:1**; el pulgar contra su pista, 14,37:1 encendido y 21:1 apagado. Eran 1:1;
    - la opción elegida de Idioma, Tema y Auto-refresco, la vista activa y el filtro activo:
      14,37:1 contra las demás;
    - la fila marcada lleva un contorno, y la casilla marcada va rellena.
  - **Dos cosas que la tarea no pedía y salieron al mirar las capturas:**
    - **el foco no se veía.** En toda la app es un `ring`, que es una sombra, y con
      `forced-colors` las sombras no se pintan. Ahora lleva contorno: en 8 de 8 paradas medidas;
    - el rótulo de lo elegido salía como un rectángulo negro: el navegador pinta una placa detrás
      de cada texto, y sobre `Highlight` lo tapa. Se arregló con `forced-color-adjust: none`.
  - `src/forced-colors.test.ts` compara las reglas con el marcado: si un `data-slot` desaparece,
    falla. **Quedó sin ver con un tema de contraste de Windows de verdad**: cambiarlo afecta a
    todo el equipo del usuario, y el guion no lo toca. La emulación dio siempre la misma paleta.

- [x] **[T14-23] Con un tema de contraste desaparecen las barras de CPU y RAM**
  - **Severidad:** baja · **Tipo:** problema
  - **Ubicación:** `src/components/UsageBar.tsx`, `src/components/UsageMeter.tsx`,
    `src/components/ServicesView.tsx` (`Estado`)
  - **Lo medido:** en las mismas capturas, las barras de la tabla y las del medidor no se pintan, ni
    el punto de estado de cada servicio. Las cifras y el texto «Parado» siguen: no se pierde ningún
    dato, pero la tabla se queda sin lo que deja comparar de un vistazo.
  - **Qué hacer:** pintar la barra y su carril con colores del sistema, o con borde, cuando hay
    `forced-colors`. Lo mismo el punto de estado.
  - **Criterio de aceptación:** en las capturas con `forced-colors`, las barras se ven y su relleno
    llega a 3:1 contra el carril.
  - **Esfuerzo:** bajo · **Depende de:** T14-22
  - **Hecho el 2026-10-05**, en el mismo bloque. El carril lleva contorno y el relleno va en
    `Highlight`: **14,37:1** contra el carril, medido en una barra a medio llenar de la tabla.
    En el medidor, el relleno del equipo va detrás, en gris. El punto de estado de un servicio:
    corriendo, relleno; parado, hueco. Visto en las capturas de Procesos y de Servicios. Con la
    emulación, como T14-22.

### Fase G — Ajustes y contenido

- [x] **[T14-24] Ajustes son 2.724 px de scroll sin forma de saltar a un grupo**
  - **Severidad:** media · **Tipo:** mejora
  - **Ubicación:** `src/components/SettingsView.tsx:324-336` y `Grupo`
  - **Lo medido:** la vista mide 2.724 px y a 1000×680 se ven 623: cuatro pantallas y media. Los
    cinco grupos del Tier 11 ordenan la lectura, pero «Actualizaciones» empieza pasados los
    2.100 px y «Acerca de» va detrás; para llegar hay que arrastrar la barra o tabular por casi
    todas las 38 paradas de la vista.
  - **Qué hacer:** una fila fija bajo la cabecera con los cinco grupos —General, Vigilancia,
    Automatismos, Actualizaciones y Acerca de—, que lleva a cada uno con el foco en su título y marca
    en cuál se está al desplazarse. Es el camino que ya usan el aviso de administrador y T14-12.
  - **Criterio de aceptación:** desde arriba, cualquier grupo queda a un clic o a una tecla. La fila
    cabe en la ventana mínima en los dos idiomas, es un `nav` con nombre, y axe sigue en cero. Al
    desplazarse a mano, la marca sigue al grupo que se ve.
  - **Propuesta del usuario (2026-10-05), a resolver al empezar la tarea:** en vez de una fila de
    saltos sobre una sola página larga, **partir Ajustes en secciones**, cada una con su botón
    colgando de «Ajustes» en el sidebar —como los filtros cuelgan de «Procesos»—, de modo que cada
    sección sea una vista corta y no haga falta desplazarse. Cambia la tarea: ya no es saltar
    dentro de 2.724 px, es que no existan. A mirar entonces: el sitio en el sidebar, que desde
    T14-16 reparte el alto entre las vistas y los filtros; adónde llevan el aviso de
    administrador y el de versión nueva (`irA`); y si un grupo solo sigue pasando del alto de la
    ventana mínima.
  - **Esfuerzo:** medio · **Depende de:** ninguna
  - **Hecho el 2026-10-05, con la propuesta del usuario y no con la fila de saltos.** Ajustes son
    seis secciones —General, Sistema, Vigilancia, Automatismos, Actualizaciones y Acerca de—, cada
    una con su botón colgando de «Ajustes» en el sidebar, y la vista pinta solo la elegida.
    - **Son seis y no los cinco grupos que había:** partida en cinco, «General» sola medía
      1.065 px y seguía con scroll en la ventana de fábrica, que era lo que se venía a quitar. El
      atajo global y los permisos de administrador salieron a «Sistema».
    - **Medido** (`auditoria-ui.mjs`): a 1000×680, las seis miden 623 px con 623 a la vista:
      ninguna pide scroll, y su lista cabe entera en el sidebar (158 px de 158). axe sin
      violaciones en las seis. El contraste con `forced-colors` se midió sección a sección.
    - **En vivo** (35 comprobaciones, con la copia una versión por detrás): el aviso de versión
      nueva lleva a «Actualizaciones», con «Descargar e instalar» a 515 px de 680 y el foco en el
      título; los pasos que buscan un ajuste entran antes en su sección. Seis pruebas de
      componente: cada sección enseña lo suyo y solo eso, se vuelve a la que se dejó, y lo escrito
      a medias en un campo sigue ahí al pasar por otra.
    - **Lo que no queda resuelto: la ventana mínima.** A 900×480, General, Sistema y Vigilancia
      piden 577, 561 y 532 px con 423 a la vista, y la lista de secciones del sidebar hace scroll
      (139 px de 158): «Acerca de» queda detrás. Las otras tres caben.
    - **De paso:** dentro de Ajustes el aviso de «sin modo administrador» se queda en su título.
      Con sus dos líneas, las seis secciones no cabían en el sidebar ni en la ventana de fábrica.
    - El criterio de la tarea hablaba de la fila de saltos —que cupiera en la ventana mínima, que
      la marca siguiera al desplazarse—: ya no aplica. Lo que sí: es un `nav`, cada sección está a
      un clic, y axe sigue en cero.

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

- [x] **[T14-27] Las cifras van con punto decimal también en español**
  - **Severidad:** baja · **Tipo:** mejora
  - **Ubicación:** `src/lib/format.ts`, `src/components/ProcessTable.tsx:303`,
    `src/components/UsageMeter.tsx`, `src/i18n.tsx:136`
  - **Lo medido:** «0.0%», «2.0 GB» y «6.2 / 7.2 GB» salen de `toFixed`, que escribe siempre punto.
    Las fechas ya siguen al idioma de la app (T12-39); los números, no. Y el subtítulo del sidebar
    dice «Process Manager» con la app en español.
  - **Qué hacer:** `Intl.NumberFormat` con el idioma de la app para porcentajes y memoria, y el
    subtítulo traducido. **A decidir con el usuario:** si en español se quiere la coma, o se prefiere
    el punto por costumbre de quien programa; en ese caso se anota y la tarea se queda en el
    subtítulo.
  - **Decidido el 2026-10-05:** se queda el **punto**, también en español. La tarea se reduce al
    subtítulo del sidebar.
  - **Criterio de aceptación:** con la app en español, la tabla, el medidor y los avisos escriben
    los decimales igual entre sí; en inglés, como hoy. Pruebas de `format.ts` en los dos idiomas.
  - **Esfuerzo:** bajo · **Depende de:** ninguna
  - **Hecho el 2026-10-05, reducida al subtítulo** por la decisión de arriba: en español dice
    «Gestor de procesos». Los decimales se quedan con punto en los dos idiomas. Sale de la lista
    de entradas que `i18n.test.tsx` deja coincidir con el inglés. Visto en las capturas.

- [ ] **[T14-28] El aviso de «sin modo administrador» no se puede apartar**
  - **Severidad:** baja · **Tipo:** mejora
  - **Ubicación:** `src/components/Sidebar.tsx:224-249`, `src-tauri/src/storage.rs`, `src/types.ts`
  - **Lo medido:** arrancar sin elevar es lo de fábrica, así que el estado normal de la app lleva un
    recuadro ámbar de 84 px que no se va nunca. Un aviso permanente deja de leerse, y ocupa el sitio
    que le falta a la navegación (T14-16).
  - **Qué hacer:** que se pueda cerrar, y que se recuerde. La explicación entera y el botón de
    reiniciar elevada siguen en Ajustes, y un Kill que falla por permisos sigue diciendo por qué.
  - **Criterio de aceptación:** cerrado el aviso, no vuelve al reiniciar la app; en Ajustes se puede
    volver a enseñar. Con la app elevada no cambia nada.
  - **Esfuerzo:** bajo · **Depende de:** ninguna
  - **Reabre:** la decisión del 2026-09-24 (Tier 11, modo administrador), que puso el aviso fijo en
    el sidebar a petición del usuario.

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

### Lo que queda suelto

Cosas que los Tiers 12 y 13 dejaron dichas y sin hacer. No son del Tier 14: son lo que quedó de
antes, y siguen aquí hasta que alguien las haga o las descarte.

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
  próxima auditoría, o antes si la app saliera para Linux.
- **El inglés no lo ha leído un hablante nativo** (T12-35), y desde la v1.10.0 hay más: las
  notas de cada versión, en `CHANGELOG.en.md` (T13-04).
- **Seis avisos altos en las dependencias de desarrollo, todos el mismo** (T13-02): `braces`
  ([GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)) no tiene versión
  arreglada, y llega por `shadcn`. No viaja en el instalador y solo corre cuando quien desarrolla
  lanza el CLI de `shadcn`. Se quita cuando `braces` publique el arreglo; hasta entonces sale
  en el resumen de cada ejecución de la CI.
- **Las pruebas con la app en marcha siguen fuera de la CI de cada push** (T13-03). El runner
  las aguanta, en unos 10 minutos, y se pueden lanzar a mano con `gh workflow run
  en-marcha.yml`. Falta decidir si compensa pasarlas a cada push. Y un camino del guion no ha
  corrido nunca: el que deja «sin comprobar» un paso cuando GitHub contesta 403 al runner.
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
