---
name: ProcessDevKill
description: "Gestor de procesos de desarrollo para Windows: el puerto de cada proceso, a la vista, y el botón para cerrarlo."
colors:
  acero-claro: "oklch(0.995 0.002 265)"
  acero-oscuro: "oklch(0.175 0.009 265)"
  superficie: "oklch(1 0 0)"
  superficie-oscura: "oklch(0.225 0.011 265)"
  lateral: "oklch(0.975 0.004 265)"
  lateral-oscuro: "oklch(0.215 0.011 265)"
  acero-atenuado: "oklch(0.965 0.004 265)"
  acero-atenuado-oscuro: "oklch(0.28 0.013 265)"
  tinta-de-acero: "oklch(0.21 0.012 265)"
  tinta-clara: "oklch(0.93 0.006 265)"
  acero-profundo: "oklch(0.25 0.014 265)"
  acero-profundo-oscuro: "oklch(0.92 0.006 265)"
  texto-sobre-acero: "oklch(0.985 0.002 265)"
  texto-secundario: "oklch(0.52 0.014 265)"
  texto-secundario-oscuro: "oklch(0.70 0.013 265)"
  borde: "oklch(0.915 0.006 265)"
  borde-oscuro: "oklch(1 0 0 / 12%)"
  borde-de-control: "oklch(0.62 0.012 265)"
  borde-de-control-oscuro: "oklch(0.55 0.012 265)"
  anillo: "oklch(0.55 0.02 265)"
  anillo-oscuro: "oklch(0.70 0.02 265)"
  rojo-senal: "oklch(0.577 0.245 27.325)"
  rojo-senal-oscuro: "oklch(0.56 0.20 25.5)"
  rojo-senal-texto: "oklch(0.50 0.19 27)"
  rojo-senal-texto-oscuro: "oklch(0.74 0.16 25)"
  ambar-aviso: "oklch(0.769 0.188 70.08)"
  ambar-texto: "oklch(0.555 0.163 48.998)"
  ambar-texto-oscuro: "oklch(0.828 0.189 84.429)"
  runtime-node: "#4a8b3a"
  runtime-node-oscuro: "#6cb85a"
  runtime-python: "#2f6690"
  runtime-python-oscuro: "#4b93cc"
  runtime-dotnet: "#6f3cc4"
  runtime-dotnet-oscuro: "#a173e8"
  runtime-java: "#c2410c"
  runtime-java-oscuro: "#f0883e"
  runtime-deno: "#27272a"
  runtime-deno-oscuro: "#e4e4e7"
  runtime-bun: "#be185d"
  runtime-bun-oscuro: "#f472b6"
  runtime-otros: "#64748b"
  runtime-otros-oscuro: "#94a3b8"
typography:
  headline:
    fontFamily: "Geist Variable, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: "1.5rem"
  title:
    fontFamily: "Geist Variable, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: "1.25rem"
  body:
    fontFamily: "Geist Variable, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: "1.25rem"
  body-strong:
    fontFamily: "Geist Variable, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: "1.25rem"
  label:
    fontFamily: "Geist Variable, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: "1rem"
  overline:
    fontFamily: "Geist Variable, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: "1rem"
    letterSpacing: "0.025em"
  caption:
    fontFamily: "Geist Variable, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: "1rem"
  mono:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: "1rem"
    fontFeature: "\"tnum\" 1"
  mono-strong:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: "1rem"
    fontFeature: "\"tnum\" 1"
rounded:
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "14px"
  full: "9999px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "20px"
  sidebar: "208px"
