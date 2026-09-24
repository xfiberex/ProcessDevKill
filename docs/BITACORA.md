# 📓 Bitácora — ProcessDevKill

> Una entrada por sesión de trabajo, la más reciente arriba. **Es historia, no estado**: lo que
> está vigente hoy vive en [CONTEXT.md](../CONTEXT.md) y lo que falta, en [ROADMAP.md](../ROADMAP.md).
>
> Se separó de CONTEXT.md el 2026-07-27 (Tier 7.7): eran 180 líneas creciendo por sesión dentro del
> documento que alguien abre para saber en qué punto está el proyecto.

---

### 2026-09-24 (noche) — Tier 11, Fase D: consistencia y claridad (v1.7.0)

- **Las siete tareas, hechas y verificadas en vivo**:
  - cabecera común y fija en las cuatro vistas;
  - Ajustes en cinco grupos;
  - «cerrar» como único verbo y «Nuke filtrados» con filtro;
  - servicios parados con su motivo;
  - Kill neutro que se tiñe con la fila;
  - la barra de CPU con suelo de un núcleo;
  - una barra de la selección que flota sin mover las filas (0 px, medido).
- **axe encontró dos cosas que la fase había roto.** El Historial se quedó sin nada enfocable dentro
  del scroll al subir «Vaciar» a la cabecera: con teclado no se podía desplazar. Y el «✕» en negrita
  de «Al cerrar la ventana» era un texto solo de símbolos. Arreglados: axe queda en cero violaciones
  y cero incompletos en las cuatro vistas, los dos temas, con la selección y con una fila bajo el
  puntero.
- **Un tropiezo de la verificación**: Vite no recargó el catálogo de textos en caliente y la primera
  medida seguía con los textos viejos. Recargando la página, bien. 278 pruebas del frontend.

### 2026-09-24 (noche) — Modo administrador

- **Pedido por el usuario: que la app diga cuándo no corre como administrador, y que se pueda
  pedir.** Un aviso en el hueco del sidebar, una sección en Ajustes con el estado, «Reiniciar como
  administrador» y «Iniciar siempre como administrador» (apagado de fábrica), y la pista en un Kill
  que falla sin elevar.
- **Probarlo pidió lanzar la app de-elevada**: la terminal de la sesión es elevada, y todo lo que
  lanza también. Con `explorer.exe <exe>` la app hereda el token sin elevar del escritorio. Así se
  vio lo que el aviso promete: todos los `node` sin script ni carpeta y el Kill de uno de prueba
  fallando; elevada, las dos cosas funcionan.
- **El primer aviso no cabía**: 116 px en un hueco de 98, y la navegación hacía scroll a 1000×680.
  Ahora mide 80, se queda en el título entre 620 y 679 px de alto y desaparece por debajo.
- El reinicio se probó desde la instancia elevada, donde `runas` no pide UAC: la nueva espera a que
  la vieja termine y queda una sola. **El camino con UAC queda por probar a mano.** 265 pruebas del
  frontend y 117 del backend.

### 2026-09-24 (tarde) — Tier 11, Fase C: maquetación (v1.6.2)

- **Las cuatro tareas, hechas y medidas en vivo**, sin publicar todavía. La tabla de procesos va con
  anchos fijos: 0 px de salto entre refrescos, ocupa justo su contenedor a 1000 y a 900 px, y un
  nombre largo se trunca. Los rótulos numéricos quedan a 0 px de sus cifras. El sidebar cabe a 480
  px de alto con los filtros desplegados: pide 469. Y el diálogo de cambiar el arranque tiene mensaje,
  aviso en recuadro y nota, con el nombre sin partir y en rojo solo si deshabilita.
- **Medir antes de fijar anchos cambió el plan.** Con la barra de uso al lado de la cifra, las
  columnas fijas se comían 612 px y al nombre le quedaban 65 en la ventana mínima. La barra pasó
  debajo de la cifra, y la fila no crece porque la segunda línea del nombre ya ocupaba ese alto.
- **El primer intento de medir los anchos daba de más**: los clones de las celdas se colgaban de
  `body` y perdían el `text-sm` y el `text-xs uppercase` que heredan de la tabla. Medidos dentro de
  su propia fila, salieron bien.
- **El diálogo se abrió siempre desde el desplegable y se cerró con Cancelar**, en los dos tonos y
  los dos temas, y ningún arranque cambió. En la primera captura la negrita del aviso no se
  distinguía, porque el recuadro iba entero en blanco: pasó al gris de la descripción. axe, en cero
  en las cuatro vistas y en el diálogo. 255 pruebas del frontend.
- **Publicada como v1.6.2** tras la CI en verde y el dry run sobre el mismo commit. Descargado
  el instalador, su hash coincide con el `.sha256` publicado (`2fa0564a…`).

### 2026-09-24 — Tier 11, Fase B: accesibilidad medida (v1.6.1)

