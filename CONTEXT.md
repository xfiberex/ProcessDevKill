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
| Publicación | `release.ps1` local + `gh` | Sin CI; ver §4 (2026-07-24) |

## 3. Estado actual

**Tiers 1 a 8 completos y verificados.** El 7 se abrió el 2026-07-27 con una revisión completa del
repositorio sobre la v1.1.1 ya publicada —código, seguridad, rendimiento, estructura, accesibilidad,
responsividad, ortografía y documentación— y se cerró entero el mismo día: seguridad, arreglos
rápidos, ortografía, comportamiento de la ventana y accesibilidad, rendimiento, refactor,
compactación de los documentos y los tres puntos de producto.

Nada de lo que recogía esa revisión era un fallo de funcionamiento —la app hace lo que promete—
**salvo la guardia de rutas de `install_update`**, que se saltaba con un `..`; arreglada en el 7.1.

**Publicado:** **v1.3.2** (2026-08-18), de refuerzo y sin funciones nuevas: cierra el **Tier 1 de la
revisión** —la validación del origen de la descarga y la prueba negativa de la guardia de PID—. 4
assets: instaladores NSIS y MSI con sus `.sha256`. Sin firma de código, así que SmartScreen sigue
avisando. La anterior fue la v1.3.1 (2026-08-14), con la **actualización silenciosa** (`/S /UPDATE
/R`), y antes la v1.3.0 (2026-08-07) con el Tier 8 —el medidor del entorno—. La primera versión
pública fue la v1.1.1.

> Verificado tras publicar, en las cuatro versiones con el mismo criterio: los 4 assets están en el
> release, la API que consulta la app devuelve el `tag_name` correcto, y **el instalador descargado
> del release coincide con el `.sha256` publicado** — la cadena entera que recorre la
> auto-actualización, sobre los archivos reales. Para la v1.3.2, `d4030bb7…`; para la v1.3.1,
> `121b228e…`; para la v1.3.0, `0050ae80…`. En la v1.3.2 se comprobó además que **las URLs reales que
> devuelve la API pasan la guardia nueva**: era lo único que podía romper la actualización entera sin
> notarse hasta el siguiente release.
>
> ⚠️ **La actualización silenciosa por fin se puede verificar de verdad.** No se pudo con la v1.3.1
> porque el instalador lo lanza la app **instalada**: actualizar desde la v1.3.0 aún enseñaba las
> ventanas. Con la v1.3.2 publicada, actualizar desde una v1.3.1 instalada es el primer caso real, y
> queda pendiente de hacerlo.

**Pruebas:** 160 de frontend (Vitest + Testing Library, en jsdom) y 52 de `cargo test`. Las tres
últimas son las guardias del Tier 1 de la revisión, y **las tres se comprobaron con una mutación**:
quitar la guardia, ver fallar el test, restaurarla. Una prueba negativa que nunca se ha visto fallar
no prueba nada.

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
"Off".

El detalle de cada verificación, con su fecha y lo que costó, está en [ROADMAP.md](ROADMAP.md) junto
al tier correspondiente y en la [bitácora](docs/BITACORA.md).