components:
  button-primary:
    backgroundColor: "{colors.acero-profundo}"
    textColor: "{colors.texto-sobre-acero}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.lg}"
    height: "32px"
    padding: "0 10px"
  button-outline:
    backgroundColor: "{colors.acero-claro}"
    textColor: "{colors.tinta-de-acero}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.lg}"
    height: "32px"
    padding: "0 10px"
  button-ghost:
    textColor: "{colors.tinta-de-acero}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.lg}"
    height: "32px"
    padding: "0 10px"
  button-ghost-hover:
    backgroundColor: "{colors.acero-atenuado}"
  button-nuke:
    backgroundColor: "{colors.rojo-senal}"
    textColor: "{colors.texto-sobre-acero}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.lg}"
    height: "32px"
    padding: "0 10px"
  button-kill:
    backgroundColor: "{colors.acero-claro}"
    textColor: "{colors.texto-secundario}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    height: "24px"
    padding: "0 8px"
  button-kill-hover:
    textColor: "{colors.rojo-senal-texto}"
  input-search:
    textColor: "{colors.tinta-de-acero}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    height: "32px"
    padding: "4px 10px"
  chip-port:
    backgroundColor: "{colors.acero-atenuado}"
    textColor: "{colors.tinta-de-acero}"
    typography: "{typography.mono-strong}"
    rounded: "{rounded.xs}"
    padding: "2px 4px"
  nav-item:
    textColor: "{colors.tinta-de-acero}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.lg}"
    height: "32px"
    padding: "0 8px"
  nav-item-active:
    backgroundColor: "{colors.acero-atenuado}"
    typography: "{typography.title}"
  segmented-active:
    backgroundColor: "{colors.acero-claro}"
    textColor: "{colors.tinta-de-acero}"
    typography: "{typography.title}"
    rounded: "{rounded.md}"
    height: "28px"
    padding: "0 10px"
  badge-zombie:
    textColor: "{colors.ambar-texto}"
    typography: "{typography.label}"
    rounded: "{rounded.xs}"
    padding: "2px 6px"
  dialog:
    backgroundColor: "{colors.superficie}"
    textColor: "{colors.tinta-de-acero}"
    rounded: "{rounded.xl}"
    padding: "16px"
    width: "448px"
---

# Design System: ProcessDevKill

> Recoge el sistema visual **tal como está en el código** el 2026-11-11 (v1.10.7). Los valores
> mandan en [src/index.css](src/index.css) y en `src/components/`: si este archivo y el CSS no
> coinciden, gana el CSS y se vuelve a generar con `/impeccable document`. Las reglas de cómo se
> trabaja —`border-control`, `ring-ring`, `forced-colors`, tablas con `min-w`— viven en
> [.claude/CLAUDE.md](.claude/CLAUDE.md); aquí solo se cuenta qué aspecto dan. Para quién es la
> app y qué es obligatorio, en [PRODUCT.md](PRODUCT.md).

## Overview

**Creative North Star: "El panel de guardia"**

ProcessDevKill es un panel de guardia: quieto y discreto mientras todo va bien, y claro al primer
vistazo cuando algo choca. Se usa de las dos formas por igual: abierto todo el día en un lateral,
mirado de reojo, y abierto de golpe con un `EADDRINUSE` en la terminal de al lado. Lo primero
pide que nada reclame atención sin motivo; lo segundo, que el puerto, el proyecto y el botón de
cerrar se encuentren sin leer. El sistema resuelve las dos cosas con la misma herramienta: **una
superficie de grises de acero, casi sin color, sobre la que solo destaca lo que tiene un
significado**.

La densidad es la de una herramienta de Windows, no la de una página: texto a 14 px, filas de dos
líneas (el proceso y, debajo, su script y su carpeta), una barra lateral fija de 208 px y
cabeceras de vista de 57 px que no hacen scroll. El color está racionado. Los runtimes tienen el
suyo, que identifica y no decora; el rojo es la señal de cierre y solo se llena en Nuke All; y el
ámbar es un aviso, nunca una alarma. Todo lo que cambia cada dos segundos —CPU, RAM, puertos— va
con cifras tabulares para que la columna no baile.

La app tiene que sentirse **una aplicación de Windows, no una página web**. Por eso se rechazan
tres mundos vecinos, confirmados con el usuario: **la web o el SaaS** (tarjetas flotantes,
degradados, cabeceras grandes, ilustraciones), **la estética «hacker»** (verde sobre negro, neón,
todo en monoespaciada) y **el antivirus alarmista** (rojo y avisos por todas partes).