- **axe pasa de varias violaciones a cero, en las cuatro vistas y los dos temas**, con las mismas
  reglas de la auditoría y sin resultados incompletos. Lo que axe no mide —bordes y anillos de
  foco— se volvió a medir en vivo con el script de la auditoría: bordes a 3,59 y 3,93:1 (antes
  1,26 y 1,74) y anillos opacos a 4,76 y 7,13:1.
- **El primer resultado del anillo daba 1:1, y era el script.** Leía la primera capa del
  `box-shadow`, que Tailwind deja transparente; leyendo el valor computado entero, el anillo estaba
  bien. Es el mismo tropiezo que ya se vio en la auditoría y conviene no volver a creérselo.
- Dos tokens nuevos (`--control` y `--destructive-text`) en vez de oscurecer los que había: los dos
  que fallaban también pintaban cosas que ya pasaban. Queda en CLAUDE.md que al regenerar un
  componente de shadcn hay que repetir el cambio.
- **La casilla de «Seleccionar todos» no creció**: WCAG admite 16 px con espacio alrededor, y el
  espacio se sacó de dentro del botón vecino. La tabla no gana ni un píxel.
- Idioma, Tema, la combinación del atajo y el Auto-refresco pasan a un control segmentado que es un
  `radiogroup` de verdad. Kill se anuncia «Kill node.exe, PID …» y el recuento del buscador ya se
  lee entero. 249 pruebas del frontend.

### 2026-09-23 (noche) — Tier 11, Fase A: que no se cierre lo que no se quería (v1.6.0)

- **Las seis tareas de la fase de riesgo, hechas y verificadas.** El atajo global viene apagado,
  con la combinación elegible y **dos pulsaciones**; cada fila dice su script y su carpeta;
  procesos protegidos que nada cierra; el tipo de arranque ya no cambia con una flecha; el orden de
  la tabla se congela bajo el puntero; y «Matar proceso» pasa al final del menú. Las decisiones, en
  CONTEXT §4 con fecha de hoy.
- **La verificación en vivo encontró dos fallos míos antes de publicar.** Los lanzadores de npm
  llaman a `node_modules\.bin\..\vite\bin\vite.js`, y sin resolver el `..` el Vite y el CLI de
  Tauri de la propia sesión salían como `.bin`. Y la segunda línea más larga
  (`@colbymchenry/codegraph-win32-x64 · ProcessDevKill`) sacaba la tabla de la ventana a 1000 px,
  porque en una tabla automática `truncate` empuja en vez de recortar. Arreglados y medidos: tabla
  y contenedor, 777 px los dos.
- **El `Select` de Base UI también cambia el valor con una letra**, con la lista cerrada, igual que
  el nativo. Pasarse a él no bastaba: solo se acepta el cambio que viene de elegir una entrada.
- **`shadcn add select` metió un paquete ajeno.** El archivo generado importaba `cn` desde el
  paquete de npm `cn` —y lo instaló como dependencia— en vez de `@/lib/utils`. Se desinstaló y se
  corrigió el import antes de seguir: una dependencia de producción que nadie pidió es justo lo que
  una auditoría de la cadena de suministro no quiere encontrarse.
- `lib.rs` baja a 406 líneas: el atajo global sale a `hotkey.rs`. Pruebas: 112 de Rust y 245 del
  frontend. **No se pulsó el atajo de verdad**, porque dispararlo cierra los procesos reales del
  equipo, ni se protegió nada en vivo, para no escribir en el `settings.json` del usuario.

### 2026-09-23 — Auditoría de UX/UI, y la CI que se había descartado

- **Auditoría de UX/UI sobre la v1.5.3, con la app en marcha** (`tauri dev` por CDP y datos reales
  del equipo): axe-core 4.13 en las cuatro vistas y los dos temas, contraste de bordes y foco
  compuesto con los colores del WebView, y capturas a 1000×680 y 900×480. Queda como el
  [Tier 11](../ROADMAP.md) del roadmap, sin empezar. No se pulsó ningún Kill ni se guardó ningún
  ajuste: el tema se cambió con la clase del DOM, y el puerto de depuración se quitó después.
- **Lo que más pesa salió probando, no leyendo:** un `<select>` nativo dispara `change` con cada
  flecha, así que el tipo de arranque de un servicio se confirma con la primera; y el menú
  contextual **sí** se abre con Shift+F10, al contrario de lo que decían el ROADMAP y CONTEXT.
- **Se revoca T4-04: hay CI en GitHub Actions**, ahora que el repositorio es público.
  `.github/workflows/ci.yml` repite las comprobaciones de `release.ps1` en `windows-latest` y las
  auditorías en Ubuntu, también cada lunes. El corte sigue siendo local.
