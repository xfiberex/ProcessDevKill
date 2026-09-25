# Registro de cambios

Qué cambió en cada versión de ProcessDevKill, contado para quien la usa. El **porqué** de cada
decisión está en [CONTEXT.md](CONTEXT.md); lo que falta por hacer, en [ROADMAP.md](ROADMAP.md).

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y las versiones siguen
[Versionado Semántico](https://semver.org/lang/es/). Las fechas son las de publicación, en hora de
la República Dominicana (UTC−4). Entre paréntesis, la fase del [ROADMAP](ROADMAP.md) o la tarea de
[la revisión del 2026-08-18](docs/REVISION-2026-08-18.md) de la que salió cada cambio: `Tier 11 · A1`
es la tarea A1 del Tier 11; `T1-01`, la tarea T1-01 de aquella revisión.

> **Reconstrucción aproximada.** Este archivo se creó el 2026-09-25, en la re-auditoría del Tier 12,
> a partir de las notas de los 15 releases publicados en GitHub y de lo que cuentan el ROADMAP y la
> bitácora. Las notas de cada release siguen siendo la versión larga; aquí queda el resumen. Desde la
> próxima versión, este archivo se escribe al cortarla y no después.

## [Sin publicar]

### Cambiado
- Los procesos críticos de Windows —`svchost`, `csrss`, `lsass`, `winlogon`, `explorer` y
  compañía— ya no se pueden vigilar aunque se añadan en Ajustes, que ahora explica por qué al
  intentarlo. Antes, Nuke All o el atajo global los habrían cerrado con los demás; con la app como
  administrador, eso podía colgar el equipo o cerrar la sesión. (T12-01)
- Arrancar o detener un servicio y cambiar su tipo de arranque ya no congelan la ventana mientras
  se espera al aviso de Windows. (T12-06)

### Documentación
- La sección de privacidad del README decía que la app no lee la línea de comandos, y la lee desde
  la v1.6.0 para mostrar el script y el proyecto. Ahora cuenta qué lee y qué enseña. (T12-29)

### Interno
- Re-auditoría completa del repositorio sobre la v1.8.0, con la app en marcha: abre el **Tier 12**
  del ROADMAP (39 tareas, ninguna crítica ni alta). Nada cambia en la app.
- Nace este registro de cambios.
- El script de publicación ya no se detiene si falta `cargo-audit` o clippy (avisa y sigue), y se
  niega a publicar cambios sin commitear o que el dry run no llegó a comprobar. (T12-21, T12-22)

## [1.8.0] — 2026-09-25

Pulido: cosas pequeñas que se notan cada día. No cambia ningún permiso ni lo que la app cierra.

### Añadido
- <kbd>Ctrl</kbd>+<kbd>F</kbd> lleva al buscador desde cualquier vista, con una × para borrarlo
  (<kbd>Esc</kbd> también borra). Antes había doce paradas de tabulador por delante. (Tier 11 · E)
- «Quitar filtro» cuando ningún proceso coincide: quita la búsqueda y el filtro de runtime a la vez.
  (Tier 11 · E)
- El Historial se agrupa por acción: un Nuke All de quince procesos es una fila que dice cuántos
  eran, de qué tipo y qué puertos liberaron, y se despliega. La hora va en relativo —«hace 5
  minutos», «ayer»— con la exacta al pasar el ratón. (Tier 11 · E)
- Zoom de la ventana con <kbd>Ctrl</kbd>+<kbd>+</kbd>, <kbd>Ctrl</kbd>+<kbd>-</kbd> y
  <kbd>Ctrl</kbd>+<kbd>0</kbd>. Si la tabla no cabe, hace scroll en vez de esconder el nombre del
  proceso. (Tier 11 · E)

### Cambiado
- El texto de las tablas y el error de la pantalla de fallo se pueden seleccionar y copiar.
  (Tier 11 · E)
- Refrescar es un icono mientras la lista se refresca sola, y recupera su texto con el auto-refresco
  en «Off». (Tier 11 · E)
- La tabla deja sitio debajo para que un aviso no tape el Kill de la última fila, y los textos del
  medidor pasan de 11 a 12 px. (Tier 11 · E)

### Corregido
- La documentación decía que el menú de cada fila solo se abría con el ratón: se abre también con
  <kbd>Shift</kbd>+<kbd>F10</kbd> o la tecla Menú desde la casilla o el Kill de la fila. (Tier 11 · F1)
- Tildes y erratas en textos que solo leen los lectores de pantalla. (Tier 11 · E)

## [1.7.0] — 2026-09-25

La app dice lo que no puede ver sin ser administrador, y las cuatro vistas pasan a tener la misma forma.

### Añadido
- Un aviso en el sidebar cuando la app corre sin permisos de administrador, que explica qué se pierde
  —la RAM de los servicios, el script, la carpeta y el cierre de los procesos abiertos como
  administrador— y lleva a Ajustes.
- En Ajustes → Permisos de administrador: **Reiniciar como administrador**, una vez, e **Iniciar
  siempre como administrador**, apagado de fábrica porque supone un aviso de UAC en cada arranque.
- Si un Kill falla con la app sin elevar, el aviso sugiere el motivo más probable.
- Una barra flotante al marcar filas: «3 seleccionados · Cerrar · Quitar selección». (Tier 11 · D7)

### Cambiado
- Cada vista empieza igual: título, una línea y sus acciones, fijos arriba. (Tier 11 · D1)
- Ajustes, por grupos: General, Vigilancia, Automatismos, Actualizaciones y, al final, Acerca de.
  (Tier 11 · D2)
- Un solo verbo para cerrar: «Kill» y «Nuke All» en inglés, y todo lo demás dice «cerrar». Con un
  filtro puesto, el botón se llama **«Nuke filtrados»**, porque cierra solo la lista filtrada.
  (Tier 11 · D3)
- El Kill de cada fila es gris y se tiñe de rojo al pasar por la fila; el rojo lleno queda para Nuke
  All. (Tier 11 · D5)
- La barra de CPU ya no sale llena en reposo: su escala empieza en un núcleo entero. (Tier 11 · D6)

### Corregido
- Los servicios parados explicaban su «—» con permisos o con TCP; ahora dicen que están parados.
  (Tier 11 · D4)

## [1.6.2] — 2026-09-24

Maquetación. No cambia nada de lo que hace la app.

### Corregido
- Las columnas de la tabla de procesos se movían hasta 13 px en cada refresco; ahora tienen ancho
  fijo. Un nombre largo se recorta en vez de sacar de la ventana las columnas Activo y Kill, y a 900
  px la tabla cabe entera: la barra de CPU y RAM pasa debajo de la cifra. (Tier 11 · C1)
- Los encabezados numéricos se alinean con sus cifras. (Tier 11 · C2)
- A 480 px de alto el sidebar cabe entero, auto-refresco incluido, que antes quedaba fuera sin forma
  de alcanzarlo. (Tier 11 · C3)
- El diálogo de cambiar el arranque de un servicio tiene partes y se lee: el aviso de que el cambio
  sobrevive al reinicio va en su recuadro, el nombre del servicio no se parte, y solo va en rojo lo
  que puede romper algo. (Tier 11 · C4)

## [1.6.1] — 2026-09-24

Accesibilidad. No cambia nada de lo que hace la app. La auditoría automática (axe) pasa a cero
violaciones en las cuatro vistas y los dos temas.

### Corregido
- Casillas, interruptores y campos tienen un borde que se ve, y el anillo del foco del teclado es
  sólido: los dos pasan de 3:1 de contraste. (Tier 11 · B1)
- El rojo de Kill y de Nuke All se lee bien en los dos temas. (Tier 11 · B2)
- Se ve lo que está elegido: la vista activa del sidebar lleva barra y seminegrita, e Idioma, Tema,
  la combinación del atajo y el Auto-refresco son controles segmentados que se recorren con flechas.
  (Tier 11 · B4)
- El botón Kill se anuncia «Kill node.exe, PID …», con la palabra que se ve, y el recuento del
  buscador se anuncia entero. (Tier 11 · B5, B6)

## [1.6.0] — 2026-09-23

Que no se cierre lo que no querías cerrar.

### Añadido
- Debajo de cada `node.exe`, **el script y la carpeta del proyecto** —`vite · mi-web`—, para saber
  cuál es cuál antes de pulsar Kill. Nunca la línea de comandos entera. El buscador también los
  encuentra. (Tier 11 · A2)
- **Procesos protegidos**: los que marques —por ejecutable, script o carpeta, en Ajustes o desde el
  menú de la fila— no los cierra nada de la app. Nuke All los deja fuera y lo dice. (Tier 11 · A3)
- Se puede elegir la combinación del atajo global: Ctrl+Alt+K, Ctrl+Alt+Shift+K o Ctrl+Alt+F12.
  (Tier 11 · A1)

### Cambiado
- **El atajo global viene apagado de fábrica** y, encendido, **pide dos pulsaciones**: la primera
  avisa de cuántos procesos caerían. Si ya lo tenías encendido, se queda encendido, pero la doble
  pulsación sí te llega. (Tier 11 · A1)
- Con el puntero sobre la tabla, las filas no cambian de sitio: el Kill que tienes debajo sigue siendo
  el del mismo proceso. (Tier 11 · A5)
- La entrada que cierra el proceso va al final del menú contextual, tras un separador. (Tier 11 · A6)

### Corregido
- El tipo de arranque de un servicio cambiaba con cada flecha del teclado, y un Enter confirmaba lo
  que no se quería. Ahora solo cambia al elegir una entrada. (Tier 11 · A4)

## [1.5.3] — 2026-08-23

### Añadido
- **Apoyar el proyecto**, en Ajustes → Acerca de. La app es gratis y lo seguirá siendo: apoyarla no
  desbloquea nada.

## [1.5.2] — 2026-08-23

### Corregido
- En el tema oscuro, la lista desplegable del tipo de arranque salía blanca con el texto casi
  blanco encima.
- La flecha del desplegable iba pegada al borde, y un texto decía que el tipo de arranque «todavía
  no se puede cambiar desde aquí», con la columna que lo cambia debajo.

## [1.5.1] — 2026-08-23

### Corregido
- El panel de servicios no cabía en la ventana y el scroll lateral se llevaba la columna del nombre.
  Ahora las columnas tienen anchos medidos y lo largo se recorta.
- La RAM ya no parte en dos líneas y el desplegable enseña «Automático (retrasado)» entero.
- Manual y Deshabilitado ya no parecen desactivados, y el motivo de los «—» lo anuncian también los
  lectores de pantalla.

## [1.5.0] — 2026-08-23

### Añadido
- **Panel de servicios de desarrollo** —SQL Server, PostgreSQL, MySQL, MongoDB, Redis, Docker e
  IIS— con su estado, su tipo de arranque y el puerto que ocupan. Se pueden **arrancar, detener y
  cambiar de tipo de arranque**, y lo que cambia la app queda anotado para **deshacerlo**. Windows
  pide permiso de administrador solo para esa acción. (Tier 10)
- **La app en español y en inglés**, sin reiniciar: la ventana, el menú de la bandeja y las
  notificaciones de Windows. (T4-01)

## [1.4.0] — 2026-08-20

Refuerzo: 33 de las 37 tareas de la revisión del 2026-08-18.

### Añadido
- **Registro de avisos**: lo que falla por dentro queda en un archivo local, con su fecha, que no se
  envía a ninguna parte. La ruta está en Ajustes → Acerca de. (T2-03)
- **Pantalla de error** en vez de una ventana en blanco, que dice que no se ha cerrado ningún
  proceso. (T2-06)

### Cambiado
- Un solo aviso por acción desde la bandeja y el atajo: antes salían dos notificaciones por clic.
  (T3-12)
- Se respeta «Efectos de animación» de Windows. (T2-07)

### Corregido
- Si los ajustes no se podían guardar, la ventana seguía enseñando el valor nuevo. (T3-03)
- Vaciar el historial ya avisa si falla. (T3-04)
- Un corte de luz a mitad de guardar podía devolver los ajustes a los de fábrica en silencio: ahora
  se escriben de forma atómica. (T2-04)
- «1 procesos Node cerrados» y dos tildes en los avisos del Auto-Kill. (T3-14, T3-15)

### Seguridad
- La descarga de una actualización solo se acepta desde un release de este repositorio, y tiene
  techo de tamaño. (T1-01, T3-02)
- Actualizada una dependencia con una vulnerabilidad conocida (`h2`, RUSTSEC-2026-0258). (T2-02)

## [1.3.2] — 2026-08-18

### Seguridad
- El actualizador comprueba que el instalador y su `.sha256` vengan de un release de este
  repositorio, sobre la URL ya interpretada: antes se fiaba de lo que le pasaba la ventana. (T1-01)
- Techo de tamaño en la descarga del instalador. (T3-02)

### Interno
- La guardia que impide cerrar procesos no vigilados tiene su prueba, validada quitándola a propósito.
  (T1-02)

## [1.3.1] — 2026-08-14

### Corregido
- **La actualización es silenciosa**: al instalar salían dos ventanas seguidas que había que
  responder. Ahora la app se cierra, se actualiza y vuelve a abrirse sola. Lo estrena quien actualiza
  **desde** la v1.3.1. (Tier 9)

## [1.3.0] — 2026-08-07

### Añadido
- **Medidor del entorno** en el sidebar: cuánta CPU y cuánta RAM del equipo se lleva el entorno de
  desarrollo, sobre el total de la máquina. Con el auto-refresco en «Off» dice «En pausa». (Tier 8)

## [1.2.0] — 2026-07-28

### Añadido
- Instancia única: lanzar la app estando abierta trae al frente la que ya hay. (Tier 7 · 4a)
- La tabla se ordena por columna. (Tier 7 · 8)
- Sidebar vertical, con los filtros por runtime colgando de «Procesos». (Tier 7 · 9)
- Un estado vacío que explica qué se vigila y cómo añadir más. (Tier 7 · 8)

### Cambiado
- **El botón ✕ cierra la app.** Antes la escondía siempre en la bandeja y se acumulaban instancias
  invisibles; esconderla es ahora un ajuste. (Tier 7 · 4a)
- **La ventana no baja de 900 px de ancho** (antes 720), el mínimo en el que la tabla cabe. (Tier 7 · 8)

### Seguridad
- La guardia de rutas del actualizador se saltaba con un `..`: ahora se normaliza antes de comparar.
  (Tier 7 · 1)
- Política de seguridad de contenido (CSP) en la ventana, que estaba sin definir. (Tier 7 · 1)

### Corregido
- Nueve textos de la interfaz sin tilde, y cada Kill dice a qué proceso cierra para los lectores de
  pantalla. (Tier 7 · 3, 4b)

## [1.1.1] — 2026-07-26

Primera versión pública que sigue disponible.

### Cambiado
- **Las actualizaciones se verifican con el `.sha256`** que acompaña a cada instalador. Detecta una
  descarga corrupta o manipulada en tránsito; no demuestra quién publicó el archivo. (Tier 6)
- Quien tenga la v1.1.0 o anterior tiene que instalar esta a mano una vez: el mecanismo de
  actualización se rehízo.

## [1.1.0] y [1.0.0] — julio de 2026, retiradas

Se publicaron con un actualizador basado en firmas minisign que se abandonó el 2026-07-26 (ver
CONTEXT §4). Se retiraron para que nadie instalara una versión que ya no podía actualizarse. Sus
fechas exactas no se conservan en los releases.

[Sin publicar]: https://github.com/xfiberex/ProcessDevKill/compare/v1.8.0...HEAD
[1.8.0]: https://github.com/xfiberex/ProcessDevKill/releases/tag/v1.8.0
[1.7.0]: https://github.com/xfiberex/ProcessDevKill/releases/tag/v1.7.0
[1.6.2]: https://github.com/xfiberex/ProcessDevKill/releases/tag/v1.6.2
[1.6.1]: https://github.com/xfiberex/ProcessDevKill/releases/tag/v1.6.1
[1.6.0]: https://github.com/xfiberex/ProcessDevKill/releases/tag/v1.6.0
[1.5.3]: https://github.com/xfiberex/ProcessDevKill/releases/tag/v1.5.3
[1.5.2]: https://github.com/xfiberex/ProcessDevKill/releases/tag/v1.5.2
[1.5.1]: https://github.com/xfiberex/ProcessDevKill/releases/tag/v1.5.1
[1.5.0]: https://github.com/xfiberex/ProcessDevKill/releases/tag/v1.5.0
[1.4.0]: https://github.com/xfiberex/ProcessDevKill/releases/tag/v1.4.0
[1.3.2]: https://github.com/xfiberex/ProcessDevKill/releases/tag/v1.3.2
[1.3.1]: https://github.com/xfiberex/ProcessDevKill/releases/tag/v1.3.1
[1.3.0]: https://github.com/xfiberex/ProcessDevKill/releases/tag/v1.3.0
[1.2.0]: https://github.com/xfiberex/ProcessDevKill/releases/tag/v1.2.0
[1.1.1]: https://github.com/xfiberex/ProcessDevKill/releases/tag/v1.1.1