**Key Characteristics:**

- Neutros de acero en un único tono (265), con la croma casi a cero.
- Un solo color de acción: el rojo de cierre, lleno solo en Nuke All.
- Siete colores de runtime, ajustados por tema y medidos contra el fondo.
- Plano, con bordes finos; solo lo que flota lleva sombra.
- Geist para leer y monoespaciada solo para lo que se copia: PID y puertos.
- Controles callados y precisos: neutros en reposo, con el foco siempre visible.
- Claro, oscuro y temas de contraste de Windows, con reglas propias para cada uno.

## Colors

Una paleta de grises de acero, fríos y casi neutros, sobre la que solo hablan tres colores con
significado: el del runtime, el rojo de cierre y el ámbar de aviso.

### Primary

- **Rojo señal** (`oklch(0.577 0.245 27.325)`; en oscuro, `oklch(0.56 0.20 25.5)`): el único color
  de acción. Lleno solo en **Nuke All** y en el botón que confirma un cierre. El texto blanco
  encima da 4,9:1 en oscuro.
- **Rojo señal, texto** (`oklch(0.50 0.19 27)`; en oscuro, `oklch(0.74 0.16 25)`): el rojo cuando
  es letra, sobre el velo rojo del Kill (`rojo-senal` al 10 %): 5,5:1. Es un token aparte para no
  apagar el fondo de Nuke All al oscurecer el texto.

### Secondary

- **Colores de runtime**: Node (`#4a8b3a` / `#6cb85a`), Python (`#2f6690` / `#4b93cc`), .NET
  (`#6f3cc4` / `#a173e8`), Java (`#c2410c` / `#f0883e`), Deno (`#27272a` / `#e4e4e7`), Bun
  (`#be185d` / `#f472b6`) y Otros (`#64748b` / `#94a3b8`). Cada par tiene un valor para el claro y
  otro para el oscuro, porque el verde que luce sobre casi negro se pierde sobre blanco. Pintan el
  icono del runtime en su fila y la barra de CPU y RAM. Medidos contra el sidebar, la fila activa
  y el fondo: el peor da 4,34:1 en claro (Java sobre la fila activa) y 5,15:1 en oscuro (Bun).
  Deno es casi negro porque su logo lo es; lo separa de «Otros» el icono, no el gris.

### Tertiary

- **Ámbar aviso** (`oklch(0.769 0.188 70.08)`, como velo del 8 al 15 %; texto `oklch(0.555 0.163
  48.998)`, en oscuro `oklch(0.828 0.189 84.429)`): lo que pide atención sin ser un peligro. La
  fila de un zombi entera (al 8 %, porque la marca sola se perdía en veinte filas), su marca y el
  aviso de «sin modo administrador» del sidebar.

### Neutral

- **Acero claro** (`oklch(0.995 0.002 265)`): el fondo de la ventana en claro. No es blanco puro,
  para que la tabla no deslumbre en una sesión larga.
- **Acero oscuro** (`oklch(0.175 0.009 265)`): el fondo en oscuro. Conserva el azul de los
  primeros Tiers (`#0f1115`), no el gris neutro que trae shadcn.
- **Superficie** (`oklch(1 0 0)`; en oscuro, `oklch(0.225 0.011 265)`): menús, diálogos y la barra
  de selección, lo que flota.
- **Lateral** (`oklch(0.975 0.004 265)`; en oscuro, `oklch(0.215 0.011 265)`): el sidebar, un paso
  por debajo del fondo.
- **Acero atenuado** (`oklch(0.965 0.004 265)`; en oscuro, `oklch(0.28 0.013 265)`): la vista
  elegida del sidebar, la etiqueta del puerto, el carril de las barras y el fondo de un grupo
  segmentado.
