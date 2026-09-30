# 🚀 Roadmap: ProcessDevKill

> Responde a **qué falta por hacer**. Lo abierto está aquí entero, con su criterio de aceptación;
> lo cerrado, en una línea por Tier y con su detalle en [docs/TIERS-1-11.md](docs/TIERS-1-11.md).
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
| — | [Revisión del 2026-08-18](docs/REVISION-2026-08-18.md): 37 tareas, cerradas | v1.3.2 a v1.5.0 |

---

## 🔍 Tier 12: Re-auditoría completa — 🟡 **abierto el 2026-09-25**
*Objetivo: cerrar lo que encontró la tercera revisión amplia del repositorio, la primera sobre el código de los Tiers 10 y 11 y el modo administrador.*

> **Sale de una re-auditoría del 2026-09-25 sobre la v1.8.0** (HEAD `33e0c20`), con nueve áreas
> acordadas con el usuario: código, seguridad, arquitectura, QA, refactorización, ortografía,
> documentación, DevOps y legal (acotada a licencias y a qué sale del equipo). Quedaron fuera
> rendimiento, accesibilidad y UI/UX —auditadas en el Tier 11 hace dos días— y SEO, que no aplica.
> **Estática y en vivo**: se leyó entero el código propio (~20.000 líneas con pruebas), se pasaron
> ESLint, clippy, las dos suites, la cobertura y las dos auditorías, y se condujo el **binario de
> release** por CDP —CSP servido, consola, superficie IPC, la interfaz en inglés, lo desplegado—.
> **No se pulsó ningún Kill, Nuke All, Arrancar ni Detener, ni se cambió ningún arranque**; el
> idioma se cambió y se devolvió, y `settings.json`, `history.json`, `service-changes.json` y el log
> se restauraron byte a byte al terminar. El informe completo, con problema, impacto y solución de
> cada punto, está en un [artifact](https://claude.ai/artifact/UqPcdMRZ8vRhrFWqJcXmRM); lo
> accionable está aquí.
>
> **Ningún hallazgo crítico ni alto.** Nueve son de severidad media y treinta bajos. Desde el Tier 5
> los Tiers son tandas temáticas, así que la severidad va escrita en cada tarea: una media de la
> fase F pesa lo mismo que una de la A.
>
> Esfuerzo: **bajo** = una sesión corta; **medio** = una sesión larga o dos.

| Fase | Qué | Tareas | Media | Baja | Esfuerzo |
|---|---|---|---|---|---|
| A | Seguridad | 4 | 2 | 2 | 1 medio, 3 bajos |
| B | Código | 10 | 2 | 8 | 2 medios, 8 bajos |
| C | Arquitectura | 3 | 1 | 2 | 1 medio, 2 bajos |
| D | Pruebas | 3 | 0 | 3 | 1 medio, 2 bajos |
| E | DevOps y corte de versión | 8 | 3 | 5 | 8 bajos |
| F | Documentación y legal | 5 | 1 | 4 | 1 medio, 4 bajos |
| G | Redacción | 3 | 0 | 3 | 3 bajos |
| H | Encontrado de paso, fuera del alcance acordado | 3 | 0 | 3 | 3 bajos |
| | **Total** | **39** | **9** | **30** | |

**Nuevos, ya conocidos y cierres en falso.** Treinta y cuatro hallazgos son nuevos. Uno ya era
conocido —el propio `THIRD-PARTY-NOTICES.txt` declara en su «alcance honesto» que no reproduce los
avisos de copyright—, pero no tenía tarea: la tiene en T12-30. Y cuatro son **tareas dadas por
cerradas que no lo estaban del todo**, lo que se dice aquí a propósito:

- **T3-09** (revisión del 2026-08-18) pedía nombre accesible «en el buscador y en el campo de
  ejecutable». El commit que la cerró (`870c8e7`) solo tocó el buscador; la v1.4.0 ya salió sin el
  otro. → T12-37.
- **T2-02**: «las herramientas que faltan avisan, no abortan». Falta `cargo-audit` y el corte
  **aborta**: reproducido en PowerShell 5.1. → T12-21.
- **T3-19**: `-SkipTests` compara el `HEAD`, pero el commit del release incluye lo modificado sin
  commitear. → T12-22.
- **Tier 11 · D4**: «con la app elevada, la RAM que falta dice "no se pudo leer"». El componente lo
  sabe hacer, pero `App.tsx` nunca le pasa si la app está elevada. → T12-07.

### Fase A — Seguridad

- [x] **[T12-01] Que ningún proceso crítico de Windows pueda entrar en la lista de vigilados**
  - **Severidad:** media · **Área:** Seguridad
  - **Ubicación:** `src-tauri/src/processes.rs:285-315` (`classify`), `src-tauri/src/storage.rs:198-223`, `src/components/SettingsView.tsx:232-246`
  - **Qué hacer:** una lista cerrada de ejecutables que la app no vigila aunque se añadan a mano
    (`smss`, `csrss`, `wininit`, `winlogon`, `services`, `lsass`, `lsaiso`, `svchost`, `system`,
    `registry`, `memcompression`, `dwm`, `fontdrvhost`, `sihost`, `explorer`…), aplicada en
    `classify` —por donde pasan las cinco vías— y avisada en Ajustes al intentar añadirlos. Hoy
    `normalize` solo pasa a minúsculas: con `svchost` vigilado, Nuke All y el atajo los cerrarían, y
    con la app elevada (v1.7.0) eso es un pantallazo azul.
  - **Criterio de aceptación:** prueba negativa: con `custom = ["csrss", "svchost", "lsass"]`,
    `classify` devuelve `None` y `kill_many` rechaza un PID de esos; la UI no deja añadirlos.
  - **Esfuerzo:** bajo · **Depende de:** ninguna
  - **Hecho el 2026-09-25.** `CRITICOS` en `processes.rs` (18 nombres, con los tres pseudoprocesos
    que sysinfo nombra con espacio) y su copia `PROCESOS_CRITICOS` en `types.ts`, atadas por
    `types.test.ts`. La prueba de `kill_many` no usa un `svchost` de verdad: lanza **una copia de
    `PING.EXE` renombrada a `svchost.exe`** en una carpeta temporal, para que un fallo de la guardia
    no pudiera cerrar un proceso del sistema. **Con la guardia desactivada, las dos pruebas de Rust
    fallan**: miden lo que tienen que medir. Ajustes rechaza el nombre con un aviso `role="alert"`
    bajo el campo. Probado en las suites, no en vivo.

- [x] **[T12-02] Volver a verificar el instalador justo antes de ejecutarlo**
  - **Severidad:** media · **Área:** Seguridad
  - **Ubicación:** `src-tauri/src/update.rs:379-447`, `:475-481`, `:530-541`
  - **Qué hacer:** el hash se comprueba al descargar, pero entre `download_update` e
    `install_update` —lo que tarde el usuario en pulsar «Instalar»— el `.exe` está en `%TEMP%`,
    escribible por cualquier proceso del usuario. Con la app **elevada**, el instalador se lanza
    elevado: un programa sin privilegios puede cambiarlo y ejecutarse con integridad alta sin UAC.
    Guardar en Rust la ruta y el hash que devolvió la descarga, y en `install_update` abrir el archivo
    sin compartir escritura ni borrado (`share_mode(FILE_SHARE_READ)`), recalcular el hash sobre ese
    handle y lanzar con el handle abierto.
  - **Criterio de aceptación:** prueba que modifica el archivo tras la descarga: `install_update` se
    niega y lo borra. `install_update` no acepta una ruta que no sea la que devolvió la descarga.
  - **Esfuerzo:** medio · **Depende de:** ninguna
  - **Hecho el 2026-09-30.** `DescargaVerificada` (ruta canónica y hash) queda en Rust al terminar la
    descarga, y `preparar_instalacion` es la guardia nueva de `install_update`: exige esa ruta, abre
    el archivo con `share_mode(FILE_SHARE_READ)`, rehace el hash sobre ese handle y lo devuelve para
    que siga abierto hasta después de `CreateProcess`. **Antes de escribirlo se comprobó lo que
    daba por hecho**, con una copia de `PING.EXE`:
    - con el handle abierto, escribir, borrar o renombrar el archivo da error 32, y renombrar su
      carpeta, error 5;
    - el `.exe` se lanza sin problema;
    - **el instalador NSIS real de la v1.8.0**, lanzado sin argumentos con el handle abierto, abre
      su asistente igual: puede leerse a sí mismo y pasar su CRC. Se cerró en la primera página,
      sin instalar nada.

    Las tres pruebas del criterio (cambiado tras la descarga, ruta intrusa, bloqueo mientras dura)
    se vieron fallar quitando cada guardia. En vivo, `install_update` sin descarga previa contesta
    «No hay ninguna descarga verificada que instalar.». **Lo que no se probó:** una actualización
    real de punta a punta con el bloqueo, que llegará con el próximo release.

- [x] **[T12-03] Quitarle a la ventana los permisos que no usa**
  - **Severidad:** baja · **Área:** Seguridad
  - **Ubicación:** `src-tauri/capabilities/default.json:9-10`
  - **Qué hacer:** fuera `notification:default` —verificado en vivo: la ventana puede usar las
    notificaciones, que solo manda Rust— y `global-shortcut:default`, que no concede nada (el atajo
    lo registra Rust). Menos superficie para un script inyectado.
  - **Criterio de aceptación:** `plugin:notification|notify` desde la ventana responde «not allowed
    by ACL», y las notificaciones de la bandeja, el atajo y el Auto-Kill siguen saliendo, probado en
    vivo.
  - **Esfuerzo:** bajo · **Depende de:** ninguna
  - **Hecho el 2026-09-30.** El motivo va en la `description` del propio `default.json`, porque el
    JSON no admite comentarios. Probado en vivo sobre el binario de release:
    - `notification|notify`, `notification|is_permission_granted` y `global-shortcut|is_registered`
      contestan «not allowed by ACL»;
    - `app|version`, que sigue concedido, contesta `1.8.0`: lo que falla es el permiso quitado, no
      el IPC entero.

    **La otra mitad del criterio quedó fuera, y se dice:** ver salir una notificación de Rust exige
    cerrar procesos por la bandeja, el atajo o el Auto-Kill, y las tres vías cerrarían también los
    del usuario. Se apoya en que los permisos de una capability solo filtran el IPC que llega de la
    ventana, y Rust llama al plugin directamente. Queda para la próxima prueba a mano con un release.

- [x] **[T12-04] Que la guardia del proceso elevado no prometa más de lo que hace**
  - **Severidad:** baja · **Área:** Seguridad / Documentación
  - **Ubicación:** `src-tauri/src/service_control.rs:19-30`, `:251-263`, `:617-646`; `CONTEXT.md` §3; `docs/TIERS-1-11.md` (Tier 10, fase B)
  - **Qué hacer:** el hijo elevado relee `customServices` de `settings.json`, que cualquier programa
    del mismo usuario puede escribir: la guardia no frena a «cualquier programa sin privilegios»,
    como dicen los tres sitios. Reescribir lo que sí hace (rechaza nombres que el usuario no añadió y
    los errores propios) y lo que no (un programa que ya corre como el usuario, que además puede
    pedir `runas` sobre binarios firmados por Microsoft). De paso, rechazar `\` y `/` en `vigilado`
    (el SCM no los admite y `\"` rompe el entrecomillado).
  - **Criterio de aceptación:** los tres textos dicen lo mismo y nada más; prueba de `vigilado` con
    `MiMotor\`.
  - **Esfuerzo:** bajo · **Depende de:** ninguna
  - **Hecho el 2026-09-30.** La cabecera de `service_control.rs` cuenta lo que la guardia hace y lo
    que no. CONTEXT y el Tier 10 conservan su texto y llevan debajo la precisión fechada, porque son
    historia. De paso, la cabecera ya no dice que «la app no se eleva nunca», que dejó de ser cierto
    en la v1.7.0. `vigilado` rechaza `\` y `/`. La prueba lo hace con esos nombres **dentro de la
    lista del usuario**, y falla con la guardia vieja.

### Fase B — Código

- [x] **[T12-05] Todo el texto de Rust que llega a la ventana, en `textos.rs`**
  - **Severidad:** media · **Área:** Código / i18n
  - **Ubicación:** `src-tauri/src/processes.rs:604`, `:610`, `:615`, `:625`; `src-tauri/src/update.rs:171-480` (27 mensajes); `src-tauri/src/storage.rs:339`, `:344`; `src-tauri/src/logging.rs:175`, `:179`
  - **Qué hacer:** hay ~35 mensajes en español fijo fuera del catálogo, y llegan a pantalla: el
    toast de un Kill fallido (`App.tsx:577`) y el error del actualizador (`Actualizaciones.tsx:57`).
    Verificado en vivo: con la app en inglés, Rust contesta «El proceso … ya no existe» y «La
    descarga no viene de github.com.». Contradice la regla de CLAUDE.md.
  - **Criterio de aceptación:** con `language: en`, esos dos casos contestan en inglés; una prueba
    recorre los errores en inglés y no encuentra letras del español (como
    `el_catalogo_ingles_no_tiene_letras_del_espanol`).
  - **Esfuerzo:** medio · **Depende de:** ninguna
  - **Hecho el 2026-09-30**, con enums sin frase y no pasando el idioma a cada función:
    - `update::Fallo`, con 30 variantes;
    - `processes::FalloCierre`, con 4, más el idioma en `kill_many`;
    - `storage::FalloGuardado`, con un `Display` en español solo para el log;
    - dos textos de `logging.rs`.

    Las palabras están en `textos.rs`, y los comandos las piden al devolver. `kill_and_record` lee el
    idioma **antes** de bloquear `sys`, para no anidar candados. Las pruebas de `update.rs` que
    buscaban trozos de frase comparan ahora la variante exacta. Dos pruebas nuevas recorren todos los
    fallos: ninguno en inglés tiene letras del español, y ninguno dice lo mismo en los dos idiomas.
    Un `match` exhaustivo impide que una variante nueva se quede fuera de la lista.

    **Probado en vivo** sobre el binario de release: con la app en inglés, el Kill de un PID que no
    existe contesta «Process 4000000001 no longer exists», y la descarga desde otro dominio, «The
    download does not come from github.com.». El detalle técnico que da Windows o `reqwest` sigue en
    su idioma, y no se traduce.

- [x] **[T12-06] Arrancar, detener y cambiar el arranque, fuera del hilo principal**
  - **Severidad:** media · **Área:** Código / Arquitectura
  - **Ubicación:** `src-tauri/src/service_control.rs:284-338`, `:351-414`; `src-tauri/src/commands.rs:118-133`
  - **Qué hacer:** en Tauri 2 un comando síncrono corre en el hilo principal (documentación oficial),
    y estos esperan al UAC, hasta 30 s al hijo y hasta 10 s sondeando: la ventana se congela todo
    ese rato. `restart_as_admin` ya es `async` por eso mismo. Marcar `#[tauri::command(async)]`
    los dos, y también `get_services`, que consulta el SCM.
  - **Criterio de aceptación:** durante una acción sobre un servicio la ventana se mueve y cambia de
    vista, probado en vivo (con la app elevada no hay UAC de por medio).
  - **Esfuerzo:** bajo · **Depende de:** ninguna
  - **Hecho el 2026-09-25**: los tres comandos llevan `#[tauri::command(async)]`. **Probado en vivo
    con el usuario**, sobre el binario de release y MySQL80. Una sonda por CDP lanza
    `control_service` sin esperar la respuesta y, mientras tanto, cronometra `get_settings` cada
    medio segundo:
    - **Con la corrección**, el usuario aprobó el UAC y el servicio se detuvo de verdad. El ciclo
      entero duró 6,8 s, y las 14 muestras contestaron en 1-2 ms.
    - **Sin ella** (los tres atributos quitados y recompilado), pidiendo «Detener» sobre el servicio
      ya detenido para que no pudiera cambiar nada, **todo comando quedó bloqueado 45 s**: el UAC
      más la espera.
  - **Lo que no discriminó, y se dice:** un `SendMessageTimeout(WM_NULL)` a la ventana contestó en
    los dos casos. `ShellExecuteEx` sigue atendiendo los mensajes mientras espera el UAC, así que la
    ventana se podía mover; lo que se congelaba era el IPC. La interfaz no podía hacer nada, ni
    cambiar de vista con datos nuevos. La prueba que cuenta es la del IPC.

- [x] **[T12-07] Pasarle a Servicios si la app está elevada** — *cierre en falso parcial de Tier 11 · D4*
  - **Severidad:** baja · **Área:** Código
  - **Ubicación:** `src/App.tsx:822-832`, `src/components/ServicesView.tsx:376-389`
  - **Qué hacer:** `ServicesView` elige entre «no se pudo leer» y «necesita administrador» según la
    prop `elevated`, pero `App` no se la pasa (sí a `Sidebar` y a `SettingsView`): en producción
    siempre pide administrador, también elevada. La prueba del componente pasa la prop a mano.
  - **Criterio de aceptación:** prueba de `App` con `get_elevation: true` y un servicio corriendo sin
    RAM: su «—» dice «No se pudo leer la RAM de este servicio.».
  - **Esfuerzo:** bajo · **Depende de:** ninguna
  - **Hecho el 2026-09-30**, con una prueba de `App` entera en los dos sentidos (elevada y sin
    elevar). Quitando la prop, el caso elevado falla. No se probó en vivo, porque exige la app
    elevada.

- [ ] **[T12-08] «Protegido» solo cuando de verdad se ha guardado**
  - **Severidad:** baja · **Área:** Código
  - **Ubicación:** `src/App.tsx:471-484`, `:529-542`
  - **Qué hacer:** `protegerFila` enseña el toast de éxito antes de saber si `save_settings` fue
    bien; si falla, salen dos avisos contradictorios y el proceso **no** queda protegido.
    `saveSettings` devuelve si guardó, y el toast espera.
  - **Criterio de aceptación:** prueba con `save_settings` rechazado: no sale «protegido», sí el error.
  - **Esfuerzo:** bajo · **Depende de:** ninguna

- [ ] **[T12-09] La guardia de PID reciclado, con la hora de arranque**
  - **Severidad:** baja · **Área:** Código
  - **Ubicación:** `src-tauri/src/processes.rs:582-627`, `src-tauri/src/lib.rs:218-265`
  - **Qué hacer:** `kill_one` relee el PID y compara solo el **nombre**: un PID reutilizado por otro
    `node.exe` pasa, aunque el comentario diga que «el nombre ya no coincidirá». Comparar también la
    hora de arranque con la de la última lista publicada.
  - **Criterio de aceptación:** prueba con dos procesos del mismo nombre: un PID con otra hora de
    arranque que la de la lista se rechaza.
  - **Esfuerzo:** medio · **Depende de:** ninguna

- [ ] **[T12-10] El script de cada fila, sin tomar el valor de una opción por el script**
  - **Severidad:** baja · **Área:** Código
  - **Ubicación:** `src-tauri/src/processes.rs:121-139`
  - **Qué hacer:** el primer argumento que no empieza por `-` se toma como script, así que
    `node -r ts-node/register app.ts` sale «register» y `python -X utf8 app.py` sale «utf8»: la
    etiqueta equivocada en la columna que existe para no cerrar a ciegas (Tier 11 · A2). Saltar el
    valor de las opciones que lo llevan (`-r`, `--require`, `--import`, `--loader`, `-X`, `-W`…).
  - **Criterio de aceptación:** pruebas de `describe` con esos dos casos devuelven `app.ts` y `app.py`.
  - **Esfuerzo:** bajo · **Depende de:** ninguna
  - **Ojo al cerrarla** (anotado el 2026-09-25, al hacer T12-29): saltar las opciones conocidas no
    cubre una desconocida con su valor aparte (`node --token abc123 server.js` seguiría enseñando
    `abc123`). El README lo avisa en Privacidad; esa frase solo se quita si se resuelve también ese
    caso.

- [ ] **[T12-11] Servicios: filtrar antes de consultar, y sin memoria sin inicializar**
  - **Severidad:** baja · **Área:** Código
  - **Ubicación:** `src-tauri/src/services.rs:429-501`, `:463-464`
  - **Qué hacer:** `enumerar` consulta el tipo de arranque de **cada** servicio de Windows (unos 300,
    con dos o tres llamadas al SCM cada uno) antes de quedarse con los de desarrollo. Filtrar
    primero. Y el buffer se pasa como `&mut [u8]` sobre capacidad sin inicializar, que en Rust es
    comportamiento indefinido aunque hoy no rompa nada: usar un buffer inicializado.
  - **Criterio de aceptación:** `tipo_de_arranque` solo se llama para los que pasan `classify_service`
    (prueba o recuento); ningún `from_raw_parts_mut` sobre memoria sin inicializar.
  - **Esfuerzo:** bajo · **Depende de:** ninguna

- [ ] **[T12-12] Conservar un `settings.json` ilegible antes de pisarlo**
  - **Severidad:** baja · **Área:** Código
  - **Ubicación:** `src-tauri/src/storage.rs:303-314`
  - **Qué hacer:** con un solo campo inválido —una errata a mano, un valor de una versión más nueva—
    se usan los valores de fábrica y el siguiente guardado sobrescribe el original: se pierden los
    vigilados y **los protegidos**. Copiarlo a `settings.json.ilegible-<ms>` y anotarlo en el log.
  - **Criterio de aceptación:** prueba con un campo inválido: tras leer existe la copia con el
    contenido original.
  - **Esfuerzo:** bajo · **Depende de:** ninguna

- [ ] **[T12-13] Escrituras del historial y del registro de servicios, de una en una**
  - **Severidad:** baja · **Área:** Código
  - **Ubicación:** `src-tauri/src/storage.rs:334-346`, `:361-375`, `:392-427`
  - **Qué hacer:** leer-modificar-escribir sin candado, con un `.json.tmp` de nombre fijo: un cierre
    del Auto-Kill (hilo del poller) y uno manual (hilo principal) a la vez pierden entradas. Un
    `Mutex` en `Storage`.
  - **Criterio de aceptación:** prueba con dos hilos añadiendo a la vez: no se pierde ninguna entrada.
  - **Esfuerzo:** bajo · **Depende de:** ninguna

- [ ] **[T12-14] Que un pánico deje rastro en el log**
  - **Severidad:** baja · **Área:** Código / Observabilidad
  - **Ubicación:** `src-tauri/src/lib.rs:318-328`, `:414-415`; `src-tauri/src/ports.rs:15-21`
  - **Qué hacer:** no hay `std::panic::set_hook`, y en release no hay consola: si falla la bandeja
    al arrancar, la app no abre sin dejar línea; si muere el hilo del poller, se quedan congelados la
    lista y el Auto-Kill sin aviso. Un gancho que escriba el pánico en el log. De paso, limitar el
    aviso de puertos ilegibles, que con un fallo persistente saldría cada 2 s y rotaría el log.
  - **Criterio de aceptación:** un pánico provocado en una prueba deja su línea; el aviso repetido
    sale como mucho una vez por minuto.
  - **Esfuerzo:** bajo · **Depende de:** ninguna

### Fase C — Arquitectura

- [ ] **[T12-15] Partir `App.tsx`**
  - **Severidad:** media · **Área:** Arquitectura / Refactorización
  - **Ubicación:** `src/App.tsx` (918 líneas; el Tier 7.6 lo dejó en 367): servicios en `:196-399`, cierres en `:565-659`
  - **Qué hacer:** sacar `useServices` (estado, acciones, dependencias, arranque y deshacer) y los
    cierres (`killMany`, `askNuke`, proteger). Y escribir en CLAUDE.md para `App.tsx` la misma regla
    de tamaño que tiene `lib.rs`.
  - **Criterio de aceptación:** `App.tsx` por debajo de ~450 líneas; las 299 pruebas en verde sin
    tocar aserciones.
  - **Esfuerzo:** medio · **Depende de:** ninguna

- [ ] **[T12-16] `lib.rs`: o arranque y nada más, o la regla dice lo que hay**
  - **Severidad:** baja · **Área:** Arquitectura
  - **Ubicación:** `src-tauri/src/lib.rs:154-265`; `.claude/CLAUDE.md` (sección Backend)
  - **Qué hacer:** CLAUDE.md dice que `lib.rs` es «arranque y `AppState`, y nada más», pero ahí
    viven `kill_and_record`, `read_list`, `publish` y `measure_usage`: el camino de cierre. Llevarlos
    a su módulo o precisar la regla.
  - **Criterio de aceptación:** regla y código coinciden.
  - **Esfuerzo:** bajo · **Depende de:** ninguna

- [ ] **[T12-17] La descarga del instalador, con plazo por lectura y no total**
  - **Severidad:** baja · **Área:** Arquitectura / Resiliencia
  - **Ubicación:** `src-tauri/src/update.rs:166-172`, `:402-434`
  - **Qué hacer:** el cliente lleva `timeout(30 s)`, que en reqwest es un plazo **total** hasta el
    final del cuerpo (documentación oficial), y el instalador son 4.119.125 bytes: por debajo de
    ~1,2 Mbit/s la actualización falla siempre. Para la descarga, `connect_timeout` y
    `read_timeout`; la consulta a la API se queda como está.
  - **Criterio de aceptación:** prueba con el `TcpListener` de la casa mandando en trozos lentos más
    de 30 s en total: la descarga termina.
  - **Esfuerzo:** bajo · **Depende de:** ninguna

### Fase D — Pruebas

- [ ] **[T12-18] Que las pruebas que se saltan en silencio fallen en la CI**
  - **Severidad:** baja · **Área:** QA
  - **Ubicación:** `src-tauri/src/processes.rs:872-875`, `:891-900`, `:966-969`, `:987-992`, `:1190-1193`, `:1517-1520`, `:1537-1542`; `.github/workflows/ci.yml:76-78`; `release.ps1:314-319`
  - **Qué hacer:** la guardia de PID, los protegidos, los puertos del lote y la CPU salen con
    `return` —y cuentan como superadas— si falta `node` o el proceso no llega a verse. Con
    `PDK_EXIGIR_NODE=1` en la CI y en el corte, esas salidas pasan a ser un fallo.
  - **Criterio de aceptación:** con la variable puesta y sin `node` en el PATH, `cargo test` falla.
  - **Esfuerzo:** bajo · **Depende de:** ninguna

- [ ] **[T12-19] Probar la entrada del proceso elevado**
  - **Severidad:** baja · **Área:** QA
  - **Ubicación:** `src-tauri/src/service_control.rs:516-559`, `:761-766`
  - **Qué hacer:** `intercept`, lo primero que ejecuta el proceso con privilegios, lee
    `std::env::args` y no tiene pruebas de sus ramas. Pasarlo a un iterador, como
    `elevation::pid_del_padre`, y probar los argumentos de más y de menos y los verbos desconocidos.
  - **Criterio de aceptación:** una prueba por rama de `intercept`.
  - **Esfuerzo:** bajo · **Depende de:** ninguna

- [ ] **[T12-20] Recuperar la cobertura donde se cierra y se eleva**
  - **Severidad:** baja · **Área:** QA
  - **Ubicación:** `src/App.tsx` (70,91 %), `src/i18n.tsx` (64,92 %), `src/components/SettingsView.tsx` (74,62 %)
  - **Qué hacer:** la cobertura bajó del 89,61 % al **81,41 %** con los Tiers 10 y 11. Cubrir las
    acciones de Servicios de `App`, pintar cada vista en inglés y los caminos de fallo de Ajustes.
  - **Criterio de aceptación:** ≥ 85 % de sentencias en total e `i18n.tsx` ≥ 80 %.
  - **Esfuerzo:** medio · **Depende de:** T12-15

### Fase E — DevOps y corte de versión

- [x] **[T12-21] Que falte `cargo-audit` avise y no aborte** — *regresión de T2-02*
  - **Severidad:** media · **Área:** DevOps
  - **Ubicación:** `release.ps1:341`, `:331-337`, `:271`, `:279`
  - **Qué hacer:** `& cargo audit --version *> $null` con `$ErrorActionPreference = "Stop"` **aborta**
    en PowerShell 5.1 si falta la herramienta (`NativeCommandError`, reproducido aparte): justo lo
    contrario de lo que decidió T2-02. Clippy ni se comprueba: si falta, dice «Clippy encontró
    avisos». Comprobar la presencia con `Invoke-Nativo`, y cambiar igual las redirecciones de las
    líneas 271 y 279.
  - **Criterio de aceptación:** con un PATH sin `cargo-audit` el dry run llega al final con su aviso.
  - **Esfuerzo:** bajo · **Depende de:** ninguna
  - **Hecho el 2026-09-25**, con una función nueva, `Test-Nativo`, para las tres preguntas de
    «¿está?» del script (el repositorio, clippy y cargo-audit) y la preferencia bajada en `ls-remote`. **El
    criterio se probó a medias, y se dice:** en este equipo `cargo-audit` está instalado, y quitarlo
    del PATH sin quitar cargo no se puede (cargo lo busca también en `~/.cargo/bin`). Se probó
    aparte, con el mismo mecanismo: `Test-Nativo cargo @('noexiste-audit','--version')` devuelve 101
    sin abortar, mientras el patrón viejo sobre el mismo comando aborta con `RemoteException`; y el
    dry run entero, con todo presente, llega al final.

- [x] **[T12-22] Árbol limpio de verdad, y el dry run atado al contenido** — *hueco de T3-19*
  - **Severidad:** media · **Área:** DevOps
  - **Ubicación:** `release.ps1:282-292`, `:296-312`, `:445-451`, `:510-521`
  - **Qué hacer:** solo se paran los archivos **sin rastrear**; lo modificado entra en el commit
    «release» por `git add -u`, y `-SkipTests` compara solo el `HEAD`. Se puede publicar código que
    ni el dry run ni la CI vieron. Abortar con cambios rastreados salvo `-AllowDirty`, y que la marca
    del dry run guarde también el hash de `git diff HEAD`.
  - **Criterio de aceptación:** tocar un archivo después del dry run hace que `-SkipTests` se niegue.
  - **Esfuerzo:** bajo · **Depende de:** ninguna
  - **Hecho el 2026-09-25.** La marca guarda en su segunda línea el SHA-256 de `git diff HEAD
    --binary`, escrito con `--output` para que no pase por la tubería de PowerShell; una marca vieja,
    de una sola línea, no vale. Probado con `-DryRun -SkipTests`, que recorre la comprobación sin
    poder publicar: con el mismo código pasa; tras añadir una línea a `format.ts`, se niega; y en un
    clon con un archivo rastreado modificado y sin `-AllowDirty`, el corte para antes de las pruebas.

- [ ] **[T12-23] Las notas del release, desde `CHANGELOG.md`**
  - **Severidad:** baja · **Área:** DevOps
  - **Ubicación:** `release.ps1:79-80`, `:395-426`
  - **Qué hacer:** sin `-NotesFile` se publican notas genéricas. Tomar la sección `## [X.Y.Z]` del
    CHANGELOG, añadirle la tabla de descarga que ya genera el script, y abortar si no existe.
    Escribir sin BOM: `Out-File -Encoding utf8` lo pone en PowerShell 5.1.
  - **Criterio de aceptación:** sin la sección, el dry run aborta; con ella, `--notes-file` es esa
    sección.
  - **Esfuerzo:** bajo · **Depende de:** ninguna

- [ ] **[T12-24] Comprobar lo publicado al terminar el corte**
  - **Severidad:** baja · **Área:** DevOps
  - **Ubicación:** `release.ps1:562-569`
  - **Qué hacer:** lo que CONTEXT §3 repite a mano en cada versión —4 assets, el `tag_name` de la
    API y el instalador descargado contra su `.sha256`— lo hace el script. Esta re-auditoría lo hizo
    para la v1.8.0: coincide (`d3a4dbd7…`).
  - **Criterio de aceptación:** el corte termina con las tres comprobaciones hechas y falla si alguna
    no cuadra.
  - **Esfuerzo:** bajo · **Depende de:** ninguna

- [ ] **[T12-25] El aviso de `THIRD-PARTY-NOTICES.txt`, por contenido y no por fecha**
  - **Severidad:** baja · **Área:** DevOps
  - **Ubicación:** `release.ps1:368-379`
  - **Qué hacer:** compara fechas, y el propio corte toca `package.json` y `Cargo.lock` al subir la
    versión: el aviso salta **siempre** («espurio» en CONTEXT de la v1.5.x a la v1.8.0). Un aviso
    que siempre salta enseña a ignorarlo. Comparar la huella de dependencias y licencias.
  - **Criterio de aceptación:** un corte sin cambios de dependencias no avisa; uno con una crate
    nueva, sí.
  - **Esfuerzo:** bajo · **Depende de:** T12-30

- [ ] **[T12-26] CI: acciones fijadas, toolchain declarado y dependencias vigiladas**
  - **Severidad:** baja · **Área:** DevOps
  - **Ubicación:** `.github/workflows/ci.yml:40-51`, `:86-103`
  - **Qué hacer:** fijar las acciones por SHA, añadir `rust-toolchain.toml` y activar Dependabot
    (npm, cargo y github-actions, solo seguridad). El árbol de desarrollo tiene 7 avisos —2 altos,
    `fast-uri` y `js-yaml`— que por política no mira nadie: un informe no bloqueante en el trabajo
    semanal.
  - **Criterio de aceptación:** ninguna acción por etiqueta, Dependabot activo y el informe semanal
    visible.
  - **Esfuerzo:** bajo · **Depende de:** ninguna

- [x] **[T12-27] La inspección en vivo, sin arrancar elevada con el puerto abierto**
  - **Severidad:** media · **Área:** DevOps / Seguridad del proceso de trabajo
  - **Ubicación:** `tools/capture-screenshots.ps1:365-387`; `.claude/CLAUDE.md:122`
  - **Qué hacer:** con `runAsAdmin` encendido, la build con `--remote-debugging-port` **arranca
    elevada**, y el CDP de `127.0.0.1:9222` no tiene autenticación: cualquier proceso local la
    conduce con privilegios. Pasó en esta re-auditoría —salió un UAC—, y una consola sin elevar no
    puede cerrarla. El script comprueba `runAsAdmin` y se niega antes de abrir el puerto. La trampa
    ya está anotada en CLAUDE.md.
  - **Criterio de aceptación:** con `runAsAdmin: true` el script aborta con un mensaje claro.
  - **Esfuerzo:** bajo · **Depende de:** ninguna
  - **Hecho el 2026-09-30.** Probado con el `settings.json` real del usuario, que lo tiene encendido:
    el script se para antes de tocar `tauri.conf.json` (mismo hash antes y después) y sin lanzar
    nada. El mensaje dice qué ajuste apagar y dónde.

- [ ] **[T12-28] El script de capturas: respaldar los ajustes y no depender del idioma**
  - **Severidad:** baja · **Área:** DevOps
  - **Ubicación:** `tools/capture-screenshots.ps1:432-481`
  - **Qué hacer:** cambia el tema del usuario por la interfaz —guarda `settings.json` de verdad— y lo
    devuelve igual. Si falla a medias, se queda cambiado. Respaldarlo byte a byte y restaurarlo en
    el `finally`, como ya hace con `tauri.conf.json`. Busca los botones por su texto en español: con
    la app en inglés aborta.
  - **Criterio de aceptación:** con la app en inglés las capturas salen, y el `settings.json` final
    es idéntico byte a byte al inicial.
  - **Esfuerzo:** bajo · **Depende de:** ninguna

### Fase F — Documentación y legal

- [x] **[T12-29] La sección de privacidad del README, que diga lo que se lee**
  - **Severidad:** media · **Área:** Legal / Documentación
  - **Ubicación:** `README.md:178-179`; `src-tauri/src/processes.rs:371-391`
  - **Qué hacer:** dice «No lee la línea de comandos», y desde la v1.6.0 la app lee la línea de
    comandos y la carpeta de cada proceso vigilado para enseñar el script y el proyecto. Contar qué
    lee, qué enseña —nunca la línea entera— y que no sale del equipo.
  - **Criterio de aceptación:** el párrafo describe lo que hace el código y no promete nada que no
    cumpla.
  - **Esfuerzo:** bajo · **Depende de:** ninguna
  - **Hecho el 2026-09-25**, contrastado con `describe`, `script_of` y `HistoryEntry`. Al escribirlo
    salió que la primera redacción también prometía de más: «un token pasado por parámetro no
    aparece» es falso (`node --token abc123 server.js` enseña `abc123`), y **T12-10 no lo arregla
    del todo**, porque solo salta las opciones conocidas. El README cuenta la limitación tal cual.

- [ ] **[T12-30] Avisos de terceros generados por herramienta y con los avisos de copyright** — *requiere revisión legal*
  - **Severidad:** baja · **Área:** Legal
  - **Ubicación:** `THIRD-PARTY-NOTICES.txt` (secciones 3 y 4)
  - **Qué hacer:** el archivo reconoce que no reproduce los avisos de copyright de los crates, y MIT,
    BSD-3-Clause, ISC y Unicode-3.0 los piden en una distribución binaria; los textos BSD y Unicode
    van como enlace a spdx.org. Generarlo con `cargo about` o similar, filtrando lo que de verdad va
    en el binario de Windows (326 crates, no los 566 del lockfile).
  - **Criterio de aceptación:** el archivo sale de un comando documentado e incluye licencia y aviso
    de cada componente distribuido.
  - **Esfuerzo:** medio · **Depende de:** ninguna

- [ ] **[T12-31] Poder apagar la comprobación de actualizaciones del arranque**
  - **Severidad:** baja · **Área:** Legal / Producto
  - **Ubicación:** `src/App.tsx:438-469`; `src-tauri/src/storage.rs:82-145`; `src/components/SettingsView.tsx:764-771`
  - **Qué hacer:** cada arranque consulta `api.github.com` (IP y User-Agent con la versión). Está
    dicho en el README y en Ajustes, pero no se puede desactivar. Un ajuste, encendido de fábrica. Si
    hace falta más según la jurisdicción, es cosa de la revisión legal.
  - **Criterio de aceptación:** con el ajuste apagado no sale ninguna petición al arrancar, probado
    en vivo; «Buscar actualizaciones» sigue funcionando.
  - **Esfuerzo:** bajo · **Depende de:** ninguna

- [x] **[T12-32] Documentación y comentarios que se quedaron atrás**
  - **Severidad:** baja · **Área:** Documentación
  - **Ubicación:** `README.md:51`, `:91` («matarlo», «matar»), `:125` («todavía no lo tiene»: la firma no llegará), `:341` (falta `hotkey.rs`), `:379-380` («todas son permisivas»: 5 son MPL-2.0); `CONTEXT.md:15` («macOS después»), `:27-28`, `:167` (la v1.4.0 se publicó el 2026-08-20); `src-tauri/src/services.rs:9-10`, `:236` («el poller lo llama»); `src-tauri/src/update.rs:873` («nada de CI»); `src/App.tsx:44-50`, `:201`; `src-tauri/src/textos.rs:11`; `src/i18n.tsx:843`
  - **Qué hacer:** cada frase, corregida para que diga lo que hay hoy.
  - **Criterio de aceptación:** un grep de cada una ya no la encuentra, y nada contradice CLAUDE.md.
  - **Esfuerzo:** bajo · **Depende de:** ninguna
  - **Hecho el 2026-09-30**, con la reorganización de la documentación: README reescrito y CONTEXT
    §1. En el código, `services.rs` (dos), `update.rs`, `textos.rs` y `App.tsx` (dos). Un grep de
    cada frase ya no la encuentra. **Lo que quedó fuera:** `src/i18n.tsx:843`, que al moverse las
    líneas ya no señala nada reconocible y no se tocó a ciegas; y el «matarlo» de un comentario
    interno de `processes.rs`, que no es texto de cara al usuario.

- [ ] **[T12-33] Decidir y escribir la convención de tildes en los comentarios**
  - **Severidad:** baja · **Área:** Refactorización / Redacción
  - **Ubicación:** `.claude/CLAUDE.md` (Comentarios); `docs/TIERS-1-11.md` (Tier 7.3)
  - **Qué hacer:** el Tier 7.3 dejó los comentarios «sin tildes de forma sistemática», y hoy conviven
    los dos estilos (`textos.rs` y `lib.rs` sin; `service_control.rs` y `elevation.rs` con). Elegir
    uno para lo nuevo y escribirlo en CLAUDE.md, **sin reformatear lo existente**.
  - **Criterio de aceptación:** la convención está en CLAUDE.md.
  - **Esfuerzo:** bajo · **Depende de:** ninguna

### Fase G — Redacción

- [x] **[T12-34] Ortografía y concordancia en los dos catálogos**
  - **Severidad:** baja · **Área:** Ortografía
  - **Ubicación:** `src-tauri/src/textos.rs:49` («encontro»); `src/i18n.tsx:336-337` y `:799-800` (servicio bloqueado); `src/i18n.tsx:103`, `:623` (origen «Ctrl+Alt+K»)
  - **Qué hacer:** «No se encontró». Con varios dependientes, «siguen corriendo A y B» y «A and B are
    still running»: hoy dice «sigue corriendo A, B» e «is still running», la clase de fallo de plural
    que el proyecto ya arregló tres veces. Y el origen del Historial se llama «Ctrl+Alt+K» aunque la
    combinación se elija desde el Tier 11: «Atajo» y «Shortcut».
  - **Criterio de aceptación:** pruebas de la frase con uno y con dos nombres en los dos idiomas, y
    del rótulo del origen.
  - **Esfuerzo:** bajo · **Depende de:** ninguna
  - **Hecho el 2026-09-30.** Los nombres se unen con `Intl.ListFormat` («A y B», «A and B»), y para
    eso `tsconfig` gana `ES2021.Intl` en `lib`, sin cambiar el `target`. El origen `hotkey` sale de
    la lista de «coinciden con motivo» de `i18n.test.tsx`, porque ya no coincide.

- [ ] **[T12-35] Repaso del inglés**
  - **Severidad:** baja · **Área:** Redacción
  - **Ubicación:** `src/i18n.tsx:696`, `:965`, `:991` (rayas y coma a la española), `:956-957` (licence/License), `:827` («closes recorded»), `:715` («neither … nor» con cinco), `:933` («on their own»), `:815`; `src-tauri/src/textos.rs:79-80` («Close all Node»)
  - **Qué hacer:** cada frase, en el inglés que escribiría un nativo y con una sola variante (en-US).
  - **Criterio de aceptación:** las pruebas que fijan esos textos, actualizadas y en verde.
  - **Esfuerzo:** bajo · **Depende de:** ninguna

- [ ] **[T12-36] Las notas del release dentro de la app**
  - **Severidad:** baja · **Área:** Redacción / UI
  - **Ubicación:** `src/components/Actualizaciones.tsx:68-72`
  - **Qué hacer:** se pintan como texto plano, y las publicadas llevan Markdown y `<kbd>`: quien
    actualice desde la v1.8.0 las verá en crudo, y solo en español. O un subconjunto de Markdown sin
    HTML, o un resumen con enlace a la página del release.
  - **Criterio de aceptación:** las notas de la v1.8.0 se leen limpias en la ventana.
  - **Esfuerzo:** bajo · **Depende de:** ninguna

### Fase H — Encontrado de paso, fuera del alcance acordado

> Accesibilidad e i18n de la interfaz no entraban en esta re-auditoría. Estos tres se encontraron
> leyendo el código de otras áreas, y se anotan para no perderlos.

- [x] **[T12-37] Nombre accesible en los campos de vigilados y servicios** — *cierre en falso de T3-09*
  - **Severidad:** baja · **Área:** Accesibilidad
  - **Ubicación:** `src/components/SettingsView.tsx:523-530`, `:571-578`
  - **Qué hacer:** `aria-label` en los dos, como ya lleva el de protegidos (`:626`). T3-09 los pedía y
    solo se hizo el buscador.
  - **Criterio de aceptación:** los dos campos se encuentran por su nombre accesible en las pruebas,
    no por el placeholder.
  - **Esfuerzo:** bajo · **Depende de:** ninguna
  - **Hecho el 2026-09-30.** El nombre es el título de cada sección, como ya hacía el de protegidos.
    Las cinco pruebas que buscaban el campo de procesos por placeholder lo buscan ahora por nombre, y
    el de servicios, que ninguna prueba tocaba, tiene la suya.

- [x] **[T12-38] `<html lang>` que siga al idioma de la app**
  - **Severidad:** baja · **Área:** Accesibilidad / i18n
  - **Ubicación:** `index.html:2`; `src/i18n.tsx:1046-1067`
  - **Qué hacer:** se queda en `es` con la interfaz en inglés (visto en vivo): un lector de pantalla
    lee el inglés con voz española. Una línea en `I18nProvider`.
  - **Criterio de aceptación:** prueba: con `language: en`, `document.documentElement.lang === "en"`.
  - **Esfuerzo:** bajo · **Depende de:** ninguna
  - **Hecho el 2026-09-30**, con la prueba del criterio, y **también en vivo**: cambiando el idioma
    desde Ajustes en el binario de release, `lang` pasa de `es` a `en` y vuelve.

- [ ] **[T12-39] La hora exacta del Historial, en el idioma de la app**
  - **Severidad:** baja · **Área:** i18n
  - **Ubicación:** `src/lib/format.ts:29-31`; `src/components/HistoryView.tsx:133-139`
  - **Qué hacer:** `formatTimestamp` usa el idioma del sistema y la hora relativa el de la app: el
    `title` puede salir en el otro idioma. Pasarle el `locale` del catálogo.
  - **Criterio de aceptación:** prueba con `language: en` y sistema en español: el `title` sale en inglés.
  - **Esfuerzo:** bajo · **Depende de:** ninguna

### Lo que este Tier no propone, y por qué

Decisiones cerradas que la re-auditoría respetó a sabiendas. Solo se reabrirían con un hecho nuevo,
y no ha aparecido ninguno:

- **Firma Authenticode** (T4-02), **dividir el bundle** (T4-05), **pruebas end-to-end sobre la
  ventana o FlaUI** (2026-07-24/25: aquí el equivalente es Vitest y CDP), **foco en la fila de la
  tabla** (2026-07-27), **minisign** (2026-07-26), **publicar desde la CI** (2026-07-24 y 2026-09-23)
  y **detectar el idioma del sistema** (2026-08-21).
- **Elevar la app entera de fábrica, o un servicio broker**: el Tier 10 los descartó, y desde la
  v1.7.0 elevarse es opcional y apagado de fábrica.

Y dos que salen de esta re-auditoría:

- **Nada de canal autenticado ni firma entre la app y su proceso elevado.** UAC no es una frontera
  de seguridad para el mismo usuario: un programa que ya corre como él puede pedir `runas` sobre
  `sc.exe`, firmado por Microsoft. Se corrige lo que se dice (T12-04) en vez de construir una defensa
  que no defiende.
- **La licencia OpenSSL no es un problema.** Se sospechó de `aws-lc-sys`, que llega por reqwest y
  rustls, y se comprobó con `cargo metadata`: la 0.45 ya no incluye esa licencia, y su expresión
  —ISC, Apache-2.0, MIT, BSD-3-Clause— es compatible con la GPLv3.

### Progreso

- **2026-09-25** — Tier abierto con **0 de 39** tareas hechas. Estado de partida, medido ese día:
  299 pruebas del frontend y 117 de Rust (+3 ignoradas) en verde, cobertura del 81,41 %, ESLint y
  clippy limpios, `npm audit --omit=dev` y `cargo audit` sin avisos.
- **2026-09-25 (segunda sesión)** — **4 de 39**: T12-21, T12-22, T12-01 y T12-29. Y luego
  **5 de 39**, con T12-06 probada en vivo con el usuario. 301 pruebas del frontend y 120 de Rust
  (+3 ignoradas) en verde; ESLint, clippy y el dry run entero, limpios.
- **2026-09-30** — **12 de 39**: la tanda de mejoras rápidas, T12-03, T12-04, T12-07, T12-27,
  T12-34, T12-37 y T12-38. 307 pruebas del frontend y 121 de Rust (+3 ignoradas) en verde, y
  ESLint y clippy limpios. Y luego **14 de 39**, con T12-02 y T12-05, dos de los medios: 126 de
  Rust. Y **15 de 39** con T12-32, al reorganizar la documentación: los Tiers 1 a 11 salen a
  `docs/TIERS-1-11.md` y las capturas se regeneran.

---

## 🔎 Revisión 2026-08-18 — cerrada

Auditoría estática del repositorio sobre la v1.3.1, en doce áreas: **37 tareas y ningún hallazgo
crítico**, cerradas las 37 el 2026-08-21. Cuatro se cerraron por decisión o por medición, no
escribiendo código: no habrá firma Authenticode (T4-02), el bundle no se divide porque no compensa
(T4-05), el rendimiento se midió (T4-03) y no había CI (T4-04, **revocada el 2026-09-23**: ver
CONTEXT §4). El detalle, en [docs/REVISION-2026-08-18.md](docs/REVISION-2026-08-18.md).

> **Los numerados se distinguen por el prefijo:** `Tier 4` es un Tier de este documento, `T4-01`
> una tarea de aquella revisión y `T12-01` una del Tier 12.
