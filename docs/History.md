# 📜 History: ProcessDevKill

> Las tareas **hechas** del Tier 14, enteras, con su criterio de aceptación y lo que se midió al
> cerrarlas. Salieron del [ROADMAP](../ROADMAP.md) el 2026-11-17, a petición del usuario, para que
> allí quede solo lo abierto; cada una conserva su número (`T14-xx`) y su fase. Por qué se decidió
> cada cosa, en [CONTEXT §4](../CONTEXT.md); qué trajo cada versión, en el
> [CHANGELOG](../CHANGELOG.md). Los Tiers anteriores, ya cerrados, están en
> [TIERS-1-11.md](TIERS-1-11.md), [TIER-12.md](TIER-12.md) y [TIER-13.md](TIER-13.md).

## 🎛 Tier 14: Auditoría de diseño UI/UX — lo hecho

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

- [x] **[T14-19] En una ventana ancha, el puerto queda a más de mil píxeles de su proceso**
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
  - **Hecho el 2026-11-11.** La tabla lleva `max-w-270` (1080 px): las fijas suman 520 y el nombre
    se queda en 560 como mucho, con el sitio que sobra en blanco a la derecha.
    - **Medido** con `auditoria-ui.mjs --fases medidas`: «Proceso» de 560 px a 1600×1000 y a
      1920×1080 (eran 1.177); 257 a 1000×680 y 157 a 900×480, como antes. axe, en cero.

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

- [x] **[T14-28] El aviso de «sin modo administrador» no se puede apartar**
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
  - **Hecho el 2026-11-11.** El aviso lleva una equis (abajo a la derecha: arriba, con Geist, el
    título partía en dos líneas y los filtros volvían a hacer scroll, visto en las capturas). Se
    guarda como `hideAdminNotice` y vuelve con «Avisar en el sidebar…» en Ajustes → Sistema. Al
    ocultarlo, el foco va al auto-refresco. Precisa la decisión del 2026-09-24 en CONTEXT §4.
    - **En vivo:** `prueba-en-marcha.mjs` lo aparta con su equis, comprueba `settings.json`,
      recarga y no vuelve, y el interruptor lo devuelve. Las seis secciones de Ajustes siguen
      cabiendo sin scroll a 1000×680 (623/623, medido). Con la app elevada no hay aviso: no se pudo
      ver en vivo, lo cubre la prueba de componente.

### Fase I — La segunda opinión (2026-11-11)

Sale de la `critique` de impeccable sobre la vista de Procesos de la v1.10.7 (ver la nota del
Tier 14 en el [ROADMAP](../ROADMAP.md)). Lo medido es de la copia de prueba por CDP; lo que solo se
leyó en el código lo dice. El usuario eligió hacerlas todas en una tanda, empezando por T14-31, con
Nuke All en rojo lleno y la fuente a prueba. Salieron en la v1.11.0.

- [x] **[T14-31] La fila con el foco de teclado no se ve**
  - **Severidad:** alta · **Tipo:** problema
  - **Ubicación:** `src/components/ProcessTable.tsx:410`, `tools/auditoria-ui.mjs`,
    `tools/prueba-en-marcha.mjs`
  - **Lo medido:** la fila activa tiene `:focus-visible` y su `outline-style` calculado es `none`,
    en claro y en oscuro. En Tailwind v4, `outline-none` pone `--tw-outline-style: none` y
    `focus-visible:outline-2` escribe `outline-style: var(--tw-outline-style)`: comprobado en el CSS
    compilado. La única pista de qué fila tiene el foco es que su Kill se pone rojo, que se lee como
    «armado» y no como «estás aquí». Con `forced-colors` sí se ve. T14-14 se dio por bueno con axe
    en cero, y axe no mira si el foco se ve.
  - **Qué hacer:** que el contorno se pinte (`focus-visible:outline-solid`, o sin `outline-none`) y
    que la fila con el foco lleve el mismo fondo que bajo el puntero. Y una comprobación que no
    dependa de mirar: el estilo calculado de la fila activa.
  - **Criterio de aceptación:** en vivo, en claro y en oscuro, la fila activa tiene un contorno
    sólido de 2 px en `--ring` y su fondo cambia. `prueba-en-marcha.mjs` falla si vuelve a salir
    `outline-style: none`. WCAG 2.4.7.
  - **Esfuerzo:** bajo · **Depende de:** ninguna
  - **Hecho el 2026-11-11.** `focus-visible:outline-solid` y el fondo del puntero en la fila con
    el foco, salvo en la marcada. **En vivo**, tras una Flecha abajo de verdad, la fila activa tiene
    `outline-style: solid` de 2 px y un fondo distinto del de las demás; el guion falla si vuelve.