- **Tinta de acero** (`oklch(0.21 0.012 265)`; en oscuro, `oklch(0.93 0.006 265)`): el texto.
- **Acero profundo** (`oklch(0.25 0.014 265)`; en oscuro, `oklch(0.92 0.006 265)`): el botón
  principal y la casilla marcada.
- **Texto secundario** (`oklch(0.52 0.014 265)`; en oscuro, `oklch(0.70 0.013 265)`): el script y
  la carpeta bajo cada proceso, las cabeceras de la tabla, el PID, las ayudas.
- **Borde** (`oklch(0.915 0.006 265)`; en oscuro, blanco al 12 %): lo que separa zonas: el sidebar,
  la cabecera de cada vista y las filas.
- **Borde de control** (`oklch(0.62 0.012 265)`; en oscuro, `oklch(0.55 0.012 265)`): el borde de
  lo que se pulsa o se rellena: casillas, interruptores, campos y desplegables. Da 3,6:1 en claro
  y 3,9:1 en oscuro; con el borde de shadcn una casilla sin marcar daba 1,26:1 y no se veía.
- **Anillo** (`oklch(0.55 0.02 265)`; en oscuro, `oklch(0.70 0.02 265)`): el foco, opaco: 4,8:1 en
  claro y 7,1:1 en oscuro.

### Named Rules

**The Single Signal Rule.** El rojo lleno es Nuke All y la confirmación de un cierre, nada más.
El Kill de cada fila es neutro y se tiñe de rojo solo con la fila bajo el puntero o con el foco
dentro: veinte botones rojos competirían con los puertos, que son lo que se viene a mirar.

**The Owned Color Rule.** El color de un runtime solo aparece donde ese runtime está: su icono y
sus barras. Nunca como fondo de una fila ni de una zona, ni como adorno.

**The Measured Token Rule.** Un color nuevo entra con su contraste medido —texto a 4,5:1, bordes y
foco a 3:1— y el número escrito en el comentario de su token, como ya lo llevan `--control`,
`--ring` y `--destructive-text`. Y con su regla en el bloque de `forced-colors` si dice algo solo
con el fondo.

## Typography

**Body Font:** Geist Variable (con `sans-serif`)
**Label/Mono Font:** la monoespaciada del sistema (`ui-monospace`, que en Windows cae en
Consolas)

**Character:** una sola familia, Geist, para todo lo que se lee, en tres pesos y dos tamaños, y la
monoespaciada del sistema reservada a lo que se copia y se compara cifra a cifra. No hay tamaño de
titular: una herramienta de Windows no anuncia, rotula.

### Hierarchy

- **Headline** (600, 16 px, 24 px de interlínea): el `h2` de cada vista, en `ViewHeader`. Uno por
  vista.
- **Title** (600, 14 px, 20 px): el nombre de la app en el sidebar, con un poco de espaciado
  (`tracking-wide`); la vista elegida del sidebar y la opción elegida de un grupo segmentado.
- **Body** (400, 14 px, 20 px): el texto de la tabla, de Ajustes, de los diálogos y de los menús.
- **Body strong** (500, 14 px, 20 px): botones y elementos del sidebar.
- **Label** (500, 12 px, 16 px): el Kill de cada fila, la marca de Zombie y los botones pequeños.
- **Overline** (500, 12 px, 16 px, 0,025 em, en mayúsculas): las cabeceras de columna de las
  tablas, en texto secundario.
- **Caption** (400, 12 px, 16 px): la segunda línea de cada proceso —`vite · mi-web`—, las ayudas
  y las cifras del equipo en el medidor.
- **Mono** (400 y 600, 12 px, cifras tabulares): el PID, y los puertos. El primer puerto, en 600
  sobre su etiqueta; los demás, en 400 y en texto secundario.

### Named Rules

**The Copyable Rule.** La monoespaciada es para lo que se copia o se compara dígito a dígito: PID
y puertos, y la tecla de un atajo (`Ctrl F`). Nada más; una app entera en monoespaciada es la
estética «hacker» que se rechaza.