> ⚠️ **La única salvedad que sigue abierta: el último paso de la auto-actualización**, lanzar el
> instalador para que reemplace la app. Todo lo anterior está verificado contra los releases
> publicados: la API responde 200, la elección de assets acierta el `-setup.exe` y su `.sha256` (no
> el del MSI), y el instalador descargado coincide con el hash publicado.
>
> **Desde el 2026-07-28 ya se puede cerrar**, y hasta ahora no se podía: hacía falta un release
> posterior al instalado. Con la v1.2.0 en la calle, basta instalar la **v1.1.1**, abrirla y dejar
> que se actualice sola desde *Ajustes → Actualizaciones*. Es lo único del actualizador que nunca ha
> corrido de principio a fin.


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
| 2026-07-23 | Interruptor para desactivar `Ctrl+Alt+K` (no estaba en el plan) | Dispara un cierre masivo sin confirmación; un atajo global mal pulsado no debería ser irreversible |
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
| 2026-08-18 | **La URL de la descarga se valida sobre la URL parseada, no sobre la cadena** | Tercera guardia de la misma familia que la de PID y la de rutas: `download_update` recibe el `ReleaseInfo` desde la ventana, así que la URL del instalador y la del `.sha256` son entrada del frontend — y verificar un archivo contra un hash que trae el mismo mensaje no verifica nada. **Se compara con `reqwest::Url::parse` y no con `starts_with` sobre el texto**, porque `Url::parse` normaliza los `..` del camino y resuelve la autoridad: sin eso, `…/releases/download/../../../evil.exe` y `https://github.com@malo.example/…` pasaban los dos. Es literalmente el fallo que ya tuvo la guardia de rutas con `Path::starts_with` el 2026-07-27, y por eso las dos están en los tests. Se valida **la URL que se pide, no a dónde acaba llevando**: GitHub redirige las descargas a `objects.githubusercontent.com`, así que exigir que el destino final sea github.com rompería la actualización entera |
| 2026-08-18 | **El backlog de la auditoría vive como una sección de ROADMAP.md, no como documento aparte** | Salió de una revisión completa del repositorio (12 áreas, 36 hallazgos, ninguno crítico) que pedía un ROADMAP por severidad —Tiers 0-4—, mientras que el de aquí son fases de desarrollo ya verificadas a las que apuntan CLAUDE.md y este mismo archivo. Sobrescribirlo habría borrado esa historia; un documento aparte habría abierto un quinto sitio donde mirar, en contra de la regla de «cada cosa vive en uno solo». Se añade al final, sin tocar una línea de los Tiers 1-9. **Los dos numerados se distinguen por el prefijo:** `Tier 4` es una fase, `T4-01` es una tarea del backlog. El informe completo, con problema, impacto y solución de cada punto, está en un [artifact](https://claude.ai/code/artifact/7e41ed95-15a4-4112-9958-71a6255c51ac); lo accionable está en el ROADMAP, que es lo que se mantiene |
| 2026-08-14 | **El instalador se lanza con `/S /UPDATE /R`: la actualización es silenciosa** | Reportado por el usuario probándolo: al pulsar «Instalar» salían dos ventanas seguidas, la del desinstalador de la versión anterior y la del asistente de instalación. Los tres flags son de la plantilla NSIS de Tauri (`installer.nsi`, verificados en el `.nsi` generado en `target/release/nsis/x64/`) y cada uno quita una parte: `/S` el asistente, **`/UPDATE` la desinstalación previa** —la plantilla salta ese paso en modo actualización, y de paso conserva los accesos directos y no reinstala WebView2—, y `/R` vuelve a abrir la app al terminar, vía `RunAsUser`. `/R` **solo se mira en modo silencioso o pasivo**, así que sin `/S` no serviría de nada. No hay carrera con el `app.exit(0)` de `install_update`: el instalador silencioso mata la app él mismo si aún la encuentra viva (`CheckIfAppIsRunning` en `utils.nsh`) |
| 2026-07-25 | El build se lanza con `ProcessStartInfo`, no con `& npm` | **En PowerShell `$env:VAR = ""` borra la variable en vez de dejarla vacía.** Con la clave sin contraseña hay que pasar un `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` vacío; al desaparecer, Tauri decide preguntar por consola y el build **se cuelga indefinidamente sin dar error**. `ProcessStartInfo.Environment` sí admite el valor vacío, y de paso la clave no toca la sesión de quien ejecuta el script |

## 5. Decisiones pendientes

- [x] ~~**Nombre definitivo**~~ → **ProcessDevKill** (2026-07-24).
- [x] ~~Repositorio remoto~~ → <https://github.com/xfiberex/ProcessDevKill> (rama `main`).
- [x] ~~Renombrar el repositorio~~ → hecho el 2026-07-24. GitHub redirige la URL vieja, así que los enlaces ya publicados de la v1.0.0 siguen funcionando. La **carpeta local** conserva el nombre `ProcessVisorDev`; es solo cosmético, pero renombrarla obliga a reabrir el proyecto en el editor.
- [ ] Lista inicial de procesos vigilados por defecto (¿incluir `java`, `deno`, `bun` desde el inicio?).
- [ ] Firma de código (Authenticode): sin ella, Windows sigue enseñando el aviso de SmartScreen, y el actualizador no puede comprobar **quién** publicó el instalador —solo que no se corrompió por el camino—. Cuesta un certificado de pago. El día que lo haya, pasa a ser la comprobación fuerte y el `.sha256` queda de respaldo, como en FormatDiskPro.
- [x] ~~Construir el índice de `codegraph`~~ → hecho el 2026-07-27; `.codegraph/codegraph.db` existe y el servidor responde.

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