- [x] **[T14-32] La fila se presenta por `node.exe`, y lo que la distingue es lo primero que se recorta**
  - **Severidad:** media · **Tipo:** problema
  - **Ubicación:** `src/components/ProcessTable.tsx:366`, `src/i18n.tsx` (diálogo de Supr y aviso
    de cierre), `src/hooks/useKills.ts`
  - **Lo medido:** la línea principal es el ejecutable, igual en 11 de 18 filas, y el detalle es
    `script · carpeta`: el proyecto va al final y se recorta el primero. A 1000×680, 5 de 17
    detalles recortados; a 900×480, los 18, con 157 px para el nombre; al 200 %, 52 px. El diálogo de
    Supr y el aviso de cierre dicen «node.exe (PID …)», que es justo lo que no identifica la fila.
  - **Qué hacer:** la carpeta del proyecto delante en el detalle, y el diálogo, el aviso y el nombre
    accesible de la fila con ella cuando la hay. Sin enseñar nada que hoy no se enseñe: el script y
    el último tramo de la carpeta, como hasta ahora.
  - **Criterio de aceptación:** a 900×480, en una fila con script y carpeta, la carpeta se lee
    entera cuando cabe y se recorta el script antes que ella. El diálogo de Supr y el aviso de cierre
    nombran la carpeta. Pruebas de componente en los dos idiomas.
  - **Esfuerzo:** medio · **Depende de:** ninguna
  - **Hecho el 2026-11-11.** El detalle es `carpeta · script`, y el Kill, el diálogo de Supr y el
    aviso de cierre dicen «node.exe de mi-web» (en inglés, «in»). **Visto en vivo:** las capturas
    enseñan «ProcessDevKill · chrome-devtools-mcp», y el aviso de éxito de la prueba en marcha dice
    «node.exe de pdk-envivo-aviso cerrado». Pruebas de componente en los dos idiomas.
    - **No se hizo** lo que la crítica proponía además —soltar PID y Activo antes de recortar—: el
      criterio de T14-19 pide que a 900×480 no cambie nada, y con la carpeta delante ya no se pierde.

- [x] **[T14-33] El camino de rescate: la lista no arranca por puerto, y del buscador a la fila hay diez tabuladores**
  - **Severidad:** media · **Tipo:** mejora
  - **Ubicación:** `src/lib/sort.ts:16`, `src/components/ProcessesHeader.tsx`,
    `src/components/ProcessTable.tsx`
  - **Lo medido:** el orden de fábrica es la RAM, y en vivo la única fila con puerto quedó 8.ª de
    18; la captura del README ordena por puerto. Del buscador a la primera fila hay 10 tabuladores
    y el 2.º es Nuke All. Ni la flecha abajo ni Intro en el buscador hacen nada.
  - **Qué hacer:** que la lista arranque ordenada por puerto —los que no tienen van al final, como
    ya hace `sort.ts`—, y que flecha abajo o Intro en el buscador lleven el foco a la primera fila.
  - **Criterio de aceptación:** al abrir la app, las filas con puerto van primero, de menor a mayor.
    En vivo y con teclado, tras escribir en el buscador, flecha abajo deja el foco en la primera
    fila. Pruebas de `sort.ts` y de componente.
  - **Esfuerzo:** bajo · **Depende de:** T14-31
  - **Reabre:** el orden de fábrica, que hasta aquí era el que manda Rust (RAM descendente).
  - **Hecho el 2026-11-11.** `DEFAULT_SORT` por puerto (CONTEXT §4) y Flecha abajo o Intro del
    buscador a la primera fila. **En vivo**, con puertos de verdad tras T14-38: la tabla arranca por
    puerto y una Flecha abajo real deja el foco en la primera fila.