**The Still Column Rule.** Toda cifra que se refresca —CPU, RAM, tiempo activo, recuentos— lleva
`tabular-nums`. La lista cambia cada dos segundos, y una columna que baila no se lee de reojo.

## Layout

La ventana abre a **1000×680** y no baja de **900×480**. A la izquierda, el **sidebar fijo de
208 px**: el nombre de la app, las cuatro vistas —Procesos, Servicios, Historial y Ajustes—, los
filtros por runtime colgando de Procesos y las secciones colgando de Ajustes, el medidor del
entorno y, abajo del todo, el auto-refresco. A la derecha, la vista: una **cabecera fija de 57 px
como mínimo** (`ViewHeader`, con el `h2` y las acciones a la derecha) y un **cuerpo que es lo único
que hace scroll** (`ViewBody`).

El ritmo es el de la escala de 4 px de Tailwind: **20 px de margen lateral** en las vistas
(`px-5`), 12 px entre controles de la cabecera, y celdas de 8 px en vertical y 12 px en horizontal.
Las listas colgadas del sidebar llevan una guía vertical de 1 px, que es lo que las lee como hijas
de su vista.

**Lo que se adapta, se adapta al contenedor y no a la ventana** (`@container`), porque con zoom la
ventana dice 1000 px y la vista tiene 459. La tabla de procesos tiene un mínimo de 468 px, suelta
la columna del PID a 571 px de contenedor y la del tiempo activo a 659, y desde ahí deja el Kill
pegado a la derecha. Una ventana baja (`short:`, 600 px de alto o menos) compacta el sidebar: sin
subtítulo y con el medidor reducido a lo esencial.

### Named Rules

**The Still Table Rule.** Mientras el puntero o el teclado están en la tabla, las filas no
cambian de sitio. Un proceso nuevo no empuja al que se iba a cerrar.

**The Pinned Action Rule.** La acción de la fila nunca queda detrás del scroll. Antes de que la
tabla haga scroll lateral se sueltan columnas secundarias enteras, y lo que decían pasa al menú de
la fila.

## Elevation & Depth

El sistema es plano. Las zonas se separan con **bordes de 1 px** en el color de borde —el sidebar,
la cabecera de cada vista, cada fila— y con un solo paso de tono entre el fondo y el sidebar.
Ninguna superficie en reposo lleva sombra. La sombra aparece solo en lo que flota por encima de la
ventana y se va a ir: menús y desplegables, la barra de selección y la marca de la opción elegida
en un grupo segmentado, que es un control y no una superficie. Con un tema de contraste de Windows
el navegador quita todas las sombras, así que **ninguna sombra lleva información**: lo que dice
también lo dice un borde o un color del sistema.

### Shadow Vocabulary

- **Flotante** (`shadow-md`, con un anillo de 1 px de `tinta-de-acero` al 10 %): menús contextuales
  y desplegables.
- **Flotante alta** (`shadow-lg`): la barra de selección, abajo en el centro, y los submenús.
- **Diálogo** (anillo de 1 px de `tinta-de-acero` al 10 %, sin sombra propia): el diálogo de
  confirmación.
- **Pulsado** (`shadow-sm` con `ring-1 ring-control`): la opción elegida de un grupo segmentado.

### Named Rules

**The Leaving Shadow Rule.** Nada en reposo lleva sombra. Una sombra dice «esto está encima y se
va a ir»; una tarjeta flotante en reposo es la web que se rechaza.

## Shapes

Esquinas suavemente redondeadas, en dos familias. **Los controles** van a 10 px (`--radius`,
`rounded-lg`): botones, campos, desplegables, menús y elementos del sidebar; los pequeños, como el
Kill de cada fila, a 8 px; y el diálogo, a 14 px. **Lo que es un dato dentro de una fila** va a
4 px: la etiqueta del puerto, la marca de Zombie, la casilla y la tecla `Ctrl F`. Las barras de CPU
y RAM, los puntos de estado de un servicio y la marca de versión nueva son redondos del todo. La
vista elegida del sidebar lleva una barra de 3 px a la izquierda, también redonda, como la marca
de selección de Windows 11. Los iconos son los de Lucide, a 16 px, y los de cada runtime, en su
color.