- **La primera ejecución encontró algo real.** Las pruebas, el lint y el build pasaron a la primera
  en `windows-latest`, pero `cargo audit` paró en **RUSTSEC-2026-0285** (`rustls` 0.23.42, publicada
  el 2026-09-14): el próximo `release.ps1` habría abortado igual. `cargo update -p rustls` a secas
  se quedó en la 0.23.43; la 0.23.45 pedía subir también `aws-lc-rs`, `aws-lc-sys` y
  `rustls-webpki`, y hubo que pedirla con `--precise`. Comprobado en local antes de subirlo:
  auditoría limpia, clippy sin avisos y 93 pruebas de Rust en verde.

### 2026-08-23 — El botón de apoyar, que solo existía para GitHub

- **`.github/FUNDING.yml` estaba desde el 2026-07-25 y no se veía en la app.** Ese archivo lo lee
  GitHub para pintar su botón de patrocinio **en la página del repositorio**, y quien instala la
  app no pasa por ahí. Ahora hay un botón en Ajustes → Acerca de, con el mismo destino.
- **El enlace vive en dos sitios y nada los ata.** Queda dicho en el comentario de
  `abrirApoyo` y en la prueba: si cambia, se cambia en los dos.
- **La prueba mira la URL exacta, no que se llame a `openUrl`.** Un enlace de dinero equivocado
  no falla por ningún lado —abre el navegador igual— y el usuario acaba pagando a otro.
- Debajo del botón va una línea que dice que la app es gratis y que apoyarla no desbloquea nada:
  un botón de pago sin eso invita a preguntarse qué se está comprando.

### 2026-08-23 — El desplegable del tema oscuro, y la flecha pegada al borde

- **La lista del `select` salía blanca en oscuro, y la flecha pegada al borde. Se arregló mal dos
  veces antes de acertar**, y las dos por lo mismo: comprobar que el CSS llegaba al DOM y dar por
  hecho el efecto. El depurador confirmaba `color-scheme: dark` y `padding-right: 12px` computados
  en la ventana, y aun así no cambiaba nada en pantalla. Lo que faltaba mirar era el resultado.
- **Lo que pinta la lista es el `background-color` del control**, no las variables del tema.
  `color-scheme` es correcto y se queda —vale para las barras de scroll y el resto de controles
  nativos— pero con `bg-transparent` el navegador seguía pintando la lista blanca, y encima el texto
  heredado de `--foreground`, casi blanco en oscuro. Con `bg-card` queda resuelto en los dos temas.
- **Chromium ignora `padding-right` para la flecha nativa**: la dibuja contra el borde de la caja.
  La única forma de colocarla es `appearance-none` y poner la nuestra, el `ChevronDownIcon` de
  lucide, con `pointer-events-none` para que el clic siga llegando al `select`. Con la flecha propia
  el hueco lo decidimos nosotros (`pr-7`) y la columna se queda en 200: texto 133,3 de 138.
- **Ninguna de las dos cosas se puede capturar por CDP**: la lista desplegada es una ventana del
  sistema, como los toast de Windows. La confirmación final fue del usuario, con las dos capturas.
- **Y en una de esas capturas se vio un texto obsoleto** de antes de la Fase C: «El tipo de arranque
  todavía no se puede cambiar desde aquí», con la columna que lo cambia justo debajo. En los dos idiomas.
- **Verificado sin cerrar la app del usuario.** `tauri dev` se salía solo: el plugin de instancia
  única cede a la que ya está abierta, y la que corría era la instalada. Se midió sobre el CSS ya
  construido en un Edge sin cabeza —el mismo motor que WebView2— en vez de cerrarle la ventana.

### 2026-08-23 — Repaso de la documentación antes de cortar la 1.5.1

- **El backlog de la auditoría sale de ROADMAP.md a `docs/REVISION-2026-08-18.md`.** Eran 834 líneas
  —el 40 % del archivo— de trabajo ya cerrado dentro del documento que uno abre para ver el plan por
  fases. **Revoca una decisión escrita del 2026-08-18**, y por el mismo criterio que la sostenía:
  aquella decía que el backlog vivía ahí porque *lo accionable* se mantiene en el ROADMAP; con las
  37 cerradas ya no hay nada accionable. Es lo que llevó la bitácora fuera de CONTEXT.md el
  2026-07-27. Queda anotado en CONTEXT §4 con su fecha, como pide la convención. ROADMAP: 2074 → 1267.
- **La tabla de decisiones de CONTEXT §4 estaba partida en dos por una línea en blanco**, y el
  segundo bloque se había quedado sin cabecera: 118 de las 129 filas se renderizaban como texto con
  barras, no como tabla. Nadie lo había visto porque el archivo se lee casi siempre en crudo.
- **La firma Authenticode figuraba a la vez como decidida (§4) y como pendiente (§5).** Se quita de
  pendientes: está descartada desde el 2026-08-18, y `release.ps1` y el README ya lo decían. Tenerla
  en las dos listas era el peor de los dos sitios.