- [x] **[T14-34] Buscar un puerto que no tiene ningún proceso vigilado acaba en «Ningún proceso coincide»**
  - **Severidad:** media · **Tipo:** mejora
  - **Ubicación:** `src-tauri/src/ports.rs`, `src-tauri/src/commands.rs`, `src/components/EmptyState.tsx`
  - **Lo medido** (en el código; en vivo no hubo puertos): `ports.rs` lee todos los sockets en
    escucha del equipo, pero la vista solo enseña los de los procesos vigilados. Si el 3000 lo tiene
    `wslrelay.exe` o Docker, la búsqueda dice «Ningún proceso coincide con el filtro» y se queda ahí.
  - **Qué hacer:** con una búsqueda que es un número de puerto y ninguna fila, preguntar a Rust quién
    escucha en él y decirlo: el nombre del ejecutable y su PID, con la forma de vigilarlo. Solo el
    nombre, como en el resto de la app.
  - **Criterio de aceptación:** prueba de Rust con un socket propio: el comando devuelve este
    proceso para su puerto y nada para uno libre. En la vista, el vacío lo dice en los dos idiomas.
  - **Esfuerzo:** medio · **Depende de:** ninguna
  - **Hecho el 2026-11-11.** Comando `who_listens` en `ports.rs` y el vacío que nombra al dueño,
    con «Vigilar» si se puede. Sin dueño no afirma que el puerto esté libre. Prueba de Rust con un
    socket propio, en verde tras T14-38, y de componente para los cuatro casos y el negativo.
    - **No se provocó en vivo** un puerto ocupado por un programa no vigilado: el guion no tiene
      uno que pueda lanzar y cerrar sin tocar los del usuario.

- [x] **[T14-35] En reposo, lo que más se ve no es lo que importa**
  - **Severidad:** baja · **Tipo:** mejora
  - **Ubicación:** `src/components/ProcessTable.tsx` (menú de la fila, barras),
    `src/components/ProcessesHeader.tsx`
  - **Lo medido:** una calavera (`SkullIcon`) en «Cerrar proceso» del menú, justo la estética que
    rechaza `DESIGN.md`; 18 «0.0%» con su barra vacía en reposo; el recuento suelto junto al buscador
    repite el del sidebar y no dice de qué es. El aviso ámbar fijo es T14-28, en esta misma tanda.
  - **Qué hacer:** el icono de «Cerrar proceso», el de Kill o ninguno; sin barra por debajo de
    0,05 % de CPU; el recuento con su palabra, o fuera.
  - **Criterio de aceptación:** visto en las capturas de `auditoria-ui.mjs` en los dos temas. axe
    sigue en cero.
  - **Esfuerzo:** bajo · **Depende de:** ninguna
  - **Hecho el 2026-11-11.** Sin carril bajo un «0.0%», el recuento solo con la lista filtrada
    («3 de 17») y un círculo con equis en «Cerrar proceso». **Visto** en las capturas de la prueba
    de la letra, en oscuro; axe en cero. El menú de la fila no se capturó: lo cubre su prueba.

- [x] **[T14-36] La letra, a prueba: Geist frente a la del sistema**
  - **Severidad:** baja · **Tipo:** decisión
  - **Ubicación:** `src/index.css`, `src/components/ProcessTable.tsx:300`,
    `src/components/ui/button.tsx:26`
  - **Lo medido:** la app usa Geist; el Administrador de tareas y la Configuración de Windows 11 usan
    Segoe UI Variable. Las cabeceras de columna van en mayúsculas con espaciado, que Windows no usa.
    El botón `sm` de shadcn escribe a 0,8rem, un paso que no está en la escala (lo marcó el
    detector).
  - **Qué hacer:** capturas y medidas de las cuatro vistas con las dos letras, en los mismos tamaños
    y zooms, para que el usuario decida. Las cabeceras en su caja normal y el botón `sm` en la
    escala, se elija la letra que se elija.
  - **Criterio de aceptación:** la decisión del usuario, anotada en CONTEXT §4, y `DESIGN.md`
    regenerado. Con la letra que quede, nada se recorta que antes cupiera: medido con
    `auditoria-ui.mjs --fases medidas`.
  - **Esfuerzo:** medio · **Depende de:** ninguna
  - **Reabre:** la fuente Geist, que la lista de «lo que se deja como está» daba por decidida.
  - **Hecho el 2026-11-17.** El usuario eligió **Segoe UI Variable** con las medidas delante: en
    las cuatro vistas, a 1000×680, 900×480 y 150 %, recorta lo mismo o menos (Procesos, 12 → 10 y
    21 → 18) y las filas miden igual. Geist sale del instalador, con su licencia OFL;
    `THIRD-PARTY-NOTICES.txt` regenerado. Cabeceras en su caja normal y el botón `sm` a
    `text-xs`. Anotado en CONTEXT §4 y `DESIGN.md` al día.