## Components

### Buttons

Callados y precisos: neutros en reposo, con el foco siempre visible.

- **Shape:** esquinas a 10 px; 32 px de alto (24 px el pequeño, 28 px el de un grupo segmentado).
- **Primary** (`acero-profundo` con texto claro): escaso a propósito. «Descargar e instalar» en
  Ajustes y el botón que confirma un diálogo que no cierra nada.
- **Outline** (fondo de la ventana; borde en `borde` en claro, 1,26:1, y en `borde-de-control` en
  oscuro): Refrescar con el auto-refresco apagado, Buscar actualizaciones y la acción de un estado
  vacío. Al ser un botón con texto, WCAG no le pide borde a 3:1; el de shadcn se dejó así.
- **Ghost:** los iconos de la cabecera —Refrescar con el auto-refresco puesto, borrar la
  búsqueda— y los elementos del sidebar. Al pasar el puntero, `acero-atenuado`.
- **Nuke All** (rojo señal lleno, texto claro): el único botón rojo lleno. Con un filtro o una
  búsqueda, el rótulo dice que cierra lo filtrado. Con una selección, se esconde y conserva el
  hueco, y la acción pasa a la barra de selección.
- **Rojo tenue** (`rojo-senal` al 10 %, texto en `rojo-senal-texto`): cerrar lo marcado, en la
  barra de selección. Destructivo pero acotado, y por eso sin llenar.
- **Kill** (pequeño, outline, texto secundario): neutro en reposo; con la fila bajo el puntero o
  con el foco dentro, borde y texto en rojo señal. Apagado y a la vista en un proceso protegido,
  con el motivo en el `title`.
- **Hover / Focus:** al pulsar, baja 1 px. El foco es un anillo opaco de 3 px en `anillo`; en
  `forced-colors`, un contorno de 2 px en `Highlight`.

### Inputs / Fields

- **Style:** borde de 1 px en `borde-de-control`, fondo transparente (en oscuro, `input` al 30 %),
  esquinas a 10 px, 32 px de alto y texto de 14 px.
- **Focus:** el borde pasa a `anillo`, con su anillo de 3 px.
- **El buscador** de Procesos ocupa el sitio que queda en la cabecera, enseña `Ctrl F` dentro
  mientras está vacío y una X para borrar cuando no.
- **Casillas** a 4 px de esquina, con el borde de control; marcadas, rellenas de `acero-profundo`.
  **Interruptores** con la pista y el pulgar distintos también en un tema de contraste.

### Navigation

- **Sidebar:** las cuatro vistas, con su icono de 16 px y el texto en 500. La elegida, sobre
  `acero-atenuado`, en 600 y con la barra de 3 px a la izquierda; la marca va por tres lados (fondo,
  peso y barra) y no solo por el color. Procesos pliega y despliega sus filtros, que cuelgan de una
  guía vertical con su recuento; Ajustes despliega sus seis secciones.
- **Grupo segmentado** (Tema, Idioma, Auto-refresco): un `radiogroup` de verdad, con un solo
  tabulador y las flechas para elegir. Lo elegido lleva fondo de la ventana, borde de control,
  sombra pequeña y 600. Solo para ajustes que se deshacen sin coste.

### La fila de proceso (signature component)

La pieza que define la app. Dos líneas: arriba, el icono del runtime en su color y el nombre;
debajo, en caption y texto secundario, `script · carpeta`. Un candado si está protegido y la marca
ámbar de Zombie si lleva minutos sin CPU con un puerto abierto. Después, **el puerto** en su
etiqueta monoespaciada, en 600 sobre `acero-atenuado` (los siguientes, sin etiqueta y en texto
secundario), el PID en monoespaciada, CPU y RAM con la cifra encima de su barra de 6 px —escalada
al proceso que más gasta de la lista, no al equipo—, el tiempo activo y el Kill pegado a la
derecha.