- Fuera también el aviso de «hay trabajo en `main` sin publicar», que la v1.5.0 dejó falso, y las
  cuatro pendientes tachadas que obligaban a leer la lista entera para encontrar las dos vivas.
- **README:** la tabla de estructura seguía diciendo que `lib.rs` tiene los comandos y no mencionaba
  `commands`, `services`, `service_control` ni `textos`. Y la sección de privacidad no decía que la
  app pregunta al SCM ni —lo más importante— **cómo eleva**: relanzando su propio ejecutable para
  una llamada, nunca la app entera. Eso, en una sección que empieza con «conviene decir en voz
  alta», faltaba.

### 2026-08-23 — El panel de servicios desbordaba a lo ancho, y se vio en una captura

- **Lo destapó una captura del usuario, no una prueba.** El panel había crecido hasta seis columnas
  con las fases B y C, y en la ventana de fábrica ya no cabía: aparecía barra de scroll horizontal
  y arrastraba la página entera —cabecera, descripción y **la columna del nombre**, que es lo que
  identifica cada fila—. En la captura no se leía qué servicio era cada uno.
- **Causa doble.** La tabla era de ancho automático, así que la celda del nombre —con
  `MSSQLFDLauncher$SQLEXPRESS` y su nombre visible localizado, más de 45 caracteres— *empujaba* en
  vez de truncar; y el contenedor de `App.tsx` solo controla el eje Y (`overflow-y-auto`), así que
  el sobrante en X se escapaba al documento. La tabla pedía unos 980 px cuando en la ventana mínima
  (900, menos 208 de barra lateral) hay 692.
- **Arreglo:** `table-fixed` con anchos declarados por columna. Lo que sobra se trunca, con los dos
  nombres en el `title`, y el nombre corto —la clave— se ve siempre.