- [x] **[T14-37] Lo que una app de Windows da por hecho: seleccionar con un clic, F6 y el sidebar con zoom**
  - **Severidad:** media · **Tipo:** mejora
  - **Ubicación:** `src/components/ProcessTable.tsx`, `src/components/Sidebar.tsx`,
    `src/hooks/useVentana.ts`
  - **Lo medido:** un clic en la fila no hace nada (el `<tr>` no tiene `onClick`); F6 no mueve el
    foco entre zonas; al 200 % el sidebar se queda con el 42 % de la ventana y hay tres barras de
    scroll verticales a la vez.
  - **Qué hacer:** clic en la fila para seleccionarla, y Ctrl o Mayús+clic para varias, sin que un
    clic en Kill, en la casilla o en el menú cambie la selección; F6 y Mayús+F6 entre el sidebar, la
    cabecera y la tabla; y por debajo de un ancho, el sidebar compacto. La barra de selección sigue
    flotando (CONTEXT §4, 2026-09-24).
  - **Criterio de aceptación:** en vivo, sobre procesos del guion: un clic marca la fila, Ctrl+clic
    añade otra, Mayús+clic marca el rango, y ninguno cierra nada. F6 recorre las tres zonas. Al 200 %,
    una sola barra de scroll vertical en Procesos. axe sigue en cero.
  - **Esfuerzo:** alto · **Depende de:** T14-31
  - **Hecho el 2026-11-17.** Clic, Ctrl+clic y Mayús+clic seleccionan sin cerrar; F6 y Mayús+F6
    recorren las tres zonas (`data-zona`); y por debajo de 640 px de CSS el sidebar se abre con ☰
    (`useMenuLateral`), decisión del usuario entre ☰ y barra de iconos.
    - **En vivo:** las tres selecciones con ratón por CDP, F6 de verdad en las tres zonas, y al
      200 % el sidebar escondido, una sola barra de scroll vertical en Procesos, ☰ que lo abre y
      Escape que lo cierra con el foco de vuelta en ☰.

- [x] **[T14-38] En Windows 10.0.26300 la app no enseñaba ningún puerto**
  - **Severidad:** alta · **Tipo:** problema
  - **Ubicación:** `src-tauri/src/ports.rs`, `src-tauri/Cargo.toml`
  - **Lo medido:** salió al preparar la crítica. En esa compilación de Windows todos los sockets
    llegan con estado `0`, que no es ninguno —hasta `Get-NetTCPConnection` falla al leerlo—;
    `listeners` lo daba como `Unknown` y el filtro por `Listen` los descartaba todos. Fallaban dos
    pruebas de Rust de `ports` y tres pasos de `prueba-en-marcha.mjs`.
  - **Qué hacer:** pedir la tabla `TCP_TABLE_OWNER_PID_LISTENER` de `GetExtendedTcpTable`, que trae
    solo los que escuchan sin depender del estado.
  - **Criterio de aceptación:** en este equipo, las pruebas de `ports` y los pasos del puerto de la
    prueba en marcha pasan.
  - **Esfuerzo:** medio · **Depende de:** ninguna
  - **Hecho el 2026-11-17**, por decisión del usuario dentro de esta tanda. IPv4 e IPv6, el nombre
    del dueño desde `sysinfo`, y `listeners` fuera (un componente menos en el instalador; avisos
    regenerados). **En vivo:** las 34 comprobaciones de `prueba-en-marcha.mjs` pasan en este
    equipo, con puertos de verdad; las 166 pruebas de Rust, también. CONTEXT §4.