La tabla es **una sola parada de tabulador**: la fila activa lleva el foco y las flechas la mueven.
Espacio marca, Supr pide cerrar (preguntando antes) y Mayús+F10 abre el menú de la fila. Bajo el
puntero, la fila toma `acero-atenuado` al 60 %; marcada, `acero-atenuado` entero y una barra de
3 px en `tinta-de-acero` a la izquierda, por dentro, que gana al ámbar de un zombi; en un tema de
contraste, un contorno en `Highlight`. Las filas entran con un fundido y salen en 180 ms
desplazándose 24 px a la izquierda con un velo rojo, y las dos cosas se apagan con «Efectos de
animación» desactivado en Windows.

### El medidor del entorno

En el sidebar: cuánto de la CPU y de la RAM del equipo pone el entorno de desarrollo. Cada métrica
en tres líneas: la cifra del entorno, una barra con dos rellenos (el del equipo, detrás y en gris)
y «Equipo» con su cifra. Las barras animan su anchura en 300 ms.

### Diálogos, menús y avisos

- **Diálogo de confirmación:** superficie, esquinas a 14 px, 16 px de relleno y 448 px de ancho
  como mucho; el pie, sobre `acero-atenuado` al 50 % con un borde arriba. Cuando cierra algo, el
  icono va sobre un velo rojo, el aviso en un recuadro con borde rojo al 30 %, y el botón que
  confirma es rojo señal lleno, como el que lo abrió. Entra con un fundido y un zoom del 95 % en
  100 ms. Cancelar devuelve el foco a lo que lo abrió.
- **Menú de la fila:** superficie a 10 px, sombra flotante; lo que cierra va al final, tras un
  separador, para que la primera flecha no caiga en él.
- **Avisos** (Sonner, siempre desde `@/lib/avisos`): un error o una advertencia se quedan hasta que
  se cierran; un éxito se va solo.
- **Aviso de «sin modo administrador»:** un recuadro ámbar en el sidebar, a 10 px de esquina, que
  lleva a la sección de Ajustes que lo explica.

## Do's and Don'ts

### Do:

- **Do** separar zonas con un borde de 1 px en `borde` y un paso de tono, no con sombras ni con
  tarjetas.
- **Do** dar a cada control su borde en `borde-de-control` (3,6:1 en claro) y su foco con el anillo
  opaco de 3 px; las reglas exactas, en `.claude/CLAUDE.md`.
- **Do** escribir cada estado que hoy se diga solo con un fondo también en el bloque de
  `forced-colors` de `index.css`, con colores del sistema.
- **Do** poner `tabular-nums` en toda cifra que se refresque, y monoespaciada solo en PID y
  puertos.
- **Do** marcar lo elegido por al menos dos lados —fondo y peso, o fondo y barra—, nunca solo con
  el color.
- **Do** empezar una vista nueva con `ViewHeader` (un `h2` de 16 px y las acciones a la derecha) y
  `ViewBody`.
- **Do** mirar primero qué hace el Administrador de tareas o la Configuración de Windows 11 ante
  la misma necesidad.

### Don't:

- **Don't** usar tarjetas flotantes, degradados, cabeceras grandes, ilustraciones ni vidrio: es la
  web o el SaaS que la app rechaza.
- **Don't** poner verde sobre negro, neón ni la app entera en monoespaciada: es la estética «hacker»
  que se rechaza.
- **Don't** pintar de rojo cada Kill, ni poner banners rojos o ámbar para lo que no es un peligro:
  es el antivirus alarmista que se rechaza. El rojo lleno es Nuke All.
- **Don't** usar el color de un runtime como fondo de una fila o de una zona.
- **Don't** usar blanco puro como fondo de la ventana en el tema claro (`acero-claro` es 0,995).
- **Don't** usar `border-input` ni el anillo de foco al 50 % que trae shadcn: no llegan a 3:1.
- **Don't** dejar la acción de una fila detrás del scroll lateral.