- **Dos anchos los fallé estimando, y se vieron en la siguiente captura:** la RAM partía «123 MB» en
  dos líneas y el desplegable cortaba «Automático (retrasa». La segunda vez se midieron en la
  ventana en marcha con `measureText` y la fuente real del control: 129 px de texto + 20 de flecha
  + 16 de relleno + 24 de celda = 192. **Un `select` nativo no pone puntos suspensivos**: corta la
  palabra a media letra, así que aquí no hay margen para aproximar.
- De paso, tres cosas que la captura dejó ver: el desplegable llevaba el anillo de foco **blanco por
  defecto del navegador** en vez del de la casa; el texto de `Manual` y `Deshabilitado` iba en
  `muted`, lo que los hacía parecer deshabilitados sin estarlo —ahora lo que arranca solo se
  distingue por el **peso**, no por quitarle contraste al resto—; y el motivo de los guiones vivía
  solo en un `title`, que quien navega con teclado no alcanza nunca.

### 2026-08-23 — `lib.rs` se parte por tercera vez: nace `commands.rs`

- La regla de CLAUDE.md dice que al pasar de ~450 líneas de código hay que partirlo, y con el
  Tier 10 cerrado iba por **566**. Es la tercera vez: las otras fueron el Tier 4 y el Tier 7.6.
- **Se van los comandos**, que son lo que más crece —cada funcionalidad de cara al usuario añade
  uno—, y se queda el arranque y `AppState`, que es lo que de verdad describe a `lib.rs`. Queda en
  **445**, y `commands.rs` en 144.
- **No se llevó todos los comandos, a propósito.** Los de servicios siguen en `service_control.rs`
  junto a su guardia, los del actualizador en `update.rs` y los del log en `logging.rs`: agrupar
  por «es un comando» habría separado cada uno de la lógica y de las comprobaciones que le dan
  sentido. El nombre por IPC lo da el último segmento de la ruta registrada, así que el frontend no
  se enteró de nada — ni una línea de TypeScript cambió.
- Refactor puro, sin cambio de comportamiento: las mismas 93 pruebas de Rust en verde antes y
  después, y clippy limpio.

### 2026-08-23 — Tier 10, Fase C: el tipo de arranque, con deshacer

- **Hecha y verificada sobre el binario de release, y con ella se cierra el Tier 10.** Un verbo más
  en el proceso elevado (`startup`), `ChangeServiceConfigW` con `SERVICE_CHANGE_CONFIG` y
  `SERVICE_NO_CHANGE` en todo lo demás. 5 pruebas nuevas de Rust (93) y 6 del frontend (217).
- **Cuatro tipos, y `boot` y `system` no están.** Son de controladores que carga el núcleo antes de
  que exista el escritorio. El proceso elevado valida **también** el tipo, no solo el nombre: es el
  segundo argumento que le llega de fuera, y un nombre vigilado con un tipo mal elegido sería una
  forma de dejar un equipo sin arrancar.
- **El registro guarda el original, no el historial.** Una entrada por servicio, con el valor de
  antes de que la app lo tocara la primera vez, y **se borra al volver a él**. Guardando cada paso
  haría falta deshacer tres veces para desandar tres cambios; así, deshacer y volver a ponerlo son
  el mismo camino y la sección desaparece sola cuando ya no hay nada que deshacer.
- **La trampa técnica: los dos «Automático» son el mismo valor para el SCM.** El retraso vive en
  otra estructura, así que hay que escribirlo con una segunda llamada y **siempre**, también
  cuando toca ponerlo en `false`. Sin eso, pasar un servicio de retrasado a automático normal no
  cambiaría nada visible y la app reportaría un cambio que no ocurrió. Comprobado en los dos
  sentidos: `DelayedAutoStart` sube a `True` y vuelve a bajar.
- **Verificado entero sobre `MySQL80`**, que era `Manual`: a `Deshabilitado`, a `Automático` —y el
  registro seguía diciendo `from: manual`, que es la decisión de diseño que importa—, a retrasado y
  de vuelta, y por último Deshacer, que lo devolvió a `Manual` y dejó el registro en `[]`.
- **Un fallo de texto mío que solo se ve probando en vivo:** el diálogo de deshacer decía «queda
  anotado abajo para poder deshacerlo», y al deshacer pasa lo contrario — la entrada se va.
  Prometer un registro que no va a existir es pequeño, pero es exactamente la clase de frase que
  enseña al usuario a no leer los avisos. Tiene ya su propio aviso.
- Y una cosa que se vio de rebote: con la app **elevada**, la columna de RAM enseña cifras, y
  `postgresql-x64-17` marca 107 MB — el árbol entero, no los 7,7 MB de su PID suelto. Confirma
  desde dentro de la app las dos cosas que se midieron por fuera esta misma mañana.

### 2026-08-23 — Tier 10, Fase B: arrancar y detener, elevando solo la acción

- **Hecha y verificada sobre el binario de release.** La app relanza su propio ejecutable con
  `ShellExecuteExW` y el verbo `runas`, pasándole un verbo y un nombre; ese proceso hace **una**
  llamada al SCM y muere. Vive elevado unos milisegundos, sin ventana, sin IPC y sin estado. 8
  pruebas nuevas de Rust (85) y 6 del frontend (211).
- **Módulo aparte a propósito.** Todo lo que eleva está en `service_control.rs`; `services.rs` sigue
  abriendo el SCM con `SC_MANAGER_CONNECT | SC_MANAGER_ENUMERATE_SERVICE` y sigue siendo **incapaz**
  de tocar nada. Mezclarlos habría sido perder esa garantía a cambio de nada: al de solo lectura lo
  llama el poller, la ventana y el catálogo entero del SCM.
- **La guardia va dentro del proceso elevado**, y es lo que más importa de la fase. El hijo revalida
  el nombre que recibe contra el catálogo de fábrica más los `customServices` que **relee del
  disco**. Si aceptara una lista de permitidos por parámetro, sería la guardia validándose contra su
  propia entrada; y sin guardia, cualquier programa del equipo podría lanzar
  `processdevkill.exe --service-action stop <lo que sea>` y conseguir que el UAC enseñara el nombre
  y el icono de *esta* app para detener un servicio del sistema.
- **Comprobada contra el binario de verdad, no solo en las pruebas:** `wuauserv`,
  `TrustedInstaller`, `GameInputRedistService` y `MSSQLSERVER2` devuelven el código 2 y siguen
  corriendo.
- **Nada de cascada.** Windows se niega a detener un servicio con dependientes vivos, y la tentación
  era que el hijo los detuviera también, como hace `services.msc`. Se descartó: serían servicios que
  nunca pasaron por la guardia ni por el diálogo. Se enseñan sus nombres —con
  `EnumDependentServicesW` filtrando por `SERVICE_ACTIVE`, **antes** de que salga el UAC— y se dice
  que hay que detener esos primero.
- **El resultado se lee, no se supone.** `ControlService` vuelve en cuanto el SCM acepta el encargo:
  se vio en vivo, arrancando `MySQL80` desde la consola y encontrándolo en `StartPending`. Por eso
  el padre sondea `QueryServiceStatusEx` cada 250 ms hasta diez segundos y existe un `pending` que
  no es ni éxito ni fallo.
- **Verificado en los dos sentidos sobre el release.** Con la app **elevada** —donde `runas` no saca
  UAC— el camino entero: arrancar `MySQL80` lo dejó en `Corriendo` con 3306 y 33060, y detenerlo
  sacó el diálogo, el toast y lo devolvió a `Parado / Manual`. Con la app **sin elevar**, el UAC
  aparece al instante y la columna de RAM vuelve a «—»: el mismo binario, y la prueba de que ese
  guion es el permiso y nada más.
- **Lo que NO se pudo ver en vivo, y queda dicho:** el caso `blocked`. Ningún servicio de desarrollo
  de este equipo tiene un dependiente en marcha —`SQLAgent$SQLEXPRESS` está deshabilitado—, y
  forzar uno pedía cambiar un tipo de arranque, que es justo lo que la fase C todavía no hace. Está
  cubierto por el mapeo de `ERROR_DEPENDENT_SERVICES_RUNNING` y por su prueba, pero no visto.
- Un arreglo que salió solo: `services.rs` gana `read_state` y `dependents`, y `enumerar` deja de
  traducir a mano el estado bruto —ahora lo hace `estado_de`, que comparten los dos—.

### 2026-08-22 — Tier 10, Fase A: el panel de servicios, de solo lectura

- **Hecha y verificada sobre el binario de release.** El panel lista los servicios de desarrollo del
  equipo con su estado, su tipo de arranque, su RAM y **el puerto que ocupa cada uno**. 10 pruebas
  nuevas de Rust (77 en total) y 11 del frontend (205).
- **No puede tocar nada, y no por disciplina sino por construcción**: el SCM se abre con
  `SC_MANAGER_CONNECT | SC_MANAGER_ENUMERATE_SERVICE` y con esos dos derechos no hay forma de
  arrancar ni detener un servicio. Arrancar y detener llegan en la Fase B, con elevación puntual.
- **El árbol de procesos era necesario de verdad, no una precaución.** El SCM dice que
  `postgresql-x64-17` es el PID del `pg_ctl.exe`; quien escucha en el puerto es el `postgres.exe`
  que cuelga de él. Con el PID del servicio saldrían 0 puertos; con el árbol salen los correctos.
- **Descubierto construyendo: la RAM de un servicio no se lee sin ser administrador.** `sysinfo`
  devolvía 0 para todos, así que se probó a abrirlos a mano con
  `OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION)` —el derecho más permisivo— y contestó **acceso
  denegado**. Medido: de 327 procesos, 168 dejan leer su memoria; los 53 del propio usuario, todos.
  `memory_mb` pasó a `Option<f64>` y la columna pinta «—» con su explicación en el `title`. **Un
  «0 MB» junto a un SQL Server corriendo es una cifra que el usuario se cree, y es falsa.**
  Rellenarla pediría `NtQuerySystemInformation`, que Microsoft se reserva el derecho a cambiar; no
  se añade eso por una columna de conveniencia.
  **Comprobado después en los dos sentidos, con la consola ya elevada:** la misma llamada lee los
  mismos PIDs sin problema (`MSSQL$SQLEXPRESS` 124,4 MB, `SQLTELEMETRY$SQLEXPRESS` 53,4 MB). Era el
  permiso y nada más, así que el `title` puede afirmarlo en vez de insinuarlo. De regalo, la prueba
  de que el árbol también hace falta para la RAM: `postgresql-x64-17` da 7,7 MB por su PID —el
  `pg_ctl.exe`— y 107,3 MB sumando sus 9 procesos.
- **La prueba negativa tenía un caso real esperando.** Al explorar la idea se filtraron los servicios
  con un `-match` que incluía `Redis` y apareció **`GameInputRedistService`**: «Redist» contiene
  «Redis». De ahí que los patrones sean de cuatro clases explícitas y **ninguna sea «contiene»**.
- **Dos cosas que aparecieron al integrar, y que eran fallos de verdad:**
  - Dos botones «Añadir» con el mismo nombre accesible —procesos y servicios—. Cinco pruebas dejaron
    de saber cuál pulsar, que es la misma duda que tendría un lector de pantalla. Arreglado con
    `aria-label`, no esquivado en las pruebas.
  - `App.test.tsx` tenía **un duplicado a mano de los ajustes** al que ya le faltaban `closeToTray`
    y `language` desde antes; al aparecer `customServices` reventaron cinco pruebas de golpe. Ahora
    parte de `DEFAULT_TEST_SETTINGS`, que está tipado como `Settings`.
- Y un tropiezo mío que conviene dejar escrito: intenté capturar la ventana con
  `Graphics.CopyFromScreen` y `SetForegroundWindow`, que Windows bloquea desde un proceso en segundo
  plano. **La captura salió de otra ventana, con contenido personal del usuario.** Se borró al
  instante. Para ver la app se usa `Page.captureScreenshot` por CDP, que pinta solo el webview.

### 2026-08-22 — Se abre el Tier 10: los servicios de desarrollo

- **Feature propuesta por el usuario**, y escrita como Tier nuevo en el ROADMAP en vez de como tarea
  del backlog: los `Tn-xx` son deuda encontrada en una revisión, y esto es una fase de desarrollo.
- **Encaja por el eslogan, no por novedad.** El 1433, el 5432 y el 27017 son puertos igual que el
  3000; la app responde «quién ocupa mi puerto» para lo que lanza el usuario y es ciega a lo que
  lanza Windows por él.
- **El argumento salió del propio equipo del usuario**, mirado antes de opinar: **dos PostgreSQL
  `Automatic` y corriendo a la vez**, en 5432 y 5433, más SQL Express y un servicio de telemetría de
  53 MB. Un panel de solo lectura ya habría enseñado eso el primer día.
- **La decisión de fondo es de privilegios, y hay que cerrarla antes de escribir código.** La app
  instala en `currentUser` y nunca eleva. Se recomienda **leer siempre sin privilegios y elevar solo
  al actuar**; elevar la app entera rompería su mejor propiedad —hoy lo peor que puede hacer un
  fallo es cerrar procesos del usuario— y un servicio broker sería desproporcionado.
- **El tipo de arranque persiste, y por eso pide más cuidado que el Auto-Kill**: sería lo primero que
  la app hace que sobrevive a un reinicio y vive fuera de su `settings.json`. Queda escrito que la
  app registrará lo que cambie para deshacerlo y que **nunca lo hará sola**.
- Anotadas tres trampas ya vistas en el equipo: el PID del servicio **no** es el que tiene el puerto
  (postgres: servicio 4992, escucha 6672 — el mismo error que costó una medición inválida en T4-03),
  SQL Express **no tiene puerto TCP**, y hay que emparejar por nombre de servicio y no por el
  visible, que está localizado.
- De paso, puesta al día la §3 de CONTEXT, que seguía diciendo «Tiers 1 a 8» y «33 de 37», y el
  índice del backlog, que seguía en 36. **Y queda dicho que hay trabajo en `main` sin publicar**: los
  dos idiomas entraron después de la v1.4.0.

### 2026-08-21 — La app habla dos idiomas, y con esto se cierran las 37

- **T4-01 hecha: español e inglés.** Era la de esfuerzo alto de toda la lista y la última que
  quedaba. Con ella, **0 pendientes de 37**.
- **El idioma llega hasta Rust, y ése era el fondo del asunto.** Hay texto de la app que la ventana
  no pinta —el menú de la bandeja y las notificaciones de Windows—, y resulta ser **lo único que se
  ve cuando la app corre escondida**. Traducir solo el frontend habría traducido justo la mitad que
  ya se entendía. De ahí `src-tauri/src/textos.rs` además de `src/i18n.tsx`.
- **En los dos lados, una clave sin traducir no compila.** En TypeScript `Catalogo` es literalmente
  `typeof es` y `en` se declara de ese tipo; en Rust `Textos` es un `struct` con una constante por
  idioma. Un mapa de claves habría dado `undefined`/`None` en tiempo de ejecución.
- **Las frases con número son funciones, no plantillas, y no por elegancia.** Los dos idiomas no
  ordenan igual: «3 procesos Node cerrados» mete el runtime entre el sustantivo y el participio, y
  «3 Node processes closed» lo pone delante. Una plantilla con huecos habría dado «3 processes Node
  closed». `closed_sentence` se rehízo con una firma semántica —`runtime: Option<&str>`,
  `con_atajo: bool`— en vez de los huecos de texto que tenía, porque con dos idiomas la bandeja
  habría tenido que saber decir «con Ctrl+Alt+K» en inglés.
- **El texto con énfasis viaja marcado (`**negrita**`, `` `código` ``) y lo resuelve `Marcado`.**
  Guardar JSX en el catálogo obligaba a escribir cada párrafo con su marcado dos veces, una por
  idioma. Los `<strong>` de esta app no son adorno: llevan «sin pedir confirmación» y «Ningún
  proceso se ha cerrado».
- **Las 175 pruebas que ya existían pasan sin tocar una sola aserción.** El español se copió
  carácter a carácter y el contexto arranca con el catálogo español, así que un componente
  renderizado suelto sigue hablando español. Era la condición de partida.
- **La prueba que de verdad hacía falta no era la obvia.** Buscar acentos en el catálogo inglés no
  caza «Historial» copiado tal cual —no lleva acento—: se comprobó con una mutación y pasaba. Hizo
  falta comparar entrada por entrada y **escribir a mano las 16 que coinciden con motivo** (siglas,
  nombres de producto, lo que ya estaba en inglés). Con eso, la mutación falla.
- **Verificado en vivo sobre el binario de release**, que era lo único que podía cerrar esto:
  - La ventana entera cambia al pulsar «English», con la app abierta.
  - **El menú de la bandeja se retraduce en caliente.** Leído del `HMENU` real —clic derecho de
    verdad sobre el icono, `MN_GETHMENU` y `GetMenuString`—, mismo PID: antes «Cerrar todos los
    Node», después «Close all Node». Windows no retraduce un menú solo, así que `save_settings`
    lo rehace cuando cambia el idioma.
  - **La notificación nativa salió en inglés**, confirmado por el usuario. No conseguí leerla por
    automatización: ni `CopyFromScreen` la recoge —eso ya se sabía— ni UI Automation la alcanzó.
  - El `settings.json` que había en el equipo **no tenía el campo `language`** y arrancó en español
    sin perder nada: el `#[serde(default)]` aguantó, que era justo el caso que se quería probar.
- **Lo que se deja sin traducir, y está escrito en el test:** «Off / 2s / 5s», los nombres de
  runtime, las siglas y lo que ya estaba en inglés en la versión española.
- **Queda pendiente una deuda que esto ha empeorado, y se anota para no perderla:** `lib.rs` está
  en **524 líneas de código** sin contar su `mod tests`, y la regla de CLAUDE.md manda partirlo al
  pasar de ~450. Ya iba en 493 antes de esta sesión —o sea que el umbral estaba cruzado de antes— y
  el idioma le ha sumado 31. Partirlo no es parte de T4-01 y habría hinchado un cambio que ya toca
  20 archivos, así que se deja dicho en vez de hacerlo de tapadillo. Sería la tercera vez.
- Un tropiezo del camino: la asignación a la copia del catálogo para `ErrorBoundary` —que vive
  **fuera** del proveedor porque envuelve a `App`— se hacía durante el render y ESLint la paró con
  razón. Pasó a un efecto; el desfase no importa porque en el primer render el idioma es el de
  fábrica, que es el mismo que ya tiene esa copia.

### 2026-08-18 — Las primeras cifras propias, y el bundle que no se divide

- **T4-03: medido.** Hasta ahora nadie había puesto un número al coste de la app. El ciclo del
  poller cuesta **~16 ms en release —el 0,8 % de un núcleo—** con el refresco a 2 s; en *debug* son
  25,6 ms, de los cuales **8,9 son leer la tabla de sockets**. El arranque, 31-152 ms hasta la
  ventana en caliente y 632 ms en frío. Y en 6 minutos en la bandeja (180 ciclos) el proceso de Rust
  pasó de 41,0 a 41,5 MB, o sea nada.
- **La medición vive como pruebas `#[ignore]` que imprimen en vez de afirmar.** Un umbral de tiempo
  en una prueba es inestable por definición y acaba quitándose; aquí lo que hacía falta era la cifra
  para decidir, no una guardia.
- **Dos intentos de medir el arranque hasta la UI pintada fallaron, y por eso no se usan.** El
  handle de ventana aparece antes de que se pinte nada, y esperar a que se aplane la CPU del proceso
  de Rust no sirve: **el JavaScript lo ejecuta el hijo de WebView2**, así que esa CPU no lo captura.
  Dos vueltas seguidas dieron 314 ms y 1235 ms. Queda dicho como limitación en vez de publicar una
  cifra que no significa lo que parece.
- **T4-05: no se divide el bundle**, y ahora con un número detrás. Compilarlo entero cuesta ~12,5 ms
  en frío, y **V8 ni siquiera lo compila entero**: pre-parsea y va compilando cada función cuando se
  llama. El aviso de Vite habla de un coste de descarga que en una app de escritorio con los assets
  embebidos **no existe**.
- **T4-01: el usuario decide hacerla**, con dos idiomas —español e inglés—. Es la de esfuerzo alto
  de toda la lista. Primer paso dado: `Language` en `Settings`, con `#[serde(default)]` para que un
  `settings.json` de una versión anterior se lea sin perder nada.

### 2026-08-18 — T4-02 descartada

- **La firma Authenticode no se va a hacer**, por decisión del usuario. Cerrada con el porqué
  escrito en vez de dejarla abierta: era la única tarea de la lista cuyo obstáculo no era técnico
  —el código está previsto, falta el gasto recurrente del certificado—.
- Anotadas las consecuencias, que es lo que de verdad aporta cerrarla: SmartScreen seguirá avisando
  siempre, y **el `.sha256` deja de ser «el respaldo hasta que haya firma» para ser el mecanismo de
  integridad definitivo**. Eso lo vuelve más importante, no menos.
- Corregido el README, que decía que el plan estaba en el ROADMAP y dejaba la impresión de que la
  firma llegaría en alguna versión próxima.
- Con esto van **34 de 37**, y **dos de las cerradas del Tier 4 lo están por decisión, no por
  trabajo**: no hay CI y no habrá firma. Una tarea que se decide no hacer está tan cerrada como una
  hecha, siempre que quede dicho por qué.

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
- **Actualización en sitio verificada por el usuario**: de la v1.3.2 a la v1.4.0, silenciosa, y el
  registro de avisos visible en Acerca de con su ruta real. **El propio log documenta el salto**
  (`v1.3.2 arrancando` → `v1.4.0 arrancando`), escrito por el binario instalado y no por una
  prueba. De paso confirmó que la `Z` del UTC no era paranoia: `02:32:19Z` fue un `22:32` local.

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
